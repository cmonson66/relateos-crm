// Templates: 5 story clusters. Standard clusters run a 6-email arc,
// crypto-native runs a tighter 4. Text-forward - cold email should read
// like a person typed it, not like a designed newsletter.
//
// ARC REBUILT 2026-08-31. The old order opened on the product ("a terminal
// that takes crypto payments") and buried the new-customer story at stage 5,
// which almost nobody reached. The new order:
//
//   e1  New customers - somebody has already asked and you said no
//   e2  Speed - the money is yours before they reach the door
//   e3  Cost - break-even, not a savings claim
//   e4  Nothing changes - the "but my customers pay with cards" objection
//   e5  Final payments - no dispute window, honest about both directions
//   e6  Either-way close
//
// Two rules this file now holds to. First, no email promises a merchant
// directory: that product does not exist yet and is not NectarPay's to
// promise, so e1 sells demand that is real today instead. Second, every price
// comes from lib/pricing.ts - nothing here hardcodes a dollar figure, because
// the $19 to $24.99 move had to be chased through nine files.

import {
  TERMINAL_LABEL,
  MONTHLY_LABEL,
  YEAR_ONE_LABEL,
  ONGOING_LABEL,
  BREAK_EVEN_YEAR_ONE_MONTHLY,
  BREAK_EVEN_ONGOING_MONTHLY,
} from "@/lib/pricing";

export type Cluster = "control" | "math" | "crowd" | "simple" | "native";
export type Stage = 1 | 2 | 3 | 4 | 5 | 6;

/** Native is a tighter 4-email arc; standard clusters run 6. */
export function maxStageFor(cluster: Cluster): Stage {
  return cluster === "native" ? 4 : 6;
}

export const CLUSTER_MAP: Record<string, Cluster> = {
  "smoke-vape": "control",
  "kava-kratom": "control",
  "firearms": "control",
  "cigar-hookah": "control",
  "jewelry-gold": "math",
  "auto": "math",
  "powersports": "math",
  "barber": "crowd",
  "food-drink": "crowd",
  "tattoo": "crowd",
  "sneaker-street": "crowd",
  "collectibles": "crowd",
  "phone-repair": "simple",
  "gym-supps": "simple",
  "pawn": "control",
  "adult-retail": "control",
  "med-spa": "math",
  "pool-landscape": "math",
  "liquor": "math",
  "bike": "math",
  "nail-beauty": "crowd",
  "gaming": "crowd",
  "thrift-vintage": "crowd",
  "crypto-native": "native",
};

export type TemplateLead = {
  name: string;
  city: string;
  vertical: string;
  vertical_label: string;
  owner_first_name: string | null;
  pulse_token: string;
};

type Rendered = { subject: string; html: string; text: string };

