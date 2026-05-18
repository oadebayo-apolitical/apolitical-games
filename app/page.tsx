import Link from "next/link";
import PageShell from "@/components/PageShell";

const GAMES = [
  {
    href: "/connections",
    title: "Connections",
    blurb:
      "Find four groups of four. The NYT-style word puzzle, with the Americanisms swapped out for British references.",
    accent: "var(--green)",
  },
  {
    href: "/whos-who",
    title: "Who's Who",
    blurb:
      "A photo of a notable British figure — politician, royal, artist, athlete. Five guesses, hints as you go.",
    accent: "var(--blue)",
  },
];

export default function Hub() {
  return (
    <PageShell>
      <header className="bc">
        <h1>Apolitical Games</h1>
        <p>A little break between meetings.</p>
      </header>

      <ul className="card-grid">
        {GAMES.map((g) => (
          <li key={g.href}>
            <Link
              className="game-card"
              href={g.href}
              style={{ ["--accent" as string]: g.accent }}
            >
              <span className="game-card-title">{g.title}</span>
              <span className="game-card-blurb">{g.blurb}</span>
              <span className="game-card-cta">Play →</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
