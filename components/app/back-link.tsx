'use client';

// "Back" that means back to where you actually came from.
//
// Every detail page used to hardcode a link to its list ("All contacts"),
// so opening a contact from an account page and hitting back dumped you in
// the full contact list instead of the shop you were working. This uses
// real history when the previous page was inside the app, and falls back
// to the list only when there is nowhere to return to (fresh tab, deep
// link from an email).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/accounts\/[^/]+/, label: 'Back to account' },
  { test: /^\/accounts/, label: 'Back to accounts' },
  { test: /^\/contacts\/[^/]+/, label: 'Back to contact' },
  { test: /^\/contacts/, label: 'Back to contacts' },
  { test: /^\/deals\/[^/]+/, label: 'Back to deal' },
  { test: /^\/deals/, label: 'Back to pipeline' },
  { test: /^\/calendar/, label: 'Back to calendar' },
  { test: /^\/map/, label: 'Back to map' },
  { test: /^\/dashboard/, label: 'Back to dashboard' },
  { test: /^\/call\/[^/]+\/sheet/, label: 'Back to sheet' },
  { test: /^\/call/, label: 'Back to call mode' },
  { test: /^\/playbook/, label: 'Back to playbook' },
  { test: /^\/activities/, label: 'Back to activity' },
  { test: /^\/campaigns/, label: 'Back to campaign' },
];

export function BackLink({
  fallbackHref,
  fallbackLabel,
}: {
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();
  const [prev, setPrev] = useState<{ label: string } | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const ref = document.referrer;
    if (!ref) return;
    try {
      const url = new URL(ref);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      const hit = LABELS.find(l => l.test.test(url.pathname));
      // Referrer is only readable on the client, so this has to happen in
      // an effect - the state it sets is derived from outside React.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrev({ label: hit?.label ?? 'Back' });
    } catch {
      // malformed referrer - stay with the fallback
    }
  }, []);

  const cls =
    'inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground mb-5 transition-colors';

  if (prev) {
    return (
      <button type="button" onClick={() => router.back()} className={cls}>
        <ArrowLeft className="h-3.5 w-3.5" /> {prev.label}
      </button>
    );
  }
  return (
    <Link href={fallbackHref} className={cls}>
      <ArrowLeft className="h-3.5 w-3.5" /> {fallbackLabel}
    </Link>
  );
}
