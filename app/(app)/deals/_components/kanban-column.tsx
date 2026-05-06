'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DealCard } from './deal-card';
import type { DealWithRefs, PipelineStage } from '@/lib/db/deals';

export function KanbanColumn({
  stage,
  deals,
  count,
  totalValue,
  stages,
}: {
  stage: PipelineStage;
  deals: DealWithRefs[];
  count: number;
  totalValue: string;
  stages: PipelineStage[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const stageColor = stage.color || '#94A3B8';
  const isClosed = stage.is_won || stage.is_lost;

  return (
    <div className="w-[85vw] sm:w-72 md:w-72 shrink-0 flex flex-col snap-start">
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-md border border-b-0 border-border/40 bg-card-foreground/[0.03]"
        style={{ borderTop: `2px solid ${stageColor}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: stageColor }} />
          <span className="font-display text-sm tracking-wider truncate">
            {stage.name.toUpperCase()}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 rounded shrink-0">
            {count}
          </span>
        </div>
        <span className="text-xs font-display tracking-wider text-muted-foreground tabular-nums">
          {totalValue}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[400px] p-2 rounded-b-md border border-t-0 border-border/40 transition-colors ${
          isOver ? 'bg-primary/5' : 'bg-background/30'
        } ${isClosed ? 'opacity-80' : ''}`}
      >
        <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {deals.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground/60 italic">
              Drop deals here
            </div>
          ) : (
            deals.map(d => <DealCard key={d.id} deal={d} stages={stages} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
