import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { BarChart3, Megaphone, MessageCircleQuestion, MessageSquareText, Newspaper, type LucideIcon } from "lucide-react";
import { openAIChat } from "@/components/global-ai-chat";
import { useAuth } from "@/hooks/use-auth";

// Daily-read feeds and "Should I be worried?" live in the top bar, next to
// search, so the rail can stay short. Badges count what's new today (Eastern):
// high-relevance news, releases from the firm's agencies, answers written.
type CountKey = "news" | "press" | "questions";

const LINKS: Array<{ title: string; url: string; icon: LucideIcon; testId: string; count?: CountKey; countLabel?: string }> = [
  { title: "News", url: "/news", icon: Newspaper, testId: "topnav-news", count: "news", countLabel: "important stories today" },
  { title: "Press", url: "/press-releases", icon: Megaphone, testId: "topnav-press", count: "press", countLabel: "releases from your agencies today" },
  { title: "Markets", url: "/predictions", icon: BarChart3, testId: "topnav-markets" },
  { title: "Should I be worried?", url: "/briefs", icon: MessageCircleQuestion, testId: "topnav-worried", count: "questions", countLabel: "answers today" },
];

export function TopBarLinks() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: counts } = useQuery<Record<CountKey, number>>({
    queryKey: ["/api/top-bar-counts"],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  return (
    <nav className="hidden items-stretch gap-1 py-1.5 lg:flex" aria-label="Feeds">
      {LINKS.map((l) => {
        const active = location === l.url || location.startsWith(l.url + "/");
        const n = l.count ? counts?.[l.count] ?? 0 : 0;
        return (
          <Link
            key={l.url}
            href={l.url}
            aria-current={active ? "page" : undefined}
            aria-label={n > 0 ? `${l.title} — ${n} ${l.countLabel}` : l.title}
            title={n > 0 ? `${n} ${l.countLabel}` : undefined}
            data-testid={l.testId}
            className={`relative flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-1 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring/50 ${
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="relative">
              <l.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.1 : 1.75} />
              {n > 0 && (
                <span
                  className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#078ACB] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card"
                  data-testid={`${l.testId}-count`}
                >
                  {n > 9 ? "9+" : n}
                </span>
              )}
            </span>
            <span className={`whitespace-nowrap text-xs leading-none ${active ? "font-semibold" : "font-medium"}`}>{l.title}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => openAIChat()}
        className="flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50"
        data-testid="topnav-research-assistant"
      >
        <MessageSquareText className="h-[22px] w-[22px]" strokeWidth={1.75} />
        <span className="whitespace-nowrap text-xs font-medium leading-none">Research assistant</span>
      </button>
    </nav>
  );
}
