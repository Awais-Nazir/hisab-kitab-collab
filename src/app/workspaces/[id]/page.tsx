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

    // Add expense form
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [paidById, setPaidById] = useState("");
    const [splitWith, setSplitWith] = useState<Set<string>>(new Set());
    const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
    const [customShares, setCustomShares] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    async function loadAll() {
        const [meRes, membersRes, expensesRes, balancesRes] = await Promise.all([
            apiFetch<{ user: User }>("/api/auth/me"),
            apiFetch<{ workspace: { members: Member[] } }>(
                `/api/workspaces` // fallback below fetches full list; workspace-specific member fetch reuses list endpoint
            ).catch(() => ({ workspace: { members: [] as Member[] } })),
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
        // Members come from balances endpoint's member list as a reliable source
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
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/members`, {
                method: "POST",
                body: JSON.stringify({ email: inviteEmail }),
            });
            setInviteEmail("");
            await loadAll();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add member");
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
                // give any rounding remainder to the last participant
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
        }
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 max-w-2xl mx-auto">
            <a href="/dashboard" className="text-sm text-gray-500 underline">
                ← Dashboard
            </a>

            {/* Balances */}
            <section className="bg-white rounded-lg shadow p-4 my-4">
                <h2 className="font-medium mb-3">Balances</h2>
                <div className="space-y-2">
                    {balances.map((b) => (
                        <div key={b.userId} className="flex justify-between items-center text-sm">
                            <span>
                                {b.name} {b.userId === currentUser?.id && "(you)"}
                            </span>
                            <div className="flex items-center gap-2">
                                <span
                                    className={
                                        b.netBalance > 0
                                            ? "text-green-600"
                                            : b.netBalance < 0
                                                ? "text-red-600"
                                                : "text-gray-400"
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
                                        className="text-xs underline text-blue-600"
                                    >
                                        Settle
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                    Positive = owed to you. Negative = you owe.
                </p>
            </section>

            {/* Members */}
            <section className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="font-medium mb-3">Members</h2>
                <div className="text-sm space-y-1 mb-3">
                    {members.map((m) => (
                        <p key={m.userId}>{m.user.name}</p>
                    ))}
                </div>
                <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                        type="email"
                        placeholder="Add member by email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                    <button type="submit" className="bg-black text-white px-4 py-2 rounded text-sm">
                        Add
                    </button>
                </form>
            </section>

            {/* Add expense */}
            <section className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="font-medium mb-3">Add shared expense</h2>
                <form onSubmit={handleAddExpense} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            className="border rounded px-3 py-2 text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            className="border rounded px-3 py-2 text-sm"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Category (optional)"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />

                    <div>
                        <label className="text-sm font-medium">Paid by</label>
                        <select
                            value={paidById}
                            onChange={(e) => setPaidById(e.target.value)}
                            required
                            className="w-full border rounded px-3 py-2 text-sm mt-1"
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
                        <label className="text-sm font-medium">Split with</label>
                        <div className="flex gap-3 mt-1">
                            {members.map((m) => (
                                <label key={m.userId} className="flex items-center gap-1 text-sm">
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
                        <label className="text-sm font-medium">Split type</label>
                        <div className="flex gap-3 mt-1 text-sm">
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
                        <div className="space-y-2">
                            {Array.from(splitWith).map((userId) => {
                                const member = members.find((m) => m.userId === userId);
                                return (
                                    <div key={userId} className="flex items-center gap-2">
                                        <span className="text-sm w-24">{member?.user.name}</span>
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
                                            className="flex-1 border rounded px-3 py-1 text-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-black text-white rounded py-2 text-sm disabled:opacity-50"
                    >
                        {submitting ? "Adding..." : "Add expense"}
                    </button>
                </form>
            </section>

            {/* Expense list */}
            <section className="bg-white rounded-lg shadow p-4">
                <h2 className="font-medium mb-3">Expenses</h2>
                <div className="space-y-2">
                    {expenses.map((exp) => (
                        <div key={exp.id} className="border-b pb-2 text-sm">
                            <div className="flex justify-between">
                                <span>{exp.description}</span>
                                <span>{Number(exp.amount).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-400">
                                Paid by {exp.paidBy.name} ·{" "}
                                {new Date(exp.date).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-400">
                                Split: {exp.splits.map((s) => `${s.user.name} ${Number(s.shareAmount).toFixed(2)}`).join(", ")}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}