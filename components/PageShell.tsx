import Link from "next/link";

// Shared layout for every page: a consistent top bar with the product
// wordmark (always links back to the hub) and a centred, max-width column.
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
    </div>
  );
}
