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
  reps: { name: string; phone: string; role: string }[];
  locations: Loc[]; atms: Atm[]; merchants: Merchant[];
};

const usd0 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ MAP --- */
function DensityMap({
  deck, selected, onSelect, layer,
}: {
  deck: Deck; selected: number; onSelect: (i: number) => void; layer: 'atm' | 'merch' | 'both';
}) {
  const W = 400, H = 440, PAD = 30;

  const { project, k } = useMemo(() => {
    const pts = [...deck.locations, ...deck.atms, ...deck.merchants];
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
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

  // Three miles, in degrees, at this latitude. Longitude degrees are shorter
  // than latitude degrees here, so the ring is an ellipse in projected space -
  // drawing a circle would overstate the east-west reach by about a fifth.
  const RADIUS_KM = 4.828;
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
  const firstPick = deck.picks[0]?.label;
  const [sel, setSel] = useState(
    Math.max(0, deck.locations.findIndex((l) => l.label === firstPick))
  );
  const [layer, setLayer] = useState<'atm' | 'merch' | 'both'>('both');

  const loc = deck.locations[sel];
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
        <Big>The guest you never hear about.</Big>
        <p className="mt-5 text-[17px] leading-relaxed text-slate-400">
          Somebody may well have asked at one of your registers whether they could pay another way.
          Most never do. They see the card reader, work out the answer, and pay the way they always
          have, or they pick somewhere else before they ever walk in.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-400">
          That is what makes it hard to see. Nobody complains about a payment option you do not
          offer. It shows up as a table that was never booked, in {n} locations, and no shift report
          will ever name it.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 p-5">
          <div className="text-[15px] leading-relaxed text-slate-300">
            What can be counted is what is around you, and that is the next screen. Machines where
            people turn cash into crypto, and businesses near your locations already taking it.
          </div>
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
            ['Guest scans', 'A code comes up on the screen and the guest scans it with their phone. If there is a discount running that night, it rides on the same code.'],
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
              Bitcoin, Ethereum, XRP, a stablecoin - the guest pays out of the wallet they already
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
          Across {n} locations you are not changing a system, retraining a floor, or renegotiating
          anything. This is a separate lane that sits beside what you run, the same way a delivery
          app or a gift certificate already does.
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
        <Big>How many of those guests are actually out there?</Big>
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
              <Stat v={loc.merch_food_5000} k="of those that are restaurants" tone="blue" />
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-400">
              {loc.nearest_name && loc.nearest_m !== undefined ? (
                <>Nearest machine is {loc.nearest_name}, {loc.nearest_m < 1000
                  ? `${loc.nearest_m} metres away`
                  : `${(loc.nearest_m / 1609).toFixed(1)} miles away`}.{' '}</>
              ) : null}
              {loc.merch_5000 === 0
                ? `Nothing within three miles takes crypto today, restaurant or otherwise. You would be the first thing on this map.`
                : loc.merch_food_5000 === 0
                ? `${loc.merch_5000} ${loc.merch_5000 === 1 ? 'business takes' : 'businesses take'} it within three miles, and not one is a restaurant. Somewhere to buy it, nowhere to eat with it.`
                : `${loc.merch_food_5000} of the ${loc.merch_5000} are restaurants, so guests here already have somewhere else to go.`}
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
        <Big>Two locations, two different questions.</Big>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#47566B]">
          They are not the same test, which is the argument for running both. One asks whether an
          event night carries it. The other asks whether the street walks in on its own.
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
          Two weeks, no charge, real guests, in both. If they do not earn their place we carry them
          back out and the other {n - deck.picks.length} locations never hear about it.
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
          It is final in both directions, so the habit is confirming the number before the guest
          scans. That is the whole of the training.
        </p>
      </Slide>

      {/* 8 cryptopop */}
      <Slide wide>
        <Eyebrow>What is being built next</Eyebrow>
        <Big>Being findable, and owning a night.</Big>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-slate-400">
          CryptoPop is two separate things. One puts you on a map people check before they leave
          the house. The other puts your name on the night they came out for.
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
            The meetups already happen. Nobody feeds them.
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
            This is the part we would do with you rather than sell to you, and the money runs
            toward you. CryptoPop sponsors the night - picking up the free appetisers, or the first
            round, or whatever gets people through the door - and brings the crowd to it. You put
            up the floor. We are looking for the first restaurant partner in the valley to build
            that with.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[
              ['We sponsor it', `CryptoPop pays for the draw - appetisers on the house, a first round, whatever fits the night. You are not buying an audience, you are hosting one somebody else paid to bring.`],
              ['Your name on it', `The night runs under your roof and your sign. You are already paying for the band four nights a week - this is the version where somebody else pays to fill the room underneath it.`],
              ['Be on the map', `Your CryptoPop listing, with the special posted by you and changed whenever you want. The listing is what brings someone in; the terminal takes the payment.`],
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
            to earn its place on the fee saving and the guests it seats. Everything on this slide is
            upside on top of that, and a conversation we want to have with you first.
          </p>
        </div>
      </Slide>

      {/* 9 the cost */}
      <Slide wide>
        <Eyebrow>All {n} locations</Eyebrow>
        <Big>What the group costs.</Big>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {[
              [`Terminals, ${n} at ${TERMINAL_LABEL}`, usd0(oneTime), 'once'],
              [
                'Membership, all locations',
                `${usd0(monthly)}/mo`,
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
              <div className="text-[15px] font-extrabold">Year one, all {n}</div>
              <div className="text-[26px] font-extrabold">{usd0(yearOne)}</div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
              Break-even is {usd0(perLocationBreakEven)} a month per location. On your ticket
              average that is a handful of tables a week, and everything past it is margin you
              keep.
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
          {deck.picks.map((p) => p.label).join(' and ')}. Two weeks.
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed">
          A terminal in each. It costs nothing while it runs and you keep every payment it takes.
          If they have not earned their place by the end of it, we carry them back out and that is
          the end of the conversation.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed">
          If they do earn it, the other {n - deck.picks.length} locations are a phone call, not another
          meeting.
        </p>
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
