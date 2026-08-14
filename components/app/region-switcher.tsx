'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export type SwitchableRegion = { id: string; code: string; name: string; is_active?: boolean };

/**
 * Region tabs for corporate.
 *
 * Uses router.push FOLLOWED BY router.refresh, and the refresh is the whole
 * point. Next's client router cache keys on the route, so navigating to the
 * same page with only a different search param can serve the cached payload
 * and never re-run the server component - the URL changes, the numbers do
 * not. That is exactly how the campaign page kept showing Phoenix's queue on
 * the DFW tab. refresh() discards that entry and forces a server round trip.
 *
 * A plain <Link> has the same problem, which is why this is a button.
 */
export function RegionSwitcher({
  regions,
  activeId,
  basePath,
  allowAll = false,
  clearParams = [],
}: {
  regions: SwitchableRegion[];
  activeId: string | null;
  basePath: string;
  /** Pages that can show every region at once (the map). A campaign cannot. */
  allowAll?: boolean;
  /** Params that belong to the region being left, e.g. a focused pin. */
  clearParams?: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  if (regions.length < 2) return null;

  function go(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id === 'all') next.delete('region');
    else next.set('region', id);
    for (const p of clearParams) next.delete(p);
    const qs = next.toString();
    start(() => {
      router.push(`${basePath}${qs ? `?${qs}` : ''}`);
      router.refresh();
    });
  }

  const tab = (id: string, label: string, active: boolean, dim = false) => (
    <button
      key={id}
      type="button"
      disabled={pending}
      onClick={() => go(id)}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs tracking-wide transition-colors disabled:opacity-60',
        active
          ? 'border-primary/40 bg-primary/10 font-medium text-primary'
          : 'border-border/40 text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      {dim && <span className="ml-1.5 opacity-60">off</span>}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowAll && tab('all', 'All regions', activeId === null)}
      {regions.map((r) => tab(r.id, r.code, r.id === activeId, r.is_active === false))}
    </div>
  );
}
