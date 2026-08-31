import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId } = await params;

    const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!membership) {
        return NextResponse.json(
            { error: "You are not a member of this workspace" },
            { status: 403 }
        );
    }

    // net[userId] = positive means they are OWED money, negative means they OWE money
    const net: Record<string, number> = {};

    const expenses = await prisma.expense.findMany({
        where: { workspaceId },
        include: { splits: true },
    });

    for (const expense of expenses) {
        const paidBy = expense.paidById!;
        net[paidBy] = (net[paidBy] ?? 0) + Number(expense.amount);

        for (const split of expense.splits) {
            net[split.userId] =
                (net[split.userId] ?? 0) - Number(split.shareAmount);
        }
    }

    const settlements = await prisma.settlement.findMany({
        where: { workspaceId },
    });

    for (const s of settlements) {
        // fromUser paid toUser, so fromUser's debt decreases (net goes up),
        // toUser's credit decreases (net goes down)
        net[s.fromUserId] = (net[s.fromUserId] ?? 0) + Number(s.amount);
        net[s.toUserId] = (net[s.toUserId] ?? 0) - Number(s.amount);
    }

    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: true },
    });

    const balances = members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        netBalance: Math.round((net[m.userId] ?? 0) * 100) / 100,
    }));

    return NextResponse.json({ balances });
}