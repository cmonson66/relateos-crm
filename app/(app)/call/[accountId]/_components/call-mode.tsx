'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Phone, Zap, CalendarCheck, MessageSquareText, Link2, PhoneMissed, XCircle, Ban, ChevronLeft } from 'lucide-react';
import { logCallOutcome, type CallOutcome } from '../../actions';
import type { CallScript } from '@/lib/call-scripts';

const STEPS = ['OPENER', 'HOOK', 'DISCOVERY', 'THE MATH', 'CLOSE'] as const;

type Props = {
  account: {
    id: string; name: string; vertical: string; city: string | null;
    band: string; cryptoNative: boolean; cryptoScore: number | null; atmCount: number | null;
  };
  contact: { id: string; name: string | null; phone: string | null; legacyId: string | null } | null;
  intel: { score: number | null; emailStage: number; monthlyVolume: number | null; status: string | null; emailable: boolean };
  recent: { type: string; subject: string; at: string }[];
  script: CallScript;
};

const money = (n: number) => '$' + Math.round(n).toLocaleString();
const words = (v: number) => (v >= 1000 && v % 1000 === 0 ? v / 1000 + ' grand' : money(v));

export function CallMode({ account, contact, intel, recent, script }: Props) {
  const [step, setStep] = useState(0);
  const [vol, setVol] = useState(intel.monthlyVolume ?? 10000);
  const [volTouched, setVolTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [logged, setLogged] = useState<CallOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  const lossYr = useMemo(() => vol * 0.03 * 12, [vol]);

  const dispo = (outcome: CallOutcome) => {
    startTransition(async () => {
      await logCallOutcome({
        accountId: account.id,
        contactId: contact?.id ?? null,
        legacyId: contact?.legacyId ?? null,
        outcome,
        notes,
        volume: volTouched || intel.monthlyVolume ? vol : null,
      });
      setLogged(outcome);
    });
  };

  const CONTROL = 'rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-wide transition-colors';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/accounts/${account.id}`} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="text-lg font-extrabold">
              {account.name}
              {contact?.name && <span className="ml-2 font-normal text-muted-foreground">· {contact.name}</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {account.city ?? '—'} · {script.clusterLabel}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(CONTROL, 'border-amber-500/50 bg-amber-500/10 text-amber-300')}>{account.band}</span>
          {account.cryptoNative && (
            <span className={cn(CONTROL, 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300')}>CRYPTO NATIVE</span>
          )}
          {contact?.phone ? (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-amber-400"
            >
              <Phone className="h-4 w-4" /> {contact.phone}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">no phone on file</span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* ---------------- left: script ---------------- */}
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={cn(
                  CONTROL,
                  i === step
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : i < step
                      ? 'border-emerald-500/40 text-emerald-300'
                      : 'border-border/40 text-muted-foreground hover:text-foreground'
                )}
              >
                {i + 1} · {s}
              </button>
            ))}
            <a
              href="#objections"
              className={cn(CONTROL, 'ml-auto inline-flex items-center gap-1 border-red-500/40 text-red-300 hover:bg-red-500/10')}
            >
              <Zap className="h-3.5 w-3.5" /> OBJECTIONS
            </a>
          </div>

          <div className="rounded-2xl border border-border/40 bg-sidebar/60 p-5">
            {step === 0 && (
              <Section title="OPENER - 10 SECONDS, EARN THE NEXT 30">
                <Say text={script.opener} />
                {script.openerHints.map((h) => (
                  <Hint key={h} text={h} />
                ))}
              </Section>
            )}
            {step === 1 && (
              <Section title={`HOOK - ${script.clusterLabel.toUpperCase()}`}>
                {script.hook.map((p) => (
                  <Say key={p} text={p} />
                ))}
                <Hint text={script.hookHint} />
                {intel.monthlyVolume && (
                  <Hint text={`Pulse intel: they slid the calculator to ${money(intel.monthlyVolume)}/mo - lead with money.`} />
                )}
              </Section>
            )}
            {step === 2 && (
              <Section title="DISCOVERY - GET THE NUMBERS, WRITE THEM DOWN">
                <div className="grid gap-2.5">
                  {script.discovery.map((d, i) => (
                    <div key={d.q} className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-3.5 py-2.5">
                      <div className="flex-1 text-[15px]">{d.q}</div>
                      {i === 0 || (account.cryptoNative && i === 2) ? (
                        <input
                          className="w-32 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm"
                          placeholder={d.placeholder}
                          defaultValue={intel.monthlyVolume ? money(intel.monthlyVolume) : ''}
                          onChange={(e) => {
                            const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                            if (v >= 1000) { setVol(v); setVolTouched(true); }
                          }}
                        />
                      ) : (
                        <input
                          className="w-32 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm"
                          placeholder={d.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Hint text="Volume writes back to the lead on disposition - emails, their Pulse card, and the next call all inherit it." />
              </Section>
            )}
            {step === 3 && (
              <Section title="THE MATH - THEIR NUMBERS, OUT LOUD">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground">
                      Monthly card volume {intel.monthlyVolume && !volTouched ? '(self-reported via Pulse)' : volTouched ? '(captured on this call)' : '(default - adjust live)'}
                    </div>
                    <div className="text-2xl font-extrabold text-amber-400">{money(vol)}</div>
                    <input
                      type="range" min={2000} max={60000} step={1000} value={vol}
                      onChange={(e) => { setVol(+e.target.value); setVolTouched(true); }}
                      className="mt-2 w-full accent-amber-500"
                    />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/40 p-4 text-sm">
                    <Row k="Lost to card fees / yr (~3%)" v={'-' + money(lossYr)} vClass="text-red-400 font-bold" />
                    <Row k="NectarPay year one, all in" v="$727" />
                    <Row k="Every year after" v="$228" />
                    <Row k="Stays in the shop, year one" v={'+' + money(Math.max(0, lossYr - 727))} vClass="text-emerald-400 font-extrabold" last />
                  </div>
                </div>
                <Say text={script.mathLine.replace('{vol}', words(vol)).replace('{loss}', money(lossYr))} />
              </Section>
            )}
            {step === 4 && (
              <Section title="CLOSE - ALWAYS LEAVE WITH ONE OF THESE">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {script.closes.map((c) => (
                    <div key={c.title} className="rounded-xl border border-border/40 bg-background/40 p-3.5">
                      <div className="mb-1 text-[13px] font-bold text-amber-400">{c.title}</div>
                      <div className="text-[13.5px] text-muted-foreground">{c.script}</div>
                      {c.note && <div className="mt-1 text-[12px] italic text-muted-foreground/80">{c.note}</div>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* objections */}
          <div id="objections" className="mt-4 rounded-2xl border border-border/40 bg-sidebar/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold tracking-[0.14em] text-amber-600">
              <Zap className="h-4 w-4" /> OBJECTION DRAWER - ANY TIME
            </h2>
            {script.objections.map((o) => (
              <details key={o.q} className="mb-2 rounded-xl border border-border/40 bg-background/40">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-foreground/90">{o.q}</summary>
                <div className="px-4 pb-3.5 text-[14.5px] leading-relaxed">{o.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* ---------------- right rail ---------------- */}
        <div className="space-y-4">
          <Rail title="LEAD INTEL">
            <Intel k="Band / score" v={`${account.band}${intel.score ? ' · ' + intel.score : ''}`} accent />
            <Intel k="Email stage" v={intel.emailStage > 0 ? `e${intel.emailStage} sent` : intel.emailable ? 'queued' : 'door-only (no email)'} />
            {account.cryptoScore != null && <Intel k="Crypto density" v={`${account.cryptoScore}${account.atmCount ? ' · ' + account.atmCount + ' ATMs near' : ''}`} />}
            {intel.monthlyVolume && <Intel k="Self-reported vol" v={money(intel.monthlyVolume) + '/mo'} accent />}
            {intel.status && <Intel k="Pipeline status" v={intel.status} />}
          </Rail>

          <Rail title="RECENT TOUCHES">
            {recent.length === 0 && <div className="text-xs text-muted-foreground">No activity yet - this is first contact.</div>}
            <div className="grid gap-1.5 text-[12.5px] text-muted-foreground">
              {recent.map((r, i) => (
                <div key={i}>
                  <b className="text-foreground/80">{r.type}</b> {r.subject.slice(0, 52)}
                </div>
              ))}
            </div>
          </Rail>

          <Rail title="CALL NOTES">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Square user, ~$12K/mo, gets crypto asks weekly, callback Thu AM before open..."
              className="min-h-[110px] w-full resize-y rounded-xl border border-border/40 bg-background/40 p-3 text-sm"
            />
            <h3 className="mb-2 mt-4 text-[11px] font-extrabold tracking-[0.14em] text-muted-foreground">
              DISPOSITION - WRITES TO TIMELINE
            </h3>
            {logged ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                Logged ✓ - timeline updated.
                <Link href={`/accounts/${account.id}`} className="ml-2 underline">Back to account</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <DispoBtn full icon={<CalendarCheck className="h-4 w-4" />} label="BOOKED VISIT" onClick={() => dispo('booked')} pending={pending} />
                <DispoBtn good icon={<MessageSquareText className="h-4 w-4" />} label="Sent one-pager" onClick={() => dispo('sent_onepager')} pending={pending} />
                <DispoBtn good icon={<Link2 className="h-4 w-4" />} label="Sent Pulse link" onClick={() => dispo('sent_pulse')} pending={pending} />
                <DispoBtn warn icon={<Phone className="h-4 w-4" />} label="Callback later" onClick={() => dispo('callback')} pending={pending} />
                <DispoBtn warn icon={<PhoneMissed className="h-4 w-4" />} label="No answer" onClick={() => dispo('no_answer')} pending={pending} />
                <DispoBtn bad icon={<XCircle className="h-4 w-4" />} label="Not interested" onClick={() => dispo('not_interested')} pending={pending} />
                <DispoBtn bad wide icon={<Ban className="h-4 w-4" />} label="DNC - never contact" onClick={() => dispo('dnc')} pending={pending} />
              </div>
            )}
          </Rail>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-extrabold tracking-[0.14em] text-amber-600">{title}</h2>
      {children}
    </div>
  );
}
function Say({ text }: { text: string }) {
  return (
    <div className="my-2.5 rounded-r-xl border-l-[3px] border-amber-500 bg-background/50 px-4 py-3 text-[15.5px] leading-relaxed text-foreground">
      {text}
    </div>
  );
}
function Hint({ text }: { text: string }) {
  return <div className="mx-0.5 my-1.5 text-[12.5px] text-muted-foreground">{text}</div>;
}
function Row({ k, v, vClass, last }: { k: string; v: string; vClass?: string; last?: boolean }) {
  return (
    <div className={cn('flex justify-between py-1.5', !last && 'border-b border-dashed border-border/40')}>
      <span className="text-muted-foreground">{k}</span>
      <span className={vClass}>{v}</span>
    </div>
  );
}
function Rail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-sidebar/60 p-4">
      <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
function Intel({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between border-b border-dashed border-border/40 py-1.5 text-[13.5px] last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn('font-bold', accent && 'text-amber-400')}>{v}</span>
    </div>
  );
}
function DispoBtn({
  icon, label, onClick, pending, full, good, warn, bad, wide,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; pending: boolean;
  full?: boolean; good?: boolean; warn?: boolean; bad?: boolean; wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12.5px] font-bold transition-colors disabled:opacity-50',
        full && 'col-span-2 border-transparent bg-amber-500 text-slate-950 hover:bg-amber-400',
        !full && 'border-border/40 bg-background/40 hover:bg-background/70',
        good && 'border-emerald-500/40 text-emerald-300',
        warn && 'border-amber-500/40 text-amber-300',
        bad && 'border-red-500/40 text-red-300',
        wide && 'col-span-2'
      )}
    >
      {icon} {label}
    </button>
  );
}
