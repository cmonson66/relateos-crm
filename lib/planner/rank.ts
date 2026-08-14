/**
 * What the rep does before they get in the car.
 *
 * The morning block has ONE job: fill tomorrow's field blocks. Today's route
 * was already decided by yesterday's calls, so a planner that only plans today
 * leaves the rep permanently a day behind their own pipeline.
 *
 * Ranking is deliberately TIERED rather than a single weighted score. A rep
 * has to be able to look at the order and agree with it - "somebody raised
 * their hand" must always beat "this one is 3 points warmer", and a formula
 * that can silently rank a cold shop above a hand-raiser is a formula they
 * stop trusting the first time it does.
 */

export type PlannerAccount = {
  accountId: string;
  contactId: string | null;
  name: string;
  city: string | null;
  vertical: string;
  band: string;
  phone: string | null;
  email: string | null;
  legacyId: string | null;
  lastActivityAt: string | null;
  cryptoScore: number | null;
};

export type PlannerSignal = {
  place_id: string;
  status: string | null;
  band: string | null;
  score: number | null;
  email_stage: number;
  last_emailed_at: string | null;
  last_intent: string | null;
  last_engaged_at: string | null;
  self_reported_monthly_volume: number | null;
  visit_day_pref: string | null;
  compliance_hold: boolean;
};

/** An activity the rep already promised: a callback, a task, a due check-in. */
export type PlannerCommitment = {
  activityId: string;
  accountId: string | null;
  contactId: string | null;
  subject: string;
  scheduledAt: string;
  type: string;
};

export type PlanItem = {
  kind: 'call' | 'send';
  accountId: string | null;
  contactId: string | null;
  activityId: string | null;
  reason: string;
  score: number;
  estMinutes: number;
};

const DAY = 86400000;

/** Tier floors. Anything in a higher tier outranks everything below it. */
const TIER = {
  requested: 900,
  engaged: 800,
  overdue: 700,
  today: 600,
  signedNoInvoice: 850,
  warmRetouch: 300,
  coldBook: 100,
} as const;

const INTENT_WORDS: Record<string, string> = {
  fees: 'the fees',
  control: 'who controls their money',
  chargebacks: 'chargebacks',
  speed: 'waiting to get paid',
  curious: 'the crypto angle',
};

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY);
}

