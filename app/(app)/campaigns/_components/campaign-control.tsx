'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Play, Pause, Send, Eye, KeyRound, Save, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  saveCampaignSettings, setCampaignStatus, previewToday, sendNow,
} from '../actions';

type Settings = {
  status: 'running' | 'paused';
  hasKey: boolean;
  from_domain: string | null;
  from_label: string | null;
  reply_to: string | null;
  physical_address: string | null;
  pulse_base_url: string | null;
  campaign_start: string;
  send_delay_ms: number;
  last_run_at: string | null;
};

type Run = {
  id: string; ran_at: string; trigger: string;
  planned: number; sent: number; failed: number; mix: Record<string, number>;
};

type PreviewItem = { placeId: string; stage: number; to: string; name: string; vertical: string; band: string; repFirst: string };

export function CampaignControl({
  settings, cap, day, queued, emailable, runs,
}: {
  settings: Settings; cap: number; day: number; queued: number; emailable: number; runs: Run[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(settings.status);
  const [form, setForm] = useState({
    resend_api_key: '',
    from_domain: settings.from_domain ?? '',
    from_label: settings.from_label ?? 'NectarPay',
    reply_to: settings.reply_to ?? '',
    physical_address: settings.physical_address ?? '',
    pulse_base_url: settings.pulse_base_url ?? '',
    campaign_start: settings.campaign_start,
    send_delay_ms: settings.send_delay_ms,
  });
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [showSettings, setShowSettings] = useState(!settings.hasKey);

  const todayRun = runs.find(r => new Date(r.ran_at).toDateString() === new Date().toDateString());
  const sentToday = todayRun?.sent ?? 0;
  const ready = settings.hasKey && !!settings.physical_address && !!settings.pulse_base_url;

  const toggle = () => {
    const next = status === 'running' ? 'paused' : 'running';
    if (next === 'running' && !ready) {
      toast.error('Add the Resend key, physical address, and Pulse URL before starting.');
      setShowSettings(true);
      return;
    }
    startTransition(async () => {
      try {
        await setCampaignStatus(next);
        setStatus(next);
        toast.success(next === 'running' ? 'Campaign running — daily send at 6:00 AM Phoenix.' : 'Campaign paused.');
        router.refresh();
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    });
  };

  const doPreview = () => startTransition(async () => {
    try {
      const r = await previewToday();
      setPreview(r.items);
      toast.success(`${r.items.length} shown · cap ${r.cap}/day · campaign day ${r.day}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Preview failed'); }
  });

  const doSend = () => {
    if (!confirm(`Send today's batch now? Up to ${cap} emails go out immediately.`)) return;
    startTransition(async () => {
      try {
        const r = await sendNow();
        if (r.note) toast.error(r.note);
        else toast.success(`Sent ${r.sent} of ${r.planned}${r.failed ? ` · ${r.failed} failed` : ''}`);
        router.refresh();
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Send failed'); }
    });
  };

  const save = () => startTransition(async () => {
    try {
      await saveCampaignSettings(form);
      toast.success('Settings saved.');
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Outbound</div>
          <h1 className="font-display text-3xl tracking-wider md:text-4xl">
            EMAIL <span className="text-primary text-glow-primary">CAMPAIGN</span>
          </h1>
        </div>
        <button
          onClick={toggle}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-extrabold tracking-wider transition-colors disabled:opacity-50',
            status === 'running'
              ? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {status === 'running' ? <><Pause className="h-4 w-4" /> RUNNING — PAUSE</> : <><Play className="h-4 w-4" /> START CAMPAIGN</>}
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Today's cap" value={cap.toString()} sub={`warm-up day ${day}`} />
        <Stat label="Sent today" value={sentToday.toString()} sub={todayRun ? todayRun.trigger : 'not yet run'} tone={sentToday > 0 ? 'green' : undefined} />
        <Stat label="Queued (never emailed)" value={queued.toLocaleString()} sub={`${emailable.toLocaleString()} emailable total`} />
        <Stat label="Next send" value="6:00 AM" sub={status === 'running' ? 'automatic, Phoenix time' : 'paused'} tone={status === 'running' ? 'gold' : undefined} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={doPreview} disabled={pending} variant="outline" size="sm" className="font-display tracking-wider">
          <Eye className="mr-2 h-4 w-4" /> Preview today
        </Button>
        <Button onClick={doSend} disabled={pending || !ready} size="sm" className="font-display tracking-wider btn-glow">
          <Send className="mr-2 h-4 w-4" /> Send batch now
        </Button>
        <Button onClick={() => setShowSettings(s => !s)} disabled={pending} variant="outline" size="sm" className="font-display tracking-wider">
          <KeyRound className="mr-2 h-4 w-4" /> {showSettings ? 'Hide settings' : 'Settings'}
        </Button>
      </div>

      {!ready && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <b>Setup needed before sending:</b>{' '}
          {[!settings.hasKey && 'Resend API key', !settings.physical_address && 'physical address (CAN-SPAM)', !settings.pulse_base_url && 'Pulse base URL']
            .filter(Boolean).join(' · ')}
        </div>
      )}

      {showSettings && (
        <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5">
          <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
          <h2 className="mb-4 font-display text-lg tracking-wider">SENDING IDENTITY</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`Resend API key ${settings.hasKey ? '(saved — leave blank to keep)' : '(required)'}`}>
              <Input type="password" placeholder={settings.hasKey ? '••••••••••••' : 're_...'}
                value={form.resend_api_key} onChange={e => setForm({ ...form, resend_api_key: e.target.value })} />
            </Field>
            <Field label="Sending domain (verified in your Resend)">
              <Input placeholder="nectarpayaz.com" value={form.from_domain}
                onChange={e => setForm({ ...form, from_domain: e.target.value })} />
            </Field>
            <Field label="From label">
              <Input placeholder="NectarPay AZ" value={form.from_label}
                onChange={e => setForm({ ...form, from_label: e.target.value })} />
            </Field>
            <Field label="Reply-to (blank = the rep's own address)">
              <Input placeholder="eric@nectarpayaz.com" value={form.reply_to}
                onChange={e => setForm({ ...form, reply_to: e.target.value })} />
            </Field>
            <Field label="Physical address (required in every email)">
              <Input placeholder="123 Main St, Phoenix AZ 85001" value={form.physical_address}
                onChange={e => setForm({ ...form, physical_address: e.target.value })} />
            </Field>
            <Field label="Pulse base URL">
              <Input placeholder="https://pulse.nectarpayaz.com" value={form.pulse_base_url}
                onChange={e => setForm({ ...form, pulse_base_url: e.target.value })} />
            </Field>
            <Field label="Campaign start (drives the warm-up ramp)">
              <Input type="date" className="[color-scheme:dark]" value={form.campaign_start}
                onChange={e => setForm({ ...form, campaign_start: e.target.value })} />
            </Field>
            <Field label="Delay between sends (ms)">
              <Input type="number" value={form.send_delay_ms}
                onChange={e => setForm({ ...form, send_delay_ms: Number(e.target.value) })} />
            </Field>
          </div>
          <Button onClick={save} disabled={pending} size="sm" className="mt-4 font-display tracking-wider btn-glow">
            <Save className="mr-2 h-4 w-4" /> Save settings
          </Button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Ramp: 30/day through day 7, 60 through 14, 120 through 21, then 250. Follow-up gaps: e2 +4d, e3 +5d, e4 +6d, e5 +7d, e6 +8d.
          </p>
        </div>
      )}

      {preview && (
        <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5">
          <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
          <h2 className="mb-3 font-display text-lg tracking-wider">TODAY&apos;S PLAN · {preview.length} SHOWN</h2>
          <div className="max-h-72 overflow-auto rounded-md border border-border/40">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40 bg-background/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-left font-medium">Business</th>
                  <th className="px-3 py-2 text-left font-medium">To</th>
                  <th className="px-3 py-2 text-left font-medium">From</th>
                  <th className="px-3 py-2 text-left font-medium">Band</th>
                </tr>
              </thead>
              <tbody>
                {preview.map(p => (
                  <tr key={p.placeId} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-1.5 font-bold text-primary">e{p.stage}</td>
                    <td className="px-3 py-1.5">{p.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.to}</td>
                    <td className="px-3 py-1.5">{p.repFirst}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.band}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card-lit relative rounded-md border border-border/40 p-5">
        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider">
          <Clock className="h-4 w-4 text-primary" /> SEND HISTORY
        </h2>
        {runs.length === 0 && <div className="py-4 text-sm text-muted-foreground">No sends yet.</div>}
        {runs.map(r => (
          <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-border/30 py-2 text-sm last:border-0">
            <span className="font-bold">
              {new Date(r.ran_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' })}
              <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-muted-foreground">{r.trigger}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {r.sent} sent{r.failed > 0 && <span className="text-destructive"> · {r.failed} failed</span>}
              {Object.keys(r.mix).length > 0 && ` · ${Object.entries(r.mix).map(([k, v]) => `${v}×${k}`).join(', ')}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'gold' | 'green' }) {
  return (
    <div className="card-lit rounded-md border border-border/40 p-3.5">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={cn('font-display text-2xl tracking-wider', tone === 'green' && 'text-emerald-400', tone === 'gold' && 'text-primary')}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
