import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Relevance-score pill with a hover/focus explanation. Callers pass the
// color classes (scoreColor) and any size tweaks via className.
export function ScoreBadge({
  score,
  className = "",
  label,
}: {
  score: number;
  className?: string;
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={`inline-flex items-center justify-center rounded-md border tabular-nums cursor-help ${className}`}
        >
          {label ? `${label} ${score}` : score}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[250px]">
        <p className="font-semibold mb-1">Relevance score: {score} / 100</p>
        <p className="text-xs leading-relaxed">
          How closely this item matches your firm's watchlist topics, agencies,
          and committees — not a percentage. 70+ is a top priority; 40–69 is
          worth watching.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