function whenWords(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

/**
 * The call list, ranked.
 *
 * `budget` is a count of calls, not minutes - the desk block is bounded by
 * how many conversations a person can actually have before lunch, and the
 * honest number is lower than anybody's first guess. Over-planning is the
 * failure mode that kills these features: a list nobody finishes is a list
 * nobody opens on day three.
 */
export function buildCallList(
  accounts: PlannerAccount[],
  signals: Map<string, PlannerSignal>,
  commitments: PlannerCommitment[],
  opts: { now: number; budget: number; signedNoInvoice?: Set<string> },
): PlanItem[] {
  const { now, budget } = opts;
  const items: PlanItem[] = [];
  const claimed = new Set<string>();

  const sigFor = (a: PlannerAccount) => (a.legacyId ? signals.get(a.legacyId) : undefined);

  // ---- Tier 1 and 2: somebody raised their hand -------------------------
  for (const a of accounts) {
    const s = sigFor(a);
    if (!s || s.compliance_hold) continue;
    // An opt-out is a closed door. It is never a call.
    if (s.status === 'DNC' || s.last_intent === 'optout') continue;
    const engagedDays = daysSince(s.last_engaged_at, now);
    if (engagedDays === null || engagedDays > 7) continue;

    const asked = s.status === 'VISIT_REQUEST' || s.status === 'TEXT_REQUEST';
    const hook = s.last_intent ? INTENT_WORDS[s.last_intent] : null;
    const vol = s.self_reported_monthly_volume;

    const reason = asked
      ? `They asked to be contacted ${whenWords(engagedDays)}. This is not a cold call.`
      : hook
        ? `Tapped ${hook} ${whenWords(engagedDays)}${vol ? ` and put themselves at $${Math.round(vol / 1000)}k a month` : ''}.`
        : `Opened their page ${whenWords(engagedDays)}.`;

    items.push({
      kind: 'call',
      accountId: a.accountId,
      contactId: a.contactId,
      activityId: null,
      // Fresher engagement ranks higher inside the tier.
      score: (asked ? TIER.requested : TIER.engaged) + (7 - engagedDays),
      reason,
      estMinutes: 8,
    });
    claimed.add(a.accountId);
  }

  // ---- Tier 3 and 4: promises the rep already made -----------------------
  for (const c of commitments) {
    if (c.accountId && claimed.has(c.accountId)) continue;
    const due = Date.parse(c.scheduledAt);
    const overdue = due < now;
    const lateDays = Math.max(0, Math.floor((now - due) / DAY));
    items.push({
      kind: 'call',
      accountId: c.accountId,
      contactId: c.contactId,
      activityId: c.activityId,
      score: (overdue ? TIER.overdue : TIER.today) + Math.min(lateDays, 60),
      reason: overdue
        ? `You said you would call. ${lateDays === 0 ? 'Earlier today' : `${lateDays} day${lateDays === 1 ? '' : 's'} ago`}.`
        : `On your calendar today: ${c.subject}`,
      estMinutes: 6,
    });
    if (c.accountId) claimed.add(c.accountId);
  }

  // ---- Tier 6: emailed, never answered ----------------------------------
  // The touch count is the point. Most meetings land after several attempts
  // and most reps quit after one or two, so a shop that has had one email and
  // no call is not a dead lead - it is an unfinished one.
  for (const a of accounts) {
    if (claimed.has(a.accountId)) continue;
    const s = sigFor(a);
    if (!s || s.compliance_hold || s.status === 'DNC') continue;
    if (s.email_stage < 1) continue;
    const since = daysSince(s.last_emailed_at, now);
    if (since === null || since < 3 || since > 45) continue;

    items.push({
      kind: 'call',
      accountId: a.accountId,
      contactId: a.contactId,
      activityId: null,
      score: TIER.warmRetouch + Math.max(0, 30 - Math.abs(since - 7)),
      reason: `Emailed ${whenWords(since)}, no reply. Nobody has called them.`,
      estMinutes: 6,
    });
    claimed.add(a.accountId);
  }

  // ---- Tier 7: cold, from their own book --------------------------------
  const cold = accounts
    .filter((a) => {
      if (claimed.has(a.accountId) || !a.phone) return false;
      const s = sigFor(a);
      if (s && (s.compliance_hold || s.status === 'DNC')) return false;
      const touched = daysSince(a.lastActivityAt, now);
      return touched === null || touched > 30;
    })
    .map((a) => {
      const bandBonus = a.band === 'HOT' ? 60 : a.band === 'WARM' ? 30 : 0;
      const density = Math.round((a.cryptoScore ?? 0) / 4);
      return {
        kind: 'call' as const,
        accountId: a.accountId,
        contactId: a.contactId,
        activityId: null,
        score: TIER.coldBook + bandBonus + density,
        reason:
          a.lastActivityAt === null
            ? `Never been called. ${a.band} in ${a.city ?? 'your book'}.`
            : `Last touched ${whenWords(daysSince(a.lastActivityAt, now) ?? 0)}. ${a.band}.`,
        estMinutes: 6,
      };
    });

  items.push(...cold);

  return items.sort((x, y) => y.score - x.score).slice(0, budget);
}

/**
 * The send list. Short on purpose - a send is a follow-through on something
 * that already happened, not a way to feel productive.
 */
export function buildSendList(
  accounts: PlannerAccount[],
  signals: Map<string, PlannerSignal>,
  opts: {
    now: number;
    budget: number;
    signedNoInvoice?: { accountId: string; name: string; days: number }[];
    /** Already on the call list. You call them or you email them, not both -
     *  a shop that gets a call and an email the same morning learns we are
     *  running a sequence at them rather than paying attention to them. */
    exclude?: Set<string>;
  },
): PlanItem[] {
  const { now, budget } = opts;
  const items: PlanItem[] = [];
  const claimed = new Set<string>(opts.exclude ?? []);

  // A signed purchase agreement with no invoice is money sitting on a desk.
  for (const g of opts.signedNoInvoice ?? []) {
    items.push({
      kind: 'send',
      accountId: g.accountId,
      contactId: null,
      activityId: null,
      score: TIER.signedNoInvoice + Math.min(g.days, 60),
      reason: `Signed ${g.days === 0 ? 'today' : whenWords(g.days)} and never invoiced. Send it.`,
      estMinutes: 4,
    });
    claimed.add(g.accountId);
  }

  for (const a of accounts) {
    if (claimed.has(a.accountId) || !a.email) continue;
    const s = a.legacyId ? signals.get(a.legacyId) : undefined;
    if (!s || s.compliance_hold || s.status === 'DNC') continue;
    const engagedDays = daysSince(s.last_engaged_at, now);
    if (engagedDays === null || engagedDays > 14) continue;
    if (s.status === 'VISIT_REQUEST' || s.status === 'TEXT_REQUEST') continue; // call, do not email

    items.push({
      kind: 'send',
      accountId: a.accountId,
      contactId: a.contactId,
      activityId: null,
      score: TIER.engaged - 50 + (14 - engagedDays),
      reason: `Looked at their page ${whenWords(engagedDays)}. Put the one-pager in front of them.`,
      estMinutes: 3,
    });
    claimed.add(a.accountId);
  }

  return items.sort((x, y) => y.score - x.score).slice(0, budget);
}
