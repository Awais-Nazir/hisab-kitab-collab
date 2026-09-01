import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id } = await params;

    const person = await prisma.person.findUnique({ where: { id } });
    if (!person || person.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (person.isSelf) {
        return NextResponse.json(
            { error: "Cannot delete yourself" },
            { status: 400 }
        );
    }

    // Prisma will throw a foreign-key error if this person has expense
    // splits/payments/settlements already — that's intentional: deleting
    // a contact with ledger history would silently corrupt past balances.
    try {
        await prisma.person.delete({ where: { id } });
    } catch {
        return NextResponse.json(
            {
                error:
                    "This contact has expense history and can't be deleted. Remove them from workspaces instead.",
            },
            { status: 409 }
        );
    }

    return NextResponse.json({ success: true });
}