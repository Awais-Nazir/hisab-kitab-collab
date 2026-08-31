"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
        <div className="min-h-screen bg-gray-50 p-4 max-w-2xl mx-auto">
            <div className="flex justify-between items-center py-4">
                <h1 className="text-xl font-semibold">Hi, {user?.name}</h1>
                <button onClick={handleLogout} className="text-sm text-gray-500 underline">
                    Log out
                </button>
            </div>

            {/* Workspaces */}
            <section className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="font-medium mb-3">Your workspaces</h2>
                <div className="space-y-2 mb-3">
                    {workspaces.length === 0 && (
                        <p className="text-sm text-gray-400">No shared workspaces yet.</p>
                    )}
                    {workspaces.map((ws) => (
                        <a
                            key={ws.id}
                            href={`/workspaces/${ws.id}`}
                            className="block border rounded px-3 py-2 hover:bg-gray-50"
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
                        className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                    <button
                        type="submit"
                        className="bg-black text-white px-4 py-2 rounded text-sm"
                    >
                        Create
                    </button>
                </form>
            </section >

            {/* Personal expenses */}
            < section className="bg-white rounded-lg shadow p-4" >
                <div className="flex justify-between items-center mb-3">
                    <h2 className="font-medium">Personal expenses</h2>
                    <span className="text-sm text-gray-500">Total: {total.toFixed(2)}</span>
                </div>

                <form onSubmit={handleAddExpense} className="grid grid-cols-3 gap-2 mb-4">
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
                    <input
                        type="text"
                        placeholder="Category (optional)"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="border rounded px-3 py-2 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={submitting}
                        className="col-span-3 bg-black text-white rounded py-2 text-sm disabled:opacity-50"
                    >
                        {submitting ? "Adding..." : "Add expense"}
                    </button>
                </form>

                <div className="space-y-1">
                    {expenses.length === 0 && (
                        <p className="text-sm text-gray-400">No expenses logged yet.</p>
                    )}
                    {expenses.map((exp) => (
                        <div
                            key={exp.id}
                            className="flex justify-between text-sm border-b py-2"
                        >
                            <div>
                                <p>{exp.description}</p>
                                <p className="text-gray-400 text-xs">
                                    {exp.category ?? "—"} · {new Date(exp.date).toLocaleDateString()}
                                </p>
                            </div>
                            <span>{Number(exp.amount).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </section >
        </div >
    );
}