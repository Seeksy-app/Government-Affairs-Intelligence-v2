import * as cheerio from "cheerio";
import { fetchHtml } from "./fetch-html";
import type { ParsedRelease } from "../government-press-service";

const BASE_URL = "https://home.treasury.gov";

// Parses https://home.treasury.gov/news/press-releases
// Structure: div.content--2col__body > div, each containing
//   span.date-format > time[datetime] and h3.featured-stories__headline > a
export async function parseTreasury(feedUrl: string): Promise<ParsedRelease[]> {
  const html = await fetchHtml(feedUrl);
  const $ = cheerio.load(html);
  const releases: ParsedRelease[] = [];

  $("div.content--2col__body > div").each((_i, el) => {
    const a = $(el).find("h3.featured-stories__headline > a");
    const title = a.text().trim();
    const href = a.attr("href")?.trim();
    if (!title || !href) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const dateStr = $(el).find(".date-format time.datetime").attr("datetime") ?? null;
    const publishedAt = dateStr ? new Date(dateStr) : null;

    releases.push({ title, url, publishedAt, summary: null, fullText: null, rawMetadata: null });
  });

  return releases;
}
