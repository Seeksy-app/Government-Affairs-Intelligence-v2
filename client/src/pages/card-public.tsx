import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, MessageCircleQuestion, Presentation } from "lucide-react";
import { GaMark } from "@/components/ga-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardView, MeetingMode } from "@/components/cards/card-view";
import type { TopicCardContent } from "@shared/schema";

interface PublicCard {
  title: string;
  content: TopicCardContent;
  firmName: string | null;
}

// The client's view of a shared card: phone-first, installable, readable
// offline once opened (service worker scoped to /card/), with a reply back.
export default function CardPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading } = useQuery<PublicCard>({
    queryKey: ["/api/public/cards", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/cards/${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "This card isn't available.");
      return body;
    },
    retry: false,
  });
  const [meeting, setMeeting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<"ack" | "question" | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (data?.title) document.title = `${data.title} · ${data.firmName ?? "GovernmentAffairs.io"}`;
  }, [data]);

  // Offline copy: a small service worker for /card/ pages only.
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/card/sw.js", { scope: "/card/" }).catch(() => {});
  }, []);

  const reply = async (kind: "ack" | "question") => {
    setProblem(null);
    if (kind === "question" && !message.trim()) return setProblem("Type your question first.");
    setBusy(true);
    try {
      const res = await fetch(`/api/public/cards/${encodeURIComponent(token)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: name.trim() || undefined, message: kind === "question" ? message.trim() : undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "Couldn't send that.");
      setSent(kind);
      setAsking(false);
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] pb-[env(safe-area-inset-bottom)] dark:bg-background">
      <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="font-semibold">This card isn't available</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "It may have been unshared."} Ask whoever sent it for a new link.</p>
          </div>
        ) : (
          <>
            <CardView title={data.title} content={data.content} firmName={data.firmName} />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 bg-card" onClick={() => setMeeting(true)} data-testid="button-meeting-mode">
                <Presentation className="h-4 w-4" /> Meeting mode
              </Button>
              {sent ? (
                <div className="flex h-12 items-center justify-center gap-1.5 rounded-md border bg-card text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check className="h-4 w-4" /> {sent === "ack" ? "Thanks, they'll know" : "Question sent"}
                </div>
              ) : (
                <Button className="h-12" disabled={busy} onClick={() => reply("ack")} data-testid="button-got-it">
                  <Check className="h-4 w-4" /> Got it
                </Button>
              )}
            </div>

            {!sent && (
              <div className="mt-2">
                {asking ? (
                  <div className="space-y-2 rounded-2xl border bg-card p-4">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" maxLength={80} />
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your question" rows={3} maxLength={1000} autoFocus data-testid="input-card-question" />
                    {problem && <p className="text-sm text-[#A53B39]">{problem}</p>}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setAsking(false)}>
                        Cancel
                      </Button>
                      <Button disabled={busy} onClick={() => reply("question")} data-testid="button-send-question">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send question
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="h-11 w-full" onClick={() => setAsking(true)} data-testid="button-ask-card-question">
                    <MessageCircleQuestion className="h-4 w-4" /> I have a question
                  </Button>
                )}
              </div>
            )}

            <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <GaMark size={16} /> Shared with GovernmentAffairs.io · Tip: add this page to your home screen
            </p>
          </>
        )}
      </div>
      {meeting && data && <MeetingMode title={data.title} content={data.content} onClose={() => setMeeting(false)} />}
    </div>
  );
}
