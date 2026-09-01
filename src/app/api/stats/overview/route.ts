import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
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

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);

    const [personalExpenses, mySplitsToday, mySplitsYesterday, allWorkspaceExpenses, settlements] =
        await Promise.all([
            prisma.expense.findMany({ where: { ownerId: user.id } }),
            // My own share of shared expenses, today
            prisma.expenseSplit.findMany({
                where: {
                    personId: user.selfPersonId,
                    expense: { workspace: { ownerId: user.id }, date: { gte: todayStart, lte: todayEnd } },
                },
            }),
            // My own share of shared expenses, yesterday
            prisma.expenseSplit.findMany({
                where: {
                    personId: user.selfPersonId,
                    expense: {
                        workspace: { ownerId: user.id },
                        date: { gte: yesterdayStart, lte: yesterdayEnd },
                    },
                },
            }),
            // Full data needed for the per-contact net balance below
            prisma.expense.findMany({
                where: { workspace: { ownerId: user.id } },
                include: { splits: true, payments: true },
            }),
            prisma.settlement.findMany({ where: { workspace: { ownerId: user.id } } }),
        ]);

    const inRange = (d: Date, start: Date, end: Date) => d >= start && d <= end;
    const sumAmount = (items: { amount: unknown }[]) =>
        items.reduce((s, e) => s + Number(e.amount), 0);
    const sumShare = (items: { shareAmount: unknown }[]) =>
        items.reduce((s, e) => s + Number(e.shareAmount), 0);

    const personalToday = personalExpenses.filter((e) => inRange(e.date, todayStart, todayEnd));
    const personalYesterday = personalExpenses.filter((e) =>
        inRange(e.date, yesterdayStart, yesterdayEnd)
    );

    const today = {
        count: personalToday.length + mySplitsToday.length,
        total: Math.round((sumAmount(personalToday) + sumShare(mySplitsToday)) * 100) / 100,
    };
    const yesterdayStats = {
        count: personalYesterday.length + mySplitsYesterday.length,
        total:
            Math.round((sumAmount(personalYesterday) + sumShare(mySplitsYesterday)) * 100) / 100,
    };

    // Net balance per contact, aggregated across every workspace they're in
    // (unaffected by the "my share" fix above — this is genuinely a group calculation)
    const net: Record<string, number> = {};
    for (const expense of allWorkspaceExpenses) {
        for (const payment of expense.payments) {
            net[payment.personId] = (net[payment.personId] ?? 0) + Number(payment.amountPaid);
        }
        for (const split of expense.splits) {
            net[split.personId] = (net[split.personId] ?? 0) - Number(split.shareAmount);
        }
    }
    for (const s of settlements) {
        net[s.fromPersonId] = (net[s.fromPersonId] ?? 0) + Number(s.amount);
        net[s.toPersonId] = (net[s.toPersonId] ?? 0) - Number(s.amount);
    }

    const contacts = await prisma.person.findMany({
        where: { ownerId: user.id, isSelf: false },
    });

    const netByPerson = contacts
        .map((p) => ({
            personId: p.id,
            name: p.name,
            netBalance: Math.round((net[p.id] ?? 0) * 100) / 100,
        }))
        .filter((p) => p.netBalance !== 0)
        .sort((a, b) => b.netBalance - a.netBalance);

    return NextResponse.json({ today, yesterday: yesterdayStats, netByPerson });
}