'use client';

import { useMemo, useState } from 'react';
import { CryptoPopPreview } from '@/components/marketing/cryptopop-preview';
import {
  TERMINAL_ONCE,
  TERMINAL_LABEL,
  MULTI_PREFERRED_MONTHLY,
  MULTI_PREFERRED_LABEL,
  BASIC_LABEL,
  bestTierFor,
  type MembershipTier,
  membershipMonthlyFor,
  yearOneFor,
  groupBreakEvenYearOne,
  BREAK_EVEN_YEAR_ONE_MONTHLY,
  CARD_FEE_PCT,
} from '@/lib/pricing';

export type Atm = { n: string; a: string; lat: number; lng: number };
export type Merchant = { n: string; c: string; k: string; lat: number; lng: number };
export type Loc = {
  label: string; city: string; addr: string; lat: number; lng: number;
  /** Present only when ATM data was gathered for this deck. */
  atm_1600?: number; atm_5000?: number; nearest_m?: number; nearest_name?: string;
  merch_5000: number; merch_food_5000: number;
  near?: (Atm & { m: number })[];
  near_merch?: { n: string; k: string; m: number }[];
};
export type Pick = {
  label: string; headline: string; body: string;
  stat: string; stat_label: string; tone: 'amber' | 'green';
};
export type Deck = {
  brand: string; subtitle: string; picks: Pick[];
  /** Drives the language. Free appetizers mean nothing to a transmission shop. */
  vertical?: string;
  reps: { name: string; phone: string; role: string }[];
  locations: Loc[]; atms: Atm[]; merchants: Merchant[];
};

/* ------------------------------------------------------------------ VOICE ---
 * The same deck has to sell a cantina and a brake shop. Almost every line that
 * says "guest" or "table" or "appetizer" is wrong for half the verticals we
 * cover, so the words come from here instead of being written into the slides.
 *
 * `perk` is the one that matters most. A crypto meetup being fed free
 * appetizers is a real offer to a restaurant and a baffling one to an auto
 * shop - so trades and retail get money off work instead of food.
 */
type Voice = {
  buyer: string;        // one of them
  buyers: string;       // several
  visit: string;        // what one transaction is called
  visits: string;
  room: string;         // where it happens
  perk: string;         // what a sponsor could pay for
  perkShort: string;
  hospitality: boolean; // can they actually host a room full of people?
  ticket: number;       // starting average ticket for the calculator
  /** Which nearby businesses count as "like yours" on the map panel. */
  peerKind: 'food' | 'service' | 'retail';
  peerLabel: string;    // "restaurants", "shops like yours"
  spendVerb: string;    // "eat with it", "spend it on what you sell"
};

const VOICE_DEFAULT: Voice = {
  buyer: 'customer', buyers: 'customers', visit: 'sale', visits: 'sales',
  room: 'shop', perk: 'money off their next visit',
  perkShort: 'money off the next visit', hospitality: false, ticket: 45,
  peerKind: 'retail', peerLabel: 'stores like yours',
  spendVerb: 'spend it on what you sell',
};

