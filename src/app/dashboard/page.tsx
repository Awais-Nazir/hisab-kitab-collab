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

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // New personal expense form state
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // New workspace form state
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const meRes = await apiFetch<{ user: User }>("/api/auth/me");
                setUser(meRes.user);

                const [wsRes, expRes] = await Promise.all([
                    apiFetch<{ workspaces: Workspace[] }>("/api/workspaces"),
                    apiFetch<{ expenses: Expense[] }>("/api/expenses/personal"),
                ]);
                setWorkspaces(wsRes.workspaces);
                setExpenses(expRes.expenses);
            } catch {
                router.push("/login");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

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
                    }),
                }
            );
            setExpenses((prev) => [res.expense, ...prev]);
            setAmount("");
            setDescription("");
            setCategory("");
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add expense");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCreateWorkspace(e: React.FormEvent) {
        e.preventDefault();
        if (creatingWorkspace) return; // guard against double-submit even if click lands twice fast
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

    return (
        <div className="page">
            <Header name={user?.name} onLogout={handleLogout} />

            {/* Workspaces */}
            <section className="card">
                <h2 className="font-medium mb-3">Your workspaces</h2>
                <div className="mb-3">
                    {workspaces.length === 0 && (
                        <p className="muted">No shared workspaces yet.</p>
                    )}
                    {workspaces.map((ws) => (
                        <a
                            key={ws.id}
                            href={`/workspaces/${ws.id}`}
                            className="workspace-link"
                        >
                            {ws.name}
                        </a>
                    ))}
                </div>
                <form onSubmit={handleCreateWorkspace} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="New workspace name (e.g. Me & Razaq)"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        required
                        className="input"
                        disabled={creatingWorkspace}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingWorkspace}
                    >
                        {creatingWorkspace ? "Creating..." : "Create"}
                    </button>
                </form>
            </section>

            {/* Personal expenses */}
            <section className="card">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="font-medium">Personal expenses</h2>
                    <span className="muted">Total: {total.toFixed(2)}</span>
                </div>

                <form onSubmit={handleAddExpense} className="grid grid-cols-3 gap-2 mb-4">
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
                    <input
                        type="text"
                        placeholder="Category (optional)"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="input"
                    />
                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn btn-primary"
                        style={{ gridColumn: "span 3" }}
                    >
                        {submitting ? "Adding..." : "Add expense"}
                    </button>
                </form>

                <div>
                    {expenses.length === 0 && (
                        <p className="muted">No expenses logged yet.</p>
                    )}
                    {expenses.map((exp) => (
                        <div key={exp.id} className="row">
                            <div>
                                <p>{exp.description}</p>
                                <p className="muted">
                                    {exp.category ?? "—"} · {new Date(exp.date).toLocaleDateString()}
                                </p>
                            </div>
                            <span>{Number(exp.amount).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}