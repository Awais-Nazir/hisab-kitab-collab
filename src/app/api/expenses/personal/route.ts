import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createPersonalExpenseSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    category: z.string().optional(),
    date: z.string().optional(), // ISO date string
});

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createPersonalExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { amount, description, category, date } = parsed.data;

    const expense = await prisma.expense.create({
        data: {
            amount,
            description,
            category,
            date: date ? new Date(date) : new Date(),
            ownerId: user.id,
        },
    });

    return NextResponse.json({ expense });
}

export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const expenses = await prisma.expense.findMany({
        where: { ownerId: user.id },
        orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
}