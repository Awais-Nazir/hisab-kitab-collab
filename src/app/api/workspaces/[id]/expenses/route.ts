import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const splitEntrySchema = z.object({
    userId: z.string(),
    shareAmount: z.number().nonnegative(),
});

const createWorkspaceExpenseSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    category: z.string().optional(),
    date: z.string().optional(),
    paidById: z.string(),
    splits: z.array(splitEntrySchema).min(1),
});

export async function POST(
    req: NextRequest,
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

    const body = await req.json();
    const parsed = createWorkspaceExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { amount, description, category, date, paidById, splits } =
        parsed.data;

    // Validate: splits must sum exactly to amount
    const splitSum = splits.reduce((sum, s) => sum + s.shareAmount, 0);
    if (Math.abs(splitSum - amount) > 0.01) {
        return NextResponse.json(
            {
                error: `Splits sum to ${splitSum.toFixed(
                    2
                )} but expense amount is ${amount.toFixed(2)}`,
            },
            { status: 400 }
        );
    }

    // Validate: paidById and all split userIds must be workspace members
    const memberIds = (
        await prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { userId: true },
        })
    ).map((m) => m.userId);

    const allParticipants = [paidById, ...splits.map((s) => s.userId)];
    const invalidParticipant = allParticipants.find(
        (id) => !memberIds.includes(id)
    );
    if (invalidParticipant) {
        return NextResponse.json(
            { error: "All participants must be members of this workspace" },
            { status: 400 }
        );
    }

    const expense = await prisma.expense.create({
        data: {
            amount,
            description,
            category,
            date: date ? new Date(date) : new Date(),
            workspaceId,
            paidById,
            splits: {
                create: splits.map((s) => ({
                    userId: s.userId,
                    shareAmount: s.shareAmount,
                })),
            },
        },
        include: { splits: { include: { user: true } }, paidBy: true },
    });

    return NextResponse.json({ expense });
}

export async function GET(
    req: NextRequest,
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

    const expenses = await prisma.expense.findMany({
        where: { workspaceId },
        include: { splits: { include: { user: true } }, paidBy: true },
        orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
}