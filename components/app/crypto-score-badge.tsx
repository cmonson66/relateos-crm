'use client';

/**
 * Compact crypto-density readout for list views.
 *
 * Uses the same violet-to-magenta ramp as the map heat layer so the two
 * surfaces read as one metric. The band colors (red/amber/slate) are
 * deliberately untouched -- density is a separate axis from merchant fit and
 * shouldn't look like a third band.
 */
export function CryptoScoreBadge({
  score,
  atmCount,
  compact = false,
}: {
  score: number | null;
  atmCount?: number | null;
  compact?: boolean;
}) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  const color =
    score >= 70 ? '#ff7ad9' : score >= 40 ? '#b93fd0' : '#6b5b8a';
  const dim = score < 40;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <span className={dim ? 'text-muted-foreground' : 'text-foreground'}>{score}</span>
        {atmCount ? <span className="text-muted-foreground/60">· {atmCount} ATM</span> : null}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2" title={atmCount ? `${atmCount} crypto ATMs within 1.5 mi` : undefined}>
      <div className="h-1 w-10 rounded-full bg-border/60 overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className={`text-xs tabular-nums ${dim ? 'text-muted-foreground' : 'text-foreground'}`}>
        {score}
      </span>
    </div>
  );
}
