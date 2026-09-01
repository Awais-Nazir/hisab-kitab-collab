import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const shareEntrySchema = z.object({
    personId: z.string(),
    amount: z.number().nonnegative(),
});

const createExpenseSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    category: z.string().optional(),
    date: z.string().optional(),
    splits: z.array(shareEntrySchema).min(1),
    payments: z.array(shareEntrySchema).min(1),
});

export async function POST(
    req: NextRequest,
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

    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { amount, description, category, date, splits, payments } = parsed.data;

    const splitSum = splits.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(splitSum - amount) > 0.01) {
        return NextResponse.json(
            { error: `Splits sum to ${splitSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
            { status: 400 }
        );
    }

    const paymentSum = payments.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(paymentSum - amount) > 0.01) {
        return NextResponse.json(
            { error: `Payments sum to ${paymentSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
            { status: 400 }
        );
    }

    const memberIds = (
        await prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { personId: true },
        })
    ).map((m) => m.personId);

    const allParticipants = [
        ...splits.map((s) => s.personId),
        ...payments.map((p) => p.personId),
    ];
    const invalid = allParticipants.find((id) => !memberIds.includes(id));
    if (invalid) {
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
            splits: {
                create: splits.map((s) => ({ personId: s.personId, shareAmount: s.amount })),
            },
            payments: {
                create: payments.map((p) => ({ personId: p.personId, amountPaid: p.amount })),
            },
        },
        include: {
            splits: { include: { person: true } },
            payments: { include: { person: true } },
        },
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

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
    });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const expenses = await prisma.expense.findMany({
        where: { workspaceId },
        include: {
            splits: { include: { person: true } },
            payments: { include: { person: true } },
        },
        orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
}