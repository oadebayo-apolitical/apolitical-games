// Server-only: fetch a person's photo + blurb from the Wikipedia REST
// summary API. Freely licensed content; Wikimedia asks for a descriptive
// User-Agent. Returns null on any failure so callers can fall back.

import "server-only";
import { wlog } from "./log";

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
    if (!res.ok) {
      wlog("wiki.http_error", { title, status: res.status });
      return null;
    }
    const data = (await res.json()) as {
      type?: string;
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    // Skip disambiguation / missing pages.
    if (data.type && data.type !== "standard") {
      wlog("wiki.not_standard", { title, type: data.type ?? "?" });
      return null;
    }
    const imageUrl =
      data.thumbnail?.source ?? data.originalimage?.source ?? null;
    if (!imageUrl) {
      wlog("wiki.no_image", { title });
      return null;
    }
    wlog("wiki.ok", { title });
    return {
      imageUrl,
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${slug}`,
      extract: data.extract ?? "",
    };
  } catch (err) {
    wlog("wiki.network_error", { title, msg: String(err) });
    return null; // network error / timeout / abort
  } finally {
    clearTimeout(timer);
  }
}
