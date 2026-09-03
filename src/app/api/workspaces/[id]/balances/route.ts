import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { computeSelfRelativeBalances } from "@/lib/balances";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;
    if (!user.selfPersonId) {
        return NextResponse.json({ error: "Account setup incomplete" }, { status: 500 });
    }

    const { id: workspaceId } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [expenses, settlements, members] = await Promise.all([
        prisma.expense.findMany({ where: { workspaceId }, include: { splits: true, payments: true } }),
        prisma.settlement.findMany({ where: { workspaceId } }),
        prisma.workspaceMember.findMany({ where: { workspaceId }, include: { person: true } }),
    ]);

    const expensesLite = expenses.map((e) => ({
        amount: Number(e.amount),
        splits: e.splits.map((s) => ({ personId: s.personId, shareAmount: Number(s.shareAmount) })),
        payments: e.payments.map((p) => ({ personId: p.personId, amountPaid: Number(p.amountPaid) })),
    }));
    const settlementsLite = settlements.map((s) => ({
        fromPersonId: s.fromPersonId,
        toPersonId: s.toPersonId,
        amount: Number(s.amount),
    }));

    const net = computeSelfRelativeBalances(user.selfPersonId, expensesLite, settlementsLite);
    const selfTotal = Math.round(Object.values(net).reduce((s, v) => s + v, 0) * 100) / 100;

    const balances = members.map((m) => ({
        personId: m.personId,
        name: m.person.name,
        isSelf: m.person.isSelf,
        netBalance: m.person.isSelf ? selfTotal : net[m.personId] ?? 0,
    }));

    return NextResponse.json({ balances });
}