export type Rep = { first: string; fromEmail: string };
export const DEFAULT_REP: Rep = { first: "Eric", fromEmail: "eric@nectarpayaz.com" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------

function pulse(base: string, token: string, intent: string): string {
  return `${base}/s/${token}?i=${intent}`;
}

/**
 * The intent chips. SPEED IS FIRST AND IT IS NEW.
 *
 * The old set was fees / control / chargebacks / curious. Speed was a chip on
 * the Pulse page but never a link in an email, and it still outdrew every
 * other intent roughly four to one on taps. Offering it in the email is the
 * cheapest change in this file.
 *
 * The control cluster keeps its own chip in place of chargebacks, because
 * being fired by a processor is the thing those owners actually feel.
 */
const INTENTS_BASE: [string, string][] = [
  ["speed", "Money in my hands now"],
  ["fees", "Cut my card fees"],
  ["chargebacks", "Kill chargebacks"],
  ["curious", "Just curious"],
];

const INTENTS_CONTROL: [string, string][] = [
  ["speed", "Money in my hands now"],
  ["control", "Nobody controls my money"],
  ["fees", "Cut my card fees"],
  ["curious", "Just curious"],
];

function intentsFor(cluster: Cluster): [string, string][] {
  return cluster === "control" ? INTENTS_CONTROL : INTENTS_BASE;
}

function buttons(base: string, token: string, pairs: [string, string][]): {
  html: string;
  text: string;
} {
  const html =
    `<p style="margin:18px 0 6px;font-weight:600">What's hitting home?</p>` +
    `<p style="margin:0 0 4px">` +
    pairs
      .map(
        ([intent, label]) =>
          `<a href="${pulse(base, token, intent)}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 14px;border:1.5px solid #C9820A;border-radius:8px;color:#0C1A2C;text-decoration:none;font-weight:600">${esc(label)}</a>`
      )
      .join("") +
    `</p>`;
  const text =
    `\nWhat's hitting home? (tap one)\n` +
    pairs.map(([intent, label]) => `  ${label}: ${pulse(base, token, intent)}`).join("\n");
  return { html, text };
}

function cta(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block;padding:11px 18px;background:#0C1A2C;color:#F2A71B;border-radius:8px;text-decoration:none;font-weight:700">${esc(label)} &rarr;</a></p>`;
}

function footer(base: string, token: string, address: string, rep: Rep): { html: string; text: string } {
  const stop = pulse(base, token, "optout");
  return {
    html: `<p style="margin:26px 0 0;font-size:12px;color:#8a94a3">${esc(rep.first)} · NectarPay Ambassador, Phoenix<br>${esc(address)}<br><a href="${stop}" style="color:#8a94a3">Not for us - stop emailing</a></p>`,
    text: `\n--\n${rep.first} · NectarPay Ambassador, Phoenix\n${address}\nNot for us - stop emailing: ${stop}`,
  };
}

function greet(lead: TemplateLead): string {
  return lead.owner_first_name ? `${lead.owner_first_name},` : `To the owner of ${lead.name},`;
}

function wrapHtml(bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0C1A2C;max-width:560px">${bodyHtml}</div>`;
}

/** Assemble a plain body: greeting, paragraphs, sign-off, footer. */
function compose(
  g: string,
  paras: string[],
  tail: { html: string; text: string } | null,
  rep: Rep,
  f: { html: string; text: string }
): { html: string; text: string } {
  const html = wrapHtml(
    `<p>${esc(g)}</p>` +
      paras.map((p) => `<p>${esc(p)}</p>`).join("") +
      (tail?.html ?? "") +
      `<p style="margin-top:14px">- ${esc(rep.first)}</p>` +
      f.html
  );
  const text = `${g}\n\n${paras.join("\n\n")}${tail ? `\n${tail.text}` : ""}\n\n- ${rep.first}${f.text}`;
  return { html, text };
}

// --- e1: NEW CUSTOMERS -------------------------------------------------------
//
// The lead-off is no longer the product. It is the customer who already walked
// in, already asked, and already got told no. Crypto is named once, low in the
// paragraph, as a description of that customer rather than as the pitch.

const E1: Record<Cluster, (l: TemplateLead) => { subject: string; paras: string[] }> = {
  crowd: (l) => ({
    subject: l.owner_first_name
      ? `Somebody already asked at your register, ${l.owner_first_name}`
      : `Somebody already asked at ${l.name}`,
    paras: [
      `Somebody has already stood at your register and asked whether they could pay another way, and whoever was working said no. Your crowd skews young, and that is exactly the group holding crypto and looking for somewhere in ${l.city} to spend it.`,
      `That is the whole opening: those customers pick the shops that take it, and tell each other which ones do. Right now on your block that is nobody.`,
      `I work with NectarPay here in the Valley. It is a small terminal by the register that adds it as a payment option, about ten seconds a sale. Your card reader keeps doing exactly what it does today. This just stops you turning that customer away.`,
    ],
  }),
  math: (l) => ({
    subject: l.owner_first_name
      ? `The buyer you're turning away, ${l.owner_first_name}`
      : `The buyer ${l.name} is turning away`,
    paras: [
      `On tickets your size there is a buyer who holds crypto and would rather spend it directly than move it into a bank first and wait. Today that person either pays another way or drives to a shop that takes it.`,
      `That is a sale you are not losing on price. You are losing it on not having the lane open.`,
      `I work with NectarPay here in the Valley. A small terminal by the register opens it, and the money lands in a wallet you own within seconds, with no percentage taken out of it. Nothing about your card setup changes.`,
    ],
  }),
  control: (l) => ({
    subject: l.owner_first_name
      ? `Customers your processor won't let you serve, ${l.owner_first_name}`
      : `The customers ${l.name} can't get paid by`,
    paras: [
      `You have had customers who could not pay you the way they wanted, because a card processor like Square or Stripe decided your industry was too risky and set the rules on your behalf. Some of those people hold crypto and would happily hand it over at the register.`,
      `I work with NectarPay here in the Valley. It is a small terminal that opens a lane nobody else sets the rules on. The money goes straight into a wallet you own the second the customer pays. Not a processor's account. Yours.`,
      `Your card reader keeps doing its job. This sits beside it, and nobody can freeze it, reverse it, or fire you from it.`,
    ],
  }),
  simple: (l) => ({
    subject: l.owner_first_name
      ? `A customer who wants to pay you right now, ${l.owner_first_name}`
      : `A customer who wants to pay ${l.name} right now`,
    paras: [
      `There is a customer who would rather pay you out of what they are already holding than move money into a bank first, and right now you have no way to take it. So they pay another way, or they go elsewhere.`,
      `I work with NectarPay here in the Valley. A small terminal by the register opens that lane. The money settles into a wallet you own in seconds, and once it settles it is final: no dispute window, no clawbacks.`,
      `Setup is an afternoon, and your card reader keeps working exactly as it does today.`,
    ],
  }),
  native: (l) => ({
    subject: l.owner_first_name
      ? `You saw this coming, ${l.owner_first_name}`
      : `${l.name} saw this coming before the block did`,
    paras: [
      `Most shops in ${l.city} are still deciding whether crypto is real. You already take it, which tells me you did the homework years before your neighbors did.`,
      `Here is what I keep finding at shops that already take it, though: either a BitPay-style processor skimming 1-2% plus a quarter a transaction and settling to the bank a day or two later, which is card economics on crypto rails, or a bare wallet QR taped up by the register that is genuinely free but clunky enough that the staff steer people away from it.`,
      `NectarPay is the third option: a real terminal, staff type the amount, customer scans, ten seconds, with zero processing fee and settlement straight to a wallet you control, instantly. Processor-grade checkout, DIY-grade economics. ${TERMINAL_LABEL} once, ${MONTHLY_LABEL} a month, flat, never a percentage.`,
      `It sits beside whatever you run today. Worth ten minutes comparing it against your current rail.`,
    ],
  }),
};

// --- e2: SPEED ---------------------------------------------------------------
//
// New email. Speed was never a story in the old arc despite being the intent
// merchants actually tap. Per-cluster only in the closing line.

const E2_CLOSER: Record<Cluster, string> = {
  crowd: `On a busy night that is the difference between money you have and money you are owed.`,
  math: `On your ticket sizes, waiting on a bank is the part that actually costs you.`,
  control: `And because it never sits in a processor's account, there is no one in the middle who can decide to hold it.`,
  simple: `Job finished, money in hand, before you have packed up.`,
  native: ``,
};

// --- e4: the objection email, cluster-tuned "nothing changes" angle -----------

const E4_ANGLE: Record<Cluster, string> = {
  native: ``,
  control: `This just adds a lane nobody can freeze or reverse, so the day a card processor gets twitchy about your industry again, you already have money coming in that they cannot touch.`,
  math: `This adds a lane where the percentage simply does not exist. Every customer who uses it is margin back, on top of a setup you did not have to change.`,
  crowd: `This adds the lane your youngest customers keep asking about, and that crowd tells each other which shops have it.`,
  simple: `This adds a lane where a settled payment is final. No disputes, no clawbacks. Work done means paid.`,
};

// --- e5: final payments, per-cluster stake -----------------------------------

const E5_STAKE: Record<Cluster, string> = {
  native: ``,
  control: `In your industry that matters twice over, because a dispute is also the thing that gets a shop flagged and then dropped.`,
  math: `On a ticket the size of yours, one reversal is a bad month.`,
  crowd: `It is a smaller ticket in your shop, but it is also the one you are least likely to fight and most likely to just eat.`,
  simple: `Parts in, labor done, and a dispute takes the money back weeks later with a fee stacked on top. That is the one that stings.`,
};

// --- Final-email sign-off line per cluster -----------------------------------

const E6_LINE: Record<Cluster, string> = {
  native: `Either way, you were early, and that counts for something.`,
  control: `Either way, no hard feelings. But if a processor squeezes you again, you will wish this was already sitting by the register.`,
  math: `Either way, the numbers do not change, so the door is open whenever it makes sense.`,
  crowd: `Either way, the first shop on the block still gets the bragging rights, and that window is open now.`,
  simple: `Either way, it is an afternoon to set up whenever you are ready.`,
};

// --- Renderers ---------------------------------------------------------------

export function renderEmail(
  stage: Stage,
  lead: TemplateLead,
  baseUrl: string,
  address: string,
  rep: Rep = DEFAULT_REP
): Rendered {
  const cluster = CLUSTER_MAP[lead.vertical] ?? "math";
  const b = buttons(baseUrl, lead.pulse_token, intentsFor(cluster));
  const f = footer(baseUrl, lead.pulse_token, address, rep);
  const g = greet(lead);
  const linkFees = pulse(baseUrl, lead.pulse_token, "fees");
  const linkSpeed = pulse(baseUrl, lead.pulse_token, "speed");
  const linkChargebacks = pulse(baseUrl, lead.pulse_token, "chargebacks");
  const linkVisit = pulse(baseUrl, lead.pulse_token, "visit");

  // e1 - new customers
  if (stage === 1) {
    const { subject, paras } = E1[cluster](lead);
    return { subject, ...compose(g, paras, b, rep, f) };
  }

  // e2 native - speed against the rail they already run
  if (stage === 2 && cluster === "native") {
    const subject = lead.owner_first_name
      ? `How fast is your current rail, ${lead.owner_first_name}?`
      : `How fast is your current rail?`;
    const paras = [
      `The one number worth pulling from your current setup: how long between the customer paying and the money being yours to spend.`,
      `On a processor rail it is a day or two, into a bank, after their cut. On ours it is seconds, into a wallet you hold, with nothing taken out. Same checkout experience either way, so the difference is entirely on your side of it.`,
      `Worth putting the two side by side on your own volume.`,
    ];
    const tail = {
      html: cta(linkSpeed, "Compare it on your numbers"),
      text: `\nCompare it on your numbers: ${linkSpeed}`,
    };
    return { subject, ...compose(g, paras, tail, rep, f) };
  }

  // e2 - speed
  if (stage === 2) {
    const subject = lead.owner_first_name
      ? `Paid before they walk out, ${lead.owner_first_name}`
      : `Paid before they walk out`;
    const paras = [
      `Following up on the last one with the part owners react to hardest.`,
      `Card money is not yours yet. The sale is made, the customer is gone, and the money turns up Tuesday, minus a cut, and can still leave again weeks later.`,
      `A payment on our terminal is done when it is done. The customer pays and it is in a wallet you own before they reach the door. Not pending, not held, not reversible.`,
      E2_CLOSER[cluster],
    ].filter(Boolean);
    const tail = {
      html: cta(linkSpeed, "See how it settles"),
      text: `\nSee how it settles: ${linkSpeed}`,
    };
    return { subject, ...compose(g, paras, tail, rep, f) };
  }

  // e3 native - run both rails
  if (stage === 3 && cluster === "native") {
    const subject = lead.owner_first_name
      ? `Run both rails for a month, ${lead.owner_first_name}?`
      : `Run both rails for a month`;
    const paras = [
      `Simplest way to settle it: keep whatever you run today exactly as it is, put our terminal beside it for a month, and compare the tape. Fees taken, time to money, and how often the staff actually reach for each one.`,
      `Setup is one afternoon. If ours does not win on your own numbers, I will carry it back out myself.`,
    ];
    const tail = {
      html: cta(linkVisit, "Set it up - pick a day"),
      text: `\nSet it up - pick a day: ${linkVisit}`,
    };
    return { subject, ...compose(g, paras, tail, rep, f) };
  }

  // e3 - cost, as a break-even floor rather than a savings claim
  if (stage === 3) {
    const subject = lead.owner_first_name
      ? `What it costs, ${lead.owner_first_name}`
      : `What it costs at ${lead.name}`;
    const table =
      `<table style="border-collapse:collapse;margin:10px 0 4px;font-size:14px">` +
      `<tr><td style="padding:4px 14px 4px 0">Terminal, once</td><td style="font-weight:700">${TERMINAL_LABEL}</td></tr>` +
      `<tr><td style="padding:4px 14px 4px 0">Membership</td><td style="font-weight:700">${MONTHLY_LABEL}/mo, billed yearly</td></tr>` +
      `<tr><td style="padding:4px 14px 4px 0">Year one, all in</td><td style="font-weight:700">${YEAR_ONE_LABEL}</td></tr>` +
      `<tr><td style="padding:4px 14px 4px 0">Every year after</td><td style="font-weight:700">${ONGOING_LABEL}</td></tr>` +
      `<tr><td style="padding:4px 14px 4px 0">Cut of your sales</td><td style="font-weight:700">none, ever</td></tr>` +
      `</table>`;
    const tableText =
      `  Terminal, once:        ${TERMINAL_LABEL}\n` +
      `  Membership:            ${MONTHLY_LABEL}/mo, billed yearly\n` +
      `  Year one, all in:      ${YEAR_ONE_LABEL}\n` +
      `  Every year after:      ${ONGOING_LABEL}\n` +
      `  Cut of your sales:     none, ever`;
    const openLine = `I am not going to tell you your whole card volume moves across. It will not, and you would spot that in about four seconds.`;
    const floorLine = `So here is the floor instead. About $${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()} a month in crypto sales covers the entire first year, and about $${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()} a month every year after that. A handful of customers a week.`;
    const html = wrapHtml(
      `<p>${esc(g)}</p>` +
        `<p>${esc(openLine)}</p>` +
        table +
        `<p>${esc(floorLine)}</p>` +
        `<p style="font-size:13px;color:#47566B">${esc(`Everything past the floor is margin you keep. Your volume is not my example, so slide your own:`)}</p>` +
        cta(linkFees, "Slide your own numbers") +
        `<p>- ${esc(rep.first)}</p>` +
        f.html
    );
    const text = `${g}\n\n${openLine}\n\n${tableText}\n\n${floorLine}\n\nEverything past the floor is margin you keep. Slide your own volume here:\n${linkFees}\n\n- ${rep.first}${f.text}`;
    return { subject, html, text };
  }

  // e4 - nothing changes
  if (stage === 4 && cluster !== "native") {
    const subject = lead.owner_first_name
      ? `The question every owner asks me, ${lead.owner_first_name}`
      : `The question every owner asks me`;
    const paras = [
      `"But my customers pay with cards." Every owner says it, and it is exactly right. That is why nothing about your card setup changes. Same reader, same flow, same everything.`,
      E4_ANGLE[cluster],
      `Worth being ready before the first customer asks. Or the tenth.`,
    ].filter(Boolean);
    return { subject, ...compose(g, paras, b, rep, f) };
  }

  // e5 - a payment that cannot come back
  if (stage === 5) {
    const subject = lead.owner_first_name
      ? `A payment that can't come back, ${lead.owner_first_name}`
      : `A payment that can't come back`;
    const paras = [
      `Every card sale has a window where the money can leave again. ${E5_STAKE[cluster]}`,
      `A payment on our terminal settles once and it is over. No dispute window, no clawback, no fee stacked on top of losing the sale.`,
      `I will say the other half plainly, because you would find it anyway: it is final in both directions. If the wrong amount gets rung up, that one is final too. So the habit is confirming the number before the customer scans, and that is the whole of it.`,
    ];
    const tail = {
      html: cta(linkChargebacks, "See how settlement works"),
      text: `\nSee how settlement works: ${linkChargebacks}`,
    };
    return { subject, ...compose(g, paras, tail, rep, f) };
  }

  // Final stage - the either-way close (stage 6 standard, stage 4 native)
  const subject = `Working ${lead.city} next week either way`;
  const close = pulse(baseUrl, lead.pulse_token, "optout");
  const html = wrapHtml(
    `<p>${esc(g)}</p>` +
      `<p>${esc(`I will be working ${lead.city} next week either way. Worth ten minutes at your shop to watch a live payment settle, or should I close your file?`)}</p>` +
      `<p>` +
      `<a href="${linkVisit}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;background:#0C1A2C;color:#F2A71B;border-radius:8px;text-decoration:none;font-weight:700">Swing by - pick a day</a>` +
      `<a href="${close}" style="display:inline-block;padding:11px 18px;border:1.5px solid #8a94a3;border-radius:8px;color:#47566B;text-decoration:none">Close my file</a>` +
      `</p>` +
      `<p>${esc(E6_LINE[cluster])}</p>` +
      `<p>- ${esc(rep.first)}</p>` +
      f.html
  );
  const text = `${g}\n\nI will be working ${lead.city} next week either way. Worth ten minutes at your shop to watch a live payment settle, or should I close your file?\n\nSwing by - pick a day: ${linkVisit}\nClose my file: ${close}\n\n${E6_LINE[cluster]}\n\n- ${rep.first}${f.text}`;
  return { subject, html, text };
}
