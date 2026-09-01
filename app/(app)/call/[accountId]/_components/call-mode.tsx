'use client';

import { useMemo, useState, useTransition } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Phone, Zap, CalendarCheck, MessageSquareText, Link2, PhoneMissed, Voicemail, UserRoundX, XCircle, Ban, ChevronLeft, Copy, Check } from 'lucide-react';
import { logCallOutcome, type CallOutcome } from '../../actions';
import { DaySlotPicker } from '@/components/day-slot-picker';
import type { CallScript } from '@/lib/call-scripts';
import type { PulseRead } from '@/lib/db/pulse-read';
import { YEAR_ONE_LABEL, ONGOING_LABEL } from '@/lib/pricing';

const STEPS = ['OPENER', 'HOOK', 'DISCOVERY', 'THE MATH', 'CLOSE'] as const;

type Props = {
  account: {
    id: string; name: string; vertical: string; city: string | null;
    band: string; cryptoNative: boolean; cryptoScore: number | null; atmCount: number | null;
  };
  contact: { id: string; name: string | null; phone: string | null; legacyId: string | null } | null;
  intel: { score: number | null; emailStage: number; monthlyVolume: number | null; status: string | null; emailable: boolean; pulseUrl?: string | null };
  recent: { type: string; subject: string; at: string }[];
  script: CallScript;
  pulseRead: PulseRead | null;
};

const money = (n: number) => '$' + Math.round(n).toLocaleString();
const words = (v: number) => (v >= 1000 && v % 1000 === 0 ? v / 1000 + ' grand' : money(v));

