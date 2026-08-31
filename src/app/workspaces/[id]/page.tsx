"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type User = { id: string; email: string; name: string };
type Member = { userId: string; user: User };
type Split = { userId: string; shareAmount: string; user: User };
type Expense = {
    id: string;
    amount: string;
    description: string;
    category: string | null;
    date: string;
    paidBy: User;
    splits: Split[];
};
type Balance = { userId: string; name: string; netBalance: number };

export default function WorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const workspaceId = params.id as string;

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [loading, setLoading] = useState(true);

    // Add member form
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);

    // Add expense form
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [paidById, setPaidById] = useState("");
    const [splitWith, setSplitWith] = useState<Set<string>>(new Set());
    const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
    const [customShares, setCustomShares] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [settling, setSettling] = useState(false);

    async function loadAll() {
        const [meRes, expensesRes, balancesRes] = await Promise.all([
            apiFetch<{ user: User }>("/api/auth/me"),
            apiFetch<{ expenses: Expense[] }>(
                `/api/workspaces/${workspaceId}/expenses`
            ),
            apiFetch<{ balances: Balance[] }>(
                `/api/workspaces/${workspaceId}/balances`
            ),
        ]);
        setCurrentUser(meRes.user);
        setExpenses(expensesRes.expenses);
        setBalances(balancesRes.balances);
        // Members list is derived from balances (every member has a balance row,
        // including zero), so this stays a single source of truth instead of a
        // separate unused fetch.
        setMembers(
            balancesRes.balances.map((b) => ({
                userId: b.userId,
                user: { id: b.userId, name: b.name, email: "" },
            }))
        );
    }

    useEffect(() => {
        loadAll()
            .catch(() => router.push("/login"))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        if (inviting) return;
        setInviting(true);
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/members`, {
                method: "POST",
                body: JSON.stringify({ email: inviteEmail }),
            });
            setInviteEmail("");
            await loadAll();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add member");
        } finally {
            setInviting(false);
        }
    }

    function toggleSplitMember(userId: string) {
        setSplitWith((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    async function handleAddExpense(e: React.FormEvent) {
        e.preventDefault();
        if (submitting) return;
        if (!paidById || splitWith.size === 0) {
            alert("Choose who paid and who is splitting this expense");
            return;
        }

        const total = parseFloat(amount);
        let splits: { userId: string; shareAmount: number }[];

        if (splitMode === "equal") {
            const participantIds = Array.from(splitWith);
            const share = Math.round((total / participantIds.length) * 100) / 100;
            splits = participantIds.map((userId, idx) => {
                const isLast = idx === participantIds.length - 1;
                const assigned = isLast
                    ? Math.round((total - share * (participantIds.length - 1)) * 100) / 100
                    : share;
                return { userId, shareAmount: assigned };
            });
        } else {
            splits = Array.from(splitWith).map((userId) => ({
                userId,
                shareAmount: parseFloat(customShares[userId] || "0"),
            }));
        }

        setSubmitting(true);
        try {
            const res = await apiFetch<{ expense: Expense }>(
                `/api/workspaces/${workspaceId}/expenses`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        amount: total,
                        description,
                        category: category || undefined,
                        paidById,
                        splits,
                    }),
                }
            );
            setExpenses((prev) => [res.expense, ...prev]);
            setAmount("");
            setDescription("");
            setCategory("");
            setSplitWith(new Set());
            setCustomShares({});
            const balancesRes = await apiFetch<{ balances: Balance[] }>(
                `/api/workspaces/${workspaceId}/balances`
            );
            setBalances(balancesRes.balances);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add expense");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSettle(toUserId: string, amountDue: number) {
        const input = prompt(
            `How much are you paying? (owed: ${amountDue.toFixed(2)})`,
            Math.abs(amountDue).toFixed(2)
        );
        if (!input) return;
        setSettling(true);
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/settlements`, {
                method: "POST",
                body: JSON.stringify({
                    toUserId,
                    amount: parseFloat(input),
                }),
            });
            const balancesRes = await apiFetch<{ balances: Balance[] }>(
                `/api/workspaces/${workspaceId}/balances`
            );
            setBalances(balancesRes.balances);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to settle");
        } finally {
            setSettling(false);
        }
    }

    if (loading) return <div className="page">Loading...</div>;

    return (
        <div className="page">
            <a href="/dashboard" className="muted" style={{ display: "inline-block", marginBottom: "1rem" }}>
                ← Dashboard
            </a>

            {/* Balances */}
            <section className="card">
                <h2 className="font-medium mb-3">Balances</h2>
                <div>
                    {balances.map((b) => (
                        <div key={b.userId} className="row">
                            <span>
                                {b.name} {b.userId === currentUser?.id && "(you)"}
                            </span>
                            <div className="flex items-center gap-2">
                                <span
                                    className={
                                        b.netBalance > 0
                                            ? "balance-positive"
                                            : b.netBalance < 0
                                                ? "balance-negative"
                                                : "muted"
                                    }
                                >
                                    {b.netBalance > 0 ? "+" : ""}
                                    {b.netBalance.toFixed(2)}
                                </span>
                                {b.netBalance < 0 && b.userId === currentUser?.id && (
                                    <button
                                        onClick={() => {
                                            const creditor = balances.find((x) => x.netBalance > 0);
                                            if (creditor) handleSettle(creditor.userId, b.netBalance);
                                        }}
                                        disabled={settling}
                                        className="btn-text"
                                        style={{ fontSize: "0.8rem" }}
                                    >
                                        {settling ? "Settling..." : "Settle"}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="muted" style={{ marginTop: "0.75rem" }}>
                    Positive = owed to you. Negative = you owe.
                </p>
            </section>

            {/* Members */}
            <section className="card">
                <h2 className="font-medium mb-3">Members</h2>
                <div style={{ marginBottom: "0.75rem" }}>
                    {members.map((m) => (
                        <p key={m.userId} style={{ padding: "0.25rem 0" }}>
                            {m.user.name}
                        </p>
                    ))}
                </div>
                <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                        type="email"
                        placeholder="Add member by email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        disabled={inviting}
                        className="input"
                        style={{ flex: 1 }}
                    />
                    <button type="submit" disabled={inviting} className="btn btn-primary">
                        {inviting ? "Adding..." : "Add"}
                    </button>
                </form>
            </section>

            {/* Add expense */}
            <section className="card">
                <h2 className="font-medium mb-3">Add shared expense</h2>
                <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            className="input"
                        />
                        <input
                            type="text"
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            className="input"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Category (optional)"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="input"
                    />

                    <div>
                        <label className="muted" style={{ display: "block", marginBottom: "0.35rem" }}>
                            Paid by
                        </label>
                        <select
                            value={paidById}
                            onChange={(e) => setPaidById(e.target.value)}
                            required
                            className="input"
                        >
                            <option value="">Select...</option>
                            {members.map((m) => (
                                <option key={m.userId} value={m.userId}>
                                    {m.user.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="muted" style={{ display: "block", marginBottom: "0.35rem" }}>
                            Split with
                        </label>
                        <div className="flex gap-3">
                            {members.map((m) => (
                                <label key={m.userId} className="flex items-center gap-1">
                                    <input
                                        type="checkbox"
                                        checked={splitWith.has(m.userId)}
                                        onChange={() => toggleSplitMember(m.userId)}
                                    />
                                    {m.user.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="muted" style={{ display: "block", marginBottom: "0.35rem" }}>
                            Split type
                        </label>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-1">
                                <input
                                    type="radio"
                                    checked={splitMode === "equal"}
                                    onChange={() => setSplitMode("equal")}
                                />
                                Equal
                            </label>
                            <label className="flex items-center gap-1">
                                <input
                                    type="radio"
                                    checked={splitMode === "custom"}
                                    onChange={() => setSplitMode("custom")}
                                />
                                Custom
                            </label>
                        </div>
                    </div>

                    {splitMode === "custom" && (
                        <div className="flex flex-col gap-2">
                            {Array.from(splitWith).map((userId) => {
                                const member = members.find((m) => m.userId === userId);
                                return (
                                    <div key={userId} className="flex items-center gap-2">
                                        <span style={{ width: "6rem" }}>{member?.user.name}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Share"
                                            value={customShares[userId] || ""}
                                            onChange={(e) =>
                                                setCustomShares((prev) => ({
                                                    ...prev,
                                                    [userId]: e.target.value,
                                                }))
                                            }
                                            className="input"
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn btn-primary"
                    >
                        {submitting ? "Adding..." : "Add expense"}
                    </button>
                </form>
            </section>

            {/* Expense list */}
            <section className="card">
                <h2 className="font-medium mb-3">Expenses</h2>
                {expenses.length === 0 && <p className="muted">No expenses logged yet.</p>}
                <div>
                    {expenses.map((exp) => (
                        <div key={exp.id} className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                            <div className="flex justify-between">
                                <span>{exp.description}</span>
                                <span>{Number(exp.amount).toFixed(2)}</span>
                            </div>
                            <p className="muted">
                                Paid by {exp.paidBy.name} ·{" "}
                                {new Date(exp.date).toLocaleDateString()}
                            </p>
                            <p className="muted">
                                Split: {exp.splits.map((s) => `${s.user.name} ${Number(s.shareAmount).toFixed(2)}`).join(", ")}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}