import Link from "next/link";

// Shared layout: white brand top bar with the product wordmark, a centred
// max-width column, and a dark footer — mirroring the Apolitical system.
// `home` (the hub) hides the back arrow, since there's nowhere to go back to.
export default function PageShell({
  children,
  home = false,
}: {
  children: React.ReactNode;
  home?: boolean;
}) {
  return (
    <div className="page">
      <header className="topbar">
        <Link href="/" className={`wordmark${home ? " is-home" : ""}`}>
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
