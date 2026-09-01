import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const addMemberSchema = z.object({
    personId: z.string(),
});

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

    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { person: true },
    });

    return NextResponse.json({ members });
}

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
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const person = await prisma.person.findUnique({
        where: { id: parsed.data.personId },
    });
    if (!person || person.ownerId !== user.id) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const existing = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_personId: { workspaceId, personId: person.id },
        },
    });
    if (existing) {
        return NextResponse.json(
            { error: "Already a member of this workspace" },
            { status: 409 }
        );
    }

    const member = await prisma.workspaceMember.create({
        data: { workspaceId, personId: person.id },
        include: { person: true },
    });

    return NextResponse.json({ member });
}