const VOICE: Record<string, Partial<Voice>> = {
  'food-drink': { buyer: 'guest', buyers: 'guests', visit: 'table', visits: 'tables',
    room: 'dining room', perk: 'a free appetizer or the first round',
    perkShort: 'appetizers on the house', hospitality: true, ticket: 38, peerKind: 'food', peerLabel: 'restaurants', spendVerb: 'eat with it' },
  'liquor': { visit: 'basket', visits: 'baskets', room: 'store',
    perk: 'money off their next bottle', perkShort: 'money off a bottle', ticket: 42, peerKind: 'retail', peerLabel: 'stores like yours', spendVerb: 'buy a bottle with it' },
  'kava-kratom': { buyer: 'regular', buyers: 'regulars', room: 'lounge',
    perk: 'a drink on the house', perkShort: 'a round on the house',
    hospitality: true, ticket: 22, peerKind: 'food', peerLabel: 'places to drink', spendVerb: 'drink with it' },
  'cigar-hookah': { buyer: 'regular', buyers: 'regulars', room: 'lounge',
    perk: 'a cigar on the house', perkShort: 'a cigar on the house',
    hospitality: true, ticket: 55, peerKind: 'food', peerLabel: 'lounges', spendVerb: 'sit down with it' },
  'barber': { visit: 'chair', visits: 'chairs', room: 'shop',
    perk: 'money off the next cut', perkShort: 'money off a cut', ticket: 35, peerKind: 'service', peerLabel: 'shops like yours', spendVerb: 'get a cut with it' },
  'nail-beauty': { visit: 'appointment', visits: 'appointments', room: 'studio',
    perk: 'money off the next appointment', perkShort: 'money off an appointment', ticket: 60, peerKind: 'service', peerLabel: 'studios like yours', spendVerb: 'book an appointment with it' },
  'tattoo': { visit: 'session', visits: 'sessions', room: 'studio',
    perk: 'money off the next session', perkShort: 'money off a session', ticket: 180, peerKind: 'service', peerLabel: 'studios like yours', spendVerb: 'book work with it' },
  'med-spa': { buyer: 'client', buyers: 'clients', visit: 'appointment', visits: 'appointments',
    room: 'clinic', perk: 'money off the next treatment',
    perkShort: 'money off a treatment', ticket: 220, peerKind: 'service', peerLabel: 'clinics like yours', spendVerb: 'book a treatment with it' },
  'auto': { visit: 'job', visits: 'jobs', room: 'shop',
    perk: 'money off the next service', perkShort: 'money off a service', ticket: 380, peerKind: 'service', peerLabel: 'shops like yours', spendVerb: 'get work done with it' },
  'powersports': { visit: 'job', visits: 'jobs', room: 'shop',
    perk: 'money off the next service', perkShort: 'money off a service', ticket: 420, peerKind: 'service', peerLabel: 'shops like yours', spendVerb: 'get work done with it' },
  'bike': { visit: 'job', visits: 'jobs', room: 'shop',
    perk: 'money off the next tune-up', perkShort: 'money off a tune-up', ticket: 95, peerKind: 'service', peerLabel: 'shops like yours', spendVerb: 'get a bike fixed with it' },
  'phone-repair': { visit: 'repair', visits: 'repairs', room: 'shop',
    perk: 'money off the next repair', perkShort: 'money off a repair', ticket: 120, peerKind: 'service', peerLabel: 'shops like yours', spendVerb: 'get a repair with it' },
  'pool-landscape': { visit: 'job', visits: 'jobs', room: 'yard',
    perk: 'money off the next visit', perkShort: 'money off a visit', ticket: 250, peerKind: 'service', peerLabel: 'services like yours', spendVerb: 'book work with it' },
  'jewelry-gold': { visit: 'sale', visits: 'sales', room: 'showroom',
    perk: 'money off the next piece', perkShort: 'money off a piece', ticket: 650 },
  'pawn': { visit: 'ticket', visits: 'tickets', room: 'shop',
    perk: 'money off the next buy', perkShort: 'money off a buy', ticket: 180 },
  'firearms': { visit: 'sale', visits: 'sales', room: 'shop',
    perk: 'money off the next box of ammo', perkShort: 'money off ammo', ticket: 480 },
  'gym-supps': { buyer: 'member', buyers: 'members', visit: 'sale', visits: 'sales',
    room: 'gym', perk: 'money off the next tub', perkShort: 'money off a tub',
    hospitality: true, ticket: 55, peerKind: 'service', peerLabel: 'gyms like yours', spendVerb: 'train with it' },
  'smoke-vape': { buyer: 'regular', buyers: 'regulars', room: 'shop',
    perk: 'money off the next visit', perkShort: 'money off a visit', ticket: 32 },
  'sneaker-street': { room: 'store', perk: 'money off the next pair',
    perkShort: 'money off a pair', ticket: 160 },
  'collectibles': { room: 'store', perk: 'money off the next pickup',
    perkShort: 'money off a pickup', hospitality: true, ticket: 85 },
  'gaming': { room: 'store', perk: 'money off the next trade',
    perkShort: 'money off a trade', hospitality: true, ticket: 50 },
  'thrift-vintage': { room: 'store', perk: 'money off the next find',
    perkShort: 'money off a find', ticket: 40 },
};

function voiceFor(vertical?: string): Voice {
  return { ...VOICE_DEFAULT, ...(vertical ? VOICE[vertical] ?? {} : {}) };
}

const usd2 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const usd0 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ MAP --- */
const RADIUS_KM = 4.828; // three miles

