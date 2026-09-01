"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await apiFetch("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <form onSubmit={handleSubmit} className="card">
                    <h1 style={{ marginTop: 0, marginBottom: "1.25rem" }}>Log in</h1>

                    {error && <p className="error-box">{error}</p>}

                    <div style={{ marginBottom: "0.9rem" }}>
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="input"
                        />
                    </div>

                    <div style={{ marginBottom: "1.1rem" }}>
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="input"
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary">
                        {loading ? "Logging in..." : "Log in"}
                    </button>

                    <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
                        No account?{" "}
                        <a href="/signup" style={{ color: "var(--color-primary)" }}>
                            Sign up
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}