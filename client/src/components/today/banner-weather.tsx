import { useQuery } from "@tanstack/react-query";
import { forecastIcon, shortDay, type WeatherWatchData } from "@/components/today/weather-watch";

// Local (Washington, D.C.) weather for the Today banner: today large, the
// next days small, and OPM's federal operating status. Shares its data with
// the Weather watch card (same query). AccuWeather requires the linked
// credit wherever its data appears.
export function BannerWeather() {
  const { data } = useQuery<WeatherWatchData>({
    queryKey: ["/api/weather-watch"],
    staleTime: 10 * 60 * 1000,
    refetchInterval: 20 * 60 * 1000,
  });
  const dc = data?.dc;
  if (!dc || dc.days.length === 0) return null;

  const [today, ...rest] = dc.days;
  const TodayIcon = forecastIcon(today);
  const open = !dc.federalStatus || /^open$/i.test(dc.federalStatus.summary.trim());

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/10 sm:min-w-[340px]" data-testid="banner-weather">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6CC3EE]">Washington, D.C.</p>
        {dc.federalStatus && (
          <a
            href={dc.federalStatus.url}
            target="_blank"
            rel="noopener noreferrer"
            title={dc.federalStatus.message}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              open ? "bg-emerald-400/15 text-emerald-200" : "bg-[#A53B39] text-white"
            }`}
            data-testid="federal-status"
          >
            Federal offices: {dc.federalStatus.summary}
          </a>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5" title={today.short}>
          <TodayIcon className={`h-9 w-9 ${today.hazard ? "text-amber-300" : "text-white"}`} strokeWidth={1.5} />
          <div>
            <p className="text-2xl font-bold leading-none tabular-nums">
              {today.high ?? today.low}°
              {today.high !== null && today.low !== null && (
                <span className="ml-1 text-sm font-medium text-white/60">/ {today.low}°</span>
              )}
            </p>
            <p className="mt-1 text-xs text-white/75">{today.short}</p>
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          {rest.slice(0, 4).map((d) => {
            const Icon = forecastIcon(d);
            return (
              <div
                key={d.name}
                title={`${d.name}: ${d.short}`}
                className={`flex w-11 flex-col items-center rounded-md py-1 ${d.hazard ? "bg-amber-400/15 ring-1 ring-amber-300/40" : ""}`}
              >
                <span className="text-[10px] font-semibold text-white/60">{shortDay(d.name)}</span>
                <Icon className={`my-0.5 h-4 w-4 ${d.hazard ? "text-amber-300" : "text-white/85"}`} />
                <span className="text-xs font-bold tabular-nums">{d.high ?? d.low}°</span>
                {d.precipChance !== null && d.precipChance >= 30 && (
                  <span className="text-[10px] font-semibold text-[#6CC3EE]">{d.precipChance}%</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(dc.hillNote || dc.headline) && (
        <p className={`text-xs ${dc.hillNote ? "font-medium text-amber-200" : "text-white/70"}`}>{dc.hillNote ?? dc.headline}</p>
      )}

      <a
        href={dc.providerUrl ?? (dc.provider === "accuweather" ? "https://www.accuweather.com" : "https://www.weather.gov")}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-white/50 hover:text-white"
        data-testid="forecast-attribution"
      >
        {dc.provider === "accuweather" ? (
          <>Forecast by <span className="font-bold text-[#FF7A45]">AccuWeather</span></>
        ) : (
          <>Forecast: National Weather Service</>
        )}
      </a>
    </div>
  );
}
