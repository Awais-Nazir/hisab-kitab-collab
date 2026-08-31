import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const addMemberSchema = z.object({
    email: z.string().email(),
});

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId } = await params;

    // Confirm the requester is actually a member of this workspace
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
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const targetUser = await prisma.user.findUnique({
        where: { email: parsed.data.email },
    });
    if (!targetUser) {
        return NextResponse.json(
            { error: "No user with that email has signed up yet" },
            { status: 404 }
        );
    }

    const existing = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: { workspaceId, userId: targetUser.id },
        },
    });
    if (existing) {
        return NextResponse.json(
            { error: "User is already a member of this workspace" },
            { status: 409 }
        );
    }

    const newMember = await prisma.workspaceMember.create({
        data: { workspaceId, userId: targetUser.id },
        include: { user: true },
    });

    return NextResponse.json({ member: newMember });
}