"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Person = { id: string; name: string; email: string | null };

export default function PeoplePage() {
    const router = useRouter();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<{ people: Person[] }>("/api/people")
            .then((res) => setPeople(res.people))
            .catch(() => router.push("/login"))
            .finally(() => setLoading(false));
    }, [router]);

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await apiFetch<{ person: Person }>("/api/people", {
                method: "POST",
                body: JSON.stringify({ name, email: email || undefined }),
            });
            setPeople((prev) => [...prev, res.person].sort((a, b) => a.name.localeCompare(b.name)));
            setName("");
            setEmail("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add contact");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Remove this contact? This only works if they have no expense history.")) return;
        try {
            await apiFetch(`/api/people/${id}`, { method: "DELETE" });
            setPeople((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to remove contact");
        }
    }

    if (loading) return <div className="page">Loading...</div>;

    return (
        <div className="page">
            <a href="/dashboard" className="muted" style={{ display: "inline-block", marginBottom: "1rem" }}>
                ← Dashboard
            </a>

            <section className="card">
                <h2 className="font-medium mb-3">Your contacts</h2>
                <p className="muted" style={{ marginBottom: "0.75rem" }}>
                    People you split expenses with. They don&apos;t need an account — just add their name.
                </p>

                {people.length === 0 && <p className="muted">No contacts yet.</p>}
                {people.map((p) => (
                    <div key={p.id} className="row">
                        <div>
                            <p style={{ margin: 0 }}>{p.name}</p>
                            {p.email && <p className="muted">{p.email}</p>}
                        </div>
                        <button onClick={() => handleDelete(p.id)} className="btn-text">
                            Remove
                        </button>
                    </div>
                ))}
            </section>

            <section className="card">
                <h2 className="font-medium mb-3">Add a contact</h2>
                {error && <p className="error-box">{error}</p>}
                <form onSubmit={handleAdd} className="flex flex-col gap-2">
                    <input
                        type="text"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={submitting}
                        className="input"
                    />
                    <input
                        type="email"
                        placeholder="Email (optional)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={submitting}
                        className="input"
                    />
                    <button type="submit" disabled={submitting} className="btn btn-primary">
                        {submitting ? "Adding..." : "Add contact"}
                    </button>
                </form>
            </section>
        </div>
    );
}