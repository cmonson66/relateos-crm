'use client';

import { useMemo, useRef, useState } from 'react';
import { CryptoPopPreview } from '@/components/marketing/cryptopop-preview';
import {
  TERMINAL_ONCE,
  MEMBERSHIP_MONTHLY,
  TERMINAL_LABEL,
  MONTHLY_LABEL,
  YEAR_ONE_ROUNDED,
  BREAK_EVEN_YEAR_ONE_MONTHLY,
} from '@/lib/pricing';

export type Atm = { n: string; a: string; lat: number; lng: number };
export type NearAtm = Atm & { m: number };
export type Loc = {
  label: string;
  city: string;
  addr: string;
  lat: number;
  lng: number;
  atm_1600: number;
  atm_5000: number;
  nearest_m: number;
  nearest_name: string;
  near: NearAtm[];
};
export type Deck = {
  brand: string;
  subtitle: string;
  rep: string;
  rep_phone: string | null;
  locations: Loc[];
  atms: Atm[];
};

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ MAP ---
 * An equirectangular projection is fine at valley scale: over about 60 miles
 * of latitude the distortion is smaller than the pins themselves. Drawing it
 * ourselves rather than loading a tile provider keeps the deck instant on a
 * phone with two bars in a restaurant, which is where it will actually open.
 */
function useProjection(locs: Loc[], atms: Atm[], w: number, h: number, pad: number) {
  return useMemo(() => {
    const pts = [...locs, ...atms];
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    // Preserve aspect so the valley does not look stretched.
    const kx = (w - pad * 2) / spanLng;
    const ky = (h - pad * 2) / spanLat;
    const k = Math.min(kx, ky);
    const ox = pad + ((w - pad * 2) - spanLng * k) / 2;
    const oy = pad + ((h - pad * 2) - spanLat * k) / 2;
    return (lat: number, lng: number): [number, number] => [
      ox + (lng - minLng) * k,
      oy + (maxLat - lat) * k,
    ];
  }, [locs, atms, w, h, pad]);
}

