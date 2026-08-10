// Trial math, in one place so the kanban card, the deal panel, and the
// dashboard KPI can never disagree about what day a trial is on.
//
// All dates are plain YYYY-MM-DD. Phoenix has no DST, so "today" is just
// UTC minus seven hours - the same anchor the calendar and dashboard use.

export const TRIAL_STAGE_SLUG = "trial-running";

/** The lengths a rep picks from. Length is the rep's call - these are shortcuts. */
export const TRIAL_LENGTH_OPTIONS = [14, 21, 30];

export type TrialFields = {
  trial_start?: string | null;
  trial_days?: number | null;
  trial_end?: string | null;
  terminal_serial?: string | null;
  trial_outcome?: string | null;
};

export type TrialStatus = {
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
  endDate: string;
  label: string;
  /** ok = plenty of runway, closing = 2 days or less, over = past the end date */
  tone: "ok" | "closing" | "over";
  finished: boolean;
};

const PHX_MS = 7 * 3600000;
const DAY_MS = 86400000;

export function phxToday(): string {
  return new Date(Date.now() - PHX_MS).toISOString().slice(0, 10);
}

function toUtcMidnight(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(ymd: string, days: number): string {
  return new Date(toUtcMidnight(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

/**
 * Null when this deal has no trial on it. A finished trial (converted or
 * returned) still reports status so the history stays readable.
 */
export function trialStatus(t: TrialFields, today: string = phxToday()): TrialStatus | null {
  if (!t.trial_start || !t.trial_days || t.trial_days < 1) return null;

  const totalDays = t.trial_days;
  const endDate = t.trial_end ?? addDays(t.trial_start, totalDays);
  const elapsed = daysBetween(t.trial_start, today);
  const dayNumber = Math.max(1, elapsed + 1);
  const daysLeft = daysBetween(today, endDate);
  const finished = !!t.trial_outcome;

  return {
    dayNumber,
    totalDays,
    daysLeft,
    endDate,
    label: `Day ${Math.min(dayNumber, totalDays + 1)} of ${totalDays}`,
    tone: finished ? "ok" : daysLeft < 0 ? "over" : daysLeft <= 2 ? "closing" : "ok",
    finished,
  };
}

/** Halfway point, rounded down, so a 14 day trial checks in on day 7. */
export function midpointDate(start: string, days: number): string {
  return addDays(start, Math.max(1, Math.floor(days / 2)));
}

/** Two days before the end - the conversation that decides the sale. */
export function conversionDate(start: string, days: number): string {
  return addDays(start, Math.max(1, days - 2));
}

/** 9 AM Phoenix on a given date, as an ISO timestamp for a scheduled activity. */
export function phxMorningIso(ymd: string): string {
  return new Date(toUtcMidnight(ymd) + 16 * 3600000).toISOString();
}
