export function Header({ name, onLogout }: { name?: string; onLogout: () => void }) {
    return (
        <header className="row" style={{ borderBottom: "1px solid var(--color-border)", marginBottom: "1rem" }}>
            <h1 style={{ fontSize: "1.25rem", margin: 0 }}>
                {name ? `Hisab Kitab — ${name}` : "Hisab Kitab"}
            </h1>
            {name && <button onClick={onLogout} className="btn-text">Log out</button>}
        </header>
    );
}