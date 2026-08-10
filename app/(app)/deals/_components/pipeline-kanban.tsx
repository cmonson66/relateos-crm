'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
  closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { DealCard } from './deal-card';
import { KanbanColumn } from './kanban-column';
import { updateDealStage } from '../actions';
import { formatDealValue, type DealWithRefs, type PipelineStage } from '@/lib/db/deals';

export function PipelineKanban({
  initialDeals,
  stages,
  canDelete,
}: {
  initialDeals: DealWithRefs[];
  stages: PipelineStage[];
  canDelete?: boolean;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dealsByStage = useMemo(() => {
    const grouped = new Map<string, DealWithRefs[]>();
    stages.forEach(s => grouped.set(s.id, []));
    deals.forEach(d => {
      const list = grouped.get(d.stage_id);
      if (list) list.push(d);
    });
    return grouped;
  }, [deals, stages]);

  const stageTotals = useMemo(() => {
    const totals = new Map<string, { count: number; value: number }>();
    stages.forEach(s => {
      const list = dealsByStage.get(s.id) || [];
      totals.set(s.id, {
        count: list.length,
        value: list.reduce((sum, d) => sum + (d.value_cents || 0), 0),
      });
    });
    return totals;
  }, [dealsByStage, stages]);

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const dealId = active.id as string;
    const overId = over.id as string;

    let targetStageId = overId;
    const overDeal = deals.find(d => d.id === overId);
    if (overDeal) targetStageId = overDeal.stage_id;

    const movedDeal = deals.find(d => d.id === dealId);
    if (!movedDeal) return;
    if (movedDeal.stage_id === targetStageId) return;

    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) return;

    setDeals(curr => curr.map(d =>
      d.id === dealId
        ? { ...d, stage_id: targetStageId, stage: targetStage, days_in_stage: 0 }
        : d
    ));

    startTransition(async () => {
      try {
        await updateDealStage(dealId, targetStageId);
        toast.success(`Moved to ${targetStage.name}`);
      } catch (err) {
        setDeals(initialDeals);
        toast.error(err instanceof Error ? err.message : 'Failed to update');
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Mobile hint */}
      <div className="md:hidden mb-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        Swipe → between stages · tap a deal to change stage
      </div>

      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x-mandatory md:snap-none -mx-4 px-4 md:mx-0 md:px-0">
        {stages.map(stage => {
          const totals = stageTotals.get(stage.id) || { count: 0, value: 0 };
          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage.get(stage.id) || []}
              count={totals.count}
              totalValue={formatDealValue(totals.value)}
              stages={stages}
              canDelete={canDelete}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} stages={stages} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
