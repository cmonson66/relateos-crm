'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteContact } from '../actions';

// Removing a person from a shop. The account itself, its deals, and its
// logged visits stay - only this contact and their own logged activity go.
export function DeleteContactButton({
  contactId,
  name,
  accountId,
}: {
  contactId: string;
  name: string;
  accountId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = () => {
    if (!confirm(`Delete ${name}?\n\nThe account stays - only this contact goes. This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteContact(contactId);
        router.push(accountId ? `/accounts/${accountId}` : '/contacts');
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
