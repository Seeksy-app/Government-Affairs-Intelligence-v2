import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  CloudLightning,
  CloudRainWind,
  ExternalLink,
  Flame,
  Landmark,
  Siren,
  Snowflake,
  Sun,
  Tornado,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type WeatherKind = "capitol" | "tropical" | "disaster" | "severe";

interface WeatherItem {
  id: string;
  kind: WeatherKind;
  title: string;
  detail: string;
  impact: string;
  states: string[];
  yourStates: string[];
  url: string;
  source: string;
}

export interface DcDay {
  name: string;
  high: number | null;
  low: number | null;
  short: string;
  precipChance: number | null;
  hazard: string | null;
}

export interface DcOutlook {
  provider?: "accuweather" | "nws";
  headline?: string | null;
  providerUrl?: string | null;
  days: DcDay[];
  federalStatus: { summary: string; message: string; url: string } | null;
  hillNote: string | null;
}

export interface WeatherWatchData {
  updatedAt: string;
  dc: DcOutlook | null;
  items: WeatherItem[];
  tracking: Array<{ name: string; classification: string; basin: string; windMph: number; url: string }>;
  yourStates: string[];
}

function iconFor(item: WeatherItem): LucideIcon {
  if (item.kind === "capitol") return Landmark;
  if (item.kind === "tropical") return CloudRainWind;
  if (item.kind === "disaster") return /fire/i.test(item.title) ? Flame : Siren;
  if (/tornado/i.test(item.title)) return Tornado;
  if (/winter|blizzard|ice|cold/i.test(item.title)) return Snowflake;
  if (/heat/i.test(item.title)) return Sun;
  return CloudLightning;
}

export function forecastIcon(d: DcDay): LucideIcon {
  const f = d.short.toLowerCase();
  const night = d.high === null;
  if (/snow|sleet|\bice\b|freezing|wintry|blizzard|flurries/.test(f)) return CloudSnow;
  if (/thunder|t-storm/.test(f)) return CloudLightning;
  if (/drizzle|slight chance/.test(f)) return CloudDrizzle;
  if (/rain|showers/.test(f)) return CloudRain;
  if (/fog|haze|smoke/.test(f)) return CloudFog;
  if (/partly|mostly sunny|mostly clear|intermittent clouds|hazy/.test(f)) return night ? CloudMoon : CloudSun;
  if (/cloud|overcast|dreary/.test(f)) return Cloud;
  return night ? Moon : Sun;
}

export function shortDay(name: string) {
  if (/^today|^tonight|^this/i.test(name)) return name.replace(/^This /, "");
  return name.slice(0, 3);
}

// Severe weather and disasters that move the political calendar. Sources are
// the National Weather Service, National Hurricane Center and FEMA.
export function WeatherWatchCard() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = useQuery<WeatherWatchData>({
    queryKey: ["/api/weather-watch"],
    staleTime: 10 * 60 * 1000,
    refetchInterval: 20 * 60 * 1000,
  });

  return (
    <Card data-testid="card-weather-watch">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Weather watch</p>
          {data?.updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              updated {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 px-4 pb-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : error || !data || !Array.isArray(data.items) ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Weather data is unavailable right now.</p>
        ) : data.items.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No severe weather or new disaster declarations affecting Congress or your states.
          </p>
        ) : (
          <div className="divide-y">
            {(showAll ? data.items : data.items.slice(0, 3)).map((item) => {
              const Icon = iconFor(item);
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block px-4 py-3 transition-colors hover:bg-muted/50"
                  data-testid={`weather-item-${item.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        item.kind === "capitol" || item.yourStates.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{item.title}</p>
                      {item.yourStates.length > 0 && (
                        <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Your {item.yourStates.length === 1 ? "state" : "states"}: {item.yourStates.join(", ")}
                        </span>
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.impact}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        {item.source}
                        <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </p>
                    </div>
                  </div>
                </a>
              );
            })}
            {data.items.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="w-full px-4 py-2 text-left text-xs font-semibold text-primary hover:bg-muted/50"
                data-testid="button-weather-more"
              >
                {showAll ? "Show fewer" : `Show ${data.items.length - 3} more`}
              </button>
            )}
          </div>
        )}

        {data && Array.isArray(data.tracking) && data.tracking.length > 0 && (
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            Tracking:{" "}
            {data.tracking.map((t, i) => (
              <span key={t.name}>
                {i > 0 && ", "}
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:text-primary">
                  {t.classification} {t.name}
                </a>{" "}
                ({t.basin}, {t.windMph} mph)
              </span>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
