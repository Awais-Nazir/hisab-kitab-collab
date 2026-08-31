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

    const users = await prisma.user.findMany({
        include: {
            workspaces: { include: { workspace: true } },
        },
    });

    let emailsSent = 0;

    for (const user of users) {
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

        const workspaceSummaries: { workspaceName: string; total: number }[] = [];

        for (const membership of user.workspaces) {
            const splits = await prisma.expenseSplit.findMany({
                where: {
                    userId: user.id,
                    expense: {
                        workspaceId: membership.workspaceId,
                        date: { gte: startOfDay, lte: endOfDay },
                    },
                },
            });
            const total = splits.reduce((sum, s) => sum + Number(s.shareAmount), 0);
            if (total > 0) {
                workspaceSummaries.push({
                    workspaceName: membership.workspace.name,
                    total,
                });
            }
        }

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