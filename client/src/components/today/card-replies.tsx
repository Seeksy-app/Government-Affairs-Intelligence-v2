import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, MessageCircleQuestion } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface UnseenReply {
  id: string;
  cardId: string;
  kind: "ack" | "question";
  name: string | null;
  message: string | null;
  createdAt: string | null;
  title: string;
}

// New client replies to shared cards, at the top of Today until opened.
export function CardReplies() {
  const { user } = useAuth();
  const { data } = useQuery<UnseenReply[]>({
    queryKey: ["/api/cards/replies/unseen"],
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000,
    retry: false,
  });
  if (!data?.length) return null;
  return (
    <section className="mb-6 rounded-xl border border-primary/30 bg-primary/[0.04] p-4" data-testid="section-card-replies">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Client replies</p>
      <ul className="space-y-2">
        {data.slice(0, 4).map((r) => (
          <li key={r.id}>
            <Link href={`/cards/${r.cardId}`} className="group flex items-start gap-2.5 text-sm">
              {r.kind === "question" ? (
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <span className="min-w-0">
                <span className="font-semibold">{r.name || "Your client"}</span>{" "}
                {r.kind === "question" ? "asked about" : "read"}{" "}
                <span className="font-medium group-hover:text-primary group-hover:underline">{r.title}</span>
                {r.message && <span className="block truncate text-muted-foreground">“{r.message}”</span>}
                <span className="block text-xs text-muted-foreground">{r.createdAt ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true }) : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
