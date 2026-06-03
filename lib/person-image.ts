// Helpers for a person's portrait URL. Pure module (no server-only) so it's
// unit-testable.
//
// Why we prefer the CDN thumbnail: the deck's Wikidata P18 image is a
// commons.wikimedia.org Special:FilePath URL, which Wikimedia rate-limits
// (HTTP 429) — badly from a shared serverless egress IP. The Wikipedia REST
// summary gives a direct upload.wikimedia.org CDN thumbnail that doesn't
// throttle the same way, so it's the preferred source; the deck URL is the
// client-side fallback.

/**
 * Widen a Wikimedia thumbnail URL to ~`width`px by rewriting its trailing
 * `/NNNpx-...` segment. Returns the URL unchanged when there's no such segment
 * (e.g. a Special:FilePath URL or a non-thumbnailed original).
 */
export function widenThumb(url: string, width = 640): string {
  return url.replace(/\/\d+px-/, `/${width}px-`);
}
