import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const settleSchema = z.object({
    toUserId: z.string(),
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
    const parsed = settleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const settlement = await prisma.settlement.create({
        data: {
            workspaceId,
            fromUserId: user.id,
            toUserId: parsed.data.toUserId,
            amount: parsed.data.amount,
            note: parsed.data.note,
        },
    });

    return NextResponse.json({ settlement });
}