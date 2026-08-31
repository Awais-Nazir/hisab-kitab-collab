import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";

export async function requireUser() {
    const user = await getCurrentUser();
    if (!user) {
        return {
            user: null,
            errorResponse: NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            ),
        };
    }
    return { user, errorResponse: null };
}