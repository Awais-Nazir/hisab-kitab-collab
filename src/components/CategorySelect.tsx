"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const DEFAULT_CATEGORIES = [
    "Food",
    "Groceries",
    "Transport",
    "Bills & Utilities",
    "Rent",
    "Shopping",
    "Entertainment",
    "Health",
    "Education",
];

const ADD_NEW = "__add_new__";
const OTHER = "Other";

type Category = { id: string; name: string };

export function CategorySelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (name: string) => void;
}) {
    const [customCategories, setCustomCategories] = useState<Category[]>([]);
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiFetch<{ categories: Category[] }>("/api/categories")
            .then((res) => setCustomCategories(res.categories))
            .catch(() => {
                // Non-critical — defaults still work without custom ones loading
            });
    }, []);

    const allNames = Array.from(
        new Set([...DEFAULT_CATEGORIES, ...customCategories.map((c) => c.name)])
    );

    async function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
        if (e.target.value === ADD_NEW) {
            setAddingNew(true);
            return;
        }
        onChange(e.target.value);
    }

    async function handleSaveNew() {
        if (!newName.trim() || saving) return;
        setSaving(true);
        try {
            const res = await apiFetch<{ category: Category }>("/api/categories", {
                method: "POST",
                body: JSON.stringify({ name: newName.trim() }),
            });
            setCustomCategories((prev) =>
                prev.some((c) => c.name === res.category.name) ? prev : [...prev, res.category]
            );
            onChange(res.category.name);
            setNewName("");
            setAddingNew(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to add category");
        } finally {
            setSaving(false);
        }
    }

    if (addingNew) {
        return (
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="New category name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input"
                    style={{ flex: 1 }}
                    autoFocus
                />
                <button type="button" onClick={handleSaveNew} disabled={saving} className="btn btn-primary">
                    {saving ? "..." : "Save"}
                </button>
                <button type="button" onClick={() => setAddingNew(false)} className="btn-text">
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <select value={value} onChange={handleSelect} className="input">
            <option value="">Category (optional)</option>
            {allNames.map((name) => (
                <option key={name} value={name}>
                    {name}
                </option>
            ))}
            <option value={OTHER}>{OTHER}</option>
            <option value={ADD_NEW}>+ Add new category...</option>
        </select>
    );
}