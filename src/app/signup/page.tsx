"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await apiFetch("/api/auth/signup", {
                method: "POST",
                body: JSON.stringify({ name, email, password }),
            });
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <form
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4"
            >
                <h1 className="text-2xl font-semibold text-center">Create account</h1>

                {error && (
                    <p className="balance-negative text-sm bg-red-50 p-2 rounded">
                        {error}
                    </p>
                )}

                <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
                >
                    {loading ? "Creating account..." : "Sign up"}
                </button>

                <p className="text-sm text-center text-gray-500">
                    Already have an account?{" "}
                    <a href="/login" className="underline">
                        Log in
                    </a>
                </p>
            </form>
        </div>
    );
}