import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDailySummaryEmail } from "@/lib/sendEmail";

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const users = await prisma.user.findMany();

    let emailsSent = 0;

    for (const user of users) {
        if (!user.selfPersonId) continue; // safety guard, shouldn't happen

        const personalExpenses = await prisma.expense.findMany({
            where: {
                ownerId: user.id,
                date: { gte: startOfDay, lte: endOfDay },
            },
        });
        const personalTotal = personalExpenses.reduce(
            (sum, e) => sum + Number(e.amount),
            0
        );

        // This user's own share of today's expenses in each workspace they own
        const mySplitsToday = await prisma.expenseSplit.findMany({
            where: {
                personId: user.selfPersonId,
                expense: {
                    workspace: { ownerId: user.id },
                    date: { gte: startOfDay, lte: endOfDay },
                },
            },
            include: {
                expense: { include: { workspace: true } },
            },
        });

        const workspaceTotals = new Map<string, number>();
        for (const split of mySplitsToday) {
            const wsName = split.expense.workspace?.name ?? "Workspace";
            workspaceTotals.set(
                wsName,
                (workspaceTotals.get(wsName) ?? 0) + Number(split.shareAmount)
            );
        }
        const workspaceSummaries = Array.from(workspaceTotals.entries()).map(
            ([workspaceName, total]) => ({ workspaceName, total })
        );

        if (personalTotal > 0 || workspaceSummaries.length > 0) {
            await sendDailySummaryEmail(
                user.email,
                user.name,
                personalTotal,
                workspaceSummaries
            );
            emailsSent++;
        }
    }

    return NextResponse.json({ success: true, emailsSent });
}