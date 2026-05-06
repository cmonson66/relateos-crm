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
import { createContact, updateContact, type ContactFormData } from '../actions';
import type { Contact } from '@/lib/db/types';

const LIFECYCLE_LABEL: Record<string, string> = {
  new: 'New',
  working: 'Working',
  engaged: 'Engaged',
  customer: 'Customer',
  disqualified: 'Disqualified',
};

export function ContactForm({
  existing,
  accounts,
  defaultAccountId,
}: {
  existing?: Contact;
  accounts: { id: string; name: string }[];
  defaultAccountId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<ContactFormData>({
    first_name: existing?.first_name || '',
    last_name: existing?.last_name || '',
    email: existing?.email || '',
    phone: existing?.phone || '',
    title: existing?.title || '',
    linkedin_url: existing?.linkedin_url || '',
    account_id: existing?.account_id || defaultAccountId || null,
    lifecycle_stage: existing?.lifecycle_stage || 'new',
    notes: existing?.notes || '',
    tags: existing?.tags || [],
  });
  const [tagInput, setTagInput] = useState((existing?.tags || []).join(', '));

  function set<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  const accountLabel = accounts.find(a => a.id === data.account_id)?.name;
  const lifecycleLabel = LIFECYCLE_LABEL[data.lifecycle_stage] || data.lifecycle_stage;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    const tags = tagInput.split(',').map(s => s.trim()).filter(Boolean);
    startTransition(async () => {
      try {
        if (existing) {
          await updateContact(existing.id, { ...data, tags });
          toast.success('Contact updated');
          router.refresh();
        } else {
          await createContact({ ...data, tags });
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
        <div className="space-y-2">
          <Label htmlFor="first_name" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">First name *</Label>
          <Input id="first_name" value={data.first_name} onChange={e => set('first_name', e.target.value)} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Last name</Label>
          <Input id="last_name" value={data.last_name || ''} onChange={e => set('last_name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Email</Label>
          <Input id="email" type="email" value={data.email || ''} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Phone</Label>
          <Input id="phone" value={data.phone || ''} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Title</Label>
          <Input id="title" value={data.title || ''} onChange={e => set('title', e.target.value)} placeholder="VP People & Culture" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="linkedin" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">LinkedIn URL</Label>
          <Input id="linkedin" type="url" value={data.linkedin_url || ''} onChange={e => set('linkedin_url', e.target.value)}
            placeholder="https://linkedin.com/in/…" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Account</Label>
          <Select
            value={data.account_id || 'none'}
            onValueChange={(v: string | null) => set('account_id', !v || v === 'none' ? null : v)}
          >
            <SelectTrigger>
              <span className={accountLabel ? '' : 'text-muted-foreground'}>
                {accountLabel || 'None'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Lifecycle stage</Label>
          <Select
            value={data.lifecycle_stage}
            onValueChange={(v: string | null) => v && set('lifecycle_stage', v as ContactFormData['lifecycle_stage'])}
          >
            <SelectTrigger>
              <span>{lifecycleLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="working">Working</SelectItem>
              <SelectItem value="engaged">Engaged</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="disqualified">Disqualified</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="tags" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Tags (comma-separated)</Label>
          <Input id="tags" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="champion, decision-maker" />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="notes" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Notes</Label>
          <Textarea id="notes" value={data.notes || ''} onChange={e => set('notes', e.target.value)} rows={4} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} className="font-display tracking-wider btn-glow">
          {pending ? 'SAVING...' : existing ? 'UPDATE' : 'CREATE CONTACT'}
        </Button>
      </div>
    </form>
  );
}
