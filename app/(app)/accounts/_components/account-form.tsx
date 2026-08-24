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
import { lookupPlace, checkForDuplicate, type PlaceHit, type NearbyWarning } from '../place-actions';
import Link from 'next/link';
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
    address: existing?.address || null,
    place_id: existing?.place_id || null,
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
  });
  // The address lookup. Typing an address is not enough - it has to resolve
  // to a point, or the account never shows on the map or in a canvas run.
  const [lookup, setLookup] = useState(existing?.address || '');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [warnings, setWarnings] = useState<NearbyWarning[] | null>(null);
  const [looking, setLooking] = useState(false);
  // The address the CURRENT coordinates belong to, so a retyped address can
  // be told apart from a pinned one.
  const [pinnedAddress, setPinnedAddress] = useState<string | null>(existing?.address || null);

  async function findAddress() {
    const q = [data.name, lookup].filter(Boolean).join(' ');
    setLooking(true);
    const res = await lookupPlace(q);
    setLooking(false);
    if (res.ok === false) {
      toast.error(res.message, { duration: 8000 });
      return;
    }
    setHits(res.hits);
  }

  async function pick(hit: PlaceHit) {
    setData((d) => ({
      ...d,
      address: hit.address,
      place_id: hit.placeId,
      latitude: hit.lat,
      longitude: hit.lng,
      city: d.city || hit.address.split(',')[1]?.trim() || '',
    }));
    setLookup(hit.address);
    setPinnedAddress(hit.address);
    setHits(null);

    const dup = await checkForDuplicate(hit);
    setWarnings(dup.ok ? dup.warnings : null);
  }
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
          const res = await updateAccount(existing.id, { ...data, tags });
          if (res.ok === false) {
            toast.error(res.message, { duration: 10000 });
            return;
          }
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
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="addr" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Street address
          </Label>
          <div className="flex gap-2">
            <Input
              id="addr"
              value={lookup}
              onChange={(e) => {
                setLookup(e.target.value);
                // Typed text is the address. Find it is what supplies the
                // COORDINATES. Without this the box looked editable and
                // silently discarded whatever you typed.
                set('address', e.target.value || null);
              }}
              placeholder="1421 W Bell Rd, Phoenix AZ"
            />
            <button
              type="button"
              disabled={looking || lookup.trim().length < 4}
              onClick={findAddress}
              className="shrink-0 rounded-md border border-border/40 px-4 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {looking ? 'Looking' : 'Find it'}
            </button>
          </div>

          {data.latitude && pinnedAddress && lookup.trim() === pinnedAddress.trim() ? (
            <p className="text-[11px] text-emerald-400">
              Pinned. It will show on the map and can turn up in a canvas run.
            </p>
          ) : data.latitude ? (
            <p className="text-[11px] text-amber-300/90">
              The pin still points at the old address. Tap Find it, or the map and any canvas run
              will send somebody to the wrong door.
            </p>
          ) : (
            <p className="text-[11px] text-amber-300/90">
              Not pinned yet. Without this the shop never appears on the map or in a run.
            </p>
          )}

          {hits && (
            <div className="mt-1 space-y-1">
              {hits.map((h) => (
                <button
                  key={h.placeId}
                  type="button"
                  onClick={() => pick(h)}
                  className="block w-full rounded-md border border-border/40 bg-background/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/50"
                >
                  <span className="font-medium">{h.name}</span>
                  <span className="block text-xs text-muted-foreground">{h.address}</span>
                </button>
              ))}
            </div>
          )}

          {warnings && warnings.length > 0 && (
            <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/[0.07] p-3 text-[13px]">
              <div className="mb-1 font-bold text-amber-300">
                {warnings[0].samePlace ? 'This shop is already in the book' : 'Already something here'}
              </div>
              {warnings.map((w) => (
                <div key={w.accountId} className="text-muted-foreground">
                  <Link href={`/accounts/${w.accountId}`} className="underline hover:text-foreground">
                    {w.name}
                  </Link>
                  {w.samePlace ? ' - same place' : ` - ${w.metres}m away`}
                  {w.ownerName ? `, owned by ${w.ownerName}` : ', unassigned'}
                </div>
              ))}
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Two records for one shop split its history, so neither one tells you whether they
                already said no. Open it instead unless this really is a separate business.
              </p>
            </div>
          )}
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
