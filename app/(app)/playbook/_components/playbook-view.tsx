'use client';

import {
  BREAK_EVEN_YEAR_ONE_MONTHLY,
  BREAK_EVEN_ONGOING_MONTHLY,
  TERMINAL_LABEL,
  MONTHLY_LABEL,
  YEAR_ONE_LABEL,
  ONGOING_LABEL,
} from '@/lib/pricing';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { Printer, FileText, BookOpen, PackageCheck, ChevronLeft, Search, X, MapPin, Compass, BookMarked, Wrench, Signpost } from 'lucide-react';
import { OnePager } from './one-pager';
import { Xit21Guide } from './xit21-guide';
import { SetupGuide } from './setup-guide';
import { searchAccounts } from '@/app/(app)/appointments/actions';

type Visit = { id: string; accountId: string | null; name: string; city: string; at: string; subject: string };

const HOOKS: { who: string; line: string }[] = [
  { who: 'Smoke, vape, kratom, firearms, pawn', line: 'A processor like Square or Stripe decides your industry is high risk and freezes you. This is a lane nobody can shut off.' },
  { who: 'Jewelry, auto, med spa, pool, liquor', line: 'On your ticket sizes, 3% is real money - about $3,600 a year out of a $10K a month shop.' },
  { who: 'Barber, tattoo, food, sneakers, nails', line: 'Your crowd is exactly who holds crypto. First shop on the block to take it gets the customers who go looking.' },
  { who: 'Phone repair, gyms', line: 'Work delivered, then clawed back weeks later. A settled crypto payment is final - no dispute window.' },
  { who: 'Cash-pay dental, vets, event venues', line: 'Big ticket, work already done. 3% on a $1,400 crown is $42, and a disputed deposit lands after the room was held. Settled crypto is final.' },
  { who: 'Already takes crypto', line: 'Respect first, never explain crypto to them. You are the third option: real terminal, zero fee, straight to their own wallet.' },
];

const ASKS = [
  '"Roughly what goes through the card reader in a month?"',
  '"Who is your processor now - Square, Clover, something else?"',
  '"Has anybody ever asked to pay with crypto at the register?"',
];

const CLOSES: { t: string; d: string }[] = [
  { t: 'Live demo now', d: 'Ten minutes, run a real payment, they watch it settle. Best possible outcome.' },
  { t: 'Book a time', d: 'Put it on the calendar in front of them, then log it before you drive off.' },
  { t: 'Text the one-pager', d: 'Get their cell. Send it while standing there so they see it arrive.' },
  { t: 'Their own page', d: 'Text them their link - they slide their own numbers in thirty seconds.' },
  { t: 'The trial', d: '"Let me put one in for a trial - nothing while it runs. Take real payments on it. Keep it or I come get it." A signed agreement goes in first.' },
  { t: 'The clean no', d: '"No hard feelings - if fees ever start stinging, you have my number." Mark DNC if they ask.' },
];

const WALLS: { q: string; a: string }[] = [
  { q: '"My customers pay with cards."', a: 'Nothing changes about your card setup. Same reader, same flow. This adds a lane nobody can freeze.' },
  { q: '"I don\'t understand crypto."', a: 'You don\'t need to. Staff types the amount, customer scans, ten seconds, money is in your wallet.' },
  { q: '"Is this legal? Is it taxed?"', a: 'Completely legal - a payment method like cash or card. Recorded on the terminal, revenue like any other.' },
  { q: '"What does it cost?"', a: `${TERMINAL_LABEL} once for the terminal, then ${MONTHLY_LABEL} a month for the membership, billed annually. Never a percentage. Year one about ${YEAR_ONE_LABEL}. Then give them the floor rather than a savings claim: about $${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()} a month in crypto sales covers year one, about $${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()} a month after. And they do not have to decide today - a trial costs them nothing while it runs.` },
  { q: '"How much of my business will even use this?"', a: `The honest floor, not a sales number. About $${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()} a month in crypto sales pays for year one and about $${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()} a month every year after - a handful of customers a week. Never claim their whole card volume moves across. They will spot it, and then nothing else you said counts.` },
  { q: '"Crypto crashes."', a: 'Settles to a stablecoin if you want - a dollar in is a dollar out. You are not betting on anything.' },
  { q: '"I need to think about it."', a: 'Better than thinking about it cold: put one in on a trial. Free while it runs, real payments on it, you pick it up if it does not earn its place. They decide on what happened, not on your say-so.' },
  { q: '"It sounds complicated."', a: 'It is simpler than your card terminal. And if you do not even want hardware, the Nectar.Pay app runs on your phone - you just give up the receipt printer and the rugged handheld.' },
  { q: '"What if it breaks?"', a: 'One-year warranty. Fails on its own, we replace it, full stop. Drop it off the roof and you buy another - fair is fair.' },
  { q: '"Can I try it first?"', a: `Yes. Put a terminal in on a trial - free while it runs, no ${TERMINAL_LABEL}, no monthly. They take real payments on it. Keep it or hand it back, their call.` },
  { q: '"What if I need real support?"', a: `Standard is ${MONTHLY_LABEL}. White-glove is $99 a month and that means we pick up the phone. Most shops start standard and never move.` },
];

