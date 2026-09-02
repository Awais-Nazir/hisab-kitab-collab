"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Header } from "@/components/Header";

type User = { id: string; email: string; name: string };
type Workspace = { id: string; name: string };
type Expense = {
    id: string;
    amount: string;
    description: string;
    category: string | null;
    date: string;
};
type DayStat = { count: number; total: number };
type PersonNet = { personId: string; name: string; netBalance: number };
type Overview = { today: DayStat; yesterday: DayStat; netByPerson: PersonNet[] };

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);

    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [expTime, setExpTime] = useState(() => new Date().toTimeString().slice(0, 5));
    const [submitting, setSubmitting] = useState(false);

    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const meRes = await apiFetch<{ user: User }>("/api/auth/me");
                setUser(meRes.user);

                const [wsRes, expRes, overviewRes] = await Promise.all([
                    apiFetch<{ workspaces: Workspace[] }>("/api/workspaces"),
                    apiFetch<{ expenses: Expense[] }>("/api/expenses/personal"),
                    apiFetch<Overview>("/api/stats/overview"),
                ]);
                setWorkspaces(wsRes.workspaces);
                setExpenses(expRes.expenses);
                setOverview(overviewRes);
            } catch {
                router.push("/login");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    async function refreshOverview() {
        try {
            const res = await apiFetch<Overview>("/api/stats/overview");
            setOverview(res);
        } catch {
            // non-critical
        }
    }

    async function handleAddExpense(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiFetch<{ expense: Expense }>(
                "/api/expenses/personal",
                {
                    method: "POST",
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        description,
                        category: category || undefined,
                        date: new Date(`${expDate}T${expTime}`).toISOString(),
                    }),
                }
            );
            setExpenses((prev) =>
                [res.expense, ...prev].sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                )
            );
            setAmount("");
            setDescription("");
            setCategory("");
            setExpDate(new Date().toISOString().slice(0, 10));
            setExpTime(new Date().toTimeString().slice(0, 5));
            await refreshOverview();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add expense");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCreateWorkspace(e: React.FormEvent) {
        e.preventDefault();
        if (creatingWorkspace) return;
        setCreatingWorkspace(true);
        try {
            const res = await apiFetch<{ workspace: Workspace }>(
                "/api/workspaces",
                {
                    method: "POST",
                    body: JSON.stringify({ name: newWorkspaceName }),
                }
            );
            setWorkspaces((prev) => [...prev, res.workspace]);
            setNewWorkspaceName("");
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to create workspace");
        } finally {
            setCreatingWorkspace(false);
        }
    }

    async function handleLogout() {
        await apiFetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    if (loading) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const owedToYou = overview?.netByPerson.filter((p) => p.netBalance > 0) ?? [];
    const youOwe = overview?.netByPerson.filter((p) => p.netBalance < 0) ?? [];

    return (
        <div className="page-wide">
            <Header name={user?.name} onLogout={handleLogout} />

            <a href="/people" className="muted" style={{ display: "inline-block", marginBottom: "1rem" }}>
                Manage contacts →
            </a>

            <div className="dashboard-grid">
                {/* Left column: stats + workspaces */}
                <div>
                    <section className="card">
                        <h2 className="font-medium mb-3">Overview</h2>
                        <div className="stat-grid" style={{ marginBottom: "1rem" }}>
                            <div className="stat-box">
                                <p className="muted" style={{ margin: 0 }}>Today (your share)</p>
                                <p style={{ margin: "0.25rem 0 0", fontSize: "1.1rem", fontWeight: 600 }}>
                                    {overview?.today.total.toFixed(2) ?? "0.00"}
                                </p>
                                <p className="muted" style={{ margin: 0 }}>
                                    {overview?.today.count ?? 0} {overview?.today.count === 1 ? "expense" : "expenses"}
                                </p>
                            </div>
                            <div className="stat-box">
                                <p className="muted" style={{ margin: 0 }}>Yesterday (your share)</p>
                                <p style={{ margin: "0.25rem 0 0", fontSize: "1.1rem", fontWeight: 600 }}>
                                    {overview?.yesterday.total.toFixed(2) ?? "0.00"}
                                </p>
                                <p className="muted" style={{ margin: 0 }}>
                                    {overview?.yesterday.count ?? 0} {overview?.yesterday.count === 1 ? "expense" : "expenses"}
                                </p>
                            </div>
                        </div>

                        {owedToYou.length === 0 && youOwe.length === 0 ? (
                            <p className="muted">All settled up — nobody owes anybody anything.</p>
                        ) : (
                            <>
                                {owedToYou.length > 0 && (
                                    <div style={{ marginBottom: "0.5rem" }}>
                                        <p className="muted" style={{ marginBottom: "0.25rem" }}>You&apos;ll get</p>
                                        {owedToYou.map((p) => (
                                            <div key={p.personId} className="row">
                                                <span>{p.name}</span>
                                                <span className="balance-positive">+{p.netBalance.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {youOwe.length > 0 && (
                                    <div>
                                        <p className="muted" style={{ marginBottom: "0.25rem" }}>You owe</p>
                                        {youOwe.map((p) => (
                                            <div key={p.personId} className="row">
                                                <span>{p.name}</span>
                                                <span className="balance-negative">{p.netBalance.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    <section className="card">
                        <h2 className="font-medium mb-3">Your workspaces</h2>
                        <div className="mb-3">
                            {workspaces.length === 0 && <p className="muted">No shared workspaces yet.</p>}
                            {workspaces.map((ws) => (
                                <a key={ws.id} href={`/workspaces/${ws.id}`} className="workspace-link">
                                    {ws.name}
                                </a>
                            ))}
                        </div>
                        <form onSubmit={handleCreateWorkspace} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="New workspace (e.g. Me & Razaq)"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                required
                                className="input"
                                disabled={creatingWorkspace}
                            />
                            <button type="submit" className="btn btn-primary" disabled={creatingWorkspace}>
                                {creatingWorkspace ? "..." : "Create"}
                            </button>
                        </form>
                    </section>
                </div>

                {/* Right column: personal expenses */}
                <section className="card">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="font-medium">Personal expenses</h2>
                        <span className="muted">Total: {total.toFixed(2)}</span>
                    </div>

                    <form onSubmit={handleAddExpense} className="form-grid-3" style={{ marginBottom: "1rem" }}>
                        <input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className="input" />
                        <input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required className="input" />
                        <input type="text" placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
                        <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} required className="input" />
                        <input type="time" value={expTime} onChange={(e) => setExpTime(e.target.value)} required className="input" />
                        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gridColumn: "1 / -1" }}>
                            {submitting ? "Adding..." : "Add expense"}
                        </button>
                    </form>

                    <div>
                        {expenses.length === 0 && <p className="muted">No expenses logged yet.</p>}
                        {expenses.map((exp) => (
                            <div key={exp.id} className="row">
                                <div>
                                    <p style={{ margin: 0 }}>{exp.description}</p>
                                    <p className="muted">
                                        {exp.category ?? "—"} · {new Date(exp.date).toLocaleString()}
                                    </p>
                                </div>
                                <span>{Number(exp.amount).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}