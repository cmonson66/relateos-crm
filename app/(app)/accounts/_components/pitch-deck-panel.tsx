'use client';

import { useState } from 'react';
import { buildPitchDeck } from '../pitch-actions';
import { Button } from '@/components/ui/button';
import { Presentation, Copy, Check, ExternalLink } from 'lucide-react';

export type Sibling = { id: string; name: string; city: string | null };

export function PitchDeckPanel({
  accountId,
  accountName,
  siblings,
  repName,
}: {
  accountId: string;
  accountName: string;
  siblings: Sibling[];
  repName: string;
}) {
  // Siblings are opt-in. brand_key is unreliable in this data - Manuel's eight
  // locations carry seven different keys - so the rep confirms the group
  // rather than the deck guessing at it.
  const [picked, setPicked] = useState<Set<string>>(new Set([accountId]));
  const [brand, setBrand] = useState(accountName);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ token: string; locations: number; merchants: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      n.add(accountId); // the account you are on is always in
      return n;
    });
  };

  const url = result ? `${window.location.origin}/pitch/${result.token}` : '';

  const build = async () => {
    setBusy(true);
    setError(null);
    const res = await buildPitchDeck({
      accountIds: [...picked],
      brand,
      repName,
      repPhone: phone,
    });
    setBusy(false);
    if (res.ok) setResult({ token: res.token, locations: res.locations, merchants: res.merchants });
    else setError(res.error);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-1 flex items-center gap-2 font-display text-sm tracking-wider">
        <Presentation className="h-4 w-4 text-primary" /> PITCH DECK
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        A link you can show on your phone and leave with them. Live map of who nearby already
        takes crypto, and a calculator they can drag.
      </p>

      {!result && (
        <>
          <label className="mb-1 block text-xs font-medium">Name on the cover</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mb-3 w-full rounded border bg-background px-2 py-1.5 text-sm"
          />

          <label className="mb-1 block text-xs font-medium">
            Your number <span className="font-normal text-muted-foreground">(optional, tap to call)</span>
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="602-555-0142"
            className="mb-3 w-full rounded border bg-background px-2 py-1.5 text-sm"
          />

          {siblings.length > 0 && (
            <>
              <div className="mb-1 text-xs font-medium">
                Other locations{' '}
                <span className="font-normal text-muted-foreground">
                  — tick any that belong to the same owner
                </span>
              </div>
              <div className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                {siblings.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={picked.has(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <span>{s.name}</span>
                    {s.city && <span className="text-muted-foreground">· {s.city}</span>}
                  </label>
                ))}
              </div>
            </>
          )}

          <Button size="sm" onClick={build} disabled={busy} className="w-full">
            {busy ? 'Building…' : `Build deck (${picked.size} location${picked.size === 1 ? '' : 's'})`}
          </Button>
        </>
      )}

      {error && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {result.locations} location{result.locations === 1 ? '' : 's'} ·{' '}
            {result.merchants} crypto-accepting businesses mapped · live 90 days
          </p>
          <div className="flex items-center gap-1.5 rounded border bg-muted/40 p-2">
            <code className="flex-1 truncate text-[11px]">{url}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded p-1 hover:bg-muted"
              aria-label="Copy link"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open it
              </Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Build another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
