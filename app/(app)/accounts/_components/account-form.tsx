'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createAccount, updateAccount, type AccountFormData } from '../actions';
import type { Account } from '@/lib/db/types';
import { VERTICALS, DEFAULT_VERTICAL, verticalLabel } from '@/lib/verticals';
import { errorMessage } from '@/lib/is-redirect-error';

export function AccountForm({ existing }: { existing?: Account }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<AccountFormData>({
    name: existing?.name || '',
    vertical: existing?.vertical || DEFAULT_VERTICAL,
    website: existing?.website || '',
    industry: existing?.industry || '',
    employee_count: existing?.employee_count || null,
    city: existing?.city || '',
    state: existing?.state || '',
    notes: existing?.notes || '',
    tags: existing?.tags || [],
  });
  const [tagInput, setTagInput] = useState((existing?.tags || []).join(', '));

  function set<K extends keyof AccountFormData>(key: K, value: AccountFormData[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  const selectedVerticalLabel = verticalLabel(data.vertical);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.name.trim()) {
      toast.error('Account name is required');
      return;
    }
    const tags = tagInput.split(',').map(s => s.trim()).filter(Boolean);
    startTransition(async () => {
      try {
        if (existing) {
          await updateAccount(existing.id, { ...data, tags });
          toast.success('Account updated');
          router.refresh();
        } else {
          await createAccount({ ...data, tags });
        }
      } catch (err) {
        // A successful create redirects, and Next signals that by throwing.
        // Without this guard the user sees NEXT_REDIRECT as an error toast.
        const msg = errorMessage(err);
        if (msg) toast.error(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card-lit border border-border/40 rounded-md p-6 space-y-5 relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
      <div className="grid md:grid-cols-2 gap-5">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="name" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Account name *</Label>
          <Input id="name" value={data.name} onChange={e => set('name', e.target.value)} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Vertical</Label>
          <Select
            value={data.vertical}
            onValueChange={(v: string | null) => v && set('vertical', v as AccountFormData['vertical'])}
          >
            <SelectTrigger>
              <span>{selectedVerticalLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {VERTICALS.map(v => (
                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Industry</Label>
          <Input id="industry" value={data.industry || ''} onChange={e => set('industry', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Website</Label>
          <Input id="website" type="url" value={data.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employees" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Employees</Label>
          <Input id="employees" type="number" value={data.employee_count ?? ''} onChange={e => set('employee_count', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">City</Label>
          <Input id="city" value={data.city || ''} onChange={e => set('city', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">State</Label>
          <Input id="state" value={data.state || ''} onChange={e => set('state', e.target.value)} />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="tags" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Tags (comma-separated)</Label>
          <Input id="tags" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="enterprise, q2-target, champion" />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="notes" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Notes</Label>
          <Textarea id="notes" value={data.notes || ''} onChange={e => set('notes', e.target.value)} rows={4} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} className="font-display tracking-wider btn-glow">
          {pending ? 'SAVING...' : existing ? 'UPDATE' : 'CREATE ACCOUNT'}
        </Button>
      </div>
    </form>
  );
}
