// Resolve a working portrait URL for a person, verifying it actually loads
// before we commit to serving them. No server-only: the pure `widenThumb`
// helper is unit-tested and `resolveImage` only uses fetch.
//
// Why this exists: the deck's Wikidata P18 image is a commons.wikimedia.org
// Special:FilePath URL, which Wikimedia rate-limits (HTTP 429) under bursts.
// The Wikipedia REST summary gives a direct upload.wikimedia.org CDN thumbnail
// that doesn't throttle the same way — so we prefer it and fall back to the
// deck URL, skipping anyone whose photo won't load.

const UA =
  "ApoliticalGames/1.0 (https://apolitical.co; internal team game) WhosWho";

/**
 * Widen a Wikimedia thumbnail URL to ~`width`px by rewriting its trailing
 * `/NNNpx-...` segment. Returns the URL unchanged when there's no such segment
 * (e.g. a Special:FilePath URL or a non-thumbnailed original).
 */
export function widenThumb(url: string, width = 640): string {
  return url.replace(/\/\d+px-/, `/${width}px-`);
}

async function loads(url: string, timeoutMs = 4000): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: ctl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    return res.ok && ct.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** First candidate URL that actually serves an image, or null if none do. */
export async function resolveImage(
  candidates: (string | null | undefined)[]
): Promise<string | null> {
  for (const url of candidates) {
    if (!url) continue;
    if (await loads(url)) return url;
  }
  return null;
}
