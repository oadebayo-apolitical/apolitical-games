"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  createGame,
  toggle,
  deselectAll,
  shuffleTiles,
  submit,
  shareText,
  MAX_MISTAKES,
  type GameState,
} from "@/lib/connections";
import type { Puzzle } from "@/lib/puzzle";
import type { PuzzlePayload } from "@/lib/puzzle-service";
import type { Mode } from "@/lib/generate";

type Phase = "playing" | "loading" | "error";

export default function Game({
  mode,
  initial,
}: {
  mode: Mode;
  initial: PuzzlePayload;
}) {
  const [phase, setPhase] = useState<Phase>("playing");
  const [state, setState] = useState<GameState>(() =>
    createGame(initial.puzzle)
  );
  const [dateLabel, setDateLabel] = useState<string | null>(
    initial.dateLabel
  );
  const [toast, setToast] = useState<string | null>(null);
  const [shakeWords, setShakeWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-triggered reload (New puzzle / Try again). This runs from an event
  // handler, not an effect, so the state resets are fine.
  const reload = useCallback(async () => {
    setPhase("loading");
    setCopied(false);
    try {
      const res = await fetch(`/api/puzzle?mode=${mode}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { puzzle: Puzzle; dateLabel: string | null } =
        await res.json();
      setDateLabel(data.dateLabel);
      setState(createGame(data.puzzle));
      setPhase("playing");
    } catch {
      setPhase("error");
    }
  }, [mode]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  function onSubmit() {
    const picked = [...state.selected];
    const next = submit(state);
    setState(next);
    if (next.lastResult === "one-away") flashToast("One away…");
    if (next.lastResult === "one-away" || next.lastResult === "wrong") {
      setShakeWords(picked);
      setTimeout(() => setShakeWords([]), 420);
    }
  }

  if (phase === "loading") {
    return (
      <>
        <Head dateLabel={null} mode={mode} />
        <div className="status">
          <div className="spinner" />
          <p>
            {mode === "daily"
              ? "Fetching today's puzzle…"
              : "Generating a fresh puzzle…"}
          </p>
        </div>
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        <Head dateLabel={null} mode={mode} />
        <div className="status">
          <p>Couldn&apos;t load a puzzle.</p>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="ctrl primary" onClick={reload}>
              Try again
            </button>
            <Link className="ctrl" href="/connections">
              Home
            </Link>
          </div>
        </div>
      </>
    );
  }

  const ended = state.status !== "playing";
  const solved = [...state.puzzle]
    .filter((g) => state.solvedLevels.includes(g.level))
    .sort(
      (a, b) =>
        state.solvedLevels.indexOf(a.level) -
        state.solvedLevels.indexOf(b.level)
    );

  return (
    <>
      <Head dateLabel={dateLabel} mode={mode} />

      <div className="stage">
        {!ended && (
          <p className="instructions">Create four groups of four!</p>
        )}

        <div className="solved-area">
          {solved.map((g) => (
            <div key={g.level} className={`solved l${g.level}`}>
              <div className="cat">{g.name}</div>
              <div className="mem">{g.members.join(", ")}</div>
            </div>
          ))}
        </div>

        {!ended && (
          <div className="grid">
            {state.tiles.map((word) => {
              const sel = state.selected.includes(word);
              const shake = shakeWords.includes(word);
              return (
                <button
                  key={word}
                  className={`tile${sel ? " selected" : ""}${
                    shake ? " shake" : ""
                  }`}
                  onClick={() => setState(toggle(state, word))}
                >
                  {word}
                </button>
              );
            })}
          </div>
        )}

        {!ended && (
          <>
            <div className="controls">
              <button
                className="ctrl"
                onClick={() => setState(shuffleTiles(state))}
              >
                Shuffle
              </button>
              <button
                className="ctrl"
                disabled={state.selected.length === 0}
                onClick={() => setState(deselectAll(state))}
              >
                Deselect all
              </button>
              <button
                className="ctrl primary"
                disabled={state.selected.length !== 4}
                onClick={onSubmit}
              >
                Submit
              </button>
            </div>

            <div className="mistakes">
              <span>Mistakes remaining:</span>
              {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
                <span
                  key={i}
                  className={`dot${
                    i >= MAX_MISTAKES - state.mistakes ? " used" : ""
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {ended && (
          <EndScreen
            state={state}
            mode={mode}
            dateLabel={dateLabel}
            copied={copied}
            onShare={async () => {
              const text = shareText(state, {
                mode,
                dateLabel: dateLabel ?? undefined,
                url:
                  typeof window !== "undefined"
                    ? window.location.origin
                    : undefined,
              });
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {
                flashToast("Copy failed — select and copy manually");
              }
            }}
            onAgain={mode === "endless" ? reload : undefined}
          />
        )}
      </div>

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </>
  );
}

function Head({
  dateLabel,
  mode,
}: {
  dateLabel: string | null;
  mode: Mode;
}) {
  return (
    <header className="bc">
      <h1>British Connections</h1>
      <p>
        {mode === "daily"
          ? `Daily${dateLabel ? ` · ${dateLabel}` : ""}`
          : "Endless"}
      </p>
    </header>
  );
}

function EndScreen({
  state,
  mode,
  dateLabel,
  copied,
  onShare,
  onAgain,
}: {
  state: GameState;
  mode: Mode;
  dateLabel: string | null;
  copied: boolean;
  onShare: () => void;
  onAgain?: () => void;
}) {
  const won = state.status === "won";
  return (
    <div className="endscreen">
      <h2>{won ? "Spot on!" : "Hard cheese."}</h2>
      <p>
        {won
          ? `Solved with ${state.mistakes} mistake${
              state.mistakes === 1 ? "" : "s"
            }.`
          : "Better luck next time, mate."}
      </p>

      <div className="resultgrid">
        {state.guesses.map((row, i) => (
          <div className="resultrow" key={i}>
            {row.map((lvl, j) => (
              <div key={j} className={`sq l${lvl}`} />
            ))}
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button className="ctrl primary" onClick={onShare}>
          {copied ? "Copied!" : "Share result"}
        </button>
        {onAgain && (
          <button className="ctrl" onClick={onAgain}>
            New puzzle
          </button>
        )}
        <Link className="ctrl" href="/connections">
          Home
        </Link>
      </div>

      {mode === "daily" && (
        <p className="hint">
          Everyone gets the same daily puzzle for {dateLabel ?? "today"} —
          paste your result into the team chat.
        </p>
      )}
    </div>
  );
}
