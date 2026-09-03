import {
  PREFERRED_LABEL,
  MULTI_PREFERRED_LABEL,
  BREAK_EVEN_YEAR_ONE_MONTHLY,
  BREAK_EVEN_ONGOING_MONTHLY,
  TERMINAL_LABEL,
  MONTHLY_LABEL,
  YEAR_ONE_LABEL,
} from '@/lib/pricing';

// Call Mode scripts - same five stories as the email cadences, spoken.
// Assembled per lead: {owner}, {shop}, {city} interpolate at render, and
// the math step computes on the lead's self-reported volume when Pulse
// (or a prior call) captured one. Voice rules match the emails: plain
// hyphens, name real companies, sound typed-by-a-person.

export type CallCluster = 'control' | 'math' | 'crowd' | 'simple' | 'native';

export const CALL_CLUSTER_MAP: Record<string, CallCluster> = {
  'smoke-vape': 'control',
  'kava-kratom': 'control',
  'firearms': 'control',
  'cigar-hookah': 'control',
  'pawn': 'control',
  'adult-retail': 'control',
  'jewelry-gold': 'math',
  'auto': 'math',
  'powersports': 'math',
  'med-spa': 'math',
  'pool-landscape': 'math',
  'liquor': 'math',
  'bike': 'math',
  'barber': 'crowd',
  'food-drink': 'crowd',
  'tattoo': 'crowd',
  'sneaker-street': 'crowd',
  'collectibles': 'crowd',
  'nail-beauty': 'crowd',
  'gaming': 'crowd',
  'thrift-vintage': 'crowd',
  'phone-repair': 'simple',
  // Cash-pay dental, vets and event venues share one shape: a large ticket,
  // work or a room already delivered, and a dispute window that opens after.
  // 'simple' is the final-payment cluster - the invoice that comes back - so
  // they lead with the clawback, not the fee. A crown cannot be repossessed.
  'dental-vet': 'simple',
  'event-venue': 'simple',
  'gym-supps': 'simple',
  'crypto-native': 'native',
};

export type CallCtx = {
  owner: string | null;   // first name if known
  shop: string;
  city: string;
  rep: string;            // rep first name
};

/**
 * `q` is written the way an OWNER says it, not the tidy version - a rep
 * mid-call scans for the words they just heard. `heard` carries the other
 * phrasings so the drawer's search finds it from any of them.
 */
export type Objection = { q: string; a: string; heard: string[] };

/**
 * Two motions, and they are not the same script.
 *
 * On the PHONE you have about ten seconds and no permission. You cannot
 * discover your way into a stranger's day - you give them a reason to stay on
 * the line, then earn the questions.
 *
 * At the DOOR you already have their attention and the social contract of
 * being in their shop. Presenting early there is amateur; the handbook is
 * right that you diagnose first and present last.
 *
 * A rep running the door script on the phone gets hung up on at "how long
 * have you been here?". A rep running the phone script at the door sounds
 * like a telemarketer standing in a barbershop.
 */
export const PHONE_ARC = [
  { step: 'Opener', goal: 'Ten seconds. Earn the next thirty.' },
  { step: 'Hook', goal: 'One reason to keep listening, matched to their shop.' },
  { step: 'Discovery', goal: 'Their numbers, in their words. Write them down.' },
  { step: 'The math', goal: 'Say it out loud with their number, not yours.' },
  { step: 'Close', goal: 'One clear ask. Trial beats everything.' },
] as const;

export const DOOR_ARC = [
  { step: 'Be a customer', goal: 'Buy something first. Off-peak, never mid-rush.' },
  { step: 'Open warmly', goal: 'A neighbor, not a pitch. No product yet.' },
  { step: 'Discover', goal: 'How do they take payments today? Let them describe it.' },
  { step: 'Listen back', goal: 'Talk under half the time. Repeat their words to them.' },
  { step: 'Diagnose', goal: 'Name what the status quo costs. Let it land.' },
  { step: 'Show, then ask', goal: 'Now demo. One small next step before you leave.' },
] as const;
export type ClosePath = { title: string; script: string; note?: string };

export type CallScript = {
  clusterLabel: string;
  opener: string;
  openerHints: string[];
  hook: string[];
  hookHint: string;
  discovery: { q: string; placeholder: string }[];
  // Template - client replaces {vol} and {loss} live. (A function here
  // would crash the RSC boundary: functions can't serialize to clients.)
  mathLine: string;
  closes: ClosePath[];
  objections: Objection[];
};

