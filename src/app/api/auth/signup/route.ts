import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
});

export async function POST(req: NextRequest) {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return NextResponse.json(
            { error: "An account with this email already exists" },
            { status: 409 }
        );
    }

    const passwordHash = await hashPassword(password);

    // Create the user, then a self-Person, then link them —
    // done as a transaction so we never end up with one without the other.
    const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
            data: { email, passwordHash, name },
        });
        const selfPerson = await tx.person.create({
            data: { ownerId: newUser.id, name, isSelf: true },
        });
        return tx.user.update({
            where: { id: newUser.id },
            data: { selfPersonId: selfPerson.id },
        });
    });

    const token = signToken(user.id);
    const res = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
    });
    res.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
    });
    return res;
}



// binaryTargets = ["native", "rhel-openssl-3.0.x"]