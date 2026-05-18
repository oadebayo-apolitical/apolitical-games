import Link from "next/link";
import PageShell from "@/components/PageShell";

export default function ConnectionsHome() {
  return (
    <PageShell>
      <header className="bc">
        <h1>Connections</h1>
        <p>Group the words into four. With a British accent.</p>
      </header>

      <div className="home">
        <p className="lede">
          Find four groups of four — same game as NYT Connections, just with
          the Americanisms swapped out for British references.
        </p>

        <Link className="mode-btn primary" href="/connections/play?mode=daily">
          <span className="title">Daily Puzzle</span>
          <span className="sub">
            Today&apos;s puzzle — the same one for everyone. Share your result
            with the team.
          </span>
        </Link>

        <Link className="mode-btn" href="/connections/play?mode=endless">
          <span className="title">Endless</span>
          <span className="sub">
            A freshly generated puzzle every time. Play as many as you like.
          </span>
        </Link>
      </div>
    </PageShell>
  );
}
