/**
 * What the shop did on their Pulse page, turned into how to open the call.
 *
 * A rep calling someone who slid the calculator to $40k and tapped "kill
 * chargebacks" should not open with the generic hook. They already told you
 * what they care about - the whole point of the Pulse card is that it asks.
 *
 * Event vocabulary comes from nectarpay-pulse: engagement_events.event is one
 * of intent | slider | visit_request | text_request | optout, and for an
 * intent the `intent` column is one of the five INTENT_LABELS keys.
 */

export type PulseEvent = {
  event: string;
  intent: string | null;
  value_num: number | null;
  created_at: string;
};

export type PulseRead = {
  /** One line the rep says out loud to open. */
  opener: string;
  /** What they actually did, in plain language, for the rail. */
  summary: string;
  /** Which of the five hooks to lead with. */
  lead: 'fees' | 'control' | 'chargebacks' | 'speed' | 'curious' | null;
  /** Their own number, if they moved the slider. */
  volume: number | null;
  /** They asked for a visit or a text - this is not a cold call any more. */
  requested: boolean;
  /** They opted out. Do not call. */
  optedOut: boolean;
  /** Views only, no taps. Interested but not committed. */
  lookedOnly: boolean;
};

const HOOK_OPENER: Record<string, string> = {
  fees:
    'You tapped the one about card fees, so let me start there. What are you paying on a card sale right now?',
  control:
    'You tapped the one about nobody controlling your money, which tells me you have been on the wrong end of a hold or a freeze. What happened?',
  chargebacks:
    'You tapped chargebacks, so I am guessing you have eaten one you could not fight. How bad was it?',
  speed:
    'You tapped getting paid instantly, so the wait is the part that bites. How long are you sitting on money right now?',
  curious:
    'You said just curious, which is fair. Let me give you the two minute version and you can tell me if it is worth more than that.',
};

const money = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

/**
 * Newest events first is what the caller should pass; order does not actually
 * matter here beyond picking the latest slider value.
 */
export function readPulse(events: PulseEvent[]): PulseRead | null {
  if (!events || events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const optedOut = sorted.some((e) => e.event === 'optout');
  const requested = sorted.some(
    (e) => e.event === 'visit_request' || e.event === 'text_request',
  );
  const lastIntent = sorted.find((e) => e.event === 'intent' && e.intent)?.intent ?? null;
  const slider = sorted.find((e) => e.event === 'slider' && e.value_num != null);
  const volume = slider?.value_num ?? null;
  const lookedOnly = !optedOut && !requested && !lastIntent && volume === null;

  // Strongest signal wins the opener. An opt-out overrides everything, then a
  // request, then what they said mattered, then their own number.
  let opener: string;
  if (optedOut) {
    opener =
      'They opted out on the Pulse page. Do not call this one - work another shop.';
  } else if (requested) {
    opener =
      'They asked to be contacted, so this is not a cold call. Open with that: "You asked about the terminal - I am the one who follows up on those."';
  } else if (lastIntent && HOOK_OPENER[lastIntent]) {
    opener = HOOK_OPENER[lastIntent];
  } else if (volume != null) {
    opener = `They put their card volume at ${money(volume)} a month on our page. Open with their own number: "You put yourself around ${money(volume)} a month in card sales - at three percent that is about ${money(volume * 0.03 * 12)} a year gone. Is that close?"`;
  } else {
    opener =
      'They opened the page but did not tap anything. Enough interest to look, not enough to ask. Open normally and do not mention the email.';
  }

  const parts: string[] = [];
  if (optedOut) parts.push('opted out');
  if (requested) parts.push('asked to be contacted');
  if (lastIntent) parts.push(`tapped "${lastIntent}"`);
  if (volume != null) parts.push(`slid to ${money(volume)} a month`);
  if (parts.length === 0) parts.push('opened the page, no taps');

  return {
    opener,
    summary: parts.join(' · '),
    lead: (lastIntent as PulseRead['lead']) ?? null,
    volume,
    requested,
    optedOut,
    lookedOnly,
  };
}
