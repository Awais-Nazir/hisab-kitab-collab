import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export async function POST(req: NextRequest) {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return NextResponse.json(
            { error: "Invalid email or password" },
            { status: 401 }
        );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
        return NextResponse.json(
            { error: "Invalid email or password" },
            { status: 401 }
        );
    }

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