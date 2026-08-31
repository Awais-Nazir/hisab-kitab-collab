export async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Request failed");
    }

    return data;
}