function DensityMap({
  deck, selected, onSelect, layer,
}: {
  deck: Deck; selected: number; onSelect: (i: number) => void; layer: 'atm' | 'merch' | 'both';
}) {
  const W = 400, H = 440, PAD = 30;

  // Frame on the LOCATIONS, not on every dot we happen to know about. Fitting
  // all 179 statewide merchants meant a single-location shop rendered at valley
  // scale, its pin a speck in the middle. Anything outside the frame falls
  // outside the viewBox and is simply not drawn.
  const { project, k } = useMemo(() => {
    const lats = deck.locations.map((p) => p.lat);
    const lngs = deck.locations.map((p) => p.lng);
    // Margin beyond the three-mile ring, so the ring has room even with one pin.
    const padLat = (RADIUS_KM * 1.55) / 110.9;
    const padLng = (RADIUS_KM * 1.55) / 92.9;
    const minLat = Math.min(...lats) - padLat, maxLat = Math.max(...lats) + padLat;
    const minLng = Math.min(...lngs) - padLng, maxLng = Math.max(...lngs) + padLng;
    const k = Math.min((W - PAD * 2) / (maxLng - minLng), (H - PAD * 2) / (maxLat - minLat));
    const ox = PAD + ((W - PAD * 2) - (maxLng - minLng) * k) / 2;
    const oy = PAD + ((H - PAD * 2) - (maxLat - minLat) * k) / 2;
    return {
      k,
      project: (lat: number, lng: number): [number, number] => [
        ox + (lng - minLng) * k, oy + (maxLat - lat) * k,
      ],
    };
  }, [deck]);

  // Longitude degrees are shorter than latitude degrees here, so the ring is an
  // ellipse in projected space - a circle overstates east-west reach by a fifth.
  const rx = (RADIUS_KM / 92.9) * k;
  const ry = (RADIUS_KM / 110.9) * k;
  const sel = deck.locations[selected];
  const [cx, cy] = project(sel.lat, sel.lng);
  const within = (lat: number, lng: number) =>
    ((lng - sel.lng) / (RADIUS_KM / 92.9)) ** 2 + ((lat - sel.lat) / (RADIUS_KM / 110.9)) ** 2 <= 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full"
         role="img" aria-label="Map of every location with crypto cash machines and crypto-accepting businesses around them">
      <defs>
        <radialGradient id="atmGlow">
          <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="merchGlow">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pinGlow">
          <stop offset="0%" stopColor="#F2A71B" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F2A71B" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} rx="18" fill="#0A1220" />
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={(W / 8) * i} y1="0" x2={(W / 8) * i} y2={H} stroke="#16233A" />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={(H / 10) * i} x2={W} y2={(H / 10) * i} stroke="#16233A" />
      ))}

      {(layer === 'merch' || layer === 'both') && deck.merchants.map((m, i) => {
        const [x, y] = project(m.lat, m.lng);
        const near = within(m.lat, m.lng);
        return (
          <g key={`m${i}`} opacity={near ? 1 : 0.22}>
            {near && <circle cx={x} cy={y} r="15" fill="url(#merchGlow)" />}
            <rect x={x - 2} y={y - 2} width="4" height="4" fill="#60A5FA" />
          </g>
        );
      })}

      {(layer === 'atm' || layer === 'both') && deck.atms.map((a, i) => {
        const [x, y] = project(a.lat, a.lng);
        const near = within(a.lat, a.lng);
        return (
          <g key={`a${i}`} opacity={near ? 1 : 0.22}>
            {near && <circle cx={x} cy={y} r="16" fill="url(#atmGlow)" />}
            <circle cx={x} cy={y} r="2.4" fill="#4ADE80" />
          </g>
        );
      })}

      {/* The three-mile ring every number on the panel is measured inside. */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none"
               stroke="#F2A71B" strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="5 4" />
      <text x={cx} y={cy - ry - 6} textAnchor="middle" fontSize="9"
            fill="#C9820A" fontWeight="700">3 miles</text>

      {deck.locations.map((l, i) => {
        const [x, y] = project(l.lat, l.lng);
        const on = i === selected;
        return (
          <g key={l.label} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            {on && <circle cx={x} cy={y} r="27" fill="url(#pinGlow)" />}
            <circle cx={x} cy={y} r={on ? 9 : 6.5} fill="#F2A71B" stroke="#0A1220" strokeWidth="2.5" />
            <text x={x} y={y - (on ? 16 : 13)} textAnchor="middle" fontSize={on ? 12 : 10}
                  fontWeight="800" fill={on ? '#FFFFFF' : '#94A3B8'}>{l.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------- CALCULATOR --- */
function Calculator({ locations }: { locations: number }) {
  const tier = bestTierFor(locations);
  const groupYearOneCost = Math.round(yearOneFor(locations, tier));
  const perLocationBreakEven = Math.round(groupBreakEvenYearOne(locations, tier) / locations);
  const [vol, setVol] = useState(100000);
  const [share, setShare] = useState(5);

  const cardCostMo = vol * CARD_FEE_PCT;
  const movedMo = vol * (share / 100);
  const savedMo = movedMo * CARD_FEE_PCT;
  const savedYr = savedMo * 12;
  const groupSavedYr = savedYr * locations;
  const covered = savedMo >= perLocationBreakEven;

  return (
    <div className="rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Card volume, one location, per month
      </label>
      <div className="mt-1 text-[32px] font-extrabold text-white">{usd0(vol)}</div>
      <input type="range" min={10000} max={500000} step={5000} value={vol}
             onChange={(e) => setVol(Number(e.target.value))}
             className="mt-2 w-full accent-[#F2A71B]" aria-label="Monthly card volume" />

      <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Share of it that moves to the new lane - you set this
      </label>
      <div className="mt-1 text-[32px] font-extrabold text-white">{share}%</div>
      <input type="range" min={1} max={25} step={1} value={share}
             onChange={(e) => setShare(Number(e.target.value))}
             className="mt-2 w-full accent-[#F2A71B]" aria-label="Share moving to crypto" />

      <div className="mt-6 space-y-2 border-t border-white/10 pt-4 text-[14px]">
        <Row k={`Processing on that volume today, at ${(CARD_FEE_PCT * 100).toFixed(1)}%`}
             v={`${usd0(cardCostMo)}/mo`} />
        <Row k={`What ${usd0(movedMo)} a month costs on this lane`} v="nothing" accent />
        <Row k="Kept, per location, per year" v={usd0(savedYr)} />
        <Row k={`Kept across all ${locations}, per year`} v={usd0(groupSavedYr)} strong />
      </div>

      <div className={`mt-4 rounded-xl p-3 text-[13px] leading-relaxed ${
        covered ? 'bg-[#4ADE80]/15 text-[#86EFAC]' : 'bg-white/5 text-slate-400'}`}>
        {covered
          ? `At that rate the group clears its entire ${usd0(groupYearOneCost)} first year in ${
              Math.max(1, Math.ceil(groupYearOneCost / (savedMo * locations)))} month${
              Math.ceil(groupYearOneCost / (savedMo * locations)) === 1 ? '' : 's'
            }.`
          : `Break-even is ${usd0(perLocationBreakEven)} a month per location across all ${locations}. Drag either slider to see where that lands.`}
      </div>
      <p className="mt-3 text-[11px] text-slate-600">
        Card rate is an industry average for restaurants; use your own statement and the numbers
        move with it. Nothing here is a projection of what will move, it is arithmetic on what you
        set.
      </p>
    </div>
  );
}

/**
 * The other half of the arithmetic. The fee calculator answers "what do I stop
 * paying"; this answers "what if it brings anyone in at all", which is the
 * thing the whole deck opens on and previously had no numbers behind it.
 */
function NewCustomers({ locations, voice, tier }: { locations: number; voice: Voice; tier: MembershipTier }) {
  const [perWeek, setPerWeek] = useState(3);
  const [ticket, setTicket] = useState(voice.ticket);

  const monthlyPerLoc = perWeek * 4.33 * ticket;
  const yearlyPerLoc = monthlyPerLoc * 12;
  const groupYearly = yearlyPerLoc * locations;
  const groupYearOneCost = Math.round(yearOneFor(locations, tier));
  const weeksToCover =
    monthlyPerLoc * locations > 0
      ? Math.ceil(groupYearOneCost / ((monthlyPerLoc * locations) / 4.33))
      : null;

  return (
    <div className="rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        New {voice.buyers} a week, per location
      </label>
      <div className="mt-1 text-[32px] font-extrabold text-white">{perWeek}</div>
      <input type="range" min={0} max={40} step={1} value={perWeek}
             onChange={(e) => setPerWeek(Number(e.target.value))}
             className="mt-2 w-full accent-[#F2A71B]"
             aria-label={`New ${voice.buyers} a week`} />

      <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Your average {voice.visit}
      </label>
      <div className="mt-1 text-[32px] font-extrabold text-white">{usd0(ticket)}</div>
      <input type="range" min={5} max={1000} step={5} value={ticket}
             onChange={(e) => setTicket(Number(e.target.value))}
             className="mt-2 w-full accent-[#F2A71B]"
             aria-label={`Average ${voice.visit}`} />

      <div className="mt-6 space-y-2 border-t border-white/10 pt-4 text-[14px]">
        <Row k="Added revenue, per location, per month" v={`${usd0(monthlyPerLoc)}/mo`} />
        <Row k="Per location, per year" v={usd0(yearlyPerLoc)} accent />
        {locations > 1 && (
          <Row k={`Across all ${locations}, per year`} v={usd0(groupYearly)} strong />
        )}
      </div>

      <div className="mt-4 rounded-xl bg-white/5 p-3 text-[13px] leading-relaxed text-slate-400">
        {perWeek === 0
          ? `Drag it to one. Even one new ${voice.buyer} a week is a number worth looking at.`
          : weeksToCover !== null && weeksToCover <= 52
          ? `At that rate the whole setup pays for itself in about ${weeksToCover} week${weeksToCover === 1 ? '' : 's'} - and that is before a cent of the card fees you stop paying.`
          : `That is on top of whatever you save on card fees, which is the next screen.`}
      </div>
      <p className="mt-3 text-[11px] text-slate-600">
        Your numbers, not ours. We have no idea how many people will use it - that
        is the honest answer, and it is why this is a slider rather than a promise.
      </p>
    </div>
  );
}

function Row({ k, v, accent, strong }: { k: string; v: string; accent?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate-400">{k}</span>
      <span className={
        strong ? 'text-[19px] font-extrabold text-[#F2A71B]'
        : accent ? 'font-extrabold text-[#4ADE80]'
        : 'font-bold text-white'
      }>{v}</span>
    </div>
  );
}

/* --------------------------------------------------------------- LAYOUT --- */
function Slide({ children, tone = 'dark', wide }: {
  children: React.ReactNode; tone?: 'dark' | 'light' | 'amber'; wide?: boolean;
}) {
  const bg = tone === 'light' ? 'bg-[#F8F4EA] text-[#0C1A2C]'
    : tone === 'amber' ? 'bg-[#F2A71B] text-[#0C1A2C]'
    : 'bg-[#0A1220] text-slate-100';
  return (
    <section className={`${bg} flex min-h-[100svh] snap-start flex-col justify-center px-6 py-16 lg:min-h-0 lg:py-24`}>
      <div className={`mx-auto w-full ${wide ? 'max-w-md lg:max-w-5xl' : 'max-w-md lg:max-w-2xl'}`}>
        {children}
      </div>
    </section>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#C9820A]">{children}</div>
);
const Big = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[30px] font-extrabold leading-[1.12] tracking-tight lg:text-[40px]">{children}</h2>
);

/* ----------------------------------------------------------------- DECK --- */
export function PitchClient({ deck }: { deck: Deck }) {
  const n = deck.locations.length;
  const voice = voiceFor(deck.vertical);
  const one = n === 1;
  const firstPick = deck.picks[0]?.label;
  const [sel, setSel] = useState(
    Math.max(0, deck.locations.findIndex((l) => l.label === firstPick))
  );
  const [layer, setLayer] = useState<'atm' | 'merch' | 'both'>('both');

  const loc = deck.locations[sel];

  // How many of the nearby crypto-accepting businesses are the same kind of
  // business as this one. Computed client-side from the merchant list so decks
  // built before this existed still get it.
  const peersNearby = useMemo(() => {
    const R_KM = 4.828;
    return deck.merchants.filter((m) => {
      const kind = m.k === 'other' ? 'retail' : m.k;
      if (kind !== voice.peerKind) return false;
      const p = Math.PI / 180;
      const x =
        Math.sin(((m.lat - loc.lat) * p) / 2) ** 2 +
        Math.cos(loc.lat * p) * Math.cos(m.lat * p) * Math.sin(((m.lng - loc.lng) * p) / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(x)) <= R_KM;
    }).length;
  }, [deck.merchants, loc, voice.peerKind]);
  // Generated decks carry no ATM coordinates - only what the accounts table
  // stores. Render what we actually have rather than an empty green layer.
  const hasAtms = deck.atms.length > 0;
  const oneTime = TERMINAL_ONCE * n;
  const tier = bestTierFor(n);
  const monthly = membershipMonthlyFor(n, tier);
  const yearOne = Math.round(yearOneFor(n, tier));
  const flatTier = tier === 'multi';
  const perLocationBreakEven = Math.round(groupBreakEvenYearOne(n, tier) / n);
  const ifOnBasic = membershipMonthlyFor(n, 'basic');
  // The same figure said the way an owner counts it. A dollar target means
  // nothing across 23 verticals; "three clients a week" lands in all of them.
  const breakEvenPerWeek = Math.max(1, Math.round(perLocationBreakEven / voice.ticket / 4.33));

  return (
    <div className="h-[100svh] snap-y snap-mandatory overflow-y-scroll bg-[#0A1220] lg:h-auto lg:snap-none lg:overflow-visible">

      {/* 1 cover */}
      <Slide>
        <div className="text-2xl font-extrabold">Nectar<span className="text-[#F2A71B]">Pay</span></div>
        <div className="mt-14">
          <Eyebrow>Prepared for</Eyebrow>
          <h1 className="text-[36px] font-extrabold leading-[1.08] tracking-tight lg:text-[52px]">{deck.brand}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-400">{deck.subtitle}</p>
        </div>
        <div className="mt-14 flex flex-wrap gap-8">
          {deck.reps.map((r) => (
            <div key={r.name}>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-600">{r.role}</div>
              <div className="mt-1 text-[17px] font-extrabold">{r.name}</div>
              {r.phone && (
                <a href={`tel:${r.phone.replace(/\D/g, '')}`} className="text-[16px] text-[#F2A71B]">{r.phone}</a>
              )}
            </div>
          ))}
        </div>
      </Slide>

      {/* 2 more customers */}
      <Slide>
        <Eyebrow>Where this starts</Eyebrow>
        <Big>The {voice.buyer} you never hear about.</Big>
        <p className="mt-5 text-[17px] leading-relaxed text-slate-400">
          Somebody may well have asked at {one ? 'your register' : 'one of your registers'} whether
          they could pay another way. Most never do. They see the card reader, work out the answer,
          and pay the way they always have, or they pick somewhere else before they ever walk in.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-400">
          That is what makes it hard to see. Nobody complains about a payment option you do not
          offer. It shows up as {voice.visits} that were never booked{one ? '' : `, in ${n} locations`},
          and no shift report will ever name it.
        </p>
        <div className="mt-8">
          <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.18em] text-[#C9820A]">
            So put a number on it
          </div>
          <NewCustomers locations={n} voice={voice} tier={bestTierFor(n)} />
        </div>
      </Slide>

      {/* 3 the calculator */}
      <Slide tone="light" wide>
        <Eyebrow>Second thing: what you stop paying</Eyebrow>
        <Big>Every card sale takes a cut. This lane does not.</Big>
        <p className="mt-4 text-[16px] leading-relaxed text-[#47566B]">
          Not a projection. Set your own volume and your own guess at what moves, and the
          arithmetic follows.
        </p>
        <div className="mt-6"><Calculator locations={n} /></div>
      </Slide>

      {/* 4 at the register */}
      <Slide wide>
        <Eyebrow>What your floor actually does</Eyebrow>
        <Big>Ten seconds. Nothing else changes.</Big>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {[
            ['Server rings it', 'The terminal is handheld. It goes to the table the same way a card reader does, or stays by the register if that suits the floor better.'],
            ['They scan', `A code comes up on the screen and the ${voice.buyer} scans it with their phone. If there is an offer running, it rides on the same code.`],
            ['Money is yours', 'It lands in an account you own before they stand up. No batch, no waiting on Tuesday.'],
          ].map(([t, b], i) => (
            <div key={t} className="rounded-2xl border border-white/10 p-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2A71B] text-[13px] font-extrabold text-[#0C1A2C]">{i + 1}</div>
              <div className="mt-3 text-[16px] font-extrabold">{t}</div>
              <p className="mt-1 text-[14px] leading-relaxed text-slate-400">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <p className="rounded-xl bg-white/5 p-4 text-[15px] leading-relaxed text-slate-300">
            Your card readers keep doing exactly what they do today. No switching processors, no
            retraining a floor, no change to a single ticket that runs the way it runs now.
          </p>
          <div className="rounded-xl border border-[#F2A71B]/40 bg-[#F2A71B]/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2A71B]">
              Whatever they already hold
            </div>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-300">
              Bitcoin, Ethereum, XRP, a stablecoin - the {voice.buyer} pays out of the wallet they already
              carry rather than buying something first. That is the whole reason this reaches
              people a single-coin setup never would.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              You decide what happens next: hold it, or convert to dollars. Converting carries a
              fee like any exchange, and it is your call rather than ours.
            </p>
          </div>
        </div>
      </Slide>

      {/* 4b your POS */}
      <Slide tone="light" wide>
        <Eyebrow>The question every operator asks second</Eyebrow>
        <Big>It does not touch your POS. That is the point.</Big>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#47566B]">
          {one ? 'You are not' : `Across ${n} locations you are not`} changing a system, retraining
          anyone, or renegotiating anything. This is a separate lane that sits beside what you run,
          the same way a delivery app or a gift certificate already does.
        </p>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2A71B]">
              What your staff does
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
              Rings the sale on your POS under a payment type we set up with you at install, named
              whatever you like. The ticket closes, inventory drops, the server gets credit, and it
              totals on its own line in your end-of-day report.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
              Toast, Square and Clover all support this already and it takes about two minutes per
              location. Your people have done it before for delivery.
            </p>
          </div>
          <div className="rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2A71B]">
              What your bookkeeper gets
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
              A line that reconciles like any other tender. Every payment is timestamped and
              permanent, so the record exists whether anyone goes looking or not - which is more
              than can be said for a cash drawer.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
              Straight answer on the books: what you take in counts as income at its dollar value
              the moment it lands, not when you convert. That one belongs with your CPA rather than
              with us.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[15px] leading-relaxed text-[#47566B]">
          Nothing writes into your system on its own, and we would rather say that plainly now than
          have a manager find it at close-out.
        </p>
      </Slide>

      {/* 5 the map */}
      <Slide wide>
        <Eyebrow>Now the part people ask about</Eyebrow>
        <Big>How many of those {voice.buyers} are actually out there?</Big>
        <p className="mt-4 text-[16px] leading-relaxed text-slate-400">
          {hasAtms
            ? 'Two things we can count. Machines where people turn cash into crypto, and businesses near you already taking it. Tap any location.'
            : 'Businesses near you already taking crypto, from our own Arizona records. Tap any location.'}
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[400px_1fr]">
          <div>
            <div className={`mb-3 flex gap-1.5 ${hasAtms ? '' : 'hidden'}`}>
              {([['both', 'Both'], ['atm', 'Cash machines'], ['merch', 'Businesses']] as const).map(([id, lbl]) => (
                <button key={id} type="button" onClick={() => setLayer(id)}
                        className={'rounded-full px-3 py-1 text-[11px] font-bold ' +
                          (layer === id ? 'bg-[#F2A71B] text-[#0C1A2C]' : 'bg-white/10 text-slate-400')}>
                  {lbl}
                </button>
              ))}
            </div>
            <DensityMap deck={deck} selected={sel} onSelect={setSel} layer={layer} />
            <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
              {hasAtms && (
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#4ADE80]" />{deck.atms.length} cash machines</span>
              )}
              <span><span className="mr-1 inline-block h-2 w-2 bg-[#60A5FA]" />{deck.merchants.length} businesses taking it</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-4">
            <div className="text-[19px] font-extrabold">{loc.label}</div>
            <div className="text-[12px] text-slate-500">{loc.addr}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              {loc.atm_1600 !== undefined && (
                <Stat v={loc.atm_1600} k="cash machines within a mile" tone="green" />
              )}
              {loc.nearest_m !== undefined && (
                <Stat v={loc.nearest_m < 1000 ? `${loc.nearest_m}m` : `${(loc.nearest_m / 1609).toFixed(1)} mi`}
                      k="to the nearest one" tone="amber" />
              )}
              <Stat v={loc.merch_5000} k="businesses taking crypto within three miles" tone="blue" />
              <Stat v={peersNearby} k={`of those that are ${voice.peerLabel}`} tone="blue" />
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-400">
              {loc.nearest_name && loc.nearest_m !== undefined ? (
                <>Nearest machine is {loc.nearest_name}, {loc.nearest_m < 1000
                  ? `${loc.nearest_m} meters away`
                  : `${(loc.nearest_m / 1609).toFixed(1)} miles away`}.{' '}</>
              ) : null}
              {loc.merch_5000 === 0
                ? `Nothing within three miles takes crypto today, ${voice.peerLabel} or otherwise. You would be the first thing on this map.`
                : peersNearby === 0
                ? `${loc.merch_5000} ${loc.merch_5000 === 1 ? 'business takes' : 'businesses take'} it within three miles, and not one of them is ${voice.peerLabel === 'restaurants' ? 'a restaurant' : 'anything like yours'}. Somewhere to spend it nearby, but nowhere to ${voice.spendVerb}.`
                : `${peersNearby} of the ${loc.merch_5000} are ${voice.peerLabel}, so people here already have somewhere to ${voice.spendVerb}.`}
            </p>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          {hasAtms ? 'Cash machines verified on Google Places. ' : ''}Businesses are from our own
          Arizona merchant records. Distances are straight-line from each street address.
        </p>
      </Slide>

      {/* 6 where to start */}
      <Slide tone="light" wide>
        <Eyebrow>Where to start</Eyebrow>
        <Big>{deck.picks.length > 1 ? 'Two locations, two different questions.' : 'Start here.'}</Big>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#47566B]">
          {deck.picks.length > 1
            ? 'They are not the same test, which is the argument for running both. One asks whether a busy night carries it. The other asks whether the street walks in on its own.'
            : `One terminal, one month, and a real answer at the end of it rather than an opinion. Nothing changes about how you take cards while it runs.`}
        </p>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {deck.picks.map((p) => (
            <div key={p.label} className="rounded-2xl bg-[#0C1A2C] p-6 text-slate-200">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#C9820A]">
                {p.label}
              </div>
              <div className={`mt-3 text-[40px] font-extrabold leading-none ${
                p.tone === 'green' ? 'text-[#4ADE80]' : 'text-[#F2A71B]'}`}>
                {p.stat}
              </div>
              <div className="mt-1 text-[12px] uppercase tracking-wider text-slate-500">
                {p.stat_label}
              </div>
              <h3 className="mt-4 text-[19px] font-extrabold leading-snug text-white">{p.headline}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[16px] leading-relaxed text-[#47566B]">
          One month, no charge, real {voice.buyers}{deck.picks.length > 1 ? ', in both' : ''}.{' '}
          {deck.picks.length > 1
            ? 'If they do not earn their place we carry them back out'
            : 'If it does not earn its place we carry it back out'}
          {n - deck.picks.length > 0
            ? ` and the other ${n - deck.picks.length} location${n - deck.picks.length === 1 ? '' : 's'} never hears about it`
            : ''}.
        </p>
      </Slide>

      {/* 7 speed */}
      <Slide wide>
        <Eyebrow>The part owners react to</Eyebrow>
        <Big>Card money is not yours yet.</Big>
        <div className="mt-7 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">A card sale</div>
            <p className="mt-2 text-[16px] leading-relaxed text-slate-300">
              Guest leaves. Money turns up Tuesday, minus a cut, and it can still leave again weeks
              later on a dispute you will probably not fight.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#F2A71B] bg-[#F2A71B]/10 p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2A71B]">A sale on this</div>
            <p className="mt-2 text-[16px] leading-relaxed text-slate-100">
              Done when it is done. Yours before they reach the door. Not pending, not held, not
              reversible.
            </p>
          </div>
        </div>
        <p className="mt-6 text-[15px] leading-relaxed text-slate-400">
          It is final in both directions, so the habit is confirming the number before the{' '}
          {voice.buyer} scans. That is the whole of the training.
        </p>
      </Slide>

      {/* 8 cryptopop */}
      <Slide wide>
        <Eyebrow>What is being built next</Eyebrow>
        <Big>{voice.hospitality ? 'Being findable, and owning a night.' : 'Being findable, and being the one they are sent to.'}</Big>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-slate-400">
          CryptoPop is two separate things. One puts you on a map people check before they leave
          the house. The other puts your name on the offer that got them out of it.
        </p>

        <div className="-mx-2 mt-8">
          <CryptoPopPreview
            shopName={deck.brand}
            city={`${loc.city}, AZ`}
            address={loc.addr}
            dark
          />
        </div>

        <div className="mt-10 rounded-2xl bg-[#0C1A2C] p-6 text-slate-200">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F2A71B]">
            CryptoPop events, and sponsoring them together
          </div>
          <h3 className="mt-2 text-[24px] font-extrabold leading-tight text-white">
            {voice.hospitality
              ? 'The meetups already happen. Nobody feeds them.'
              : 'The crowd already exists. Nobody is pointing it at you.'}
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
            This is the part we would do with you rather than sell to you, and the money runs
            toward you. CryptoPop sponsors it - picking up {voice.perk}, or whatever gets people
            through the door - and brings the crowd to it. You put up the {voice.room}. We are
            looking for the first partner in the valley to build that with.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[
              ['We sponsor it', voice.hospitality
                ? `CryptoPop pays for the draw - ${voice.perkShort}, whatever fits the night. You are not buying an audience, you are hosting one somebody else paid to bring.`
                : `CryptoPop puts up ${voice.perkShort} for anyone who turns up and pays this way. You are not buying an audience, you are handed one somebody else paid to bring.`],
              ['Your name on it', voice.hospitality
                ? `The night runs under your roof and your sign, in front of exactly the people whose money your register can now take.`
                : `Your name on the offer, in front of exactly the people whose money your register can now take. No night to host, no room to turn over - they come to you.`],
              ['Be on the map', `Your CryptoPop listing, with the offer posted by you and changed whenever you want. The listing is what brings someone in; the terminal takes the payment.`],
            ].map(([t, b]) => (
              <div key={t} className="rounded-xl bg-white/5 p-4">
                <div className="text-[15px] font-extrabold text-[#F2A71B]">{t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-white/10 pt-4 text-[13px] leading-relaxed text-slate-500">
            Straight with you: CryptoPop is in development. The listing and the events are not part
            of what you would be buying today and there is no launch date on them. The terminal has
            to earn its place on the fee saving and the {voice.buyers} it brings in. Everything on this slide is
            upside on top of that, and a conversation we want to have with you first.
          </p>
        </div>
      </Slide>

      {/* 9 the cost */}
      <Slide wide>
        <Eyebrow>{one ? 'What it costs' : `All ${n} locations`}</Eyebrow>
        <Big>{one ? 'What it costs.' : 'What the group costs.'}</Big>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {[
              [
                one ? 'Terminal' : `Terminals, ${n} at ${TERMINAL_LABEL}`,
                usd0(oneTime),
                one ? 'once' : 'once, one per location',
              ],
              [
                one ? 'Membership' : 'Membership, all locations',
                `${usd2(monthly)}/mo`,
                flatTier ? 'one flat fee, preferred service included' : 'billed yearly',
              ],
              ['Percentage of your sales', 'none', 'ever'],
              ['Chargeback fees on this lane', 'none', 'there are no chargebacks'],
            ].map(([k, v, note]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2">
                <div>
                  <div className="text-[15px] text-slate-300">{k}</div>
                  <div className="text-[11px] text-slate-600">{note}</div>
                </div>
                <div className="whitespace-nowrap text-[17px] font-extrabold">{v}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-baseline justify-between rounded-2xl bg-[#F2A71B] px-5 py-4 text-[#0C1A2C]">
              <div className="text-[15px] font-extrabold">{one ? 'Year one' : `Year one, all ${n}`}</div>
              <div className="text-[26px] font-extrabold">{usd0(yearOne)}</div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
              Break-even is {usd0(perLocationBreakEven)} a month{one ? '' : ' per location'}. At a
              typical {usd0(voice.ticket)} {voice.visit}, that is about{' '}
              <b className="text-slate-200">
                {breakEvenPerWeek} new {breakEvenPerWeek === 1 ? voice.buyer : voice.buyers} a week
              </b>
              {' '}paying this way. Everything past that is margin you keep.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              Slide your own average back on the second screen and the number moves with it.
            </p>
            {flatTier && (
              <div className="mt-4 rounded-xl border border-[#F2A71B]/40 bg-[#F2A71B]/5 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2A71B]">
                  Why all {n} beats one
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-300">
                  One flat {MULTI_PREFERRED_LABEL} a month covers the whole group, preferred
                  service included. Per location that would be {BASIC_LABEL} each, or{' '}
                  {usd0(ifOnBasic)} a month for {n} - so the group tier is not a surcharge for
                  scale, it is {usd0(ifOnBasic - MULTI_PREFERRED_MONTHLY)} a month less than paying
                  per location, on better service.
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
                  It moves the bar too. One location on its own has to clear{' '}
                  {usd0(BREAK_EVEN_YEAR_ONE_MONTHLY)} a month to pay for itself. Spread across {n},
                  each only has to clear {usd0(perLocationBreakEven)}. Every location you add lowers
                  it further, which is the opposite of how your card processing works.
                </p>
              </div>
            )}
          </div>
        </div>
      </Slide>

      {/* 10 the ask */}
      <Slide tone="amber">
        <Eyebrow>The ask</Eyebrow>
        <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-tight lg:text-[44px]">
          {deck.picks.map((p) => p.label).join(' and ')}. One month.
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed">
          {deck.picks.length > 1 ? 'A terminal in each. It costs' : 'One terminal. It costs'} nothing
          while it runs and you keep every payment it takes. If
          {deck.picks.length > 1 ? ' they have not earned their place' : ' it has not earned its place'}
          by the end of it, we carry {deck.picks.length > 1 ? 'them' : 'it'} back out and that is the
          end of the conversation.
        </p>
        {n - deck.picks.length > 0 && (
          <p className="mt-4 text-[17px] leading-relaxed">
            If it earns it, the other {n - deck.picks.length} location{n - deck.picks.length === 1 ? ' is' : 's are'} a
            phone call, not another meeting.
          </p>
        )}
        <div className="mt-10 flex flex-wrap gap-4">
          {deck.reps.map((r) => (
            <a key={r.name} href={r.phone ? `tel:${r.phone.replace(/\D/g, '')}` : undefined}
               className="flex-1 rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{r.role}</div>
              <div className="mt-1 text-[19px] font-extrabold">{r.name}</div>
              {r.phone && <div className="text-[17px] text-[#F2A71B]">{r.phone}</div>}
            </a>
          ))}
        </div>
        <p className="mt-8 text-[12px] leading-relaxed text-[#0C1A2C]/60">
          This link stays live. Send it to anyone who needs to see it.
        </p>
      </Slide>
    </div>
  );
}

function Stat({ v, k, tone }: { v: number | string; k: string; tone: 'green' | 'blue' | 'amber' }) {
  const c = tone === 'green' ? 'text-[#4ADE80]' : tone === 'blue' ? 'text-[#60A5FA]' : 'text-[#F2A71B]';
  return (
    <div className="rounded-xl bg-black/30 px-1 py-2">
      <div className={`text-[22px] font-extrabold ${c}`}>{v}</div>
      <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{k}</div>
    </div>
  );
}
