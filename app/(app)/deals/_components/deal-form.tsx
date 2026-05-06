'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createDeal, updateDeal, type DealFormData } from '../actions';
import type { Deal, PipelineStage } from '@/lib/db/deals';

type ContactOption = { id: string; first_name: string; last_name: string | null; account_id: string | null };
type AccountOption = { id: string; name: string };

export function DealForm({
  existing,
  accounts,
  contacts,
  stages,
  defaultAccountId,
  defaultContactId,
}: {
  existing?: Deal;
  accounts: AccountOption[];
  contacts: ContactOption[];
  stages: PipelineStage[];
  defaultAccountId?: string;
  defaultContactId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const firstStage = useMemo(
    () => stages.find(s => s.position === 1) || stages[0],
    [stages]
  );

  const [name, setName] = useState(existing?.name || '');
  const [accountId, setAccountId] = useState(existing?.account_id || defaultAccountId || '');
  const [contactId, setContactId] = useState<string>(existing?.primary_contact_id || defaultContactId || '');
  const [stageId, setStageId] = useState(existing?.stage_id || firstStage?.id || '');
  const [valueDollars, setValueDollars] = useState(
    existing?.value_cents ? String(existing.value_cents / 100) : ''
  );
  const [closeDate, setCloseDate] = useState(existing?.expected_close_date || '');
  const [notes, setNotes] = useState(existing?.notes || '');

  useEffect(() => {
    if (!stageId && firstStage) setStageId(firstStage.id);
  }, [firstStage, stageId]);

  const filteredContacts = useMemo(
    () => accountId
      ? contacts.filter(c => c.account_id === accountId || c.id === contactId)
      : contacts,
    [contacts, accountId, contactId]
  );

  // Manual label resolution — bulletproof against shadcn Select rendering quirks
  const accountLabel = accounts.find(a => a.id === accountId)?.name;
  const contactLabel = (() => {
    const c = contacts.find(x => x.id === contactId);
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : null;
  })();
  const stageLabel = stages.find(s => s.id === stageId)?.name;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Deal name is required');
    if (!accountId) return toast.error('Account is required');
    if (!stageId) return toast.error('Stage is required');

    const cents = Math.round(parseFloat(valueDollars || '0') * 100);
    const payload: DealFormData = {
      name: name.trim(),
      account_id: accountId,
      primary_contact_id: contactId || null,
      stage_id: stageId,
      value_cents: isNaN(cents) ? 0 : cents,
      expected_close_date: closeDate || null,
      notes: notes || null,
    };

    startTransition(async () => {
      try {
        if (existing) {
          await updateDeal(existing.id, payload);
          toast.success('Deal updated');
          router.refresh();
        } else {
          await createDeal(payload);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card-lit border border-border/40 rounded-md p-6 space-y-5 relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
      <div className="grid md:grid-cols-2 gap-5">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="name" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Deal name *</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} required autoFocus
            placeholder="e.g. Q3 Leadership Cohort" />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Account *</Label>
          <Select value={accountId || undefined} onValueChange={setAccountId}>
            <SelectTrigger>
              <span className={accountLabel ? '' : 'text-muted-foreground'}>
                {accountLabel || 'Select account…'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Primary contact</Label>
          <Select
            value={contactId || 'none'}
            onValueChange={(v) => setContactId(v === 'none' ? '' : v)}
          >
            <SelectTrigger>
              <span className={contactLabel ? '' : 'text-muted-foreground'}>
                {contactLabel || 'None'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {filteredContacts.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name || ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Stage</Label>
          <Select value={stageId || undefined} onValueChange={setStageId}>
            <SelectTrigger>
              <span className={stageLabel ? '' : 'text-muted-foreground'}>
                {stageLabel || 'Select stage…'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="value" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Value (USD)</Label>
          <Input id="value" type="number" step="0.01" min="0" value={valueDollars}
            onChange={e => setValueDollars(e.target.value)} placeholder="0" />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="close" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Expected close date</Label>
          <Input id="close" type="date" value={closeDate || ''}
            onChange={e => setCloseDate(e.target.value)} />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="notes" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Notes</Label>
          <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} className="font-display tracking-wider btn-glow">
          {pending ? 'SAVING...' : existing ? 'UPDATE' : 'CREATE DEAL'}
        </Button>
      </div>
    </form>
  );
}
