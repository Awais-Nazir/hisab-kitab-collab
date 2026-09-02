export function Header({ name, onLogout }: { name?: string; onLogout: () => void }) {
    const initial = name ? name.trim().charAt(0).toUpperCase() : "?";
    return (
        <header className="header-bar">
            <div className="flex items-center gap-2">
                <div className="avatar">{initial}</div>
                <div>
                    <h1 style={{ fontSize: "1.1rem", margin: 0, lineHeight: 1.2 }}>Hisab Kitab</h1>
                    {name && <p className="muted" style={{ margin: 0 }}>{name}</p>}
                </div>
            </div>
            {name && <button onClick={onLogout} className="btn-text">Log out</button>}
        </header>
    );
}