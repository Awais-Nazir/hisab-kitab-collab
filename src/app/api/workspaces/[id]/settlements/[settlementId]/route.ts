import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateSettleSchema = z.object({
    fromPersonId: z.string(),
    toPersonId: z.string(),
    amount: z.number().positive(),
    note: z.string().optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId, settlementId } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!existing || existing.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSettleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const memberIds = (
        await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { personId: true } })
    ).map((m) => m.personId);
    if (!memberIds.includes(parsed.data.fromPersonId) || !memberIds.includes(parsed.data.toPersonId)) {
        return NextResponse.json({ error: "Both people must be members of this workspace" }, { status: 400 });
    }

    const settlement = await prisma.settlement.update({
        where: { id: settlementId },
        data: {
            fromPersonId: parsed.data.fromPersonId,
            toPersonId: parsed.data.toPersonId,
            amount: parsed.data.amount,
            note: parsed.data.note,
        },
    });

    return NextResponse.json({ settlement });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId, settlementId } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!existing || existing.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.settlement.delete({ where: { id: settlementId } });
    return NextResponse.json({ success: true });
}