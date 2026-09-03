"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type LedgerDay = { date: string; delta: number; runningTotal: number };
type Ledger = { personId: string; total: number; days: LedgerDay[] };

export function LenaDenaRow({ personId, name, netBalance }: { personId: string; name: string; netBalance: number }) {
    const [expanded, setExpanded] = useState(false);
    const [ledger, setLedger] = useState<Ledger | null>(null);
    const [loading, setLoading] = useState(false);

    async function toggle() {
        if (!expanded && !ledger) {
            setLoading(true);
            try {
                const res = await apiFetch<Ledger>(`/api/people/${personId}/ledger`);
                setLedger(res);
            } catch {
                // silently fail, stays collapsed
            } finally {
                setLoading(false);
            }
        }
        setExpanded((prev) => !prev);
    }

    return (
        <div style={{ borderBottom: "1px solid var(--color-border)" }}>
            <button
                onClick={toggle}
                className="row"
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
                <span>{expanded ? "▾" : "▸"} {name}</span>
                <span className={netBalance > 0 ? "balance-positive" : netBalance < 0 ? "balance-negative" : "muted"}>
                    {netBalance > 0 ? "+" : ""}{netBalance.toFixed(2)}
                </span>
            </button>
            {expanded && (
                <div style={{ padding: "0 0 0.75rem 1rem" }}>
                    {loading && <p className="muted">Loading...</p>}
                    {ledger && ledger.days.length === 0 && <p className="muted">No activity yet.</p>}
                    {ledger?.days.map((d) => (
                        <div key={d.date} className="flex justify-between" style={{ padding: "0.25rem 0", fontSize: "0.85rem" }}>
                            <span className="muted">
                                {new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                            <span className={d.delta > 0 ? "balance-positive" : d.delta < 0 ? "balance-negative" : "muted"}>
                                {d.delta > 0 ? "+" : ""}{d.delta.toFixed(2)}
                            </span>
                            <span className="muted">bal: {d.runningTotal.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}