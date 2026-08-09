// Call Mode scripts — same five stories as the email cadences, spoken.
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
  'gym-supps': 'simple',
  'crypto-native': 'native',
};

export type CallCtx = {
  owner: string | null;   // first name if known
  shop: string;
  city: string;
  rep: string;            // rep first name
};

export type Objection = { q: string; a: string };
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

const SHARED_DISCOVERY = [
  { q: `"Roughly what's going through the card reader a month?"`, placeholder: '$12,000' },
  { q: `"Who's your processor now - Square, Clover... ?"`, placeholder: 'Square' },
  { q: `"Anybody ever ask to pay with crypto at the register?"`, placeholder: 'yes / no / weekly' },
];

const SHARED_OBJECTIONS: Objection[] = [
  {
    q: `"My customers pay with cards."`,
    a: `"And they'll keep doing that - nothing about your card setup changes. Same reader, same flow. This adds a lane on the side, and every sale that uses it is a sale with no fee on it."`,
  },
  {
    q: `"I don't understand crypto."`,
    a: `"You don't need to. Staff types the amount, customer scans, ten seconds, money's in your wallet. You never touch an exchange, never hold anything you don't want to. It's a cash register that can't be charged back."`,
  },
  {
    q: `"Is this legal / is it taxed?"`,
    a: `"Completely - it's a payment method, same as cash or card. Sales get recorded on the terminal like any register, and your accountant treats it like revenue because it is revenue."`,
  },
  {
    q: `"What's it cost?"`,
    a: `"$499 once for the terminal, $19 a month flat. Never a percentage of your sales - that's the whole point. Year one all-in is about $727, which is less than what cards take from most shops every two months."`,
  },
  {
    q: `"Crypto crashes / it's fake money."`,
    a: `"If you want, it settles to a stablecoin - dollar-pegged, a dollar in is a dollar out. You're not betting on anything. And if you'd rather hold it, that's your call - it's your wallet."`,
  },
  {
    q: `"I need to think about it."`,
    a: `"Totally fair. Let me text you the one-pager so you're thinking about the real numbers - and I'm in the area later this week either way. If it's a no then, it's a no, no hard feelings."`,
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
    title: '④ The clean no',
    script: `"No hard feelings - if the fees ever start stinging, you've got my number."`,
    note: 'If they say never contact: mark DNC. We never call again.',
  },
];

function opener(ctx: CallCtx): string {
  const who = ctx.owner ? `Hey, is this ${ctx.owner}? ... ${ctx.owner}, ` : `Hey, am I talking to the owner? ... Great - `;
  return `"${who}my name's ${ctx.rep}, I'm here in the Valley - I work with shops around ${ctx.city} and I'll keep this to thirty seconds. Is now terrible?"`;
}

const OPENER_HINTS = [
  `If "who is this?" - "${'${rep}'} with NectarPay, we set up zero-fee payment lanes for shops like yours. Thirty seconds and you can hang up on me."`,
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
          `"You've probably seen it - a card processor like Square or Stripe decides your industry is 'high risk' and some shop down the street is begging a new processor to take their money at a worse rate."`,
          `"What we do is simple: a small terminal by your register that takes crypto - zero processing fee, money lands in a wallet you own the second they pay. Nobody can hold it, reverse it, or fire you from it."`,
          `"Your card reader keeps doing its job. This is the no-fee lane next to it."`,
        ],
        hookHint: `Lead with sovereignty; switch to money if they engage on fees.`,
        mathLine: `"So at {vol} a month, cards are taking about {loss} a year off your top line - and that's before a processor ever gets twitchy about your industry. If even part of that moves to the no-fee lane, the terminal pays for itself the first month."`,
      };
    case 'math':
      return {
        ...base,
        clusterLabel: 'Napkin-math story',
        hook: [
          `"On your ticket sizes, card processing is real money - roughly 3% comes off the top of every sale, and a delivered sale can still get reversed weeks later."`,
          `"We put a small terminal by the register that takes crypto - zero processing fee, settles to your own wallet in seconds, can't be charged back. Flat $19 a month, never a percentage."`,
        ],
        hookHint: `This cluster buys on arithmetic - get to Discovery fast and let the numbers pitch.`,
        mathLine: `"So at {vol} a month, that's about {loss} a year going to the card networks. Our whole first year costs $727. That's the entire pitch - you can do that math without me."`,
      };
    case 'crowd':
      return {
        ...base,
        clusterLabel: 'Young-crowd story',
        hook: [
          `"Somebody's probably already asked at the register - your crowd skews young, and that's exactly who holds crypto and picks the shops that take it."`,
          `"We put a small terminal next to your register - crypto payments, zero processing fee, money hits your own wallet instantly. Cards keep working exactly like today."`,
          `"Being the first spot on the block that takes it is worth more than the fees it saves - and it saves those too."`,
        ],
        hookHint: `Lead with the customers, not the fees - this cluster buys relevance.`,
        mathLine: `"And the fee side isn't nothing either - at {vol} a month, cards take about {loss} a year. The crowd angle gets you customers, the zero-fee side keeps more of what they spend."`,
      };
    case 'simple':
      return {
        ...base,
        clusterLabel: 'Final-payment story',
        hook: [
          `"You know the worst invoice in this business - the one that comes back. Work's finished, service delivered, and weeks later a dispute claws the money back with a fee stacked on top."`,
          `"We put a terminal by your register that takes crypto - zero fee, and a settled payment is final. No dispute window, no clawbacks. Work done means paid."`,
        ],
        hookHint: `Chargebacks are the wound here - press gently and let them tell you a story.`,
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
        mathLine: `"If you're on a processor rail today, run the comparison: their cut on {vol} a month against our flat $19. If you're on a bare QR, you're already at zero - so the pitch is the terminal experience and the directory listing, not the fee."`,
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
            title: '② The directory anchor',
            script: `"Either way, we're building the merchant map crypto holders will use to find shops - early listings anchor their neighborhood. Worth being pinned first."`,
          },
          ...SHARED_CLOSES(ctx).slice(1, 2),
          SHARED_CLOSES(ctx)[3],
        ],
        objections: [
          {
            q: `"My QR setup works fine."`,
            a: `"And it's free, which I respect. The gap is everything around the payment - amount entry, staff being able to run it, receipts, refunds. That's what keeps the crypto lane from actually getting used. Run both for a month and watch which one your staff reaches for."`,
          },
          {
            q: `"I'm on BitPay already."`,
            a: `"Then you know the drill - they take their cut and the bank deposit shows up in a day or two. Ours is zero fee and settles to your wallet in seconds. Same customers, same coins, none of the skim."`,
          },
          ...SHARED_OBJECTIONS.slice(2),
        ],
      };
  }
}