import { FirstWeek } from './first-week';

export function PlaybookView({
  visits = [],
  rep = { first: 'Rep', cell: '', email: '' },
}: {
  visits?: Visit[];
  rep?: { first: string; cell: string; email: string };
}) {
  // Land on a menu, not inside the script
  const [tab, setTab] = useState<'home' | 'week1' | 'script' | 'onepager' | 'setup' | 'xit21' | 'kit'>('home');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Shops added by search rather than from the calendar - for the rep who
  // just walked past a promising restaurant
  const [extra, setExtra] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [searching, startSearch] = useTransition();
  const seq = useRef(0);

  const runSearch = (val: string) => {
    setQ(val);
    const mine = ++seq.current;
    if (val.trim().length < 2) { setResults([]); return; }
    startSearch(async () => {
      const rows = await searchAccounts(val);
      if (seq.current === mine) setResults(rows);
    });
  };

  const addExtra = (a: { id: string; name: string; city: string | null }) => {
    setExtra(prev => (prev.some(x => x.id === a.id) ? prev : [...prev, a]));
    setPicked(prev => new Set(prev).add(a.id));
    setQ(''); setResults([]);
  };

  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const kitHref = `/playbook/kit?ids=${[...picked].join(',')}`;

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          html, body { background: #fff !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          #playbook, #playbook * { visibility: visible !important; }
          /* Browsers drop background colour when printing unless told not to.
             Without this the honey rule, the amber callout and the dark price
             box on the one-pager all come out blank white. */
          #playbook, #playbook * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #playbook { position: absolute !important; left: 0; top: 0; width: 100% !important; padding: 0 !important; }
          /* The install guide wraps its body in an inner padded div so the
             honey rule can run edge to edge on screen. On paper the page
             margin already handles it, so drop the inner padding too. */
          #playbook > .print-pad { padding: 0 !important; }
          #playbook { border: 0 !important; }
          #playbook .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          {tab !== 'home' ? (
            <button
              onClick={() => setTab('home')}
              className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Playbook
            </button>
          ) : (
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Field</div>
          )}
          <h1 className="font-display text-3xl tracking-wider">
            {tab === 'home' ? <>THE <span className="text-primary">PLAYBOOK</span></>
              : tab === 'onepager' ? <>THE <span className="text-primary">ONE-PAGER</span></>
              : tab === 'week1' ? <>YOUR FIRST <span className="text-primary">WEEK</span></>
              : tab === 'setup' ? <>SETTING <span className="text-primary">THEM UP</span></>
              : tab === 'xit21' ? <>GET THEM ON <span className="text-primary">THE MAP</span></>
              : tab === 'kit' ? <>PRINT A <span className="text-primary">KIT</span></>
              : <>THE <span className="text-primary">WALK-IN</span></>}
          </h1>
        </div>
        {/* XIT21 is excluded alongside the kit: its printable version is the
            PDF it links to, and printing the dark on-screen cards would burn
            a cartridge for a worse sheet. */}
        {tab !== 'kit' && tab !== 'xit21' && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        )}
      </div>

      {tab === 'home' && (
        <div className="grid gap-3 sm:grid-cols-2 print:hidden">
          {([
            ['week1', 'Your first week', 'New here? Start with this. What to do each day and what good looks like.', Compass],
            ['script', 'The door script', 'Walking in. Be a customer first, diagnose before you present. Not the phone script.', BookOpen],
            ['onepager', 'The one-pager', 'Your leave-behind, with your name and cell on it.', FileText],
            ['setup', 'Setting them up', 'The install, start to finish. Wallet, merchant account, coins, share link.', Wrench],
            ['xit21', 'XIT21', 'Get them on the crypto map, and the register on their terminal.', Signpost],
            ['kit', 'Print a kit', 'A packet per shop: their sheet plus a one-pager to leave.', PackageCheck],
          ] as const).map(([id, title, blurb, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="card-lit rounded-md border border-border/40 p-5 text-left transition-colors hover:border-primary/50"
            >
              <Icon className="mb-2.5 h-6 w-6 text-primary" />
              <div className="font-display text-lg tracking-wider">{title.toUpperCase()}</div>
              <div className="mt-1 text-xs text-muted-foreground">{blurb}</div>
            </button>
          ))}

          {/* A file, not a tab - it opens in the phone's own PDF reader, which
              handles 36 pages far better than anything rendered in here. */}
          <Link
            href="/ambassador-handbook.pdf"
            target="_blank"
            rel="noopener"
            className="card-lit rounded-md border border-border/40 p-5 text-left transition-colors hover:border-primary/50"
          >
            <BookMarked className="mb-2.5 h-6 w-6 text-primary" />
            <div className="font-display text-lg tracking-wider">THE AMBASSADOR HANDBOOK</div>
            <div className="mt-1 text-xs text-muted-foreground">
              NectarPay&apos;s own 36-page field edition. Read it once cover to cover.
            </div>
            <div className="mt-2 text-[11px] text-amber-300/80">
              Pilot Launch v1.0 - the pay page is out of date. Ask before quoting it.
            </div>
          </Link>
        </div>
      )}

      {tab === 'onepager' && (
        <div id="playbook"><OnePager rep={rep} /></div>
      )}

      {tab === 'xit21' && <Xit21Guide />}

      {tab === 'kit' && (
        <div className="rounded-md border border-border/40 bg-sidebar/60 p-5">
          <h2 className="mb-1 font-display text-lg tracking-wider">PRINT A KIT</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Pick the shops you are visiting. Each one prints a walk-in sheet written for that shop, followed by a one-pager to leave behind.
          </p>
          <div className="mb-4 rounded-lg border border-border/40 bg-background/40 p-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Any shop - no appointment needed
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={e => runSearch(e.target.value)}
                placeholder="Type a shop name - for the place you just drove past…"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
            {q.trim().length >= 2 && (
              <div className="mt-1.5 overflow-hidden rounded-md border border-border/40">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => addExtra(r)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-sidebar-accent/60"
                  >
                    <span className="font-semibold">{r.name}</span>
                    {r.city && <span className="ml-2 text-xs text-muted-foreground">{r.city}</span>}
                  </button>
                ))}
                {results.length === 0 && !searching && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches in your accounts.</div>
                )}
              </div>
            )}
            {extra.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extra.map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-bold text-amber-300">
                    <MapPin className="h-3 w-3" /> {a.name}
                    <button
                      onClick={() => {
                        setExtra(prev => prev.filter(x => x.id !== a.id));
                        setPicked(prev => { const n = new Set(prev); n.delete(a.id); return n; });
                      }}
                      className="opacity-70 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {visits.length > 0 && (
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              This week&apos;s visits
            </div>
          )}
          {visits.length === 0 && (
            <div className="py-2 text-xs text-muted-foreground">
              Nothing on the calendar this week - search above for any shop instead.
            </div>
          )}
          {visits.map(v => (
            <label key={v.id} className="flex cursor-pointer items-center gap-3 border-b border-dashed border-border/30 py-2.5 last:border-0">
              <input
                type="checkbox"
                checked={picked.has(v.accountId!)}
                onChange={() => toggle(v.accountId!)}
                className="h-4 w-4 accent-amber-500"
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-bold">{v.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {new Date(v.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Phoenix' })}
                  {' · '}
                  {new Date(v.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Phoenix' })}
                  {v.city && ` · ${v.city}`}
                </span>
              </span>
            </label>
          ))}
          <div className="mt-4 flex flex-wrap gap-2">
            {picked.size > 0 && (
              <Link
                href={kitHref}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground"
              >
                <Printer className="h-4 w-4" /> Build kit - {picked.size} shop{picked.size === 1 ? '' : 's'} ({picked.size * 2} pages)
              </Link>
            )}
            <Link
              href="/playbook/kit?blank=1"
              className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground"
              title="Script and one-pagers with no shop attached"
            >
              <Printer className="h-4 w-4" /> Blank kit for cold walking
            </Link>
          </div>
        </div>
      )}

      {tab === 'week1' && <FirstWeek />}

      {tab === 'setup' && <SetupGuide />}

      {tab === 'script' && (
      <>

      <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm print:hidden">
        <b className="text-amber-300">This is the door script.</b> You are standing in their
        shop, so you have their attention and you can afford to diagnose before you present.
        On the phone you cannot - you get about ten seconds and no permission, which is why
        Call Mode hooks first and asks second. Running this one down a phone line gets you
        hung up on at &quot;how long have you been here?&quot;
      </div>

      <div id="playbook" className="rounded-md border border-border/40 bg-white p-6 text-black sm:p-8">
        <div className="avoid-break mb-5">
          <h2 className="mb-2 text-lg font-extrabold">The whole pitch in one sentence</h2>
          <Say>&quot;A small terminal by your register that takes crypto - zero processing fee, money lands in your own wallet the second they pay, and it can never be reversed. Your card reader keeps doing its job.&quot;</Say>
        </div>

        <Step n="1" title="WALK IN - READ THE ROOM FIRST">
          <p className="mb-2 text-sm">
            If there is a line, buy something small and come back later. Never pitch a busy register. If the
            owner is out: get a name, get a good time, leave the one-pager, and log it.
          </p>
          <Say>&quot;Hey - is the owner around? ... I&apos;m [name], I work with shops here in [city]. Two minutes, and I&apos;ll get out of your way.&quot;</Say>
          <p className="text-xs text-neutral-600">
            You asked for two minutes. Honor it - earning the next ten beats taking them.
          </p>
        </Step>

        <Step n="2" title="THE HOOK - THEIR PAIN, NOT YOUR PRODUCT">
          <div className="space-y-1.5 text-sm">
            {HOOKS.map(h => (
              <div key={h.who}>
                <span className="font-bold">{h.who}:</span> <span className="text-neutral-700">{h.line}</span>
              </div>
            ))}
          </div>
        </Step>

        <Step n="3" title="ASK THREE THINGS - THEN SHUT UP">
          <ol className="ml-4 list-decimal space-y-1 text-sm">
            {ASKS.map(a => <li key={a}>{a}</li>)}
          </ol>
          <p className="mt-1.5 text-xs text-neutral-600">
            Write the volume number down. It goes in the CRM the moment you are back in the truck.
          </p>
        </Step>

        <Step n="4" title="THE MATH - USE THEIR NUMBER, NOT MINE">
          <table className="mb-2 w-full table-fixed text-sm">
            <tbody>
              <tr className="border-b border-neutral-300"><td className="py-1">Lost to card fees / year (~3% of $10K/mo)</td><td className="py-1 text-right font-bold">-$3,600</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-1">NectarPay year one, all in</td><td className="py-1 text-right">{YEAR_ONE_LABEL}</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-1">Every year after</td><td className="py-1 text-right">{ONGOING_LABEL}</td></tr>
              <tr><td className="py-1 font-bold">Stays in the shop, year one</td><td className="py-1 text-right font-extrabold">+$2,873</td></tr>
            </tbody>
          </table>
          <Say>&quot;So at [their number] a month, cards are taking about [their loss] a year off your top line. The terminal pays for itself the first month. That is the whole pitch.&quot;</Say>
        </Step>

        <Step n="5" title="CLOSE - NEVER LEAVE EMPTY">
          <div className="space-y-1 text-sm">
            {CLOSES.map(c => (
              <div key={c.t}><span className="font-bold">{c.t}:</span> <span className="text-neutral-700">{c.d}</span></div>
            ))}
          </div>
        </Step>

        <div className="avoid-break mt-5 border-t-2 border-black pt-3">
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-[0.15em]">The six walls - know these cold</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {WALLS.map(w => (
              <div key={w.q}>
                <div className="font-bold">{w.q}</div>
                <div className="text-neutral-700">{w.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-neutral-300 pt-2 text-xs">
          <span className="font-bold">PRICING, MEMORIZED:</span> {TERMINAL_LABEL} terminal · {MONTHLY_LABEL}/mo membership · zero processing
          fee · non-custodial · no chargebacks
        </div>
        <div className="mt-1 text-[11px] italic text-neutral-500">
          Every shop has its own sheet: open the account, Start call, then Sheet.
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  tone = 'ink',
  children,
}: {
  n: string;
  title: string;
  /** 'honey' for the install guide. The door script keeps the plain numeral. */
  tone?: 'ink' | 'honey';
  children: React.ReactNode;
}) {
  const honey = tone === 'honey';
  return (
    <div className="avoid-break mb-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={
            honey
              ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#f2a71b] text-[11px] font-bold text-[#0c1a2c]'
              : 'flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white'
          }
        >
          {n}
        </span>
        <h2
          className={
            honey
              ? 'text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#0c1a2c]'
              : 'text-[11px] font-extrabold uppercase tracking-[0.15em]'
          }
        >
          {title}
        </h2>
      </div>
      <div className="ml-7">{children}</div>
    </div>
  );
}

function Say({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 border-l-2 border-neutral-400 bg-neutral-100 py-1.5 pl-2.5 text-sm italic">{children}</p>;
}
