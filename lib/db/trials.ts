// Trial math, in one place so the kanban card, the deal panel, and the
// dashboard KPI can never disagree about what day a trial is on.
//
// All dates are plain YYYY-MM-DD. The zone-aware arithmetic now lives in
// lib/db/tz.ts so a region outside Arizona gets its own "today" and its own
// 9 AM. The phx* helpers below are thin Phoenix-bound wrappers kept so every
// existing caller still compiles; new code should pass the region's zone to
// todayIn() / morningIso() directly.

import { DEFAULT_TZ, morningIso, todayIn, addDays, daysBetween } from "@/lib/db/tz";

export { addDays, daysBetween };

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

/** @deprecated Phoenix-bound. Use todayIn(region.timezone) from lib/db/tz. */
export function phxToday(): string {
  return todayIn(DEFAULT_TZ);
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

/**
 * 9 AM Phoenix on a given date, as an ISO timestamp for a scheduled activity.
 * @deprecated Use morningIso(ymd, region.timezone) from lib/db/tz.
 */
export function phxMorningIso(ymd: string): string {
  return morningIso(ymd, DEFAULT_TZ);
}
