import Link from "next/link";
import PageShell from "@/components/PageShell";

const GAMES = [
  {
    href: "/connections",
    tag: "Word puzzle",
    title: "Connections",
    blurb:
      "Find four groups of four. The NYT-style word puzzle, with the Americanisms swapped out for British references.",
  },
  {
    href: "/whos-who",
    tag: "Guessing game",
    title: "Who's Who",
    blurb:
      "A photo of a notable British figure — politician, royal, artist, athlete. Five guesses, hints as you go.",
  },
];

export default function Hub() {
  return (
    <PageShell home>
      <header className="bc">
        <h1>Apolitical Games</h1>
        <p>A little break between meetings.</p>
      </header>

      <ul className="card-grid">
        {GAMES.map((g) => (
          <li key={g.href}>
            <Link className="game-card" href={g.href}>
              <span className="game-card-tag">{g.tag}</span>
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
