import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const settleSchema = z.object({
    fromPersonId: z.string(),
    toPersonId: z.string(),
    amount: z.number().positive(),
    note: z.string().optional(),
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
    const parsed = settleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const memberIds = (
        await prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { personId: true },
        })
    ).map((m) => m.personId);

    if (
        !memberIds.includes(parsed.data.fromPersonId) ||
        !memberIds.includes(parsed.data.toPersonId)
    ) {
        return NextResponse.json(
            { error: "Both people must be members of this workspace" },
            { status: 400 }
        );
    }

    const settlement = await prisma.settlement.create({
        data: {
            workspaceId,
            fromPersonId: parsed.data.fromPersonId,
            toPersonId: parsed.data.toPersonId,
            amount: parsed.data.amount,
            note: parsed.data.note,
        },
    });

    return NextResponse.json({ settlement });
}