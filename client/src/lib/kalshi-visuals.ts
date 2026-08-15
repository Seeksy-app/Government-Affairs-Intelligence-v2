import { Landmark, Trophy, DollarSign, TrendingUp, Cloud, Beaker, Film, Heart, Globe, Vote, type LucideIcon } from "lucide-react";

// Kalshi-style category chrome: icon + label, keyed loosely off the category
// string the API returns (or our UI category id). No API call needed — this
// is pure presentation, unlike the price/volume data below.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  politics: Landmark,
  elections: Vote,
  sports: Trophy,
  economics: DollarSign,
  financials: TrendingUp,
  companies: TrendingUp,
  "climate and weather": Cloud,
  climate: Cloud,
  "science and technology": Beaker,
  tech: Beaker,
  entertainment: Film,
  social: Film,
  culture: Film,
  health: Heart,
  world: Globe,
};

export function getCategoryIcon(category?: string | null): LucideIcon {
  if (!category) return Globe;
  return CATEGORY_ICONS[category.toLowerCase()] ?? Globe;
}

// A validated hex from Kalshi's own color_code beats any guessed palette —
// it's the literal team/brand color. Falls back to a price-strength scale
// (matches the rest of the app: green strong-yes, amber toss-up, rose
// strong-no) when Kalshi doesn't supply one.
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function resolveAccentColor(yesPrice: number, colorCode?: string | null): string {
  if (colorCode && HEX_RE.test(colorCode)) return colorCode;
  if (yesPrice >= 60) return "#059669"; // emerald
  if (yesPrice >= 40) return "#D97706"; // amber
  return "#E11D48"; // rose
}

// "Closes Aug 19" / "Closed" — honest substitute for a live-game clock we
// don't have data for; Kalshi's close_time is real and always available.
export function formatCloseLabel(closeTime?: string | null): string {
  if (!closeTime) return "";
  const d = new Date(closeTime);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getTime() < Date.now()) return "Closed";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `Closes ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" })}`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}k`;
  return `$${volume.toLocaleString()}`;
}
