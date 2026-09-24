// The GA "Dome" mark: a round G beside an arched A that echoes the Capitol
// dome. Navy tile + white glyph on light surfaces, white tile + navy glyph on
// dark ones. `inverted` forces a variant; left unset, it follows dark mode.
// Same geometry as client/public/favicon.svg — keep the two in sync.
export function GaMark({
  size = 32,
  inverted,
  className = "",
}: {
  size?: number;
  inverted?: boolean;
  className?: string;
}) {
  const tile =
    inverted === undefined ? "fill-[#14253D] dark:fill-white" : inverted ? "fill-white" : "fill-[#14253D]";
  const glyph =
    inverted === undefined ? "stroke-white dark:stroke-[#14253D]" : inverted ? "stroke-[#14253D]" : "stroke-white";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="GovernmentAffairs.io"
      className={`shrink-0 ${className}`}
    >
      <rect width="200" height="200" rx="44" className={tile} />
      <g fill="none" strokeWidth="24" className={glyph} transform="translate(10 10) scale(0.9)">
        <path d="M80.6 77.4A32 32 0 1 0 90 100H66" />
        <path d="M124 144V92A24 24 0 0 1 172 92V144M124 118H172" />
      </g>
    </svg>
  );
}
