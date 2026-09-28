import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Layers, MessageCircleQuestion } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LEVELS } from "@/components/cards/card-view";
import type { CardReply, TopicCard } from "@shared/schema";

type CardRow = TopicCard & { replies: CardReply[] };

// Every card the firm has made, newest first, with sharing state and replies.
export default function CardsPage() {
  const { data: cards, isLoading } = useQuery<CardRow[]>({ queryKey: ["/api/cards"] });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Share"
        title="Topic Cards"
        description="One-screen summaries to share with a client or pull up in a meeting. Make one from any Should I be worried? answer."
        actions={
          <Button asChild>
            <Link href="/briefs">Make a card from an answer</Link>
          </Button>
        }
      />
      {isLoading ? null : !cards?.length ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No cards yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Open any answer under Should I be worried? and click Make a card.</p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]" data-testid="cards-grid">
          {cards.map((c) => {
            const level = LEVELS[c.content.level] ?? LEVELS.watch;
            const live = c.status === "shared" && !c.revokedAt;
            const unseen = c.replies.filter((r) => !r.seenAt);
            return (
              <Link
                key={c.id}
                href={`/cards/${c.id}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
                data-testid={`card-row-${c.id}`}
              >
                <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${level.bar}`} />
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${level.pill}`}>{level.label}</span>
                  <span className={`text-xs font-semibold ${live ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {live ? "Shared" : "Not shared"}
                  </span>
                </div>
                <p className="mt-2 font-semibold leading-snug group-hover:text-primary">{c.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.content.know}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Updated {c.updatedAt ? formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true }) : ""}</span>
                  {unseen.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
                      <MessageCircleQuestion className="h-3 w-3" /> {unseen.length} new
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
