import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ batchId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { batchId } = await params;

    const rows = await prisma.settlement.findMany({
        where: { batchId },
        include: { workspace: true },
    });
    if (rows.length === 0 || rows.some((r) => r.workspace.ownerId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.settlement.deleteMany({ where: { batchId } });
    return NextResponse.json({ success: true });
}