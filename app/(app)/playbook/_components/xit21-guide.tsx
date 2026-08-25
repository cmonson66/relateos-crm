'use client';

import { ExternalLink, Printer } from 'lucide-react';

/**
 * XIT21 in the Playbook.
 *
 * Deliberately a REP-FACING guide, not a pitch. A rep already believes in the
 * terminal; what they do not know is that the register is a web page, that
 * putting it on the terminal takes a minute, and that they can list a shop
 * from their own phone while standing at the counter.
 *
 * Note on framing: XIT21 is Monson Development's, not NectarPay's. It is a
 * directory any crypto-accepting shop belongs on, and the listing is free
 * whatever they use to get paid. Reps should say it that way - a merchant can
 * tell the difference between a directory and an advert, and the honest
 * version is the one that gets a yes.
 */

const SITE = 'https://xit21.com';

const STEPS: [string, string, string][] = [
  [
    'Sign in on your phone',
    `${SITE}/admin`,
    'Magic link to your email. Do it before you walk in - the link takes a minute to arrive and you do not want to wait at the counter.',
  ],
  [
    'Tap Sign a shop',
    '',
    'Type the business name, tap Find, pick them from the list. That fills the address and pins them on the map in one tap.',
  ],
  [
    'If Google has never heard of them',
    '',
    "Search the street address instead. Still nothing? Stand inside and tap 'Pin where I am standing' - your phone beats Google's pin, which often sits on the building centroid rather than the door.",
  ],
  [
    'Set what they take, then sign them up',
    '',
    'Settles in, also takes, an hours note, and the owner\u2019s email if they will give it. They are live the moment you tap it, with their own exit number.',
  ],
  [
    'Show them the setup codes',
    '',
    'Two QR codes on screen. The left one goes on the terminal. The owner scans the right one with their own phone.',
  ],
  [
    'Put their first offer up together',
    '',
    'From the owner\u2019s Offers tab. Do not leave without one running - a shop with nothing on is a pin nobody taps.',
  ],
  [
    'Test it in front of them',
    '',
    'Claim the offer on your own phone, scan it on their terminal, and let them watch the total come out. That thirty seconds is what makes it real rather than a promise.',
  ],
];

const TAPS: [string, string][] = [
  ['Open Chrome on the terminal', 'Not the payment app - the browser.'],
  ['Point its camera at the LEFT code', "Camera app or Chrome's scanner. Tap the link that pops up."],
  ['Menu, then Add to Home screen', 'Three dots, top right. Confirm the name, tap Add.'],
  ['Open it from the home screen', 'Full screen, no address bar - staff cannot wander onto the customer site.'],
  ['Allow the camera when it asks', 'Say yes once. Without it the scanner cannot read a pass.'],
  ['Scan a real pass to finish', 'Claim one on your phone, scan it here, watch the total come out.'],
];

const LINKS: [string, string, string][] = [
  ['Sign in', `${SITE}/admin`, 'Your back office. Sign a shop from here.'],
  ['Listing form', `${SITE}/add`, 'Hand this to a shop that wants to think about it.'],
  ['The map', `${SITE}/map`, 'Show them what they are joining.'],
  ['Contact', `${SITE}/contact`, 'For an owner who is not the person at the counter.'],
];

export function Xit21Guide() {
  return (
    <div id="xit21" className="space-y-6">
      {/* The printable version, first, because a rep heading out the door wants
          the sheet rather than the screen. */}
      <a
        href="/xit21-onepager.pdf"
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 rounded-lg border border-emerald-700/50 bg-emerald-700/5 p-4 transition-colors hover:border-emerald-600"
      >
        <Printer className="h-5 w-5 flex-none text-emerald-500" />
        <div className="min-w-0">
          <div className="text-sm font-bold">Print the one-pager</div>
          <div className="text-[12.5px] text-muted-foreground">
            The whole thing on one sheet, with QR codes. Keep one in the car.
          </div>
        </div>
      </a>

      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="text-lg font-bold">What XIT21 is</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A free directory of local businesses that take crypto, plus the offers those shops choose
          to run. A customer claims an offer, shows a code at the register, the shop scans it, and
          the screen tells them what to charge. XIT21 never touches the money.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <b className="text-foreground">Say it as a directory, not an advert.</b> Listing is free
          and has nothing to do with how a shop gets paid - a merchant who already takes crypto
          through anything at all belongs on the map. That is true, and it is the version that
          gets a yes.
        </p>
      </div>

      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="text-lg font-bold">In the shop, in order</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map(([title, href, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-emerald-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold">
                  {title}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener"
                      className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-500 hover:underline"
                    >
                      {href.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* The part a rep has never done. It is an Android with a browser, so
          there is nothing to download - but nobody guesses that, and a rep who
          is unsure says "I will send it over later", which is where the
          install quietly dies. */}
      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="text-lg font-bold">Putting the register on their NectarPay terminal</h2>
        <p className="mt-1 text-[13px] italic text-muted-foreground">
          The terminal is an Android with a browser. Nothing to download, no app store, about a
          minute.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TAPS.map(([t, d], i) => (
            <div key={t} className="flex gap-2.5">
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-bold">{t}</div>
                <div className="text-[12px] leading-snug text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-md border border-border/40 bg-muted/40 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">If the camera will not scan:</b> type the six-character
          code from the customer&apos;s screen instead. It is on the register page under the scan
          button and works exactly the same. There is never a reason to turn someone away.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-5">
        <h2 className="text-sm font-bold text-amber-500">Do not get these wrong</h2>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
          <li>
            <b className="text-foreground">The owner code is the shop&apos;s takings.</b> Give it to
            the owner, in person. Never leave it on the counter.
          </li>
          <li>
            <b className="text-foreground">The register code only scans passes.</b> That is the one
            that goes on the terminal - it cannot see money or change offers.
          </li>
          <li>
            <b className="text-foreground">If a code gets out</b>, the owner replaces the register
            link themselves from their Offers tab. It takes thirty seconds.
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="text-lg font-bold">Links</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LINKS.map(([label, href, blurb]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener"
              className="rounded-md border border-border/40 px-3 py-2.5 transition-colors hover:border-emerald-600"
            >
              <div className="flex items-center gap-1.5 text-[13px] font-bold">
                {label}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="text-[12px] text-muted-foreground">{blurb}</div>
              <div className="mt-0.5 font-mono text-[11px] text-emerald-500">
                {href.replace(/^https?:\/\//, '')}
              </div>
            </a>
          ))}
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        XIT21 is built and run by Monson Development. It is free for merchants and independent of
        how a shop takes payment.
      </p>
    </div>
  );
}
