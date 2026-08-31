import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createWorkspaceSchema = z.object({
    name: z.string().min(1),
});

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const workspace = await prisma.workspace.create({
        data: {
            name: parsed.data.name,
            members: {
                create: { userId: user.id },
            },
        },
        include: { members: { include: { user: true } } },
    });

    return NextResponse.json({ workspace });
}

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const workspaces = await prisma.workspace.findMany({
        where: { members: { some: { userId: user.id } } },
        include: { members: { include: { user: true } } },
    });

    return NextResponse.json({ workspaces });
}