// Order matters. The first question sets what the call is about, and the
// campaign now opens on the customer nobody could serve - so the rep asks
// about that customer before asking about money. Leading with volume tells an
// owner this is a processor pitch and re-frames everything the email just did.
const SHARED_DISCOVERY = [
  { q: `"Anybody ever ask to pay with crypto at the register?"`, placeholder: 'yes / no / weekly' },
  { q: `"When they do, what happens - do they pay another way, or do they leave?"`, placeholder: 'pays cash / leaves' },
  { q: `"Roughly what's going through the card reader a month?"`, placeholder: '$12,000' },
  { q: `"Who's your processor now - Square, Clover... ?"`, placeholder: 'Square' },
];

const SHARED_OBJECTIONS: Objection[] = [
  {
    q: `"Yeah, we're fine - everybody just uses their card."`,
    heard: ['card', 'cards', 'credit card', "we're fine", 'nobody asks', 'no demand'],
    a: `"And they'll keep doing that - nothing about your card setup changes. Same reader, same flow. This adds a lane on the side, and every sale that uses it is a sale with no fee on it."`,
  },
  {
    q: `"I don't know anything about crypto."`,
    heard: ['understand', 'know nothing', 'confusing', 'bitcoin', 'over my head', 'not techy'],
    a: `"You don't need to. Staff types the amount, customer scans, ten seconds, money's in your wallet. You never touch an exchange, never hold anything you don't want to. It's a register that can't be charged back."`,
  },
  {
    q: `"Crypto goes up and down - I'm not gambling with my money."`,
    heard: ['volatile', 'crash', 'risky', 'gambling', 'up and down', 'lose value', 'fake money'],
    // Confirmed with NectarPay Aug 14: the MERCHANT picks the settlement
    // asset. That makes this answerable without hedging, which it was not
    // before - the handbook and the app were answering it two ways.
    a: `"You pick what it lands in. Want dollars? Set it to a dollar-pegged coin - a dollar in is a dollar out, and you're never holding anything that moves. Want to keep bitcoin? That's your call too. It's your wallet and your choice, not ours."`,
  },
  {
    q: `"How do I turn it into actual dollars?"`,
    heard: ['cash out', 'convert', 'dollars', 'bank', 'spend it', 'off ramp', 'real money'],
    a: `"Same as moving money out of any account. Most owners set it to land in a dollar-pegged coin so there's nothing to convert, then move it to their bank on whatever schedule they like - some sweep it Friday, some let it sit. It's your money and your timing."`,
  },
  {
    q: `"What if you guys go out of business?"`,
    heard: ['out of business', 'go under', 'disappear', 'still work', 'what happens to my money', 'shut down'],
    // The strongest answer in the deck and neither document was using it.
    a: `"Nothing happens to your money, and that's the part worth hearing. We never hold it. It goes straight from your customer into a wallet you own, and that wallet is yours whether we exist or not. Worst case you lose the software and keep every dollar."`,
  },
  {
    q: `"What if my cashier rings up the wrong amount?"`,
    heard: ['wrong amount', 'mistake', 'typo', 'refund', 'void', 'take it back', 'undo'],
    // Say it BEFORE the register does. A merchant who hears this from us
    // feels dealt with straight; one who finds out at the counter feels lied
    // to, and "no chargebacks" is the claim that sets up the fall.
    a: `"Then you refund them out of your wallet, same as handing back cash. I'd rather say that now than have you find out at the register - crypto is final in both directions. Nobody can charge you back, and you can't pull one back either. For most shops that's the good side of the trade, but you should hear both halves from me."`,
  },
  {
    q: `"What do I tell my bookkeeper?"`,
    heard: ['accountant', 'bookkeeper', 'taxes', 'records', 'quickbooks', 'irs', 'write it off'],
    a: `"It's revenue, recorded like a card sale - the terminal keeps the record, date, amount, what came in, and your bookkeeper treats it like any other deposit. I'm not a tax guy and I won't pretend to be, so if they want the fine print, that's a question for your CPA."`,
  },
  {
    q: `"Is that even legal?"`,
    heard: ['legal', 'allowed', 'regulated', 'against the law'],
    a: `"Completely - it's a payment method, same as cash or card. Sales get recorded on the terminal like any register, and your accountant treats it like revenue because it is revenue."`,
  },
  {
    q: `"What's this gonna run me?"`,
    heard: ['cost', 'price', 'how much', 'expensive', 'what do you charge'],
    a: `"${TERMINAL_LABEL} once for the terminal, then ${MONTHLY_LABEL} a month for the membership, paid annually. Never a percentage of your sales - that's the whole point. And it doesn't take much to be worth it: about $${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()} a month in crypto sales covers year one, and about $${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()} a month every year after that. You don't have to decide today either - I can put one in on a trial first and it costs you nothing while it runs."`,
  },
  {
    q: `"How much of my business is even going to use this?"`,
    heard: ['how many', 'worth it', 'pay for itself', 'break even', 'nobody uses', 'volume', 'roi'],
    // The number to say instead of a savings figure. A savings claim assumes
    // their whole card volume moves to crypto; break-even assumes almost none
    // of it does, and still works.
    a: `"Fair question, and here's the honest floor rather than a sales number. About $${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()} a month in crypto sales pays for year one. After that it's about $${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()} a month - that's a handful of customers a week. Everything past that is margin you keep, and you never pay a percentage on any of it."`,
  },
  {
    q: `"Sounds complicated."`,
    heard: ['complicated', 'hard', 'learn', 'train', 'staff', 'another thing', 'time'],
    a: `"It's simpler than the card terminal you already use - type the amount, they scan, done. And if you'd rather not have another box at all, the NectarPay app runs right on your phone. You'd just be giving up the receipt printer and the rugged handheld."`,
  },
  {
    q: `"What if it breaks?"`,
    heard: ['break', 'broken', 'warranty', 'repair', 'quits', 'stops working'],
    a: `"One-year warranty. If it quits on its own, we replace it, full stop. If it gets thrown across the shop, that one's on you - fair is fair. Thermal paper is the only thing you'd ever buy, and that's a few dollars anywhere."`,
  },
  {
    q: `"What if something goes wrong and I need somebody?"`,
    heard: ['support', 'help', 'someone to call', 'service', 'who do i call'],
    a: `"Standard membership is ${MONTHLY_LABEL} a terminal and you've got me. If you want NectarPay picking up the phone directly, preferred service is ${PREFERRED_LABEL} a month. And if you're running five terminals or more, the group plan is ${MULTI_PREFERRED_LABEL} flat with preferred included - which is less than you'd pay on the basic plan for that many. Most single-location shops start basic and never move."`,

  },
  {
    q: `"Can I try it first?"`,
    heard: ['try', 'trial', 'test', 'demo', 'see it work', 'trial run'],
    a: `"Yes, and I'd rather you did. I can put a terminal in for a trial and it costs you nothing while it runs - no ${TERMINAL_LABEL}, no monthly, nothing. You take real payments on it. If it earns its place you keep it, and if it doesn't I come get it and we shake hands. That's the whole risk."`,
  },
  {
    q: `"How does this integrate with my POS?"`,
    heard: ['pos', 'point of sale', 'toast', 'square', 'clover', 'aloha', 'register system',
      'integrate', 'integration', 'talk to my system', 'my system', 'bookkeeping', 'reconcile',
      'end of day', 'close out', 'my reports'],
    a: `"It doesn't, and that's on purpose. It's a separate lane that sits beside your POS - we never touch your system, which is exactly why nothing about your current setup has to change. You ring the sale on your own POS under a payment type you set up once, same as you already do for a delivery app or a gift certificate. Ticket closes, inventory drops, the server gets credit, and it shows in your end-of-day report like any other sale. Two minutes to set up and I'll do it with you at install."`,
  },
  {
    q: `"So how do I reconcile it at close-out?"`,
    heard: ['reconcile', 'close out', 'closeout', 'match up', 'my books', 'accountant',
      'bookkeeper', 'cpa', 'taxes', 'tax', 'report it', 'drawer'],
    a: `"Same way you reconcile a delivery app. That payment type totals separately in your report, and it should match what came into your wallet that day. Every payment is timestamped and permanent, so there's a record whether anybody looks or not. For what it's worth on the books: crypto you take in is income at its dollar value the moment it lands, not when you cash out - but that one's a question for your CPA, not me."`,
  },
  {
    q: `"Let me think about it."`,
    heard: ['think about it', 'get back to you', 'not right now', 'call me later', 'talk to my partner'],
    a: `"Totally fair. Here's what I'd rather do than have you think about it cold: let me put one in on a trial. Costs you nothing while it runs, you take real payments on it, and if it doesn't earn its place I pick it up. That way you're deciding on what actually happened instead of on my say-so."`,
  },
];

