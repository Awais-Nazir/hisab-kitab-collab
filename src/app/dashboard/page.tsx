"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Header } from "@/components/Header";
import { CategorySelect } from "@/components/CategorySelect";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { GlobalSettlementSection } from "@/components/GlobalSettlementSection";
import { LenaDenaRow } from "@/components/LenaDenaRow";

type User = { id: string; email: string; name: string, selfPersonId: string };
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
type TrendDay = { label: string; total: number };

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [trend, setTrend] = useState<TrendDay[]>([]);
    const [loading, setLoading] = useState(true);

    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [expTime, setExpTime] = useState(() => new Date().toTimeString().slice(0, 5));
    const [submitting, setSubmitting] = useState(false);

    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const meRes = await apiFetch<{ user: User }>("/api/auth/me");
                setUser(meRes.user);

                const [wsRes, expRes, overviewRes, trendRes] = await Promise.all([
                    apiFetch<{ workspaces: Workspace[] }>("/api/workspaces"),
                    apiFetch<{ expenses: Expense[] }>("/api/expenses/personal"),
                    apiFetch<Overview>("/api/stats/overview"),
                    apiFetch<{ days: TrendDay[] }>("/api/stats/last7days"),
                ]);
                setWorkspaces(wsRes.workspaces);
                setExpenses(expRes.expenses);
                setOverview(overviewRes);
                setTrend(trendRes.days);
            } catch {
                router.push("/login");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    async function refreshStats() {
        try {
            const [overviewRes, trendRes] = await Promise.all([
                apiFetch<Overview>("/api/stats/overview"),
                apiFetch<{ days: TrendDay[] }>("/api/stats/last7days"),
            ]);
            setOverview(overviewRes);
            setTrend(trendRes.days);
        } catch {
            // non-critical
        }
    }


    async function handleSubmitExpense(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                amount: parseFloat(amount),
                description,
                category: category || undefined,
                date: new Date(`${expDate}T${expTime}`).toISOString(),
            };
            if (editingId) {
                const res = await apiFetch<{ expense: Expense }>(`/api/expenses/personal/${editingId}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                setExpenses((prev) => prev.map((e) => (e.id === editingId ? res.expense : e)));
                setEditingId(null);
            } else {
                const res = await apiFetch<{ expense: Expense }>("/api/expenses/personal", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                setExpenses((prev) =>
                    [res.expense, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                );
            }
            setAmount("");
            setDescription("");
            setCategory("");
            setExpDate(new Date().toISOString().slice(0, 10));
            setExpTime(new Date().toTimeString().slice(0, 5));
            await refreshStats();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to save expense");
        } finally {
            setSubmitting(false);
        }
    }

    function handleEditClick(exp: Expense) {
        setEditingId(exp.id);
        setAmount(exp.amount);
        setDescription(exp.description);
        setCategory(exp.category ?? "");
        const d = new Date(exp.date);
        setExpDate(d.toISOString().slice(0, 10));
        setExpTime(d.toTimeString().slice(0, 5));
    }

    function handleCancelEdit() {
        setEditingId(null);
        setAmount("");
        setDescription("");
        setCategory("");
        setExpDate(new Date().toISOString().slice(0, 10));
        setExpTime(new Date().toTimeString().slice(0, 5));
    }

    async function handleDeleteExpense(id: string) {
        if (!confirm("Delete this expense?")) return;
        try {
            await apiFetch(`/api/expenses/personal/${id}`, { method: "DELETE" });
            setExpenses((prev) => prev.filter((e) => e.id !== id));
            await refreshStats();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete");
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

    if (!user) {
        return null;
    }

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const owedToYou = overview?.netByPerson.filter((p) => p.netBalance > 0) ?? [];
    const youOwe = overview?.netByPerson.filter((p) => p.netBalance < 0) ?? [];
    const netTotal = (overview?.netByPerson ?? []).reduce((s, p) => s + p.netBalance, 0);

    return (
        <div className="page-wide">
            <Header name={user?.name} onLogout={handleLogout} />

            <a href="/people" className="muted" style={{ display: "inline-block", marginBottom: "1rem" }}>
                Manage contacts →
            </a>

            {/* Stat cards row */}
            <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "1rem" }}>
                <div className="stat-card-v2">
                    <p className="stat-label">Today</p>
                    <p className="stat-value">{overview?.today.total.toFixed(2) ?? "0.00"}</p>
                    <p className="stat-sub">{overview?.today.count ?? 0} {overview?.today.count === 1 ? "expense" : "expenses"} · your share</p>
                </div>
                <div className="stat-card-v2">
                    <p className="stat-label">Yesterday</p>
                    <p className="stat-value">{overview?.yesterday.total.toFixed(2) ?? "0.00"}</p>
                    <p className="stat-sub">{overview?.yesterday.count ?? 0} {overview?.yesterday.count === 1 ? "expense" : "expenses"} · your share</p>
                </div>
                <div className={`stat-card-v2 ${netTotal >= 0 ? "accent-positive" : "accent-negative"}`}>
                    <p className="stat-label">Net balance</p>
                    <p className="stat-value" style={{ color: netTotal >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
                        {netTotal >= 0 ? "+" : ""}{netTotal.toFixed(2)}
                    </p>
                    <p className="stat-sub">across all contacts</p>
                </div>
            </div>

            {/* Trend chart */}
            <div className="chart-card">
                <h2 className="font-medium mb-3">Last 7 days</h2>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                                fontSize: "0.85rem",
                            }}
                            formatter={(value) => [Number(value ?? 0).toFixed(2), "Spent"]}
                        />
                        <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="dashboard-grid">
                {/* Left column */}
                <div>
                    <section className="card">
                        <h2 className="font-medium mb-3">Lena / Dena</h2>
                        {owedToYou.length === 0 && youOwe.length === 0 ? (
                            <p className="muted">All settled up — nobody owes anybody anything.</p>
                        ) : (
                            <>
                                {owedToYou.length > 0 && (
                                    <div style={{ marginBottom: "0.5rem" }}>
                                        <p className="muted" style={{ marginBottom: "0.25rem" }}>You&apos;ll get</p>
                                        {owedToYou.map((p) => (
                                            <LenaDenaRow key={p.personId} personId={p.personId} name={p.name} netBalance={p.netBalance} />
                                        ))}
                                    </div>
                                )}
                                {youOwe.length > 0 && (
                                    <div>
                                        <p className="muted" style={{ marginBottom: "0.25rem" }}>You owe</p>
                                        {youOwe.map((p) => (
                                            <LenaDenaRow key={p.personId} personId={p.personId} name={p.name} netBalance={p.netBalance} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                    <GlobalSettlementSection selfPersonId={user.selfPersonId} onSettled={refreshStats} />

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

                    <form onSubmit={handleSubmitExpense} className="flex flex-col gap-2" style={{ marginBottom: "1rem" }}>
                        <div className="form-grid-3">
                            <input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className="input" />
                            <input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required className="input" />
                            <CategorySelect value={category} onChange={setCategory} />
                        </div>
                        <div className="form-grid-2">
                            <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} required className="input" />
                            <input type="time" value={expTime} onChange={(e) => setExpTime(e.target.value)} required className="input" />
                        </div>
                        <button type="submit" disabled={submitting} className="btn btn-primary">
                            {submitting ? "Saving..." : editingId ? "Update expense" : "Add expense"}
                        </button>
                        {editingId && (
                            <button type="button" onClick={handleCancelEdit} className="btn-text">Cancel edit</button>
                        )}
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
                                <div className="flex items-center gap-2">
                                    <span>{Number(exp.amount).toFixed(2)}</span>
                                    <button onClick={() => handleEditClick(exp)} className="btn-text" style={{ fontSize: "0.78rem" }}>Edit</button>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="btn-text" style={{ fontSize: "0.78rem" }}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}