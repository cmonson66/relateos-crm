'use client';

import { QrBlock, type QrKey } from './qr-codes';
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
  qr?: { code: QrKey; label: string };
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
  ['There is no PRINT RECEIPT button after a sale',
   <>You are in a browser shortcut, not the app. The button only renders when the native printer
     answers, so it is absent rather than greyed out. Open <K>NectarPay POS</K> from the app
     drawer and check <K>Printer test</K> - if it says <b>Browser mode</b>, that is the whole
     problem.</>],
  ['The terminal shows a login instead of the pairing screen',
   <>Open the app rather than a browser. If you are in the app already, it is the wrong address -
     <b>/pos/pair</b>, not /pos and not the dashboard.</>],
  ['They ask where the money is if their phone breaks',
   <>The coin, not the phone. A new phone, the app, import the key from the coin again - which is
     also why the coin lives in a safe and the password is in a password manager.</>],
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
          wallet and need to have touched every step. If you sent the setup link when you booked
          and they did their part, budget half an hour; an hour if they did not.
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
              <b>Know which wallet app they are installing.</b>{' '}
              <span className="text-neutral-600">
                Bitcoin.com Wallet is the one we have set up on. It installs on THEIR phone at the
                counter, never yours - see step 1.
              </span>
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

        <Step n="1" title="Open the coin" sub="Their phone, on the table in front of them" qr={{ code: 'mint', label: 'Start here' }}>
          <Trap title="Every step here happens on THEIR phone. Never yours.">
            The redeem flow imports the coin&apos;s private key into a wallet app. That key is the
            money. Put it on your own phone - even &quot;just to save time in the car&quot; - and
            you are holding a merchant&apos;s funds, which is the one thing we tell every owner
            never happens. Hand them the phone or stand beside them; do not take shortcuts on
            this one.
          </Trap>
          <Trap title="Install the app and create an empty wallet BEFORE you touch the coin.">
            <b>Bitcoin.com Wallet</b> is what we have set up on. Most wallet apps{' '}
            <b>will not accept a private key until a wallet already exists inside them</b>, so:
            install it on their phone, <b>create a new empty wallet</b>, and only then start
            redeeming. Backwards and the import silently refuses, mid-install, with the owner
            watching.
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
          <div className="my-2 rounded-sm border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-[12.5px] leading-snug">
            <b>&quot;So which app is my money in?&quot;</b> They will ask, and the answer is that
            it is not in an app at all - it is on the coin. The coin holds one key, and any app
            holding that key sees the same funds. Two apps is not two pots of money.{' '}
            <b>Beekeeper is the one they open day to day</b>, because it is the one linked to
            their NectarPay account in step 4.
          </div>
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
          <p className="mt-1.5 text-neutral-600">
            <b>Volatility is only half the reason they are off.</b> Moving Bitcoin costs a network
            fee of a few dollars <b>per transfer, whatever the amount</b> - so on a shop taking
            $6 tickets it can eat a third of a sale. Stablecoins on a cheap network do not have
            that problem. A shop with small tickets should leave the rest off.
          </p>
        </Step>

        <Step n="6" title="Install the app on the terminal" sub="Not a browser. This is where installs quietly go wrong" qr={{ code: 'apk', label: 'Download the app' }}>
          <p className="mb-1">
            The POS is an <b>Android app</b>, sideloaded - there is no Play Store listing. Most
            Senraise terminals arrive with it already on them, so look in the app drawer before
            you download anything.
          </p>
          <Trap title="Chrome plus Add to Home screen is NOT the app.">
            It looks identical - same icon, same screen, no address bar - and it silently has{' '}
            <b>no receipt printer, no NFC tap-to-pay and no Tangem card support</b>. Those are
            native plugins that only exist inside the real app. There is no error message. The
            print button simply never appears, and nobody finds out until a customer asks for a
            receipt.
          </Trap>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li><b>Look for it first.</b> Open the app drawer and find <K>NectarPay POS</K>. If it
                is there, open it and skip to the pairing steps.</li>
            <li><b>If it is not:</b> on the terminal, <K>Settings</K> &rsaquo; <K>Security</K>{' '}
                &rsaquo; <K>Install unknown apps</K>, and allow <K>Chrome</K>.</li>
            <li>In Chrome go to <A href="https://app.nectar-pay.com/pos-apk">app.nectar-pay.com/pos-apk</A>,
                download, tap the file, <K>Install</K>.</li>
            <li><b>Then allow <K>NectarPay POS</K> itself</b> under that same Install unknown apps
                screen. Not to install it - so it can update <i>itself</i>. With no Play Store
                that is the only clean update path there is.</li>
            <li><b>Delete any old home-screen shortcut.</b> Two identical icons and one of them
                cannot print is a support call waiting to happen.</li>
          </ol>

          <p className="mt-2 mb-1 font-bold">Now pair it.</p>
          <Trap title="The pairing code dies in five minutes.">
            Get the terminal sitting on the pairing screen <b>before</b> you generate one. Do it
            the other way round and you will be watching a clock while the owner watches you.
          </Trap>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li><b>On the terminal first:</b> open the app and leave it on the pairing screen.</li>
            <li><b>Now on their computer:</b> dashboard, then <K>Terminals</K> in the left menu.</li>
            <li>Pick their location under <K>Store</K>.</li>
            <li>Give it a <K>Label</K> that says where it lives - <b>Front register</b>,
                <b> Patio</b>, <b>Sarah&apos;s phone</b>. A location with two devices needs to
                tell them apart later.</li>
            <li>Click <K>Pair a device</K>. A six-character code and a QR appear.</li>
            <li>On the terminal: scan the QR with its camera, <b>or</b> type the six characters.
                Either works.</li>
            <li>Click <K>Done</K> on the computer. It now shows under <b>Paired terminals</b> with
                a last-seen time.</li>
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

        <Step n="7" title="Print a test receipt" sub="Thirty seconds, and it is the proof the app is real">
          <p className="mb-1">
            Do this on every install, before you touch anything else. It is the only way to know
            you are in the real app and not a browser dressed up as one.
          </p>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li><b>Load thermal paper.</b> The merchant supplies it - your agreement says so - but
                carry a roll or you will be doing this twice.</li>
            <li>In the app go to <K>POS settings</K>, then <K>Printer test</K>.</li>
            <li>Read the line under the heading. <K>Printer detected</K> is what you want.{' '}
                <b>Browser mode</b> means you are in a shortcut, not the app - go back to step 6.{' '}
                <b>No printer on this device</b> means the app is right but the hardware is not
                answering, which is a call to support, not something to fix at the register.</li>
            <li>Run <K>Sample receipt</K>. Paper comes out, you are done.</li>
            <li>Run <K>Alignment test</K> too. It prints columns, bold and double-size, so a
                paper-width problem shows up now rather than on a real ticket.</li>
          </ol>
          <p className="mt-1.5 text-neutral-600">
            While you are in POS settings, <b>note the app version</b>. Anything from mid-2026
            onward is current. A much older preloaded build can be missing pieces with no error to
            explain it, and support will ask for that number first.
          </p>
          <Trap title="Receipts do not have to be paper.">
            Store settings carry <K>Email receipt</K> and <K>SMS receipt</K> toggles and both are{' '}
            <b>off by default</b>. Turn them on if the merchant wants them - and always for a
            merchant running the phone app with no hardware, because that is their only receipt.
            <K>Allow reprint</K> lets a cashier pull a paid invoice from history and print it
            again, which is the answer when somebody asks for a receipt after the fact.
          </Trap>
        </Step>

        <Step n="8" title="Make a share link and test it live" sub="The step that closes the install">
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

        <Step n="9" title="Set up their POS payment type" sub="Two minutes, and it ends the question forever">
          <p>
            Every owner asks how this fits their POS. It does not integrate, and that is the
            selling point - it is a separate lane, so nothing about their current setup changes.
            They ring the sale on their own POS under a payment type you create together right
            now. Name it <K>Crypto (NectarPay)</K>.
          </p>
          <ul className="ml-4 mt-1.5 list-disc space-y-0.5">
            <li><b>Toast</b> - Toast Web, <K>Finance</K> &rsaquo; <K>Settings</K> &rsaquo;{' '}
                <K>Other payment options</K> &rsaquo; <K>+ Add</K>. Same mechanism they already use
                for delivery apps. Shows on the POS under <K>Other payments</K>.</li>
            <li><b>Square</b> - Dashboard, <K>Settings</K> &rsaquo; <K>Account &amp; Settings</K>{' '}
                &rsaquo; <K>Payments</K> &rsaquo; <K>Payment Methods</K>, create a custom payment
                method and switch on <K>Activate on Point of Sale</K>. On the POS it is{' '}
                <K>Charge</K> &rsaquo; <K>More</K>. Turn on the tip capture option or their servers
                lose tips on those tickets.</li>
            <li><b>Clover</b> - Dashboard, <K>Settings</K> &rsaquo; <K>View all settings</K>{' '}
                &rsaquo; <K>Payments</K> &rsaquo; <K>Tenders</K> &rsaquo; <K>Edit</K> &rsaquo;{' '}
                <K>Create custom tender</K>.</li>
          </ul>
          <p className="mt-1.5 text-neutral-600">
            Anything else has the same feature under a different name - look for other, custom or
            alternate tender. The ticket still closes, inventory still drops, the server still gets
            credit, and it totals separately in their end-of-day report.
          </p>
          <Trap title="Do not let a manager think this posts to their POS by itself.">
            Nothing writes into their system. The staff ring it manually, exactly as they do for a
            delivery order. Say that out loud at install and nobody feels misled at close-out.
          </Trap>
        </Step>

        <Step n="10" title="Before you walk out">
          <Trap title="Their exchange account is the one that gets forgotten.">
            Without it a shop can take payments and cannot reach a dollar of it. It is step 1 on
            the setup link you sent when you booked - <b>check it is actually open</b>, not
            started. If it is not, that is the seven-day check-in call, not a nice-to-have.
          </Trap>
          <div className="my-2 rounded-sm border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-[12.5px] leading-snug">
            <b>Tell them how cashing out actually works, or they will do it wrong once and
            stop.</b> The network fee is charged <b>per transfer, not per dollar</b>, so moving
            $10 costs about what moving $800 costs. They let payments build up in the wallet and
            move them across <b>once a week or once a month</b> - never after each sale. A shop
            that transfers one $6 ticket watches a third of it disappear and decides the whole
            thing is a scam.
          </div>
          <ul className="ml-4 list-disc space-y-0.5">
            <li><b>Everyone who works the register has done one transaction themselves.</b> Not
                watched one - done one.</li>
            <li><b>Their exchange account is open and their bank is linked to it.</b> Ask to see
                it. &quot;I signed up&quot; is not the same as approved.</li>
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
            v4
          </div>
        </div>

      </div>
    </div>
  );
}