const SHARED_CLOSES = (ctx: CallCtx): ClosePath[] => [
  {
    title: '① The walk-in (best)',
    script: `"I'm working ${ctx.city} this week - ten minutes at your shop, I'll run a live payment and you watch it settle. Morning or afternoon better?"`,
  },
  {
    title: '② The one-pager text',
    script: `"Let me text you the one-page version - everything including pricing. What's the best cell?"`,
    note: 'Then send the PNG + their Pulse link.',
  },
  {
    title: '③ The card link',
    script: `"I'll text you a page I set up for ${ctx.shop} specifically - slide your own numbers, takes thirty seconds."`,
  },
  {
    title: '④ The trial',
    script: `"Here's what I'd rather do. Let me put one in for a trial - costs you nothing while it runs, no ${TERMINAL_LABEL}, no monthly. Take real payments on it. If it earns its place you keep it, if it doesn't I come get it. Fair?"`,
    note: 'Trial length is your call. A signed agreement goes in before the terminal does.',
  },
  {
    title: '⑤ The clean no',
    script: `"No hard feelings - if the fees ever start stinging, you've got my number."`,
    note: 'If they say never contact: mark DNC. We never call again.',
  },
];

function opener(ctx: CallCtx): string {
  const who = ctx.owner ? `Hey, is this ${ctx.owner}? ... ${ctx.owner}, ` : `Hey, am I talking to the owner? ... Great - `;
  return `"${who}my name's ${ctx.rep}, I'm here in the Valley - I work with shops around ${ctx.city} and I'll keep this to thirty seconds. Is now terrible?"`;
}

