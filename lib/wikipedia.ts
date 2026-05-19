// Server-only: fetch a person's blurb from the Wikipedia REST summary API,
// by their canonical article title (which the deck supplies, so it resolves
// reliably). The photo no longer comes from here — it's the Wikidata P18
// image in the deck — so a missing thumbnail is not a failure any more.
// Freely licensed content; Wikimedia asks for a descriptive User-Agent.

import "server-only";
import { wlog } from "./log";

export interface WikiExtract {
  extract: string;
  pageUrl: string;
}

const UA =
  "ApoliticalGames/1.0 (https://apolitical.co; internal team game) WhosWho";

export async function fetchExtract(
  title: string
): Promise<WikiExtract | null> {
  const slug = encodeURIComponent(title.trim().replace(/\s+/g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      wlog("wiki.http_error", { title, status: res.status });
      return null;
    }
    const data = (await res.json()) as {
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    wlog("wiki.ok", { title });
    return {
      extract: data.extract ?? "",
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${slug}`,
    };
  } catch (err) {
    wlog("wiki.network_error", { title, msg: String(err) });
    return null; // network error / timeout / abort — caller proceeds blurb-less
  } finally {
    clearTimeout(timer);
  }
}
