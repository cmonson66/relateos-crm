'use client';

import Link from 'next/link';
import { Printer, ChevronLeft } from 'lucide-react';
import type { CallScript } from '@/lib/call-scripts';
import { OnePager } from './one-pager';
import { SheetBody } from './sheet-body';

export type KitSheet = {
  account: { id: string; name: string; city: string; band: string; cryptoNative: boolean };
  owner: string | null;
  phone: string | null;
  emailStage: number;
  volume: number | null;
  pulseUrl: string | null;
  script: CallScript;
};

export function KitView({
  sheets,
  rep,
  blank = false,
}: {
  sheets: KitSheet[];
  rep: { first: string; cell: string; email: string };
  blank?: boolean;
}) {
  const blankCount = 3; // three one-pagers - enough for a morning of walk-ins
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          html, body { background: #fff !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          #kit, #kit * { visibility: visible !important; }
          #kit {
            position: absolute !important; left: 0; top: 0;
            width: 100% !important; max-width: none !important;
            margin: 0 !important; padding: 0 !important;
          }
          .kit-page { break-after: page; page-break-after: always; }
          .kit-page:last-child { break-after: auto; page-break-after: auto; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/playbook" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Playbook
        </Link>
        <div className="text-sm text-muted-foreground">
          {blank
            ? `Blank kit · ${blankCount} one-pagers`
            : `${sheets.length} shop${sheets.length === 1 ? '' : 's'} · ${sheets.length * 2} pages`}
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground"
        >
          <Printer className="h-4 w-4" /> Print the kit
        </button>
      </div>

      {sheets.length === 0 && !blank && (
        <div className="rounded-md border border-border/40 p-6 text-center text-sm text-muted-foreground">
          No shops selected. Pick your visits on the Playbook page.
        </div>
      )}

      <div id="kit" className="space-y-6">
        {blank && Array.from({ length: blankCount }).map((_, i) => (
          <div key={`blank-${i}`} className="kit-page">
            <OnePager />
          </div>
        ))}
        {sheets.map(s => (
          <div key={s.account.id}>
            <div className="kit-page">
              <SheetBody {...s} rep={rep} />
            </div>
            <div className="kit-page mt-6 print:mt-0">
              <OnePager rep={rep} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
