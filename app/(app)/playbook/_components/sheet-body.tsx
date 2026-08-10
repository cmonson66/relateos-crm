'use client';

// The printable body of a walk-in sheet, shared by the single-shop route
// and the multi-shop kit so both always look identical.
import type { CallScript } from '@/lib/call-scripts';

const money = (n: number) => '$' + Math.round(n).toLocaleString();

export function SheetBody({
  account, owner, phone, emailStage, volume, pulseUrl, script, rep,
}: {
  account: { id: string; name: string; city: string; band: string; cryptoNative: boolean };
  owner: string | null;
  phone: string | null;
  emailStage: number;
  volume: number | null;
  pulseUrl: string | null;
  script: CallScript;
  rep: { first: string; cell: string; email: string };
}) {
  const vol = volume ?? 10000;
  const loss = vol * 0.03 * 12;

  return (
    <div className="w-full overflow-hidden rounded-md border border-border/40 bg-white p-6 text-black sm:p-8 print:border-0 print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Walk-in sheet</div>
          <h1 className="text-2xl font-extrabold leading-tight">{account.name}</h1>
          <div className="text-sm text-neutral-600">
            {account.city}
            {owner && <> · Ask for <b>{owner}</b></>}
            {phone && <> · {phone}</>}
          </div>
        </div>
        <div className="text-right text-xs">
          {account.band && <div className="font-extrabold">{account.band}</div>}
          {account.cryptoNative && <div className="text-neutral-600">Already takes crypto</div>}
          <div className="text-neutral-600">
            {emailStage > 0 ? `Had ${emailStage} email${emailStage === 1 ? '' : 's'} from you` : 'No emails yet'}
          </div>
        </div>
      </div>

      {volume != null && (
        <div className="mb-4 border-l-4 border-black bg-neutral-100 px-3 py-2 text-sm">
          <b>They told us:</b> about {money(volume)}/month on cards. Use their number, not a generic one.
        </div>
      )}

      <Section n="1" title="WALK IN">
        <p className="mb-1.5 text-sm">Read the room first. If there is a line, buy something small and come back.</p>
        <Say>&quot;Hey - is {owner ?? 'the owner'} around? ... I&apos;m {rep.first}, I work with shops here in {account.city.split(',')[0]}. Two minutes, and I&apos;ll get out of your way.&quot;</Say>
        <p className="text-xs text-neutral-600">If they&apos;re not in: get a name and a good time, leave the one-pager, log it.</p>
      </Section>

      <Section n="2" title="THE HOOK">
        {script.hook.map((h, i) => <Say key={i}>{h}</Say>)}
      </Section>

      <Section n="3" title="ASK THREE THINGS">
        <ol className="ml-4 list-decimal space-y-1 text-sm">
          {script.discovery.map(d => <li key={d.q}>{d.q}</li>)}
        </ol>
        <p className="mt-1.5 text-xs text-neutral-600">Write the volume number down. It goes in the CRM after.</p>
      </Section>

      <Section n="4" title="THE MATH, OUT LOUD">
        <table className="mb-2 w-full table-fixed text-sm">
          <tbody>
            <tr className="border-b border-neutral-300"><td className="py-1">Their card volume / month</td><td className="py-1 text-right font-bold">{money(vol)}</td></tr>
            <tr className="border-b border-neutral-300"><td className="py-1">Lost to card fees / year (~3%)</td><td className="py-1 text-right font-bold">-{money(loss)}</td></tr>
            <tr className="border-b border-neutral-300"><td className="py-1">NectarPay year one, all in</td><td className="py-1 text-right">$727</td></tr>
            <tr><td className="py-1 font-bold">Stays in the shop, year one</td><td className="py-1 text-right font-extrabold">+{money(Math.max(0, loss - 727))}</td></tr>
          </tbody>
        </table>
        <Say>{script.mathLine.replace('{vol}', money(vol) + ' a month').replace('{loss}', money(loss))}</Say>
      </Section>

      <Section n="5" title="CLOSE - LEAVE WITH ONE">
        <ul className="ml-4 list-disc space-y-1 text-sm">
          {script.closes.map(c => (
            <li key={c.title}><b>{c.title.replace(/^[\u2460-\u2463]\s*/, '')}:</b> {c.script.replace(/^"|"$/g, '')}</li>
          ))}
        </ul>
      </Section>

      <div className="avoid-break mt-4 border-t-2 border-black pt-3">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">If they push back</div>
        <div className="grid gap-1.5 text-xs sm:grid-cols-2">
          {script.objections.slice(0, 6).map(o => (
            <div key={o.q}>
              <div className="font-bold">{o.q.replace(/^"|"$/g, '')}</div>
              <div className="text-neutral-700">{o.a.replace(/^"|"$/g, '')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-300 pt-2 text-xs text-neutral-600">
        <span><b>{rep.first}</b>{rep.cell && ` · ${rep.cell}`}{rep.email && ` · ${rep.email}`}</span>
        {pulseUrl && <span className="font-mono">{pulseUrl}</span>}
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">
        $499 terminal · $19/mo flat · zero processing fee · non-custodial · no chargebacks
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="avoid-break mb-3.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">{n}</span>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.15em]">{title}</h2>
      </div>
      <div className="ml-7">{children}</div>
    </div>
  );
}

function Say({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 border-l-2 border-neutral-400 pl-2.5 text-sm italic">{children}</p>;
}
