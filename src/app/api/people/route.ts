import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createPersonSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
});

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const people = await prisma.person.findMany({
        where: { ownerId: user.id, isSelf: false },
        orderBy: { name: "asc" },
    });

    return NextResponse.json({ people });
}

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createPersonSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const person = await prisma.person.create({
        data: {
            ownerId: user.id,
            name: parsed.data.name,
            email: parsed.data.email,
        },
    });

    return NextResponse.json({ person });
}