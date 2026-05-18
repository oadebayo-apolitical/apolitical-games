import Link from "next/link";

// Shared layout: white brand top bar with the product wordmark (always
// links back to the hub), a centred max-width column, and a dark footer —
// mirroring the Apolitical design system.
export default function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <header className="topbar">
        <Link href="/" className="wordmark">
          Apolitical Games
        </Link>
      </header>
      <div className="shell">{children}</div>
      <footer className="site-footer">
        <strong>Apolitical Games</strong> · a little break between meetings
      </footer>
    </div>
  );
}
