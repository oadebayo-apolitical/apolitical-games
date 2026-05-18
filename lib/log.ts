// Tiny structured logger for the Who's Who pipeline. One greppable line per
// event so we can see exactly where variety is lost (generation vs Wikipedia
// vs fallback). Shows up in the dev terminal and in Vercel function logs.

import "server-only";

export function wlog(event: string, fields: Record<string, unknown> = {}) {
  const parts = Object.entries(fields).map(
    ([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`
  );
  // e.g. [whos-who] gen.ok name="Ian Botham" title="Ian Botham"
  console.log(`[whos-who] ${event} ${parts.join(" ")}`.trimEnd());
}
