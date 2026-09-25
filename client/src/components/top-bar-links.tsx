import { Link, useLocation } from "wouter";
import { BarChart3, Megaphone, MessageCircleQuestion, Newspaper, type LucideIcon } from "lucide-react";

// Daily-read feeds and "Should I be worried?" live in the top bar, next to
// search, so the rail can stay short. They also appear in the phone menu.
const LINKS: Array<{ title: string; url: string; icon: LucideIcon; testId: string }> = [
  { title: "News", url: "/news", icon: Newspaper, testId: "topnav-news" },
  { title: "Press", url: "/press-releases", icon: Megaphone, testId: "topnav-press" },
  { title: "Markets", url: "/predictions", icon: BarChart3, testId: "topnav-markets" },
  { title: "Should I be worried?", url: "/briefs", icon: MessageCircleQuestion, testId: "topnav-worried" },
];

export function TopBarLinks() {
  const [location] = useLocation();
  return (
    <nav className="hidden items-stretch gap-1 lg:flex" aria-label="Feeds">
      {LINKS.map((l) => {
        const active = location === l.url || location.startsWith(l.url + "/");
        return (
          <Link
            key={l.url}
            href={l.url}
            aria-current={active ? "page" : undefined}
            data-testid={l.testId}
            className={`flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring/50 ${
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <l.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.1 : 1.75} />
            <span className={`whitespace-nowrap text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
              {l.title}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
