import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

function dayBounds(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: start.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) };
}

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    if (!user.selfPersonId) {
        return NextResponse.json(
            { error: "Account setup incomplete — no self-person found" },
            { status: 500 }
        );
    }

    const days = Array.from({ length: 7 }, (_, i) => dayBounds(6 - i)); // oldest → newest

    const results = await Promise.all(
        days.map(async ({ start, end, label }) => {
            const [personal, mySplits] = await Promise.all([
                prisma.expense.findMany({
                    where: { ownerId: user.id, date: { gte: start, lte: end } },
                }),
                prisma.expenseSplit.findMany({
                    where: {
                        personId: user.selfPersonId!,
                        expense: { workspace: { ownerId: user.id }, date: { gte: start, lte: end } },
                    },
                }),
            ]);
            const personalTotal = personal.reduce((s, e) => s + Number(e.amount), 0);
            const splitTotal = mySplits.reduce((s, e) => s + Number(e.shareAmount), 0);
            return { label, total: Math.round((personalTotal + splitTotal) * 100) / 100 };
        })
    );

    return NextResponse.json({ days: results });
}