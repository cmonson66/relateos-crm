'use client';

// Sync with visible result. The silent form-post version made a working
// sync and a failed one look identical - every outcome now surfaces,
// including WHY a skip happened.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { enrichAccount } from '../enrich';

export function SyncButton({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  const run = () => {
    setDone(false);
    startTransition(async () => {
      try {
        const r = await enrichAccount(accountId);
        if (r.status === 'linked') {
          toast.success(
            r.cryptoScore != null
              ? `Linked - crypto density ${Math.round(r.cryptoScore)}. Pin and band are live.`
              : 'Linked - pin and band are live.'
          );
          setDone(true);
          router.refresh();
        } else if (r.status === 'duplicate') {
          toast.error('This business is already in the CRM under another account.');
        } else if (r.status === 'no-match') {
          toast.error('No confident Google match - check the account name and city, then try again.');
        } else {
          toast.error(`Sync unavailable: ${r.reason}`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Sync failed');
      }
    });
  };

  return (
    <Button
      type="button"
      onClick={run}
      disabled={pending}
      variant="outline"
      size="sm"
      className="font-display tracking-wider"
      title="Match on Google - map pin, band, crypto score"
    >
      {pending ? 'SYNCING…' : done ? '\u2713 Synced' : '\uD83D\uDD17 Sync'}
    </Button>
  );
}