export function CallMode({ account, contact, intel, recent, script, pulseRead }: Props) {
  const [step, setStep] = useState(0);
  // Their own slider number beats the stored one - it is what they told us
  // most recently, and on their own page.
  const [vol, setVol] = useState(pulseRead?.volume ?? intel.monthlyVolume ?? 10000);
  const [volTouched, setVolTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [logged, setLogged] = useState<CallOutcome | null>(null);
  const [scheduling, setScheduling] = useState<'booked' | 'callback' | null>(null);
  // Armed by the gatekeeper button so the rep can name who answered.
  const [askingWho, setAskingWho] = useState(false);
  const [spokeTo, setSpokeTo] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const lossYr = useMemo(() => vol * 0.03 * 12, [vol]);

  const router = useRouter();
  const [wallOpen, setWallOpen] = useState(false);
  const [wallQuery, setWallQuery] = useState('');

  // Matched against how the owner ACTUALLY said it, not our tidy heading.
  // A rep types the two or three words still ringing in their ear.
  const walls = useMemo(() => {
    const q = wallQuery.trim().toLowerCase();
    if (!q) return script.objections;
    return script.objections.filter(
      (o) =>
        o.q.toLowerCase().includes(q) ||
        o.a.toLowerCase().includes(q) ||
        o.heard.some((h) => h.includes(q) || q.includes(h)),
    );
  }, [script.objections, wallQuery]);

  // One touch, mid-call, at the moment they say "send me something". The
  // outcome is logged on the way out so the call is never lost to the detour.
  const sendAndLog = (template: string) => {
    startTransition(async () => {
      await logCallOutcome({
        accountId: account.id,
        contactId: contact?.id ?? null,
        legacyId: contact?.legacyId ?? null,
        outcome: template === 'one-pager' ? 'sent_onepager' : 'sent_pulse',
        notes,
        volume: volTouched || intel.monthlyVolume ? vol : null,
        scheduledAt: null,
        scheduleLabel: null,
      });
      const to = contact?.id ? `&contact=${contact.id}` : '';
      // from=call so the send screen's back button returns to this script
      // rather than the account page. They may still be on the phone.
      router.push(`/send/${account.id}?t=${template}${to}&from=call`);
    });
  };

  const dispo = (outcome: CallOutcome, scheduledAt?: string, scheduleLabel?: string, who?: string) => {
    // Booked + callback expand into the scheduler first - the appointment
    // gets locked while they're still on the line
    if ((outcome === 'booked' || outcome === 'callback') && !scheduledAt) {
      setScheduling((s) => (s === outcome ? null : outcome));
      return;
    }
    // Ask who answered first. The name is optional - a second tap logs it
    // without one rather than blocking a rep who did not catch it.
    if (outcome === 'gatekeeper' && who === undefined) {
      setAskingWho((a) => !a);
      return;
    }
    startTransition(async () => {
      await logCallOutcome({
        accountId: account.id,
        contactId: contact?.id ?? null,
        legacyId: contact?.legacyId ?? null,
        outcome,
        notes,
        volume: volTouched || intel.monthlyVolume ? vol : null,
        scheduledAt: scheduledAt ?? null,
        scheduleLabel: scheduleLabel ?? null,
        spokeTo: who ?? null,
      });
      setLogged(outcome);

      // "Sent one-pager" used to log an outcome for something that had not
      // been sent - the rep still had to go find a way to send it. Log the
      // call first (notes and volume are captured while they are fresh),
      // then hand straight off to the send screen with the message already
      // picked and the recipient editable.
      if (outcome === 'sent_onepager') {
        const to = contact?.id ? `&contact=${contact.id}` : '';
        router.push(`/send/${account.id}?t=one-pager${to}&from=call`);
      }
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
              {account.city ?? '-'} · {script.clusterLabel}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(CONTROL, 'border-amber-500/50 bg-amber-500/10 text-amber-300')}>{account.band}</span>
          {account.cryptoNative && (
            <span className={cn(CONTROL, 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300')}>CRYPTO NATIVE</span>
          )}
          <Link
            href={`/send/${account.id}?from=call${contact?.id ? `&contact=${contact.id}` : ''}`}
            className="rounded-lg border border-border/40 px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/50"
            title="Send a message from a template"
          >
            ✉ Send
          </Link>
          <Link
            href={`/call/${account.id}/sheet`}
            className="rounded-lg border border-border/40 px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/50"
            title="Printable walk-in sheet"
          >
            🖨 Sheet
          </Link>
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
          {/* Above the stepper on purpose: this changes how the call OPENS,
              so it has to be read before the rep starts talking rather than
              found in a side rail afterwards. */}
          {pulseRead && (
            <div
              className={cn(
                'mb-4 rounded-md border p-4',
                pulseRead.optedOut
                  ? 'border-destructive/50 bg-destructive/10'
                  : pulseRead.requested
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-primary/40 bg-primary/[0.06]'
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-display text-[11px] tracking-[0.18em] text-muted-foreground">
                  THEY OPENED THEIR PAGE
                </span>
                <span className="text-[11px] text-muted-foreground">{pulseRead.summary}</span>
              </div>
              <p className="text-[14.5px] leading-relaxed">{pulseRead.opener}</p>
              {pulseRead.volume != null && !pulseRead.optedOut && (
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  The math slider is already set to their number.
                </p>
              )}
            </div>
          )}

          <div className="mb-2 text-[10px] font-extrabold tracking-[0.16em] text-muted-foreground">
            ON THE PHONE · ten seconds to earn the next thirty
          </div>
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
            {/* Opens OVER the script instead of scrolling to it. Jumping to
                an anchor mid-call means losing your place while somebody is
                still talking. */}
            <button
              type="button"
              onClick={() => setWallOpen(true)}
              className={cn(CONTROL, 'ml-auto inline-flex items-center gap-1 border-red-500/40 text-red-300 hover:bg-red-500/10')}
            >
              <Zap className="h-3.5 w-3.5" /> OBJECTIONS
            </button>
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
                    <Row k="NectarPay year one, all in" v={YEAR_ONE_LABEL} />
                    <Row k="Every year after" v={ONGOING_LABEL} />
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

          {/* Send, without leaving the call. These are the two things an
              owner asks for by name, and the rep should not have to hang up
              and go find them. */}
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-sidebar/60 p-4">
            <span className="text-[11px] font-extrabold tracking-[0.14em] text-muted-foreground">
              &quot;SEND ME SOMETHING&quot;
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => sendAndLog('one-pager')}
              className={cn(CONTROL, 'inline-flex items-center gap-1.5 border-amber-500/50 text-amber-200 hover:bg-amber-500/10')}
            >
              <MessageSquareText className="h-3.5 w-3.5" /> The one-pager
            </button>
            {intel.pulseUrl && (
              <button
                type="button"
                disabled={pending}
                onClick={() => sendAndLog('send-me-something')}
                className={cn(CONTROL, 'inline-flex items-center gap-1.5 border-amber-500/50 text-amber-200 hover:bg-amber-500/10')}
              >
                <Link2 className="h-3.5 w-3.5" /> Their own page
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">
              Logs the call, then opens the message with their number already in it.
            </span>
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

          {intel.pulseUrl && (
          <Rail title="THEIR PULSE PAGE">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-2.5">
              <div className="break-all font-mono text-[11.5px] text-amber-200">{intel.pulseUrl}</div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(intel.pulseUrl!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/40 py-1.5 text-[11.5px] font-bold hover:bg-background/60"
                >
                  {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
                </button>
                {contact?.phone && (
                  <a
                    href={`sms:${contact.phone}?&body=${encodeURIComponent(
                      `${contact.name ? contact.name + ', ' : ''}here is that page I mentioned for ${account.name} - slide your own numbers: ${intel.pulseUrl}`
                    )}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/40 py-1.5 text-[11.5px] font-bold hover:bg-background/60"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" /> Text it
                  </a>
                )}
              </div>
            </div>
          </Rail>
          )}

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
              placeholder="Square user, ~$12K/mo, gets crypto asks weekly. Owner is Maria, in before 10 most days..."
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
              <>
              <div className="grid grid-cols-2 gap-2">
                <DispoBtn full icon={<CalendarCheck className="h-4 w-4" />} label={scheduling === 'booked' ? 'BOOKED VISIT ▴' : 'BOOKED VISIT'} onClick={() => dispo('booked')} pending={pending} />
                <DispoBtn good icon={<MessageSquareText className="h-4 w-4" />} label="Sent one-pager" onClick={() => dispo('sent_onepager')} pending={pending} />
                <DispoBtn good icon={<Link2 className="h-4 w-4" />} label="Sent Pulse link" onClick={() => dispo('sent_pulse')} pending={pending} />
                <DispoBtn warn icon={<Phone className="h-4 w-4" />} label={scheduling === 'callback' ? 'Callback ▴' : 'Callback later'} onClick={() => dispo('callback')} pending={pending} />
                <DispoBtn warn icon={<PhoneMissed className="h-4 w-4" />} label="No answer" onClick={() => dispo('no_answer')} pending={pending} />
                <DispoBtn warn icon={<Voicemail className="h-4 w-4" />} label="Left a voicemail" onClick={() => dispo('voicemail')} pending={pending} />
                {/* The most common real outcome on a first dial. Without it a
                    rep logs "no answer" and the call looks like nothing
                    happened, when in fact they now know who the owner is and
                    when to ring back. */}
                <DispoBtn warn icon={<UserRoundX className="h-4 w-4" />} label={askingWho ? 'Talked to someone ▴' : 'Talked to someone'} onClick={() => dispo('gatekeeper')} pending={pending} />
                <DispoBtn bad icon={<XCircle className="h-4 w-4" />} label="Not interested" onClick={() => dispo('not_interested')} pending={pending} />
                <DispoBtn bad wide icon={<Ban className="h-4 w-4" />} label="DNC - never contact" onClick={() => dispo('dnc')} pending={pending} />
              </div>
              {askingWho && (
                <div className="mt-2 rounded-xl border border-border/40 bg-background/40 p-3">
                  <label className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-muted-foreground">
                    WHO ANSWERED?
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={spokeTo}
                      onChange={(e) => setSpokeTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') dispo('gatekeeper', undefined, undefined, spokeTo);
                      }}
                      autoFocus
                      placeholder="Maria at the counter"
                      className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => dispo('gatekeeper', undefined, undefined, spokeTo)}
                      disabled={pending}
                      className="flex-none rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
                    >
                      Log
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    A name means you can ask for them next time. Skip it if you did not catch it.
                  </p>
                </div>
              )}
              {scheduling && (
                <DaySlotPicker
                  busy={pending}
                  confirmPrefix={scheduling === 'booked' ? 'Book visit' : 'Schedule callback'}
                  onConfirm={(iso, label) => dispo(scheduling, iso, label)}
                />
              )}
              </>
            )}
          </Rail>
        </div>
      </div>

      {/* Bottom sheet on purpose: a rep holding a phone to their ear reads the
          top of the screen and taps at the bottom. Coming up from under the
          thumb also leaves the step they were on visible above it. */}
      <Sheet open={wallOpen} onOpenChange={setWallOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-amber-500">
              <Zap className="h-4 w-4" /> What did they just say?
            </SheetTitle>
            <SheetDescription>
              Type a couple of their own words. {script.objections.length} answers in here.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6">
            <input
              autoFocus
              value={wallQuery}
              onChange={(e) => setWallQuery(e.target.value)}
              placeholder="cards / think about it / crash / cash out..."
              className="mb-3 w-full rounded-lg border border-border/40 bg-background px-3.5 py-2.5 text-[15px]"
            />

            {walls.length === 0 ? (
              <div className="rounded-xl border border-border/40 bg-background/40 p-4 text-sm text-muted-foreground">
                Nothing matched that. Clear the box to see all {script.objections.length} - and
                if what they said really is not in here, it should be. Say so.
              </div>
            ) : (
              walls.map((o) => (
                <details
                  key={o.q}
                  open={wallQuery.trim().length > 0}
                  className="mb-2 rounded-xl border border-border/40 bg-background/40"
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-foreground/90">
                    {o.q}
                  </summary>
                  <div className="px-4 pb-3.5 text-[15px] leading-relaxed">{o.a}</div>
                </details>
              ))
            )}

            <button
              type="button"
              onClick={() => setWallOpen(false)}
              className="mt-4 w-full rounded-md bg-primary/90 px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
            >
              Back to the call
            </button>
          </div>
        </SheetContent>
      </Sheet>
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
