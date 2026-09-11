'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteDealInline } from '../actions';
import { cn } from '@/lib/utils';
import { initials, formatRelative } from '@/lib/utils/format';
import { formatDealValue, type DealWithRefs, type PipelineStage } from '@/lib/db/deals';
import { trialStatus } from '@/lib/db/trials';

export function DealCard({
  deal,
  stages,
  dragging,
  canDelete,
}: {
  deal: DealWithRefs;
  stages: PipelineStage[];
  dragging?: boolean;
  canDelete?: boolean;
}) {
  const [deletePending, startDelete] = useTransition();
  const router = useRouter();

  // Quick cleanup straight from the board - handy after demo/test deals
  const removeDeal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete the deal "${deal.name}"?\n\nThe account and its history stay. This cannot be undone.`)) return;
    startDelete(async () => {
      try {
        await deleteDealInline(deal.id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  };
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // deals_with_stage is a flat view: stage_is_won / stage_is_lost, no nested
  // stage object. Reading deal.stage.is_won threw on every render of this
  // page, which is why the board would not open at all.
  const stale = deal.days_in_stage >= 14 && !deal.stage_is_won && !deal.stage_is_lost;

  // A running trial is its own clock - a terminal is sitting in someone's
  // shop, so the days-in-stage counter is the wrong thing to watch.
  const trial = trialStatus(deal);
  const showTrial = trial && !trial.finished;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'card-lit group border border-border/40 rounded-md p-3 mb-2 cursor-grab active:cursor-grabbing',
        'hover:border-primary/40 transition-colors',
        dragging && 'shadow-2xl border-primary/60 glow-stripe-soft cursor-grabbing',
        stale && 'border-destructive/30'
      )}
    >
      <Link
        href={`/deals/${deal.id}`}
        onClick={e => isDragging && e.preventDefault()}
        className="block"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-medium text-sm leading-tight line-clamp-2 min-w-0">
            {deal.name}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {stale && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
            {canDelete && (
              <button
                type="button"
                onPointerDown={e => e.stopPropagation()}
                onClick={removeDeal}
                disabled={deletePending}
                title="Delete deal"
                className="rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {deal.account && (
          <div className="text-xs text-muted-foreground mb-3 truncate">
            {deal.account.name}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <div className="font-display text-xl tracking-wider text-primary text-glow-primary">
            {formatDealValue(deal.value_cents)}
          </div>
          {showTrial && (
            <span className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums shrink-0',
              trial.tone === 'over'
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : trial.tone === 'closing'
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                  : 'border-border/40 text-muted-foreground'
            )}>
              {trial.tone === 'over' ? 'Trial over' : trial.label}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
          {deal.owner ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-medium flex items-center justify-center shrink-0">
                {initials(deal.owner.full_name, deal.owner.email)}
              </div>
              <span className="text-[10px] text-muted-foreground truncate">
                {(deal.owner.full_name || deal.owner.email).split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">unassigned</span>
          )}
          <span className={cn(
            'text-[10px] tabular-nums flex items-center gap-1',
            stale ? 'text-destructive font-medium' : 'text-muted-foreground'
          )}>
            <Clock className="h-2.5 w-2.5" />
            {deal.days_in_stage}d
          </span>
        </div>
      </Link>
    </div>
  );
}
