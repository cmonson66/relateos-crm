'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Clock, Power, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { createRegion, updateRegion } from '../actions';

export type RegionCard = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  send_hour: number;
  agenda_hour: number;
  is_active: boolean;
  people: number;
  accounts: number;
  leads: number;
  campaign_status: 'running' | 'paused' | null;
};

// A short list beats a free-text box: the 058 trigger rejects an unknown zone
// by name, but the friendlier fix is not offering a wrong one. Anything else
// can still be set directly in the database.
const ZONES = [
  { value: 'America/Phoenix', label: 'Phoenix - Arizona, no DST' },
  { value: 'America/Chicago', label: 'Central - Dallas, Chicago' },
  { value: 'America/New_York', label: 'Eastern - Atlanta, Miami' },
  { value: 'America/Denver', label: 'Mountain - Denver, Salt Lake' },
  { value: 'America/Los_Angeles', label: 'Pacific - Los Angeles, Seattle' },
];

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
}));

// This Select renders whatever raw value it is given, so every trigger below
// resolves its own label. Left to SelectValue, the hour pickers displayed "6"
// and "7" and the timezone picker displayed the IANA string.
function zoneLabel(tz: string): string {
  return ZONES.find((z) => z.value === tz)?.label ?? tz;
}

function hourLabel(h: number): string {
  return HOURS.find((x) => x.value === String(h))?.label ?? String(h);
}

function localNow(tz: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  } catch {
    return '';
  }
}

export function RegionsManager({
  regions,
  canCreate = false,
}: {
  regions: RegionCard[];
  /** Creating a region is super_admin only (067). Admins can still tune one. */
  canCreate?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    timezone: 'America/Chicago',
    send_hour: 6,
    agenda_hour: 7,
  });

  function run(fn: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.ok === false) {
        toast.error(res.message);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-4">
      {regions.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-display text-xs tracking-wider text-primary">
                  {r.code}
                </span>
                <h2 className="truncate font-display text-lg tracking-wide">{r.name}</h2>
                {!r.is_active && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Off</span>
                )}
                {r.campaign_status && (
                  <span
                    className={
                      r.campaign_status === 'running'
                        ? 'rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600'
                        : 'rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600'
                    }
                  >
                    Campaign {r.campaign_status}
                  </span>
                )}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {localNow(r.timezone)} local
                <span className="text-muted-foreground/50">|</span>
                {r.people} on the team
                <span className="text-muted-foreground/50">|</span>
                {r.accounts.toLocaleString()} shops
                <span className="text-muted-foreground/50">|</span>
                {r.leads.toLocaleString()} leads
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => updateRegion(r.id, { is_active: !r.is_active }))}
            >
              <Power className="mr-1.5 h-3.5 w-3.5" />
              {r.is_active ? 'Turn off' : 'Turn on'}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Time zone</Label>
              <Select
                value={r.timezone}
                disabled={pending}
                onValueChange={(v: string | null) => v && run(() => updateRegion(r.id, { timezone: v }))}
              >
                <SelectTrigger className="mt-1"><span className="truncate">{zoneLabel(r.timezone)}</span></SelectTrigger>
                <SelectContent>
                  {ZONES.some((z) => z.value === r.timezone) ? null : (
                    <SelectItem value={r.timezone}>{r.timezone}</SelectItem>
                  )}
                  {ZONES.map((z) => (
                    <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Campaign sends at</Label>
              <Select
                value={String(r.send_hour)}
                disabled={pending}
                onValueChange={(v: string | null) => v && run(() => updateRegion(r.id, { send_hour: Number(v) }))}
              >
                <SelectTrigger className="mt-1"><span>{hourLabel(r.send_hour)}</span></SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agenda email at</Label>
              <Select
                value={String(r.agenda_hour)}
                disabled={pending}
                onValueChange={(v: string | null) => v && run(() => updateRegion(r.id, { agenda_hour: Number(v) }))}
              >
                <SelectTrigger className="mt-1"><span>{hourLabel(r.agenda_hour)}</span></SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Both times are this region&apos;s own clock. The hourly cron acts when it matches.
          </p>
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-dashed bg-card p-4">
          <h2 className="font-display text-lg tracking-wide">New region</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs" htmlFor="rg-name">Name</Label>
              <Input
                id="rg-name"
                className="mt-1"
                placeholder="Dallas / Fort Worth"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs" htmlFor="rg-code">Short code</Label>
              <Input
                id="rg-code"
                className="mt-1"
                placeholder="DFW"
                maxLength={8}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label className="text-xs">Time zone</Label>
              <Select value={form.timezone} onValueChange={(v: string | null) => v && setForm({ ...form, timezone: v })}>
                <SelectTrigger className="mt-1"><span className="truncate">{zoneLabel(form.timezone)}</span></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sends at</Label>
                <Select
                  value={String(form.send_hour)}
                  onValueChange={(v: string | null) => v && setForm({ ...form, send_hour: Number(v) })}
                >
                  <SelectTrigger className="mt-1"><span>{hourLabel(form.send_hour)}</span></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Agenda at</Label>
                <Select
                  value={String(form.agenda_hour)}
                  onValueChange={(v: string | null) => v && setForm({ ...form, agenda_hour: Number(v) })}
                >
                  <SelectTrigger className="mt-1"><span>{hourLabel(form.agenda_hour)}</span></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Its campaign is created paused, starting at day one of the ramp. Nothing sends until you turn it on.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => createRegion(form),
                  () => {
                    toast.success(`${form.code || 'Region'} added`);
                    setForm({ name: '', code: '', timezone: 'America/Chicago', send_hour: 6, agenda_hour: 7 });
                    setAdding(false);
                  },
                )
              }
            >
              <Check className="mr-1.5 h-4 w-4" />
              Create region
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : canCreate ? (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add a region
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Opening a new region is a super admin action. You can change the settings above.
        </p>
      )}
    </div>
  );
}