const OPENER_HINTS = [
  `If "who is this?" - "${'${rep}'} with NectarPay. There's a customer walking into shops like yours who can't pay the way they want. Thirty seconds and you can hang up on me."`,
  `Why "is now terrible": "no" is easier to say than "yes" - let them say no and keep the floor.`,
];

export function buildScript(vertical: string, cryptoNative: boolean, ctx: CallCtx): CallScript {
  const cluster: CallCluster = cryptoNative ? 'native' : (CALL_CLUSTER_MAP[vertical] ?? 'math');
  const hints = OPENER_HINTS.map((h) => h.replace('${rep}', ctx.rep));
  const base = {
    opener: opener(ctx),
    openerHints: hints,
    discovery: SHARED_DISCOVERY,
    closes: SHARED_CLOSES(ctx),
    objections: SHARED_OBJECTIONS,
  };

  switch (cluster) {
    case 'control':
      return {
        ...base,
        clusterLabel: 'Processor-pain story (control)',
        hook: [
          `"You've had customers who couldn't pay you the way they wanted - because Square or Stripe decided your industry was too risky and set the rules on your behalf. Some of those people are holding crypto and would hand it over at the register."`,
          `"A small terminal opens that lane, and the money goes into a wallet you own the second they pay. Not a processor's account. Yours. Nobody can freeze it, reverse it, or fire you from it."`,
          `"Your card reader keeps doing its job. This sits beside it."`,
        ],
        hookHint: `Open on the customer they couldn't serve, then sovereignty. Fees are the third beat, never the first.`,
        mathLine: `"So at {vol} a month, cards are taking about {loss} a year off your top line - and that's before a processor ever gets twitchy about your industry. If even part of that moves to the no-fee lane, the terminal pays for itself the first month."`,
      };
    case 'math':
      return {
        ...base,
        clusterLabel: 'Napkin-math story',
        hook: [
          `"On tickets your size there's a buyer holding crypto who'd rather spend it directly than move it into a bank first and wait. Today that person either pays another way or drives to a shop that takes it."`,
          `"A small terminal by the register opens that lane, and the money lands in a wallet you own within seconds with nothing taken out of it."`,
          `"${TERMINAL_LABEL} for the terminal, then ${MONTHLY_LABEL} a month. Never a percentage."`,
        ],
        hookHint: `Open on the sale they're losing, not on the 3%. This cluster still buys on arithmetic - get to Discovery fast and let the numbers close it.`,
        mathLine: `"So at {vol} a month, that's about {loss} a year going to the card networks. Our whole first year costs ${YEAR_ONE_LABEL}. That's the entire pitch - you can do that math without me."`,
      };
    case 'crowd':
      return {
        ...base,
        clusterLabel: 'Young-crowd story',
        hook: [
          `"Somebody's already asked at your register and whoever was working said no. Your crowd skews young, and that's exactly who's holding crypto and looking for somewhere to spend it."`,
          `"Those customers pick the shops that take it, and they tell each other which ones do. Right now on your block that's nobody."`,
          `"Small terminal by the register, about ten seconds a sale, and the money's in a wallet you own before they reach the door. Cards keep working exactly like today."`,
        ],
        hookHint: `Lead with the customer who got told no. Fees are a bonus here, never the opener - this cluster buys relevance.`,
        mathLine: `"And the fee side isn't nothing either - at {vol} a month, cards take about {loss} a year. The crowd angle gets you customers, the zero-fee side keeps more of what they spend."`,
      };
    case 'simple':
      return {
        ...base,
        clusterLabel: 'Final-payment story',
        hook: [
          `"There's a customer who'd rather pay you out of what they're already holding than move money into a bank first - and right now you've got no way to take it."`,
          `"A terminal by the register opens that lane, and the money settles into a wallet you own in seconds."`,
          `"And once it settles it's final. No dispute window, no clawbacks. You know the worst invoice in this business - the one that comes back weeks later with a fee stacked on top. Not on this lane. Work done means paid."`,
        ],
        hookHint: `Open on the customer, land on the clawback. Chargebacks are the wound here - press gently and let them tell you a story.`,
        mathLine: `"On the fee side, at {vol} a month you're giving the networks about {loss} a year - and every reversed job on top of that. This lane closes both doors."`,
      };
    case 'native':
      return {
        ...base,
        clusterLabel: 'Third-option story (already takes crypto)',
        hook: [
          `"So you already take crypto - which tells me you did the homework years before your neighbors. Respect. I'm not calling to explain bitcoin to you."`,
          `"Here's what I keep seeing at shops that already take it: either a BitPay-style processor skimming 1-2% plus a quarter per transaction and settling to the bank in a day or two - card-fee economics on crypto rails - or a bare wallet QR by the register that's free but clunky enough the staff steer around it."`,
          `"We're the third option: a real terminal - staff types the amount, customer scans, ten seconds - zero processing fee, settlement straight to a wallet you control, instantly. Processor-grade checkout, DIY-grade economics."`,
        ],
        hookHint: `NEVER pitch "have you considered crypto" - open with respect, then the third option.`,
        mathLine: `"If you're on a processor rail today, run the comparison: their cut on {vol} a month against our flat ${MONTHLY_LABEL}. If you're on a bare QR you're already at zero - so the pitch is the terminal experience and how fast it settles, not the fee."`,
        discovery: [
          { q: `"What are you running today - BitPay-style processor, or your own wallet QR?"`, placeholder: 'BitPay / QR / other' },
          { q: `"Roughly how much crypto volume a month?"`, placeholder: '$2,000' },
          { q: `"And what's total card volume - worth knowing what the no-fee lane could absorb?"`, placeholder: '$12,000' },
        ],
        closes: [
          {
            title: '① Run both rails (best)',
            script: `"Keep whatever you run today exactly as is - put our terminal beside it for a month and compare the tape. If ours doesn't win on your own numbers, I'll carry it back out myself."`,
          },
          {
            title: '② Time to money',
            script: `"Pull one number off whatever you run today: how long between the customer paying and the money being yours to spend. Processor rail, that's a day or two into a bank after their cut. Ours is seconds, into a wallet you hold. Same checkout either way - the difference is all on your side."`,
          },
          ...SHARED_CLOSES(ctx).slice(1, 2),
          SHARED_CLOSES(ctx)[3],
        ],
        objections: [
          {
            q: `"My QR setup works fine."`,
            heard: ['qr', 'wallet address', 'we just show a code', 'works fine', 'already free'],
            a: `"And it's free, which I respect. The gap is everything around the payment - amount entry, staff being able to run it, receipts, refunds. That's what keeps the crypto lane from actually getting used. Let me put a terminal in on a trial, run both side by side for a couple of weeks, and watch which one your staff reaches for."`,
          },
          {
            q: `"I'm on BitPay already."`,
            heard: ['bitpay', 'coinbase commerce', 'processor', 'already have a provider', 'strike'],
            a: `"Then you know the drill - they take their cut and the bank deposit shows up in a day or two. Ours is zero fee and settles to your wallet in seconds. Same customers, same coins, none of the skim. Put one in on a trial and run them side by side - the difference shows up on the first sale."`,
          },
          ...SHARED_OBJECTIONS.slice(2),
        ],
      };
  }
}
