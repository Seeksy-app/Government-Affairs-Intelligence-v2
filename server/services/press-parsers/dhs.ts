import * as cheerio from "cheerio";
import { fetchHtml } from "./fetch-html";
import type { ParsedRelease } from "../government-press-service";

const BASE_URL = "https://www.dhs.gov";

// Parses https://www.dhs.gov/news-releases/press-releases
// Structure: ul.usa-collection > li.usa-collection__item, each containing
//   .usa-collection__calendar-date time[datetime] (date-only: "2026-06-01")
//   div.usa-collection__body h3.usa-collection__heading > a (title + href)
//   div.usa-collection__body > p (summary)
export async function parseDhs(feedUrl: string): Promise<ParsedRelease[]> {
  const html = await fetchHtml(feedUrl);
  const $ = cheerio.load(html);
  const releases: ParsedRelease[] = [];

  $("li.usa-collection__item").each((_i, el) => {
    const a = $(el).find("div.usa-collection__body h3.usa-collection__heading > a");
    const title = a.text().trim();
    const href = a.attr("href")?.trim();
    if (!title || !href) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const dateStr = $(el).find(".usa-collection__calendar-date time").attr("datetime") ?? null;
    // DHS dates are date-only ("2026-06-01") — treat as midnight UTC
    const publishedAt = dateStr ? new Date(`${dateStr}T00:00:00Z`) : null;
    const summary = $(el).find("div.usa-collection__body > p").first().text().trim() || null;

    releases.push({ title, url, publishedAt, summary, fullText: null, rawMetadata: null });
  });

  return releases;
}
