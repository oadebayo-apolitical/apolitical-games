"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { isCorrectGuess, type Round } from "@/lib/personality";

const MAX_ATTEMPTS = 5;
// How many rounds to keep preloaded so Skip/Next feels instant.
const BUFFER_TARGET = 2;

async function fetchRound(): Promise<Round | null> {
  try {
    const res = await fetch("/api/personality", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Round;
  } catch {
    return null;
  }
}

// Warm the browser image cache so the photo is ready before it's shown.
function warmImage(url?: string | null) {
  if (url && typeof window !== "undefined") {
    const img = new window.Image();
    img.src = url;
  }
}
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

  // Preloaded rounds (+ in-flight count) live in refs so topping up the
  // buffer never triggers a re-render.
  const bufferRef = useRef<Round[]>([]);
  const inFlightRef = useRef(0);

  const refill = useCallback(() => {
    const need =
      BUFFER_TARGET - bufferRef.current.length - inFlightRef.current;
    for (let i = 0; i < need; i++) {
      inFlightRef.current += 1;
      fetchRound()
        .then((r) => {
          if (r) {
            bufferRef.current.push(r);
            warmImage(r.image?.url);
          }
        })
        .finally(() => {
          inFlightRef.current -= 1;
        });
    }
  }, []);

  const applyRound = useCallback((r: Round) => {
    setRound(r);
    setGuess("");
    setAttempts(0);
    setStatus("playing");
    setPhase("playing");
  }, []);

  // Move to the next person — instant if the buffer has one; otherwise
  // fall back to a foreground fetch with the loading state.
  const next = useCallback(async () => {
    const buffered = bufferRef.current.shift();
    if (buffered) {
      applyRound(buffered);
      refill();
      return;
    }
    setPhase("loading");
    const r = await fetchRound();
    if (r) applyRound(r);
    else setPhase("error");
    refill();
  }, [applyRound, refill]);

  // Start preloading on mount (also warms the SSR person's image).
  useEffect(() => {
    warmImage(initial.image?.url);
    refill();
  }, [initial.image?.url, refill]);

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

            <button
              className="ctrl ww-skip"
              type="button"
              onClick={next}
              aria-label="Skip this person and load another"
            >
              Skip →
            </button>
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
