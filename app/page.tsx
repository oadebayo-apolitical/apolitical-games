import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <header className="bc">
        <h1>British Connections</h1>
        <p>Group the words into four. With a British accent.</p>
      </header>

      <div className="home">
        <p className="lede">
          Find four groups of four. Same game as NYT Connections — just with the
          Americanisms swapped out for British references.
        </p>

        <Link className="mode-btn primary" href="/play?mode=daily">
          <div className="title">Daily Puzzle</div>
          <div className="sub">
            Today&apos;s puzzle — the same one for everyone. Share your result
            with the team.
          </div>
        </Link>

        <Link className="mode-btn" href="/play?mode=endless">
          <div className="title">Endless</div>
          <div className="sub">
            A freshly generated puzzle every time. Play as many as you like.
          </div>
        </Link>
      </div>
    </main>
  );
}
