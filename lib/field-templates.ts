/**
 * Field message templates.
 *
 * Lives beside lib/call-scripts.ts. Same idea: the words a rep needs, already
 * written, so nothing has to be composed standing in a parking lot.
 *
 * Source material: the NectarPay Ambassador Playbook (Pilot Launch v1.0) plus
 * the walk-in script already in the app. Copy follows the house rules:
 * plain hyphens, comma greetings, real company names, never the word that
 * starts with "c" and means the thing by the register, CryptoPop spelled that way.
 *
 * Tokens (all optional - renderTemplate degrades gracefully):
 *   {{shop}} {{owner}} {{city}} {{rep}} {{repCell}} {{repEmail}} {{pulseUrl}}
 * Conditional sections:
 *   {{#pulse}} ... {{/pulse}}   only rendered when a Pulse URL is present
 *   {{#owner}} ... {{/owner}}   only rendered when a real owner name is known
 */

export type FieldChannel = "email" | "text";

export type FieldTemplateGroup =
  | "first-touch"
  | "after-a-visit"
  | "they-asked"
  | "keeping-it-alive"
  | "after-the-sale";

export type FieldTemplate = {
  id: string;
  label: string;
  /** One line in the picker: when a rep should reach for this one. */
  when: string;
  group: FieldTemplateGroup;
  subject: string;
  email: string;
  text: string;
  /** True when the message reads badly without a Pulse link. */
  wantsPulse?: boolean;
};

export const FIELD_TEMPLATE_GROUPS: {
  id: FieldTemplateGroup;
  label: string;
  blurb: string;
}[] = [
  {
    id: "first-touch",
    label: "Reaching out cold",
    blurb: "Nobody has talked to them yet. Your own opener, not the campaign's.",
  },
  {
    id: "after-a-visit",
    label: "After a visit",
    blurb: "The door did not end in a sale. These are the ones that matter most.",
  },
  {
    id: "they-asked",
    label: "They asked for something",
    blurb: "Send it while you are still in their parking lot.",
  },
  {
    id: "keeping-it-alive",
    label: "Keeping it alive",
    blurb: "Later, colder, or stalled.",
  },
  {
    id: "after-the-sale",
    label: "After the sale",
    blurb: "The part that pays twice.",
  },
];

