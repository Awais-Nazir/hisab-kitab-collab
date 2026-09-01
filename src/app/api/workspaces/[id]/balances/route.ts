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

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
    });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const net: Record<string, number> = {};

    const expenses = await prisma.expense.findMany({
        where: { workspaceId },
        include: { splits: true, payments: true },
    });

    for (const expense of expenses) {
        for (const payment of expense.payments) {
            net[payment.personId] = (net[payment.personId] ?? 0) + Number(payment.amountPaid);
        }
        for (const split of expense.splits) {
            net[split.personId] = (net[split.personId] ?? 0) - Number(split.shareAmount);
        }
    }

    const settlements = await prisma.settlement.findMany({ where: { workspaceId } });
    for (const s of settlements) {
        net[s.fromPersonId] = (net[s.fromPersonId] ?? 0) + Number(s.amount);
        net[s.toPersonId] = (net[s.toPersonId] ?? 0) - Number(s.amount);
    }

    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { person: true },
    });

    const balances = members.map((m) => ({
        personId: m.personId,
        name: m.person.name,
        isSelf: m.person.isSelf,
        netBalance: Math.round((net[m.personId] ?? 0) * 100) / 100,
    }));

    return NextResponse.json({ balances });
}