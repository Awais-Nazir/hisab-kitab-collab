import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createCategorySchema = z.object({
    name: z.string().min(1).max(40),
});

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const categories = await prisma.category.findMany({
        where: { ownerId: user.id },
        orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({
        where: { ownerId_name: { ownerId: user.id, name: parsed.data.name } },
    });
    if (existing) {
        return NextResponse.json({ category: existing });
    }

    const category = await prisma.category.create({
        data: { ownerId: user.id, name: parsed.data.name },
    });

    return NextResponse.json({ category });
}