import type { ReactNode } from "react";

// The one page-title pattern for the app: optional eyebrow (the sidebar
// section the page lives in), a 650-weight title, a one-line description,
// and right-aligned actions. Keep descriptions to a single plain sentence.
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = "",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  /** Extra content under the title row, e.g. tabs or stat chips. */
  children?: ReactNode;
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground" data-testid="text-page-title">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// Standard page frame: consistent max width and gutters for content pages.
export function PageShell({
  children,
  width = "wide",
  className = "",
}: {
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  // Use the room, with breathing space: pages run wide, side padding grows
  // with the screen, and a 1600px cap keeps ultra-wide monitors readable.
  // "narrow" is for forms only.
  const max = width === "narrow" ? "max-w-5xl" : "max-w-[1600px]";
  return (
    <div className={`mx-auto w-full ${max} px-4 py-6 sm:px-6 lg:px-10 lg:py-8 xl:px-14 2xl:px-20 ${className}`}>
      {children}
    </div>
  );
}
