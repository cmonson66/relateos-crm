'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials, formatRelative } from '@/lib/utils/format';
import { formatDealValue, type DealWithRefs, type PipelineStage } from '@/lib/db/deals';

export function DealCard({
  deal,
  stages,
  dragging,
}: {
  deal: DealWithRefs;
  stages: PipelineStage[];
  dragging?: boolean;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const stale = deal.days_in_stage >= 14 && !deal.stage.is_won && !deal.stage.is_lost;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'card-lit border border-border/40 rounded-md p-3 mb-2 cursor-grab active:cursor-grabbing',
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
          {stale && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
        </div>

        {deal.account && (
          <div className="text-xs text-muted-foreground mb-3 truncate">
            {deal.account.name}
          </div>
        )}

        <div className="flex items-baseline justify-between mb-2.5">
          <div className="font-display text-xl tracking-wider text-primary text-glow-primary">
            {formatDealValue(deal.value_cents)}
          </div>
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
