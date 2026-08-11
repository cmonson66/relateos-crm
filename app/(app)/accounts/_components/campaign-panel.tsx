import { Mail, Zap, CheckCircle2, Clock, ExternalLink } from 'lucide-react';

// Where this shop stands in the outbound sequence, in plain language.
const STAGE_LABEL: Record<number, string> = {
  0: 'Not emailed yet',
  1: 'Email 1 sent - the opener',
  2: 'Email 2 sent - the napkin math',
  3: 'Email 3 sent - the objection answer',
  4: 'Email 4 sent - the neighborhood',
  5: 'Email 5 sent - new customers',
  6: 'Email 6 sent - the last one',
};

// Gaps the engine uses between stages
const GAP: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 };

export function CampaignPanel({
  intel,
  pulseUrl,
}: {
  intel: {
    email_stage?: number; status?: string; band?: string; score?: number;
    monthly_volume?: number | null; emails?: number;
  };
  pulseUrl: string | null;
}) {
  const stage = intel.email_stage ?? 0;
  const status = intel.status ?? 'NEW';
  const emailable = (intel.emails ?? 0) > 0;
  const done = stage >= 6;
  const engaged = status !== 'NEW' && status !== 'EMAILED';
  const nextGap = GAP[stage];

  return (
    <div className="card-lit relative rounded-md border border-border/40 p-5 mb-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider">
        <Mail className="h-4 w-4 text-primary" /> CAMPAIGN
      </h2>

      {/* six dots, one per email */}
      <div className="mb-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5, 6].map(n => (
          <div
            key={n}
            title={`Email ${n}`}
            className={`h-2 flex-1 rounded-full ${
              n <= stage ? 'bg-primary' : 'bg-border/40'
            }`}
          />
        ))}
      </div>

      <div className="text-sm font-medium">{STAGE_LABEL[stage] ?? `Email ${stage} sent`}</div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {!emailable && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> No email address - this one is a door or a phone call
          </div>
        )}
        {engaged && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Zap className="h-3.5 w-3.5" /> Sequence stopped - they engaged ({status})
          </div>
        )}
        {!engaged && done && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sequence complete - no more automatic emails
          </div>
        )}
        {!engaged && !done && emailable && stage > 0 && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Email {stage + 1} goes out about {nextGap} days after the last one
          </div>
        )}
        {!engaged && stage === 0 && emailable && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Queued - will start when the campaign reaches them
          </div>
        )}
        {intel.monthly_volume != null && (
          <div className="text-amber-400">
            Told us they do ${Math.round(intel.monthly_volume).toLocaleString()}/mo on cards
          </div>
        )}
      </div>

      {pulseUrl && (
        <a
          href={pulseUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open this shop's Pulse page in a new tab"
          className="mt-3 flex items-center gap-2 break-all rounded-md border border-amber-500/30 bg-amber-500/[0.05] px-2.5 py-1.5 font-mono text-[11px] text-amber-200 transition-colors hover:border-amber-500/60 hover:bg-amber-500/10"
        >
          <span className="min-w-0 flex-1 underline decoration-amber-500/40 underline-offset-2">{pulseUrl}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </a>
      )}
    </div>
  );
}
