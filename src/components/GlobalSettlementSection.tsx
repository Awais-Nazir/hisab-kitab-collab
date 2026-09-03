"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Person = { id: string; name: string; email: string | null };
type Batch = {
    batchId: string;
    date: string;
    fromPerson: { id: string; name: string; isSelf: boolean };
    toPerson: { id: string; name: string; isSelf: boolean };
    total: number;
    breakdown: { workspaceName: string; amount: number }[];
};

export function GlobalSettlementSection({
    selfPersonId,
    onSettled,
}: {
    selfPersonId: string;
    onSettled: () => void;
}) {
    const [contacts, setContacts] = useState<Person[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);

    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [amount, setAmount] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ breakdown: { workspaceName: string; amount: number }[]; remaining: number } | null>(null);

    const options = [{ id: selfPersonId, name: "You" }, ...contacts];

    async function load() {
        const [peopleRes, batchesRes] = await Promise.all([
            apiFetch<{ people: Person[] }>("/api/people"),
            apiFetch<{ batches: Batch[] }>("/api/settlements/global"),
        ]);
        setContacts(peopleRes.people);
        setBatches(batchesRes.batches);
    }

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (submitting || !fromId || !toId || fromId === toId) return;
        setSubmitting(true);
        setResult(null);
        try {
            const res = await apiFetch<{
                totalOwedBefore: number;
                settlements: { amount: string; workspace: { name: string } }[];
            }>("/api/settlements/global", {
                method: "POST",
                body: JSON.stringify({ fromPersonId: fromId, toPersonId: toId, amount: parseFloat(amount) }),
            });
            const breakdown = res.settlements.map((s) => ({
                workspaceName: s.workspace.name,
                amount: Number(s.amount),
            }));
            const paid = breakdown.reduce((s, b) => s + b.amount, 0);
            setResult({ breakdown, remaining: Math.round((res.totalOwedBefore - paid) * 100) / 100 });
            setAmount("");
            await load();
            onSettled();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to record settlement");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDeleteBatch(batchId: string) {
        if (!confirm("Delete this global settlement? This removes it from every workspace it touched.")) return;
        try {
            await apiFetch(`/api/settlements/global/${batchId}`, { method: "DELETE" });
            await load();
            onSettled();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete");
        }
    }

    if (loading) return null;

    return (
        <section className="card">
            <h2 className="font-medium mb-3">Global settlement</h2>
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
                Record one payment that spans several shared workspaces — it&apos;ll be applied to the oldest debts first.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="form-grid-2">
                    <select value={fromId} onChange={(e) => setFromId(e.target.value)} required className="input">
                        <option value="">From...</option>
                        {options.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                    <select value={toId} onChange={(e) => setToId(e.target.value)} required className="input">
                        <option value="">To...</option>
                        {options.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                </div>
                <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="input"
                />
                <button type="submit" disabled={submitting} className="btn btn-primary">
                    {submitting ? "Recording..." : "Record global settlement"}
                </button>
            </form>

            {result && (
                <div style={{ marginTop: "0.75rem", padding: "0.6rem", background: "var(--color-bg)", borderRadius: "8px" }}>
                    <p className="muted" style={{ marginBottom: "0.25rem" }}>Applied to:</p>
                    {result.breakdown.map((b, i) => (
                        <p key={i} style={{ margin: "0.15rem 0" }}>{b.workspaceName}: {b.amount.toFixed(2)}</p>
                    ))}
                    {result.remaining > 0 && (
                        <p className="balance-negative" style={{ marginTop: "0.25rem" }}>
                            {result.remaining.toFixed(2)} still remaining
                        </p>
                    )}
                </div>
            )}

            {batches.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                    <p className="muted" style={{ marginBottom: "0.25rem" }}>History</p>
                    {batches.map((b) => (
                        <div key={b.batchId} className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                            <div className="flex justify-between">
                                <span>{b.fromPerson.isSelf ? "You" : b.fromPerson.name} → {b.toPerson.isSelf ? "You" : b.toPerson.name}</span>
                                <div className="flex items-center gap-2">
                                    <span>{b.total.toFixed(2)}</span>
                                    <button onClick={() => handleDeleteBatch(b.batchId)} className="btn-text" style={{ fontSize: "0.78rem" }}>Delete</button>
                                </div>
                            </div>
                            <p className="muted">{new Date(b.date).toLocaleString()}</p>
                            <p className="muted">{b.breakdown.map((x) => `${x.workspaceName}: ${x.amount.toFixed(2)}`).join(", ")}</p>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}