function DensityMap({
  deck,
  selected,
  onSelect,
}: {
  deck: Deck;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const W = 360, H = 420, PAD = 26;
  const project = useProjection(deck.locations, deck.atms, W, H, PAD);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
         aria-label="Map of Manuel's locations and the crypto ATMs around them">
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pinGlow">
          <stop offset="0%" stopColor="#F2A71B" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#F2A71B" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width={W} height={H} rx="18" fill="#0A1220" />
      {/* Grid, purely to read as a map rather than a scatter plot. */}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={(W / 8) * i} y1="0" x2={(W / 8) * i} y2={H}
              stroke="#16233A" strokeWidth="1" />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={(H / 10) * i} x2={W} y2={(H / 10) * i}
              stroke="#16233A" strokeWidth="1" />
      ))}

      {/* Every crypto ATM we could find, each with a soft halo. The halos
          overlapping IS the density - no legend needed to read it. */}
      {deck.atms.map((a, i) => {
        const [x, y] = project(a.lat, a.lng);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="17" fill="url(#glow)" />
            <circle cx={x} cy={y} r="2.4" fill="#4ADE80" />
          </g>
        );
      })}

      {deck.locations.map((l, i) => {
        const [x, y] = project(l.lat, l.lng);
        const on = i === selected;
        return (
          <g key={l.label} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            {on && <circle cx={x} cy={y} r="26" fill="url(#pinGlow)" />}
            <circle cx={x} cy={y} r={on ? 9 : 6.5}
                    fill="#F2A71B" stroke="#0A1220" strokeWidth="2.5" />
            <text x={x} y={y - (on ? 16 : 13)} textAnchor="middle"
                  fontSize={on ? 12 : 10} fontWeight="800"
                  fill={on ? '#FFFFFF' : '#94A3B8'}>
              {l.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------- SLIDES --- */

function Slide({
  children,
  tone = 'dark',
}: {
  children: React.ReactNode;
  tone?: 'dark' | 'light' | 'amber';
}) {
  const bg =
    tone === 'light' ? 'bg-[#F8F4EA] text-[#0C1A2C]'
    : tone === 'amber' ? 'bg-[#F2A71B] text-[#0C1A2C]'
    : 'bg-[#0A1220] text-slate-100';
  return (
    <section
      className={`${bg} flex min-h-[100svh] snap-start flex-col justify-center px-6 py-14`}
    >
      <div className="mx-auto w-full max-w-md">{children}</div>
    </section>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#C9820A]">
    {children}
  </div>
);

const Big = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[30px] font-extrabold leading-[1.12] tracking-tight">{children}</h2>
);

export function PitchClient({ deck }: { deck: Deck }) {
  const [sel, setSel] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const n = deck.locations.length;

  const oneTime = TERMINAL_ONCE * n;
  const yearOne = YEAR_ONE_ROUNDED * n;
  const monthly = MEMBERSHIP_MONTHLY * n;
  const loc = deck.locations[sel];

  const busiest = useMemo(
    () => [...deck.locations].sort((a, b) => b.atm_1600 - a.atm_1600)[0],
    [deck.locations]
  );
  const totalWithinMile = deck.locations.reduce((s, l) => s + l.atm_1600, 0);

  return (
    <div
      ref={scroller}
      className="h-[100svh] snap-y snap-mandatory overflow-y-scroll bg-[#0A1220]"
    >
      {/* 1 ------------------------------------------------------------ */}
      <Slide>
        <div className="text-2xl font-extrabold">
          Nectar<span className="text-[#F2A71B]">Pay</span>
        </div>
        <div className="mt-16">
          <Eyebrow>Prepared for</Eyebrow>
          <h1 className="text-[38px] font-extrabold leading-[1.08] tracking-tight">
            {deck.brand}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-400">{deck.subtitle}</p>
        </div>
        <div className="mt-16 flex items-baseline gap-3">
          <div className="text-[64px] font-extrabold leading-none text-[#F2A71B]">{n}</div>
          <div className="text-[15px] leading-tight text-slate-400">
            locations
            <br />
            one decision
          </div>
        </div>
        <p className="mt-14 text-[13px] text-slate-500">
          {deck.rep} · scroll to move through it
        </p>
      </Slide>

      {/* 2 ------------------------------------------------------------ */}
      <Slide>
        <Eyebrow>The customer you cannot serve</Eyebrow>
        <Big>Somebody has already asked at your register.</Big>
        <p className="mt-5 text-[17px] leading-relaxed text-slate-400">
          They asked whether they could pay another way, and whoever was working said no. Across{' '}
          {n} rooms, that is not a one-off. That is a standing policy nobody chose.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-400">
          Here is what is around those rooms right now.
        </p>
      </Slide>

      {/* 3 ------------------------- the map --------------------------- */}
      <Slide>
        <Eyebrow>Crypto density · tap a location</Eyebrow>
        <h2 className="mb-4 text-[24px] font-extrabold leading-tight">
          {deck.atms.length} crypto cash machines around your {n} rooms.
        </h2>

        <DensityMap deck={deck} selected={sel} onSelect={setSel} />

        <div className="mt-4 rounded-2xl bg-white/5 p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[17px] font-extrabold">{loc.label}</div>
            <div className="text-[12px] text-slate-500">{loc.addr}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-black/30 py-2">
              <div className="text-[22px] font-extrabold text-[#4ADE80]">{loc.atm_1600}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                within a mile
              </div>
            </div>
            <div className="rounded-xl bg-black/30 py-2">
              <div className="text-[22px] font-extrabold text-[#4ADE80]">{loc.atm_5000}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                within three
              </div>
            </div>
            <div className="rounded-xl bg-black/30 py-2">
              <div className="text-[22px] font-extrabold text-[#F2A71B]">
                {loc.nearest_m < 1000
                  ? `${loc.nearest_m}m`
                  : `${(loc.nearest_m / 1609).toFixed(1)}mi`}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">nearest</div>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
            Closest is {loc.nearest_name}, {loc.addr.split(',')[0]}. Someone standing at that
            machine is turning cash into crypto. The nearest place to spend it is not your dining
            room.
          </p>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
          Green dots are crypto ATMs verified on Google Places this week. Counts are straight-line
          distance from each address.
        </p>
      </Slide>

      {/* 4 ------------------------------------------------------------ */}
      <Slide tone="light">
        <Eyebrow>What it looks like at the register</Eyebrow>
        <Big>Ten seconds. Nothing else changes.</Big>
        <ol className="mt-6 space-y-4">
          {[
            'Server types the amount into a small terminal by the register.',
            'Guest scans the code on the screen with their phone.',
            'It is done, and the money is in a wallet you own before they stand up.',
          ].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F2A71B] text-[13px] font-extrabold">
                {i + 1}
              </span>
              <span className="text-[16px] leading-relaxed text-[#47566B]">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 rounded-xl bg-[#0C1A2C] p-4 text-[15px] leading-relaxed text-slate-300">
          Your card readers keep doing exactly what they do today. This sits beside them. No
          switching processors, no retraining a floor.
        </p>
      </Slide>

      {/* 5 ------------------------------------------------------------ */}
      <Slide>
        <Eyebrow>Speed</Eyebrow>
        <Big>Card money is not yours yet.</Big>
        <div className="mt-7 space-y-3">
          <div className="rounded-2xl border border-white/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              A card sale
            </div>
            <p className="mt-1 text-[16px] leading-relaxed text-slate-300">
              Guest leaves. Money turns up Tuesday, minus a cut, and can still leave again weeks
              later.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#F2A71B] bg-[#F2A71B]/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2A71B]">
              A sale on this
            </div>
            <p className="mt-1 text-[16px] leading-relaxed text-slate-100">
              Done when it is done. In a wallet you own before they reach the door. Not pending,
              not held, not reversible.
            </p>
          </div>
        </div>
        <p className="mt-6 text-[15px] leading-relaxed text-slate-400">
          No dispute window. No chargeback. A settled payment is final, which cuts both ways, so
          the habit is confirming the number before the guest scans.
        </p>
      </Slide>

      {/* 6 ------------------------------------------------------------ */}
      <Slide tone="light">
        <Eyebrow>The honest arithmetic</Eyebrow>
        <Big>Nobody is telling you your card volume moves.</Big>
        <p className="mt-4 text-[16px] leading-relaxed text-[#47566B]">
          It will not, and you would spot that in about four seconds. So here is the floor
          instead, per room.
        </p>
        <div className="mt-6 rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
          <div className="text-[44px] font-extrabold leading-none text-[#F2A71B]">
            {usd(BREAK_EVEN_YEAR_ONE_MONTHLY)}
          </div>
          <div className="mt-1 text-[14px] text-slate-400">
            a month, per location, in crypto sales covers the entire first year of that location.
          </div>
          <div className="mt-4 border-t border-white/10 pt-4 text-[15px] leading-relaxed text-slate-300">
            On a restaurant ticket that is a handful of tables a week. Everything past it is
            margin you keep, and there is never a percentage on any of it.
          </div>
        </div>
      </Slide>

      {/* 7 ------------------------------------------------------------ */}
      <Slide>
        <Eyebrow>All {n} rooms</Eyebrow>
        <Big>What the whole group costs.</Big>
        <div className="mt-6 space-y-2">
          {[
            [`Terminals, ${n} at ${TERMINAL_LABEL}`, usd(oneTime), 'once'],
            [`Membership, ${n} at ${MONTHLY_LABEL}`, usd(monthly) + '/mo', 'billed yearly'],
            ['Cut of your sales', 'none', 'ever'],
          ].map(([k, v, note]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <div>
                <div className="text-[15px] text-slate-300">{k}</div>
                <div className="text-[11px] text-slate-600">{note}</div>
              </div>
              <div className="text-[17px] font-extrabold">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-[#F2A71B] px-5 py-4 text-[#0C1A2C]">
          <div className="text-[15px] font-extrabold">Year one, all {n}</div>
          <div className="text-[26px] font-extrabold">{usd(yearOne)}</div>
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-slate-400">
          Start with one room if you would rather. The trial costs nothing while it runs and you
          hand the terminal back if it does not earn its place.
        </p>
      </Slide>

      {/* 8 ------------------------------------------------------------ */}
      <Slide tone="light">
        <Eyebrow>What is coming next</Eyebrow>
        <div className="-mx-2">
          <CryptoPopPreview shopName={deck.brand} />
        </div>
      </Slide>

      {/* 9 ------------------------------------------------------------ */}
      <Slide tone="amber">
        <Eyebrow>The ask</Eyebrow>
        <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-tight">
          Put one in {busiest.label} for two weeks.
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed">
          It has {busiest.atm_1600} crypto cash machines inside a mile, the most of any of your{' '}
          {n} rooms, and {totalWithinMile} sit within a mile of the group. It costs nothing while
          it runs. If it does not earn its place, we carry it back out.
        </p>
        <div className="mt-10 rounded-2xl bg-[#0C1A2C] p-5 text-slate-200">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Your rep</div>
          <div className="mt-1 text-[20px] font-extrabold">{deck.rep}</div>
          {deck.rep_phone && (
            <a href={`tel:${deck.rep_phone}`} className="mt-1 block text-[17px] text-[#F2A71B]">
              {deck.rep_phone}
            </a>
          )}
        </div>
        <p className="mt-8 text-[12px] leading-relaxed text-[#0C1A2C]/60">
          This link stays live. Send it to anyone who needs to see it.
        </p>
      </Slide>
    </div>
  );
}
