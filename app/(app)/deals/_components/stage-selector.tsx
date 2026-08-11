'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { updateDealStage } from '../actions';
import type { PipelineStage } from '@/lib/db/deals';

export function StageSelector({
  dealId,
  currentStageId,
  stages,
}: {
  dealId: string;
  currentStageId: string;
  stages: PipelineStage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currentLabel = stages.find(s => s.id === currentStageId)?.name || 'Unknown';

  function handleChange(value: string | null) {
    if (!value || value === currentStageId) return;
    startTransition(async () => {
      try {
        const res = await updateDealStage(dealId, value);
        if (res && res.ok === false) {
          // Refused - the select is uncontrolled here, so refresh puts the
          // label back to the real stage rather than leaving a lie on screen.
          toast.error(res.message);
          router.refresh();
          return;
        }
        toast.success('Stage updated');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      }
    });
  }

  return (
    <Select value={currentStageId} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="font-display tracking-wider text-sm h-9">
        <span>{currentLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {stages.map(s => (
          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
