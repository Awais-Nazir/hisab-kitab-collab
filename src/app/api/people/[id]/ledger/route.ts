import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: personId } = await params;

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [splits, payments, settlements] = await Promise.all([
        prisma.expenseSplit.findMany({ where: { personId }, include: { expense: true } }),
        prisma.expensePayment.findMany({ where: { personId }, include: { expense: true } }),
        prisma.settlement.findMany({
            where: { OR: [{ fromPersonId: personId }, { toPersonId: personId }] },
        }),
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const deltasByDay: Record<string, number> = {};

    for (const p of payments) {
        const key = dayKey(p.expense.date);
        deltasByDay[key] = (deltasByDay[key] ?? 0) + Number(p.amountPaid);
    }
    for (const s of splits) {
        const key = dayKey(s.expense.date);
        deltasByDay[key] = (deltasByDay[key] ?? 0) - Number(s.shareAmount);
    }
    for (const s of settlements) {
        const key = dayKey(s.date);
        if (s.fromPersonId === personId) deltasByDay[key] = (deltasByDay[key] ?? 0) + Number(s.amount);
        if (s.toPersonId === personId) deltasByDay[key] = (deltasByDay[key] ?? 0) - Number(s.amount);
    }

    const sortedDays = Object.keys(deltasByDay).sort(); // ascending, for running total
    let running = 0;
    const chronological = sortedDays.map((day) => {
        running = Math.round((running + deltasByDay[day]) * 100) / 100;
        return { date: day, delta: Math.round(deltasByDay[day] * 100) / 100, runningTotal: running };
    });

    const days = [...chronological].reverse(); // newest first, for display
    const total = chronological.length > 0 ? chronological[chronological.length - 1].runningTotal : 0;

    return NextResponse.json({ personId, total, days });
}