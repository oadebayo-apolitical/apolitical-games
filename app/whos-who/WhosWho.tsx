"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { isCorrectGuess, type Round } from "@/lib/personality";

const MAX_ATTEMPTS = 5;
type Phase = "playing" | "loading" | "error";
type Status = "playing" | "won" | "lost";

export default function WhosWho({ initial }: { initial: Round }) {
  const [phase, setPhase] = useState<Phase>("playing");
  const [round, setRound] = useState<Round>(initial);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [wrongFlash, setWrongFlash] = useState(false);

  // Hint 0 is shown from the start; each wrong guess reveals the next.
  const revealed = Math.min(1 + attempts, round.hints.length);

  const next = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/personality", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Round = await res.json();
      setRound(data);
      setGuess("");
      setAttempts(0);
      setStatus("playing");
      setPhase("playing");
    } catch {
      setPhase("error");
    }
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "playing" || !guess.trim()) return;
    if (
      isCorrectGuess(guess, {
        name: round.name,
        acceptableAnswers: round.acceptableAnswers,
      })
    ) {
      setStatus("won");
      return;
    }
    const used = attempts + 1;
    setAttempts(used);
    setGuess("");
    setWrongFlash(true);
    setTimeout(() => setWrongFlash(false), 420);
    if (used >= MAX_ATTEMPTS) setStatus("lost");
  }

  if (phase === "loading") {
    return (
      <Frame title>
        <div className="status">
          <div className="spinner" />
          <p>Finding someone…</p>
        </div>
      </Frame>
    );
  }

  if (phase === "error") {
    return (
      <Frame title>
        <div className="status">
          <p>Couldn&apos;t load a person.</p>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="ctrl primary" onClick={next}>
              Try again
            </button>
            <Link className="ctrl" href="/">
              Home
            </Link>
          </div>
        </div>
      </Frame>
    );
  }

  const done = status !== "playing";

  return (
    <Frame title>
      <div className="ww">
        <div className="ww-frame">
          {round.image ? (
            <Image
              src={round.image.url}
              alt={done ? round.name : "Mystery British personality"}
              fill
              sizes="340px"
              priority
              unoptimized
            />
          ) : (
            <span className="placeholder">
              (photo unavailable — play from the hints)
            </span>
          )}
        </div>
        {round.image && (
          <a
            className="credit"
            href={round.image.pageUrl}
            target="_blank"
            rel="noreferrer"
          >
            Photo: Wikipedia
          </a>
        )}

        {!done && (
          <>
            <form className="ww-form" onSubmit={onSubmit}>
              <input
                className="ww-input"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Who is this?"
                aria-label="Your guess"
                autoComplete="off"
                autoFocus
              />
              <button
                className="ctrl primary"
                type="submit"
                disabled={!guess.trim()}
              >
                Guess
              </button>
            </form>

            <div
              className="ww-attempts"
              style={wrongFlash ? { color: "#c0392b" } : undefined}
            >
              <span>Guesses left:</span>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <span
                  key={i}
                  className={`ww-pip${i < attempts ? " used" : ""}`}
                />
              ))}
            </div>
          </>
        )}

        <ul className="ww-hints">
          {round.hints.slice(0, revealed).map((h, i) => (
            <li className="ww-hint" key={i}>
              <span className="label">Hint {i + 1}</span>
              {h}
            </li>
          ))}
        </ul>

        {done && (
          <div className="ww-reveal">
            <h2>{status === "won" ? "Got it!" : "Not quite."}</h2>
            <div className="name">{round.name}</div>
            <p>{round.category}</p>
            {round.blurb && <p>{round.blurb}</p>}
            <div className="btn-row">
              <button className="ctrl primary" onClick={next}>
                Next person
              </button>
              <Link className="ctrl" href="/">
                Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

function Frame({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: boolean;
}) {
  return (
    <>
      {title && (
        <header className="bc">
          <h1>Who&apos;s Who</h1>
          <p>Name the British public figure.</p>
        </header>
      )}
      <div className="stage">{children}</div>
    </>
  );
}
