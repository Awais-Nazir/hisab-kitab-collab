import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

function pairwiseDeltaForExpense(
    selfId: string,
    otherId: string,
    splits: { personId: string; shareAmount: number }[],
    payments: { personId: string; amountPaid: number }[],
    total: number
): number {
    if (total <= 0) return 0;
    let delta = 0;
    for (const split of splits) {
        for (const payment of payments) {
            if (split.personId === payment.personId) continue;
            const portion = split.shareAmount * (payment.amountPaid / total);
            if (portion <= 0.0001) continue;
            if (split.personId === selfId && payment.personId === otherId) {
                delta -= portion;
            } else if (payment.personId === selfId && split.personId === otherId) {
                delta += portion;
            }
        }
    }
    return delta;
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;
    if (!user.selfPersonId) {
        return NextResponse.json({ error: "Account setup incomplete" }, { status: 500 });
    }

    const { id: personId } = await params;
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const memberships = await prisma.workspaceMember.findMany({
        where: { personId, workspace: { ownerId: user.id } },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const [expenses, settlements] = await Promise.all([
        prisma.expense.findMany({
            where: { workspaceId: { in: workspaceIds } },
            include: { splits: true, payments: true },
        }),
        prisma.settlement.findMany({
            where: {
                workspaceId: { in: workspaceIds },
                OR: [
                    { fromPersonId: personId, toPersonId: user.selfPersonId },
                    { fromPersonId: user.selfPersonId, toPersonId: personId },
                ],
            },
        }),
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const deltasByDay: Record<string, number> = {};

    for (const e of expenses) {
        const total = Number(e.amount);
        const splits = e.splits.map((s) => ({ personId: s.personId, shareAmount: Number(s.shareAmount) }));
        const payments = e.payments.map((p) => ({ personId: p.personId, amountPaid: Number(p.amountPaid) }));
        const delta = pairwiseDeltaForExpense(user.selfPersonId, personId, splits, payments, total);
        if (Math.abs(delta) > 0.0001) {
            const key = dayKey(e.date);
            deltasByDay[key] = (deltasByDay[key] ?? 0) + delta;
        }
    }

    for (const s of settlements) {
        const key = dayKey(s.date);
        const amount = Number(s.amount);
        if (s.fromPersonId === personId && s.toPersonId === user.selfPersonId) {
            deltasByDay[key] = (deltasByDay[key] ?? 0) - amount;
        } else if (s.fromPersonId === user.selfPersonId && s.toPersonId === personId) {
            deltasByDay[key] = (deltasByDay[key] ?? 0) + amount;
        }
    }

    const sortedDays = Object.keys(deltasByDay).sort();
    let running = 0;
    const chronological = sortedDays.map((day) => {
        running = Math.round((running + deltasByDay[day]) * 100) / 100;
        return { date: day, delta: Math.round(deltasByDay[day] * 100) / 100, runningTotal: running };
    });

    const days = [...chronological].reverse();
    const total = chronological.length > 0 ? chronological[chronological.length - 1].runningTotal : 0;

    return NextResponse.json({ personId, total, days });
}