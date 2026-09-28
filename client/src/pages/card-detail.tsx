import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Check, Copy, Loader2, Mail, MessageSquare, Presentation, Share2, Trash2, Undo2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardView, LEVELS, MeetingMode } from "@/components/cards/card-view";
import type { CardReply, TopicCard, TopicCardContent } from "@shared/schema";

type CardFull = TopicCard & { replies: CardReply[] };
const pad = (xs: string[], n: number) => [...xs, ...Array(Math.max(0, n - xs.length)).fill("")].slice(0, n);

// Edit a card (left), see exactly what the client sees (right), share it.
export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: card, isLoading } = useQuery<CardFull>({ queryKey: [`/api/cards/${id}`] });

  const [title, setTitle] = useState("");
  const [c, setC] = useState<TopicCardContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [meeting, setMeeting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (card && !dirty) {
      setTitle(card.title);
      setC({ ...card.content, talkingPoints: pad(card.content.talkingPoints, 3), pros: pad(card.content.pros, 3), cons: pad(card.content.cons, 3) });
    }
  }, [card, dirty]);

  // Opening the card marks its replies as read.
  useEffect(() => {
    if (card?.replies.some((r) => !r.seenAt)) {
      apiRequest("POST", `/api/cards/${id}/seen`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/cards/replies/unseen"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      });
    }
  }, [card, id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/cards/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
  };
  const fail = (err: Error) => toast({ title: "Something went wrong", description: friendlyError(err), variant: "destructive" });

  const save = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/cards/${id}`, {
        title,
        content: { ...c, talkingPoints: c!.talkingPoints.filter((x) => x.trim()), pros: c!.pros.filter((x) => x.trim()), cons: c!.cons.filter((x) => x.trim()) },
      }),
    onSuccess: () => {
      setDirty(false);
      refresh();
      toast({ title: "Card saved" });
    },
    onError: fail,
  });
  const share = useMutation({
    mutationFn: async (on: boolean) => apiRequest("POST", `/api/cards/${id}/share`, { share: on }),
    onSuccess: (_r, on) => {
      refresh();
      toast({ title: on ? "Card is shared. Copy the link to send it." : "Sharing stopped. The old link no longer works." });
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/cards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      navigate("/cards");
    },
    onError: fail,
  });

  if (isLoading || !card || !c) {
    return (
      <PageShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  const live = card.status === "shared" && !card.revokedAt;
  const url = `${window.location.origin}/card/${card.shareToken}`;
  const edit = (patch: Partial<TopicCardContent>) => {
    setC({ ...c, ...patch });
    setDirty(true);
  };
  const editList = (key: "talkingPoints" | "pros" | "cons", i: number, v: string) => {
    const next = [...c[key]];
    next[i] = v;
    edit({ [key]: next } as Partial<TopicCardContent>);
  };
  const preview: TopicCardContent = {
    ...c,
    talkingPoints: c.talkingPoints.filter((x) => x.trim()),
    pros: c.pros.filter((x) => x.trim()),
    cons: c.cons.filter((x) => x.trim()),
  };

  return (
    <PageShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/cards" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All cards
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setMeeting(true)} data-testid="button-card-meeting">
            <Presentation className="h-4 w-4" /> Meeting mode
          </Button>
          {live ? (
            <Button variant="outline" onClick={() => share.mutate(false)} disabled={share.isPending}>
              <Undo2 className="h-4 w-4" /> Stop sharing
            </Button>
          ) : (
            <Button onClick={() => share.mutate(true)} disabled={share.isPending || dirty} data-testid="button-share-card" title={dirty ? "Save your edits first" : undefined}>
              <Share2 className="h-4 w-4" /> Share
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-[#A53B39]"
            onClick={() => window.confirm("Delete this card? A shared link stops working.") && remove.mutate()}
            aria-label="Delete card"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {live && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-900/20" data-testid="card-share-bar">
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Shared</span>
          <Input readOnly value={url} className="min-w-[220px] flex-1 bg-background text-sm" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`sms:?&body=${encodeURIComponent(`${title}: ${url}`)}`}>
              <MessageSquare className="h-4 w-4" /> Text
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${preview.know}\n\n${url}`)}`}>
              <Mail className="h-4 w-4" /> Email
            </a>
          </Button>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Editor */}
        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold">Title</label>
            <Input className="mt-1.5 text-base" value={title} maxLength={90} onChange={(e) => (setTitle(e.target.value), setDirty(true))} data-testid="input-card-title" />
          </div>
          <div>
            <label className="text-sm font-semibold">Concern level</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(Object.keys(LEVELS) as Array<TopicCardContent["level"]>).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={c.level === l}
                  onClick={() => edit({ level: l })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${c.level === l ? LEVELS[l].pill : "border text-muted-foreground"}`}
                >
                  {LEVELS[l].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">What you need to know</label>
            <Textarea className="mt-1.5" rows={3} maxLength={400} value={c.know} onChange={(e) => edit({ know: e.target.value })} data-testid="input-card-know" />
          </div>
          <div>
            <label className="text-sm font-semibold">Top talking points</label>
            <div className="mt-1.5 space-y-2">
              {c.talkingPoints.map((t, i) => (
                <Input key={i} value={t} maxLength={220} placeholder={`Talking point ${i + 1}`} onChange={(e) => editList("talkingPoints", i, e.target.value)} />
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["pros", "cons"] as const).map((k) => (
              <div key={k}>
                <label className="text-sm font-semibold">{k === "pros" ? "Pros" : "Cons"}</label>
                <div className="mt-1.5 space-y-2">
                  {c[k].map((t, i) => (
                    <Input key={i} value={t} maxLength={200} placeholder={k === "pros" ? "An upside" : "A risk"} onChange={(e) => editList(k, i, e.target.value)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            {card.briefId ? (
              <Link href={`/briefs/${card.briefId}`} className="text-sm text-primary hover:underline">
                Open the full answer
              </Link>
            ) : (
              <span />
            )}
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-card">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save card
            </Button>
          </div>

          {/* Replies */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Replies</h2>
            {card.replies.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {live ? "When your client taps Got it or asks a question, it shows up here and in your email." : "Share the card to get replies."}
              </p>
            ) : (
              <ul className="mt-3 divide-y">
                {card.replies.map((r) => (
                  <li key={r.id} className="py-2.5 text-sm">
                    <p>
                      <span className="font-semibold">{r.name || "Your client"}</span>{" "}
                      <span className="text-muted-foreground">
                        {r.kind === "ack" ? "tapped Got it" : "asked a question"} ·{" "}
                        {r.createdAt ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true }) : ""}
                      </span>
                    </p>
                    {r.message && <p className="mt-1 rounded-lg bg-muted/50 p-2.5">{r.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Live preview: what the client sees */}
        <div className="lg:sticky lg:top-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">What your client sees</p>
          <div className="rounded-[2rem] border-4 border-[#14253D]/80 bg-[#F7F6F2] p-3 shadow-lg dark:bg-background">
            <CardView title={title || card.title} content={preview} />
          </div>
        </div>
      </div>

      {meeting && <MeetingMode title={title} content={preview} onClose={() => setMeeting(false)} />}
    </PageShell>
  );
}
