import { formatDistanceToNow } from "date-fns";

// What a top-bar badge was counting, shown at the top of the page it opens.
export interface NewItem {
  id: string;
  title: string;
  href: string;
  meta?: string;
  at?: string | Date | null;
}

export function NewSinceStrip({ items, noun, className = "mb-5" }: { items: NewItem[]; noun: string; className?: string }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);
  return (
    <section className={`${className} rounded-xl border border-primary/25 bg-primary/5 p-4`} data-testid="new-since-strip">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
        New since you last looked · {items.length} {noun}
      </p>
      <ul className="mt-2 space-y-1.5">
        {shown.map((it) => (
          <li key={it.id} className="flex items-start gap-2 text-sm">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span className="min-w-0">
              <a href={it.href} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary hover:underline">
                {it.title}
              </a>
              {(it.meta || it.at) && (
                <span className="text-muted-foreground">
                  {" · "}
                  {[it.meta, it.at ? formatDistanceToNow(new Date(it.at), { addSuffix: true }) : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {items.length > shown.length && (
        <p className="mt-2 text-xs text-muted-foreground">+{items.length - shown.length} more, marked New below.</p>
      )}
    </section>
  );
}

export function NewPill() {
  return (
    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground" data-testid="pill-new">
      New
    </span>
  );
}