export const FIELD_TEMPLATES: FieldTemplate[] = [
  /* ------------------------------------------------------------------ *
   * FIRST TOUCH - rep led, before or instead of the campaign
   * ------------------------------------------------------------------ */
  {
    id: "cold-intro",
    label: "Cold introduction",
    when: "Nobody has contacted them yet and you want to start it yourself.",
    group: "first-touch",
    wantsPulse: true,
    subject: "Quick question about card fees at {{shop}}",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

I work with NectarPay here in {{#city}}{{city}}{{/city}}{{^city}}the Valley{{/city}}, and I am reaching out to a handful of shops directly rather than blasting anyone.

Short version: we make a terminal that sits by the register and lets you take crypto payments with no percentage fee. The money lands in a wallet you own, in seconds, and it cannot be charged back. Whatever you use for cards now keeps working exactly as it does. This is a lane beside it, not a replacement.

Most owners I talk to are paying two to four percent on every card sale. If that sounds like you, the math is worth two minutes.

{{#pulse}}I put the numbers for {{shop}} on one page: {{pulseUrl}}

{{/pulse}}Would a slow hour this week work to show you one live payment settle? Takes about two minutes and I will not oversell you.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}this is {{rep}} with NectarPay. We make a terminal that takes crypto with no percentage fee, money straight to a wallet you own, no chargebacks. Cards keep working the same.{{#pulse}} Your numbers: {{pulseUrl}}{{/pulse}} Worth two minutes at a slow hour this week?`,
  },
  {
    id: "cold-meeting-ask",
    label: "Ask for a sit-down",
    when: "You want a real meeting on the calendar, not a drive-by.",
    group: "first-touch",
    wantsPulse: true,
    subject: "Fifteen minutes at {{shop}}?",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

I am {{rep}} with NectarPay. I am setting up a few short meetings with owners around {{#city}}{{city}}{{/city}}{{^city}}the Valley{{/city}} this week and would like fifteen minutes with you.

What I would cover, and nothing else:

What you are paying now on card processing, in your own numbers.
What comes out of a crypto sale instead, which is nothing.
A live payment on the terminal so you can see it settle rather than take my word for it.

If it is not a fit after fifteen minutes, I will say so myself and leave you alone.

{{#pulse}}Background if you want it first: {{pulseUrl}}

{{/pulse}}What day is quietest for you?

{{rep}}
{{repCell}}
{{repEmail}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} with NectarPay. Setting up a few 15 minute meetings with owners around {{#city}}{{city}}{{/city}}{{^city}}the area{{/city}} this week. I show you your card fees, what a crypto sale costs instead, and one live payment. What day is quietest for you?`,
  },
  {
    id: "cold-neighbor",
    label: "Someone nearby already took it",
    when: "You have a shop live or trialling close by. The strongest cold opener you have.",
    group: "first-touch",
    wantsPulse: true,
    subject: "A shop near you started taking crypto",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

A business a few blocks from {{shop}} put in a NectarPay terminal, and I am working my way around the same area.

It takes crypto payments with no percentage fee, and the money lands in a wallet the owner controls within seconds. No chargebacks on those sales, ever. Their card processing did not change at all.

I am not going to pretend crypto is most of anyone's business yet. The reason owners do it is that the sales which do move over cost them nothing, and they stop being the shop that has to say no when somebody asks.

{{#pulse}}Here is the same math run on {{shop}}: {{pulseUrl}}

{{/pulse}}Worth two minutes when you are slow?

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} with NectarPay. A shop a few blocks from {{shop}} just started taking crypto with no percentage fee, money straight to their own wallet. I am working the same area this week.{{#pulse}} Your numbers: {{pulseUrl}}{{/pulse}} Two minutes when you are slow?`,
  },

  /* ------------------------------------------------------------------ *
   * AFTER A VISIT
   * ------------------------------------------------------------------ */
  {
    id: "owner-absent",
    label: "Owner was not in",
    when: "You walked in, the owner was out, you left a one-pager with staff.",
    group: "after-a-visit",
    wantsPulse: true,
    subject: "Stopped by {{shop}} today",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

I came by {{shop}} today and you were out, so I left a one-page rundown with your team.

The short version: NectarPay is a small terminal that sits by the register and lets you take crypto payments with no percentage fee. The money lands in a wallet you own, in seconds. Whatever you use for cards now, Square or Stripe or anything else, keeps working exactly as it does. This just adds a lane beside it.

{{#pulse}}I put a page together for {{shop}} specifically, with the math on your own numbers: {{pulseUrl}}

{{/pulse}}No rush and no pressure. If you want the two-minute version in person, tell me a slow hour and I will come back then.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}this is {{rep}} with NectarPay. I stopped by {{shop}} today and left a one-pager with your team. It is a terminal that takes crypto with no processing fee, money straight to a wallet you own.{{#pulse}} Details here: {{pulseUrl}}{{/pulse}} What is a slow hour for you?`,
  },
  {
    id: "talked-no-decision",
    label: "Talked, no decision",
    when: "Good conversation, they did not say yes and did not say no.",
    group: "after-a-visit",
    wantsPulse: true,
    subject: "Good talking with you at {{shop}}",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

Thanks for the few minutes today. I know you did not plan on a sales conversation while you were working.

I am not going to chase you on this. I will say the one thing worth remembering: there is no percentage taken out of a crypto sale, and the money is in your wallet before the customer walks out. That is it. The terminal is $499 once, and the membership is $19 a month billed annually. No percentage of your sales, ever.

{{#pulse}}Everything we talked about is on this page, including the math on your own volume: {{pulseUrl}}

{{/pulse}}If you want to see a live payment settle before you decide anything, that takes about two minutes and I can do it whenever you are slow.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} here, good talking with you today at {{shop}}. No pressure from me.{{#pulse}} Here is the page with your numbers on it: {{pulseUrl}}{{/pulse}} If you ever want to watch a payment settle live, it takes two minutes.`,
  },
  {
    id: "gatekeeper-only",
    label: "Only got the staff",
    when: "You never reached a decision maker, but you got a name or an email.",
    group: "after-a-visit",
    wantsPulse: true,
    subject: "Note for the owner of {{shop}}",
    email: `Hi there,

I came into {{shop}} today and spoke with someone on your team. They were great, and they pointed me here.

I work with NectarPay. We make a small terminal that lets a business take crypto payments with no percentage fee, with the money landing instantly in a wallet the business owns. It sits beside whatever card system you already use rather than replacing it.

I am not asking for a decision by email. I am asking for two minutes with whoever handles payments, at a time that is not the middle of your rush.

{{#pulse}}Everything is laid out here, with the math on your own numbers: {{pulseUrl}}

{{/pulse}}Who should I be talking to, and when is your quiet hour?

{{rep}}
{{repCell}}
{{repEmail}}`,
    text: `Hi, this is {{rep}} with NectarPay. I came into {{shop}} today and spoke with your team. Could you point me to whoever handles payments?{{#pulse}} Here is what it is about: {{pulseUrl}}{{/pulse}} I need about two minutes at a slow hour, not during a rush. Thanks.`,
  },

  /* ------------------------------------------------------------------ *
   * THEY ASKED FOR SOMETHING
   * ------------------------------------------------------------------ */
  {
    id: "send-me-something",
    label: "Send me something",
    when: 'They said "send me some information" and meant it.',
    group: "they-asked",
    wantsPulse: true,
    subject: "The NectarPay rundown you asked for",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

Here is what you asked for, kept short.

What it is: a terminal by the register that lets a customer pay you in crypto. You type the amount, they scan a code, the money is in a wallet you control in seconds. Nobody sits in the middle of it.

What it costs: $499 for the terminal, once. Then $19 a month for the membership, paid up front for the year. No percentage of your sales, ever.

What it saves: nothing is taken out of a crypto sale. A shop running $10,000 a month through cards at about 3 percent is paying roughly $3,600 a year to do it. Card processing still applies to card sales, so the real number depends on how much moves over, but every dollar that does move over arrives whole.

What it does not do: it does not replace your card system, and it is not something your customers need to understand. They already have the wallet app or they do not.

{{#pulse}}I built a page for {{shop}} where you can slide your own numbers around: {{pulseUrl}}

{{/pulse}}If it looks worth two minutes, I will bring the terminal by and run a live payment so you can watch it settle.

{{rep}}
{{repCell}}
{{repEmail}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}as promised. NectarPay: a terminal that takes crypto with zero percentage fee, money in your own wallet in seconds, works alongside your card system. $499 once, $19/mo membership.{{#pulse}} Full rundown with your numbers: {{pulseUrl}}{{/pulse}} - {{rep}}`,
  },
  {
    id: "already-with-processor",
    label: "They already have a processor",
    when: 'They said "I already have a payment system."',
    group: "they-asked",
    wantsPulse: true,
    subject: "Keep what you have at {{shop}}",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

You said you already have a payment system, and my honest answer is: keep it.

NectarPay is not a replacement for Square or Stripe or whoever runs your cards. It sits next to them. Cards keep working exactly the way they do today. What it adds is one lane where there is no percentage taken out and no waiting on a deposit, for the customers who want to pay that way.

There is also no chargeback risk on that lane. A crypto payment is final. If you have ever lost a delivered sale to a dispute weeks later, that part alone is worth a look.

{{#pulse}}Here is the page for {{shop}}, if you want to see what it looks like against your own volume: {{pulseUrl}}

{{/pulse}}Two minutes whenever you are slow, and I will show you a real payment settle.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} here. Keep your card system, seriously. NectarPay just adds a lane beside it with no percentage fee and no chargebacks. Cards keep working the same.{{#pulse}} More here: {{pulseUrl}}{{/pulse}}`,
  },
  {
    id: "trial-offer",
    label: "Offer a trial terminal",
    when: "They are interested but not ready to pay. Requires a signed trial agreement.",
    group: "they-asked",
    wantsPulse: true,
    subject: "A trial terminal for {{shop}}",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

Here is a way to settle this without you spending anything.

NectarPay authorized me to put a terminal in your shop on a trial. Free means free: no $499, no monthly, nothing while the trial runs. You use it, your customers use it, and at the end you tell me whether it earned its spot by the register.

There is one piece of paperwork. A trial terminal needs a signed trial agreement before it goes in, which mostly covers the hardware coming back if you decide against it. I will bring it with me.

Setup takes an afternoon at most. I stay and run a live payment with you, and I walk your team through it so nobody is guessing on a busy day.

{{#pulse}}The numbers for {{shop}} are here if you want them in front of you first: {{pulseUrl}}

{{/pulse}}What does your week look like?

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} here. I can put a NectarPay terminal in {{shop}} on a free trial. No terminal cost, no monthly, nothing while it runs. There is a short trial agreement to sign and I bring it with me.{{#pulse}} Your numbers: {{pulseUrl}}{{/pulse}} What day works?`,
  },
  {
    id: "post-demo",
    label: "After a demo",
    when: "They watched a live payment settle and you have not closed yet.",
    group: "they-asked",
    wantsPulse: true,
    subject: "That payment that settled in about ten seconds",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

Thanks for letting me run that in the middle of your day.

You saw the whole thing: amount in, customer scans, money in the wallet. No percentage came out of it and there is no way for it to be reversed three weeks from now.

Where that leaves you: $499 for the terminal, then $19 a month for the membership. I can have you set up and taking your first real payment in an afternoon, and I will train whoever works the register so it is not just you who knows how.

{{#pulse}}Your page is here if you want to run the numbers again on your own time: {{pulseUrl}}

{{/pulse}}Is there one thing you would want to be sure of before saying yes? Tell me what it is and I will get you a straight answer, even if the answer is that we are not a fit.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}thanks for the time today and for letting me run that live. $499 for the terminal and $19/mo for the membership, and I can have you taking real payments in an afternoon. Anything you would want to be sure of before you say yes?{{#pulse}} Your numbers: {{pulseUrl}}{{/pulse}} - {{rep}}`,
  },

  /* ------------------------------------------------------------------ *
   * KEEPING IT ALIVE
   * ------------------------------------------------------------------ */
  {
    id: "come-back-later",
    label: "Come back later",
    when: 'They said "not right now" and gave you a reason.',
    group: "keeping-it-alive",
    subject: "Circling back to {{shop}}",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

You told me the timing was not right, so I am not going to pretend this is anything other than me checking back like I said I would.

Nothing has changed on my end. $499 for the terminal, $19 a month for the membership, no percentage of your sales. It still sits alongside your card system rather than replacing it.

If the timing is better now, I need about two minutes and a slow hour. If it is not, tell me when to check back and I will put it on my calendar and leave you alone until then.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} with NectarPay, checking back like I said I would. Is the timing any better for those two minutes? If not, tell me when and I will leave you alone until then.`,
  },
  {
    id: "cold-revival",
    label: "Cold revival",
    when: "Months of nothing. Give them an easy way to say no.",
    group: "keeping-it-alive",
    wantsPulse: true,
    subject: "Still worth two minutes at {{shop}}?",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

We talked a while back about NectarPay and then life happened on both ends.

One thing has changed worth mentioning: CryptoPop is coming, a directory and deals map that points nearby crypto customers toward the shops that take it. Merchants who are already set up get listed. That turns the terminal from something that saves you fees into something that can also bring somebody through the door.

The rest is the same. $499 once, $19 a month, no percentage, money straight to a wallet you own, no chargebacks.

{{#pulse}}Your page is still here: {{pulseUrl}}

{{/pulse}}If this is a no, say so and I will close it out with no hard feelings. If it is a maybe, I will bring the terminal by and show you a payment settle.

{{rep}}
{{repCell}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}{{rep}} with NectarPay. We talked a while back. New thing: CryptoPop is coming, a directory that points crypto customers to shops that take it, and merchants who are set up get listed.{{#pulse}} {{pulseUrl}}{{/pulse}} Still worth two minutes, or should I close it out?`,
  },

  /* ------------------------------------------------------------------ *
   * AFTER THE SALE
   * ------------------------------------------------------------------ */
  {
    id: "post-install-thankyou",
    label: "After the install",
    when: "Day one. Send it the same evening the terminal goes in.",
    group: "after-the-sale",
    subject: "You are live, {{shop}}",
    email: `{{#owner}}{{owner}},{{/owner}}{{^owner}}Hi there,{{/owner}}

You are set up and taking payments. Thanks for trusting me with a spot by your register.

A few things so nothing catches you off guard:

The wallet is yours. I do not have access to it and neither does NectarPay. Nobody can freeze it or decide when you get paid.

Anyone working the register can run one. If you hire somebody next month, call me and I will walk them through it rather than making you explain it.

I will check in on day seven and again around day thirty, and then I stop pestering you unless something breaks. If something does break before that, my cell is below and I answer it.

One ask, whenever it feels earned: who else do you know who would rather stop paying card fees? A name from you is worth more than anything I can say cold.

{{rep}}
{{repCell}}
{{repEmail}}`,
    text: `{{#owner}}{{owner}}, {{/owner}}you are live. Wallet is yours, nobody can freeze it. I will check in on day 7 and day 30, and my cell is right here if anything comes up before that. Thanks for the shot. - {{rep}}`,
  },
];

/* -------------------------------------------------------------------- *
 * Rendering
 * -------------------------------------------------------------------- */

export type FieldTokens = {
  shop?: string | null;
  /** Real owner first name only. Placeholder contacts must be passed as null. */
  owner?: string | null;
  city?: string | null;
  rep?: string | null;
  repCell?: string | null;
  repEmail?: string | null;
  pulseUrl?: string | null;
};

export type RenderedMessage = {
  subject: string;
  body: string;
};

const PLACEHOLDER_NAMES = new Set([
  "business",
  "owner",
  "the owner",
  "manager",
  "front desk",
  "info",
]);

/** A placeholder contact is not a person. Do not greet it by name. */
export function realOwnerName(name?: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function section(source: string, key: string, present: boolean): string {
  const positive = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, "g");
  const negative = new RegExp(`\\{\\{\\^${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, "g");
  return source
    .replace(positive, present ? "$1" : "")
    .replace(negative, present ? "" : "$1");
}

function fill(source: string, tokens: FieldTokens): string {
  const owner = realOwnerName(tokens.owner);
  const pulse = (tokens.pulseUrl ?? "").trim();

  let out = source;
  out = section(out, "pulse", pulse.length > 0);
  out = section(out, "owner", owner !== null);
  // A shop with no city on file should read "the Valley", not "in ."
  out = section(out, "city", (tokens.city ?? "").trim().length > 0);

  const values: Record<string, string> = {
    shop: (tokens.shop ?? "your shop").trim(),
    owner: owner ?? "",
    city: (tokens.city ?? "").trim(),
    rep: (tokens.rep ?? "").trim(),
    repCell: (tokens.repCell ?? "").trim(),
    repEmail: (tokens.repEmail ?? "").trim(),
    pulseUrl: pulse,
  };

  out = out.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );

  // A missing cell or email leaves a bare line behind. Collapse it.
  out = out
    .split("\n")
    .filter((line, index, all) => {
      if (line.trim() !== "") return true;
      return !(index > 0 && all[index - 1].trim() === "");
    })
    .join("\n")
    .trim();

  return out;
}

export function renderFieldTemplate(
  template: FieldTemplate,
  channel: FieldChannel,
  tokens: FieldTokens,
): RenderedMessage {
  return {
    subject: fill(template.subject, tokens),
    body: fill(channel === "email" ? template.email : template.text, tokens),
  };
}

export function getFieldTemplate(id: string): FieldTemplate | undefined {
  return FIELD_TEMPLATES.find((t) => t.id === id);
}

export function fieldTemplatesByGroup(group: FieldTemplateGroup): FieldTemplate[] {
  return FIELD_TEMPLATES.filter((t) => t.group === group);
}
