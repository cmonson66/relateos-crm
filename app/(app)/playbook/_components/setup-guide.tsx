'use client';

import { QrBlock } from './qr-codes';
import { MoneyFlow } from '@/components/marketing/money-flow';

/**
 * The merchant install, in the Playbook.
 *
 * Same content as the printable sheet, one deliberate difference: the sites
 * are TAPPABLE LINKS rather than QR codes. On paper a rep needs a code to
 * point a phone at; in the app the rep is already holding the phone, so a QR
 * of a URL on the same screen is a puzzle with an obvious answer.
 *
 * Everything else is carried over intact, including the ordering that matters:
 * traps sit BEFORE the step they ruin, not after it.
 */

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener"
    className="font-bold text-[#b45309] underline underline-offset-2"
  >
    {children}
  </a>
);

/** A literal on-screen button or field, so a rep can match it to the screen. */
const K = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded border border-neutral-300 bg-neutral-100 px-1 font-bold text-neutral-900">
    {children}
  </span>
);

function Trap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="avoid-break my-2 rounded-sm border border-[#f2a71b] bg-[#fffbeb] px-2.5 py-1.5 text-[12.5px] leading-snug">
      <b className="text-[#b45309]">{title}</b> {children}
    </div>
  );
}

function Step({ n, title, sub, qr, children }: {
  n: string; title: string; sub?: string;
  qr?: { code: 'mint' | 'bee' | 'np' | 'dash' | 'pair'; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="avoid-break mb-4">
      <div className="mb-1 flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#f2a71b] text-[11px] font-bold text-[#0c1a2c]">
          {n}
        </span>
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#0c1a2c]">
            {title}
          </h2>
          {sub && <div className="text-[11.5px] italic text-neutral-500">{sub}</div>}
        </div>
      </div>
      {/* The code sits beside the step, the way it does on the printed sheet -
          a rep on a laptop is setting up the merchant's phone, so scanning off
          the screen is the normal case. The link stays too, for a rep already
          on their phone. */}
      <div className="ml-7 flex items-start gap-4">
        {qr && <QrBlock code={qr.code} label={qr.label} />}
        <div className="min-w-0 flex-1 text-[13px]">{children}</div>
      </div>
    </div>
  );
}

const FAILURES: [string, React.ReactNode][] = [
  ['The wallet app will not take the private key',
   <>There is no wallet in the app yet. Create a new empty wallet in it first, then import.
     Almost every wallet app behaves this way.</>],
  ['The camera will not open in beekeeper',
   <>Permission was declined. Browser settings, site permissions, camera, allow, then reload.
     On iPhone: Settings, Safari, Camera.</>],
  ['The etched QR will not scan',
   <>More light, less angle. Take the phone case off if it shadows the lens. Dry cloth only,
     never anything abrasive.</>],
  ['&quot;Link&quot; does nothing / no wallets listed',
   <>The wallet was not finished reading. Wait two minutes, reload beekeeper, try again.</>],
  ['A coin they toggled on did not save',
   <>They saved after several. Toggle one, SAVE, repeat.</>],
  ['The pairing code ran out',
   <>Click <K>Pair a device</K> again for a fresh one. Nothing is broken and nothing is
     half-paired.</>],
  ['The terminal shows a login instead of the pairing screen',
   <>Wrong address. It is <b>/pos/pair</b>, not /pos and not the dashboard.</>],
  ['The seal looks disturbed',
   <>Stop. Do not use it. A coin that may have been opened is a coin whose key someone else
     may hold.</>],
];

export function SetupGuide() {
  return (
    <div id="playbook" className="rounded-md border border-border/40 bg-white text-black">
      <div className="h-1.5 w-full bg-[#f2a71b]" />
      <div className="print-pad p-6 sm:p-8">

        <div className="avoid-break mb-5 flex items-start justify-between gap-4 border-b-2 border-[#0c1a2c] pb-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#b45309]">
              Install guide
            </div>
            <h2 className="mt-1 text-xl font-extrabold text-[#0c1a2c]">Setting up a merchant</h2>
          </div>
          <div className="text-right leading-none">
            <div className="text-lg font-extrabold text-[#0c1a2c]">
              Nectar<span className="text-[#b45309]">Pay</span>
            </div>
            <div className="mt-0.5 text-[9px] italic text-neutral-500">Sweeten Every Transaction.</div>
          </div>
        </div>

        <p className="avoid-break mb-4 text-sm text-neutral-700">
          Do this <b>with</b> them - their phone, their computer, their hands on it. They own the
          wallet and need to have touched every step. Budget an afternoon the first couple of
          times; about forty minutes once you have done a few.
        </p>

        <div className="avoid-break mb-4 rounded-sm border border-neutral-300 p-3">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#b45309]">
            Before you knock
          </div>
          <div className="grid gap-x-6 gap-y-0.5 text-[12.5px] sm:grid-cols-2">
            <div><b>An unopened coin.</b> <span className="text-neutral-600">Check the seal in the car, not at the counter.</span></div>
            <div><b>Their terminal, charged.</b> <span className="text-neutral-600">Or on power at the register.</span></div>
            <div><b>Their Wi-Fi password.</b> <span className="text-neutral-600">Ask when you book, not on the day.</span></div>
            <div><b>Who is the owner.</b> <span className="text-neutral-600">The wallet has to be theirs, not a manager&apos;s.</span></div>
            <div><b>Two dollars.</b> <span className="text-neutral-600">For the live test payment at the end.</span></div>
            <div><b>An hour they are not busy.</b> <span className="text-neutral-600">Never during a rush.</span></div>
            <div className="sm:col-span-2">
              <b>A wallet app with an empty wallet already created in it.</b>{' '}
              <span className="text-neutral-600">Do this in the car - see step 1.</span>
            </div>
            <div className="sm:col-span-2">
              <b>The setup link sent when you booked.</b>{' '}
              <span className="text-neutral-600">
                Deal page, BEFORE THE INSTALL. Their exchange account takes days to clear, so if
                nothing is ticked off, phone them before you drive out.
              </span>
            </div>
          </div>
        </div>

        <div className="avoid-break mb-5 rounded-sm border-l-4 border-[#f2a71b] bg-[#fffbeb] p-3">
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#b45309]">
            Say this out loud before you start
          </div>
          <p className="text-sm">
            <b>The coin IS the money.</b> It is not a receipt and not a backup - the wallet key is
            physically on it. Lose the coin and the written backup and the funds are gone, and
            nobody, us included, can bring them back. That is the same thing that makes it
            impossible for anyone to freeze or claw back what they earn. Both halves are true and
            they should hear both from you.
          </p>
        </div>

        <Step n="1" title="Open the coin" sub="On the table in front of them" qr={{ code: 'mint', label: 'Start here' }}>
          <Trap title="Do this first, before you touch the coin.">
            The redeem flow asks for a hot wallet to import into, and <b>most wallet apps will
            not accept a private key until a wallet already exists inside them</b>. Install the
            wallet app, <b>create a new empty wallet</b>, and only then start redeeming. Backwards
            and the import silently refuses, mid-install, with the owner watching.
          </Trap>
          <p className="mb-1.5">
            Go to <A href="https://blockchainmint.com/redeem">blockchainmint.com/redeem</A> and
            follow it with the coin you brought.
          </p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>A fingernail lifts the sticker. Rubbing alcohol or WD40 loosens a stubborn one.</li>
            <li><b>Get the whole sticker off.</b> Under it: tamper-evident glue in patches, and a
                laser-etched QR code.</li>
            <li>Nothing abrasive - ever. Scratch the etching and the coin is scrap.</li>
          </ul>
          <Trap title="Check the glue before you go further.">
            Patchy is normal. Smooth, shiny or peeled means the coin was opened before it reached
            you. Put it away and use a different one.
          </Trap>
        </Step>

        <Step n="2" title="Pair the coin to their phone" sub="Their phone, not yours" qr={{ code: 'bee', label: 'Their wallet' }}>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>On their phone, open <A href="https://beekeeper.money">beekeeper.money</A>.</li>
            <li>Tap <K>Scan coin</K>, then <K>Start camera</K>, then <b>Allow</b> when the phone
                asks for the camera.</li>
            <li>Scan the <b>laser-etched</b> QR - the one under the sticker. Not the sticker.</li>
            <li>Read the four rules with them and tap to agree. Do not tap through on their behalf.</li>
            <li>They choose a password. <b>Put it in a password manager while you are standing
                there.</b></li>
          </ol>
          <p className="my-1.5 border-l-2 border-neutral-400 bg-neutral-100 py-1.5 pl-2.5 text-sm italic">
            &quot;Put that password somewhere you would still find it in two years. Not a note by
            the register.&quot;
          </p>
          <Trap title="Wait for it.">
            The wallet takes a couple of minutes to read as ready. Do not start step 3 until it
            does, or the link in step 4 will not find it.
          </Trap>
        </Step>

        <Step n="3" title="Create their merchant account" sub="Their computer" qr={{ code: 'np', label: 'Merchant account' }}>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Go to <A href="https://nectar-pay.com">nectar-pay.com</A> and click <K>Start free</K>,
                top right.</li>
            <li>Their email for a magic link, or their Google account.</li>
            <li>Business name <b>exactly as customers know it</b> - it prints on receipts.</li>
            <li>A QR code appears on screen. <b>Stop. Do not close this page.</b></li>
          </ol>
          <Trap title="That QR is the handoff.">
            It has to stay on screen while you do step 4 on their phone. Closing it means starting
            the account link again.
          </Trap>
        </Step>

        <Step n="4" title="Link the wallet to the account" sub="Phone and computer together - the step people fumble">
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Back on their phone in beekeeper.money, find <K>Link</K> at the top of the
                <b> TOTAL BALANCE</b> tile.</li>
            <li>The camera opens. Point it at the QR on their computer screen.</li>
            <li>A list of wallets appears on the phone. Tap <K>approve</K>, then <K>link</K> at
                the bottom.</li>
            <li>The computer says linked. Click <K>enable standard stablecoins</K>.</li>
            <li>Take the defaults - except <b>uncheck tipping</b> unless they asked for it. It adds
                a screen every customer has to get past.</li>
          </ol>
          <p className="mt-1.5 text-neutral-600">
            Standard stablecoins is the right starting point: dollar-pegged, so nothing they take
            in moves overnight.
          </p>
        </Step>

        <Step n="5" title="Choose which coins they accept" sub="Optional - stablecoins alone is a complete setup" qr={{ code: 'dash', label: 'Dashboard' }}>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Go to <A href="https://app.nectar-pay.com/dashboard">app.nectar-pay.com/dashboard</A>.</li>
            <li>Open <K>Store</K>, then <K>Wallets &amp; Chains</K>.</li>
            <li>BTC, ETH, LTC, Bitcoin Cash, DOGE and the rest are <b>off by default</b> on
                purpose - their value moves.</li>
            <li><b>Toggle one on, press SAVE, then do the next one.</b></li>
          </ol>
          <Trap title="One at a time, saving each.">
            It does not save several together, and this is where people lose ten minutes wondering
            why nothing stuck.
          </Trap>
        </Step>

        <Step n="6" title="Pair the terminal" sub="Order matters here - read the trap first" qr={{ code: 'pair', label: 'On the terminal' }}>
          <p className="mb-1">
            The POS is a <b>web app</b>. Nothing to download, no app store. It runs on a Senraise
            H10P or on any Android phone.
          </p>
          <Trap title="The pairing code dies in five minutes.">
            Get the terminal sitting on the pairing screen <b>before</b> you generate one. Do it
            the other way round and you will be watching a clock while the owner watches you.
          </Trap>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li><b>On the terminal first:</b> open Chrome and go to{' '}
                <A href="https://app.nectar-pay.com/pos/pair">app.nectar-pay.com/pos/pair</A>.
                Leave it there.</li>
            <li><b>Now on their computer:</b> dashboard, then <K>Terminals</K> in the left menu.</li>
            <li>Pick their shop under <K>Store</K>.</li>
            <li>Give it a <K>Label</K> that says where it lives - <b>Front counter</b>,
                <b> Patio</b>, <b>Sarah&apos;s phone</b>. A shop with two devices needs to tell
                them apart later.</li>
            <li>Click <K>Pair a device</K>. A six-character code and a QR appear.</li>
            <li>On the terminal: scan the QR with its camera, <b>or</b> type the six characters.
                Either works.</li>
            <li>Click <K>Done</K> on the computer. It now shows under <b>Paired terminals</b> with
                a last-seen time.</li>
            <li><b>Install it:</b> on the terminal, Chrome menu (three dots, top right), then
                <K>Add to Home screen</K>. Full screen, no address bar, so staff cannot wander out
                of it.</li>
          </ol>
          <p className="mt-1.5 text-neutral-600">
            <b>Check the last-seen time before you leave.</b> That one line is how you know it
            really paired - and it is the first thing support will ask you for.
          </p>
          <Trap title="A lost device is a delete, not a phone call.">
            Each terminal signs with its own secret, so the owner revokes just that one from this
            page with the bin icon and the others keep working. Show them where it is - they will
            ask what happens if a phone walks off.
          </Trap>
        </Step>

        <Step n="7" title="Make a share link and test it live" sub="The step that closes the install">
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Still in <K>Store</K> settings, find <K>Share Links</K>.</li>
            <li>Create one and open it.</li>
            <li>Run a real payment through it - a couple of dollars, start to settled, while they
                watch.</li>
          </ol>
          <p className="mt-1.5 text-neutral-600">
            That first live payment is what makes it real for them. NectarPay can also build an
            email banner off the same link, so ask whether they want one.
          </p>
        </Step>

        <Step n="8" title="Before you walk out">
          <ul className="ml-4 list-disc space-y-0.5">
            <li><b>Everyone who works the register has done one transaction themselves.</b> Not
                watched one - done one.</li>
            <li>The password is in a password manager, not on paper by the till.</li>
            <li>The coin is somewhere they would keep cash. A safe, not the drawer.</li>
            <li>The seven-day check-in is on the calendar <b>before</b> you leave, not after.</li>
            <li>Ask about XIT21 while you are there - free listing, and one more reason for
                somebody to walk in.</li>
          </ul>
        </Step>

        {/* They ask this at the end of every install, and a rep who answers it
            badly undoes the whole visit. Turn the screen around rather than
            improvising - and never let them think NectarPay moves the money to
            their bank, because it does not. */}
        <div className="avoid-break mt-5 border-t-2 border-[#0c1a2c] pt-3">
          <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#0c1a2c]">
            &quot;So how do I actually get paid?&quot;
          </h2>
          <MoneyFlow />
        </div>

        <div className="avoid-break mt-5 border-t-2 border-[#0c1a2c] pt-3">
          <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#0c1a2c]">
            When it goes wrong
          </h2>
          <div className="space-y-1.5">
            {FAILURES.map(([q, a], i) => (
              <div key={i} className="avoid-break grid gap-x-4 border-b border-dashed border-neutral-300 pb-1.5 text-[12.5px] sm:grid-cols-[38%_1fr]">
                <div className="font-bold" dangerouslySetInnerHTML={{ __html: q }} />
                <div className="text-neutral-700">{a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="avoid-break mt-5 flex items-baseline justify-between gap-4 border-t border-neutral-300 pt-3">
          <p className="text-[11px] leading-relaxed text-neutral-600">
            Set-up support is included. If what is on their screen does not match this sheet,
            <b> stop and call it in</b> rather than guessing - these steps change as the product
            does. A merchant watching you guess is a merchant who stops trusting the thing you
            just sold them.
          </p>
          <div className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.18em] text-neutral-400">
            v3
          </div>
        </div>

      </div>
    </div>
  );
}
