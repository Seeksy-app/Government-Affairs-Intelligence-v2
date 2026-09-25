import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AskBox } from "@/components/briefs/ask-box";

// Daily-read feeds live in the top bar, next to search, so the rail can stay
// short. Pages still appear in the phone menu.
const FEEDS = [
  { title: "News", url: "/news" },
  { title: "Press", url: "/press-releases" },
  { title: "Markets", url: "/predictions" },
];

export function TopBarLinks() {
  const [location] = useLocation();
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Feeds">
      {FEEDS.map((f) => {
        const active = location === f.url || location.startsWith(f.url + "/");
        return (
          <Link
            key={f.url}
            href={f.url}
            aria-current={active ? "page" : undefined}
            data-testid={`topnav-${f.title.toLowerCase()}`}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {f.title}
          </Link>
        );
      })}
    </nav>
  );
}

// "Should I be worried?" from anywhere: opens the ask box over the current page.
export function AskButton() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  // Submitting navigates to the new brief — close on any route change.
  useEffect(() => setOpen(false), [location]);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        aria-label="Should I be worried?"
        data-testid="button-ask-worried"
      >
        <MessageCircleQuestion className="h-4 w-4" />
        <span className="hidden xl:inline">Should I be worried?</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl gap-0 border-0 bg-transparent p-0 shadow-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Should I be worried?</DialogTitle>
          <AskBox />
        </DialogContent>
      </Dialog>
    </>
  );
}
