import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    category: z.string().optional(),
    date: z.string().optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id } = await params;
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const expense = await prisma.expense.update({
        where: { id },
        data: {
            amount: parsed.data.amount,
            description: parsed.data.description,
            category: parsed.data.category,
            date: parsed.data.date ? new Date(parsed.data.date) : existing.date,
        },
    });

    return NextResponse.json({ expense });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id } = await params;
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
}