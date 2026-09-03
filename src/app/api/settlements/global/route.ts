import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { computeSelfRelativeBalances } from "@/lib/balances";

const globalSettleSchema = z.object({
    fromPersonId: z.string(),
    toPersonId: z.string(),
    amount: z.number().positive(),
    note: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = globalSettleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { fromPersonId, toPersonId, amount, note } = parsed.data;

    if (fromPersonId === toPersonId) {
        return NextResponse.json(
            { error: "From and to must be different people" },
            { status: 400 }
        );
    }

    const [fromPerson, toPerson] = await Promise.all([
        prisma.person.findUnique({ where: { id: fromPersonId } }),
        prisma.person.findUnique({ where: { id: toPersonId } }),
    ]);
    if (!fromPerson || fromPerson.ownerId !== user.id || !toPerson || toPerson.ownerId !== user.id) {
        return NextResponse.json({ error: "Invalid people" }, { status: 400 });
    }

    // Every workspace where the paying person is a member
    const memberships = await prisma.workspaceMember.findMany({
        where: { personId: fromPersonId, workspace: { ownerId: user.id } },
    });

    // For each, compute how much fromPerson currently owes there, plus the
    // earliest expense date (our proxy for "how old is this debt")
    const candidates: { workspaceId: string; owed: number; oldestDate: Date }[] = [];

    for (const m of memberships) {
        const workspaceId = m.workspaceId;

        // toPerson must also be a member here for a pairwise debt to make sense
        const toIsMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_personId: { workspaceId, personId: toPersonId } },
        });
        if (!toIsMember) continue;

        const [expenses, existingSettlements, earliestExpense] = await Promise.all([
            prisma.expense.findMany({ where: { workspaceId }, include: { splits: true, payments: true } }),
            prisma.settlement.findMany({ where: { workspaceId } }),
            prisma.expense.findFirst({ where: { workspaceId }, orderBy: { date: "asc" } }),
        ]);

        const expensesLite = expenses.map((e) => ({
            amount: Number(e.amount),
            splits: e.splits.map((s) => ({ personId: s.personId, shareAmount: Number(s.shareAmount) })),
            payments: e.payments.map((p) => ({ personId: p.personId, amountPaid: Number(p.amountPaid) })),
        }));
        const settlementsLite = existingSettlements.map((s) => ({
            fromPersonId: s.fromPersonId,
            toPersonId: s.toPersonId,
            amount: Number(s.amount),
        }));

        // Compute pairwise from toPerson's perspective, then read fromPerson's balance in it
        const net = computeSelfRelativeBalances(toPersonId, expensesLite, settlementsLite);
        const owed = net[fromPersonId] ?? 0;

        if (owed > 0.01) {
            candidates.push({
                workspaceId,
                owed: Math.round(owed * 100) / 100,
                oldestDate: earliestExpense?.date ?? new Date(0),
            });
        }
    }

    const totalOwed = Math.round(candidates.reduce((s, c) => s + c.owed, 0) * 100) / 100;

    if (amount > totalOwed + 0.01) {
        return NextResponse.json(
            {
                error: `This payment (${amount.toFixed(
                    2
                )}) is more than what's owed across shared workspaces (${totalOwed.toFixed(
                    2
                )}). Record it per-workspace instead if this is an advance.`,
            },
            { status: 400 }
        );
    }

    candidates.sort((a, b) => a.oldestDate.getTime() - b.oldestDate.getTime());

    const batchId = randomUUID();
    let remaining = amount;
    const created = [];

    for (const c of candidates) {
        if (remaining <= 0) break;
        const allocate = Math.round(Math.min(remaining, c.owed) * 100) / 100;
        if (allocate <= 0) continue;
        const settlement = await prisma.settlement.create({
            data: {
                workspaceId: c.workspaceId,
                fromPersonId,
                toPersonId,
                amount: allocate,
                note: note ? note : undefined,
                batchId,
            },
            include: { workspace: true },
        });
        created.push(settlement);
        remaining = Math.round((remaining - allocate) * 100) / 100;
    }

    return NextResponse.json({ batchId, settlements: created, totalOwedBefore: totalOwed });
}

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const settlements = await prisma.settlement.findMany({
        where: { batchId: { not: null }, workspace: { ownerId: user.id } },
        include: { fromPerson: true, toPerson: true, workspace: true },
        orderBy: { date: "desc" },
    });

    const batches = new Map<string, typeof settlements>();
    for (const s of settlements) {
        const key = s.batchId as string;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key)!.push(s);
    }

    const result = Array.from(batches.entries()).map(([batchId, rows]) => ({
        batchId,
        date: rows[0].date,
        fromPerson: { id: rows[0].fromPerson.id, name: rows[0].fromPerson.name, isSelf: rows[0].fromPerson.isSelf },
        toPerson: { id: rows[0].toPerson.id, name: rows[0].toPerson.name, isSelf: rows[0].toPerson.isSelf },
        total: rows.reduce((s, r) => s + Number(r.amount), 0),
        breakdown: rows.map((r) => ({ workspaceName: r.workspace.name, amount: Number(r.amount) })),
    }));

    return NextResponse.json({ batches: result });
}