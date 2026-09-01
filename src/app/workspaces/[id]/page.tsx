"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Person = { id: string; name: string; email: string | null; isSelf?: boolean };
type Member = { personId: string; person: Person };
type ShareEntry = { personId: string; amount: string };
type Split = { personId: string; shareAmount: string; person: Person };
type Payment = { personId: string; amountPaid: string; person: Person };
type Expense = {
    id: string;
    amount: string;
    description: string;
    category: string | null;
    date: string;
    splits: Split[];
    payments: Payment[];
};
type Balance = { personId: string; name: string; isSelf: boolean; netBalance: number };

function ShareEditor({
    title,
    members,
    selected,
    setSelected,
    mode,
    setMode,
    customAmounts,
    setCustomAmounts,
}: {
    title: string;
    members: Member[];
    selected: Set<string>;
    setSelected: (s: Set<string>) => void;
    mode: "equal" | "custom";
    setMode: (m: "equal" | "custom") => void;
    customAmounts: Record<string, string>;
    setCustomAmounts: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
    function toggle(personId: string) {
        const next = new Set(selected);
        if (next.has(personId)) next.delete(personId);
        else next.add(personId);
        setSelected(next);
    }

    return (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "10px", padding: "0.75rem" }}>
            <p className="form-label" style={{ marginBottom: "0.5rem" }}>{title}</p>
            <div className="flex gap-3" style={{ marginBottom: "0.5rem" }}>
                {members.map((m) => (
                    <label key={m.personId} className="flex items-center gap-1">
                        <input type="checkbox" checked={selected.has(m.personId)} onChange={() => toggle(m.personId)} />
                        {m.person.isSelf ? "You" : m.person.name}
                    </label>
                ))}
            </div>
            <div className="flex gap-3" style={{ marginBottom: "0.5rem" }}>
                <label className="flex items-center gap-1">
                    <input type="radio" checked={mode === "equal"} onChange={() => setMode("equal")} />
                    Equal
                </label>
                <label className="flex items-center gap-1">
                    <input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} />
                    Custom
                </label>
            </div>
            {mode === "custom" && (
                <div className="flex flex-col gap-2">
                    {Array.from(selected).map((personId) => {
                        const member = members.find((m) => m.personId === personId);
                        return (
                            <div key={personId} className="flex items-center gap-2">
                                <span style={{ width: "6rem" }}>
                                    {member?.person.isSelf ? "You" : member?.person.name}
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Amount"
                                    value={customAmounts[personId] || ""}
                                    onChange={(e) =>
                                        setCustomAmounts((prev) => ({ ...prev, [personId]: e.target.value }))
                                    }
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function computeShares(
    total: number,
    selected: Set<string>,
    mode: "equal" | "custom",
    customAmounts: Record<string, string>
): ShareEntry[] {
    const ids = Array.from(selected);
    if (mode === "equal") {
        const share = Math.round((total / ids.length) * 100) / 100;
        return ids.map((personId, idx) => {
            const isLast = idx === ids.length - 1;
            const amt = isLast ? Math.round((total - share * (ids.length - 1)) * 100) / 100 : share;
            return { personId, amount: amt.toString() };
        });
    }
    return ids.map((personId) => ({ personId, amount: customAmounts[personId] || "0" }));
}

export default function WorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const workspaceId = params.id as string;

    const [members, setMembers] = useState<Member[]>([]);
    const [contacts, setContacts] = useState<Person[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [loading, setLoading] = useState(true);

    // Add member
    const [selectedContactId, setSelectedContactId] = useState("");
    const [addingMember, setAddingMember] = useState(false);

    // Expense form
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
    const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
    const [splitCustom, setSplitCustom] = useState<Record<string, string>>({});
    const [paySelected, setPaySelected] = useState<Set<string>>(new Set());
    const [payMode, setPayMode] = useState<"equal" | "custom">("equal");
    const [payCustom, setPayCustom] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // Settle form
    const [settleFrom, setSettleFrom] = useState("");
    const [settleTo, setSettleTo] = useState("");
    const [settleAmount, setSettleAmount] = useState("");
    const [settling, setSettling] = useState(false);

    async function loadAll() {
        const [membersRes, contactsRes, expensesRes, balancesRes] = await Promise.all([
            apiFetch<{ members: Member[] }>(`/api/workspaces/${workspaceId}/members`),
            apiFetch<{ people: Person[] }>("/api/people"),
            apiFetch<{ expenses: Expense[] }>(`/api/workspaces/${workspaceId}/expenses`),
            apiFetch<{ balances: Balance[] }>(`/api/workspaces/${workspaceId}/balances`),
        ]);
        setMembers(membersRes.members);
        setContacts(contactsRes.people);
        setExpenses(expensesRes.expenses);
        setBalances(balancesRes.balances);
    }

    useEffect(() => {
        loadAll()
            .catch(() => router.push("/login"))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const availableContacts = contacts.filter(
        (c) => !members.some((m) => m.personId === c.id)
    );

    async function handleAddMember(e: React.FormEvent) {
        e.preventDefault();
        if (addingMember || !selectedContactId) return;
        setAddingMember(true);
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/members`, {
                method: "POST",
                body: JSON.stringify({ personId: selectedContactId }),
            });
            setSelectedContactId("");
            await loadAll();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add member");
        } finally {
            setAddingMember(false);
        }
    }

    async function handleAddExpense(e: React.FormEvent) {
        e.preventDefault();
        if (submitting) return;
        if (splitSelected.size === 0 || paySelected.size === 0) {
            alert("Choose who this was split with and who paid");
            return;
        }
        const total = parseFloat(amount);
        const splits = computeShares(total, splitSelected, splitMode, splitCustom);
        const payments = computeShares(total, paySelected, payMode, payCustom);

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
                        splits: splits.map((s) => ({ personId: s.personId, amount: parseFloat(s.amount) })),
                        payments: payments.map((p) => ({ personId: p.personId, amount: parseFloat(p.amount) })),
                    }),
                }
            );
            setExpenses((prev) => [res.expense, ...prev]);
            setAmount("");
            setDescription("");
            setCategory("");
            setSplitSelected(new Set());
            setSplitCustom({});
            setPaySelected(new Set());
            setPayCustom({});
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

    async function handleSettle(e: React.FormEvent) {
        e.preventDefault();
        if (settling || !settleFrom || !settleTo || settleFrom === settleTo) return;
        setSettling(true);
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/settlements`, {
                method: "POST",
                body: JSON.stringify({
                    fromPersonId: settleFrom,
                    toPersonId: settleTo,
                    amount: parseFloat(settleAmount),
                }),
            });
            setSettleFrom("");
            setSettleTo("");
            setSettleAmount("");
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
                {balances.map((b) => (
                    <div key={b.personId} className="row">
                        <span>{b.isSelf ? "You" : b.name}</span>
                        <span className={b.netBalance > 0 ? "balance-positive" : b.netBalance < 0 ? "balance-negative" : "muted"}>
                            {b.netBalance > 0 ? "+" : ""}
                            {b.netBalance.toFixed(2)}
                        </span>
                    </div>
                ))}
                <p className="muted" style={{ marginTop: "0.75rem" }}>
                    Positive = owed money. Negative = owes money.
                </p>
            </section>

            {/* Settle up */}
            <section className="card">
                <h2 className="font-medium mb-3">Record a settlement</h2>
                <form onSubmit={handleSettle} className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <select value={settleFrom} onChange={(e) => setSettleFrom(e.target.value)} required className="input">
                            <option value="">From...</option>
                            {members.map((m) => (
                                <option key={m.personId} value={m.personId}>
                                    {m.person.isSelf ? "You" : m.person.name}
                                </option>
                            ))}
                        </select>
                        <select value={settleTo} onChange={(e) => setSettleTo(e.target.value)} required className="input">
                            <option value="">To...</option>
                            {members.map((m) => (
                                <option key={m.personId} value={m.personId}>
                                    {m.person.isSelf ? "You" : m.person.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        required
                        className="input"
                    />
                    <button type="submit" disabled={settling} className="btn btn-primary">
                        {settling ? "Recording..." : "Record settlement"}
                    </button>
                </form>
            </section>

            {/* Members */}
            <section className="card">
                <h2 className="font-medium mb-3">Members</h2>
                {members.map((m) => (
                    <p key={m.personId} style={{ padding: "0.25rem 0" }}>
                        {m.person.isSelf ? "You" : m.person.name}
                    </p>
                ))}
                <form onSubmit={handleAddMember} className="flex gap-2" style={{ marginTop: "0.75rem" }}>
                    <select
                        value={selectedContactId}
                        onChange={(e) => setSelectedContactId(e.target.value)}
                        className="input"
                        style={{ flex: 1 }}
                    >
                        <option value="">Select a contact...</option>
                        {availableContacts.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <button type="submit" disabled={addingMember || !selectedContactId} className="btn btn-primary">
                        {addingMember ? "Adding..." : "Add"}
                    </button>
                </form>
                {availableContacts.length === 0 && contacts.length === 0 && (
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                        No contacts yet — <a href="/people" style={{ color: "var(--color-primary)" }}>add some first</a>.
                    </p>
                )}
            </section>

            {/* Add expense */}
            <section className="card">
                <h2 className="font-medium mb-3">Add shared expense</h2>
                <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className="input" />
                        <input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required className="input" />
                    </div>
                    <input type="text" placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} className="input" />

                    <ShareEditor
                        title="Split with (who consumed this)"
                        members={members}
                        selected={splitSelected}
                        setSelected={setSplitSelected}
                        mode={splitMode}
                        setMode={setSplitMode}
                        customAmounts={splitCustom}
                        setCustomAmounts={setSplitCustom}
                    />

                    <ShareEditor
                        title="Paid by (who fronted the cash)"
                        members={members}
                        selected={paySelected}
                        setSelected={setPaySelected}
                        mode={payMode}
                        setMode={setPayMode}
                        customAmounts={payCustom}
                        setCustomAmounts={setPayCustom}
                    />

                    <button type="submit" disabled={submitting} className="btn btn-primary">
                        {submitting ? "Adding..." : "Add expense"}
                    </button>
                </form>
            </section>

            {/* Expense list */}
            <section className="card">
                <h2 className="font-medium mb-3">Expenses</h2>
                {expenses.length === 0 && <p className="muted">No expenses logged yet.</p>}
                {expenses.map((exp) => (
                    <div key={exp.id} className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                        <div className="flex justify-between">
                            <span>{exp.description}</span>
                            <span>{Number(exp.amount).toFixed(2)}</span>
                        </div>
                        <p className="muted">{new Date(exp.date).toLocaleDateString()}</p>
                        <p className="muted">
                            Paid: {exp.payments.map((p) => `${p.person.isSelf ? "You" : p.person.name} ${Number(p.amountPaid).toFixed(2)}`).join(", ")}
                        </p>
                        <p className="muted">
                            Split: {exp.splits.map((s) => `${s.person.isSelf ? "You" : s.person.name} ${Number(s.shareAmount).toFixed(2)}`).join(", ")}
                        </p>
                    </div>
                ))}
            </section>
        </div>
    );
}