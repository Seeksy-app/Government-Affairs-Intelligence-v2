// CC BY 4.0 credit required wherever LegiScan data is shown (see the LegiScan
// API usage survey declarations). Plain-text version for emails lives in
// LEGISCAN_ATTRIBUTION (shared/bill-label.ts).
export function LegiScanAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`} data-testid="text-legiscan-attribution">
      State legislative data provided by{" "}
      <a href="https://legiscan.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
        LegiScan
      </a>
      , licensed under{" "}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
        CC BY 4.0
      </a>
      .
    </p>
  );
}
