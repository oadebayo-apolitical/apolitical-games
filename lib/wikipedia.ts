// Server-only: fetch a person's photo + blurb from the Wikipedia REST
// summary API. Freely licensed content; Wikimedia asks for a descriptive
// User-Agent. Returns null on any failure so callers can fall back.

import "server-only";

export interface WikiInfo {
  imageUrl: string;
  pageUrl: string;
  extract: string;
}

const UA =
  "ApoliticalGames/1.0 (https://apolitical.co; internal team game) WhosWho";

export async function fetchWikiInfo(title: string): Promise<WikiInfo | null> {
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
    if (!res.ok) return null;
    const data = (await res.json()) as {
      type?: string;
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    // Skip disambiguation / missing pages.
    if (data.type && data.type !== "standard") return null;
    const imageUrl =
      data.thumbnail?.source ?? data.originalimage?.source ?? null;
    if (!imageUrl) return null;
    return {
      imageUrl,
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${slug}`,
      extract: data.extract ?? "",
    };
  } catch {
    return null; // network error / timeout / abort
  } finally {
    clearTimeout(timer);
  }
}
