import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createWorkspaceSchema = z.object({
    name: z.string().min(1),
    memberPersonIds: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!user.selfPersonId) {
        return NextResponse.json(
            { error: "Account setup incomplete — no self-person found" },
            { status: 500 }
        );
    }

    // Confirm any provided contacts actually belong to this user
    if (parsed.data.memberPersonIds.length > 0) {
        const count = await prisma.person.count({
            where: { id: { in: parsed.data.memberPersonIds }, ownerId: user.id },
        });
        if (count !== parsed.data.memberPersonIds.length) {
            return NextResponse.json(
                { error: "One or more contacts are invalid" },
                { status: 400 }
            );
        }
    }

    const workspace = await prisma.workspace.create({
        data: {
            ownerId: user.id,
            name: parsed.data.name,
            members: {
                create: [
                    { personId: user.selfPersonId }, // you're always a member
                    ...parsed.data.memberPersonIds.map((personId) => ({ personId })),
                ],
            },
        },
        include: { members: { include: { person: true } } },
    });

    return NextResponse.json({ workspace });
}

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const workspaces = await prisma.workspace.findMany({
        where: { ownerId: user.id },
        include: { members: { include: { person: true } } },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ workspaces });
}