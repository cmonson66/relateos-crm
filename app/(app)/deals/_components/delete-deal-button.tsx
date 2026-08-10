'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteDeal } from '../actions';

// Deleting a deal removes the pipeline card only - the account, its
// contacts, and every logged call or visit stay exactly where they are.
export function DeleteDealButton({ dealId, dealName }: { dealId: string; dealName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = () => {
    if (!confirm(`Delete the deal "${dealName}"?\n\nThe account and its history stay - only this pipeline card goes. This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteDeal(dealId);
        // deleteDeal redirects on success; this is the fallback
        router.push('/deals');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Delete failed';
        if (msg.includes('NEXT_REDIRECT')) return;
        toast.error(msg);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={run}
      className="border-destructive/50 text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
