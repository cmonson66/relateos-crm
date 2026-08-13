// Region-aware date math.
//
// Phoenix has no DST, so the app got away with "UTC minus seven hours" for a
// long time. A second region does not: America/Chicago is two hours off
// Phoenix in summer and one hour off in winter, so a fixed offset is wrong
// half the year. Everything here takes an IANA zone and derives the offset
// from the instant, using Intl - no dependency, no offset table to maintain.
//
// Plain dates stay YYYY-MM-DD strings and stay zone-free. A date only needs a
// zone when it is being turned into an instant (scheduling a task, bounding a
// day) or when an instant is being turned back into a date (what is "today").

/** IANA zone name, e.g. America/Phoenix or America/Chicago. */
export type TimeZone = string;

/** Phoenix stays the fallback so an unconfigured region behaves as before. */
export const DEFAULT_TZ: TimeZone = "America/Phoenix";

const DAY_MS = 86400000;

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<TimeZone, Intl.DateTimeFormat>();

function partsFormatter(tz: TimeZone): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/** Wall-clock reading in `tz` for a given instant. */
export function partsIn(tz: TimeZone, at: Date = new Date()): Parts {
  const bag: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(at)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    // Some engines render midnight as "24" under hour12:false.
    hour: Number(bag.hour) % 24,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Milliseconds `tz` is ahead of UTC at a given instant. Negative in the US. */
function offsetMsAt(utcMs: number, tz: TimeZone): number {
  const p = partsIn(tz, new Date(utcMs));
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - utcMs;
}

/** The calendar date in `tz` right now (or at `at`), as YYYY-MM-DD. */
export function todayIn(tz: TimeZone = DEFAULT_TZ, at: Date = new Date()): string {
  const p = partsIn(tz, at);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Hour of the day, 0-23, in `tz`. This is what an hourly cron gates on. */
export function hourIn(tz: TimeZone = DEFAULT_TZ, at: Date = new Date()): number {
  return partsIn(tz, at).hour;
}

/**
 * The instant at which the wall clock in `tz` reads the given local time.
 *
 * Guess by treating the local time as UTC, correct by the offset at that
 * guess, then correct again in case the first correction crossed a DST
 * boundary. Away from a transition both passes agree and it is one answer.
 *
 * Near a transition they disagree and the candidates get checked by reading
 * the clock back:
 *  - Spring forward: 2:00 to 3:00 local does not exist, neither candidate
 *    reads back, so the later one wins and 2:30 becomes 3:30. Resolving
 *    backward instead would move a task to the day before, which is exactly
 *    the class of bug this module exists to kill.
 *  - Fall back: 1:00 to 2:00 local happens twice, both candidates read back,
 *    so the earlier one wins and the task fires on the first pass.
 *
 * Midnight and 9 AM are unambiguous in every US zone, so the app's own
 * scheduling never reaches these branches - but region timezones are data,
 * and someone will eventually set a region to a zone that transitions at a
 * different hour.
 */
export function zonedIso(
  ymd: string,
  hour: number,
  minute: number,
  tz: TimeZone = DEFAULT_TZ,
): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0);

  const first = naive - offsetMsAt(naive, tz);
  const second = naive - offsetMsAt(first, tz);
  if (first === second) return new Date(first).toISOString();

  const readsBack = (ts: number) => {
    const p = partsIn(tz, new Date(ts));
    return p.hour === hour && p.minute === minute && p.day === (d ?? 1);
  };
  const valid = [first, second].filter(readsBack);

  // None valid = a gap, take the later instant. Both valid = a repeat, take
  // the earlier one.
  const ts = valid.length === 0 ? Math.max(first, second) : Math.min(...valid);
  return new Date(ts).toISOString();
}

/** Local midnight in `tz`, as an ISO instant. */
export function dayStartUtc(ymd: string, tz: TimeZone = DEFAULT_TZ): string {
  return zonedIso(ymd, 0, 0, tz);
}

/** Half-open bounds for one local day: start <= t < end. */
export function dayBoundsUtc(
  ymd: string,
  tz: TimeZone = DEFAULT_TZ,
): { startIso: string; endIso: string } {
  return { startIso: dayStartUtc(ymd, tz), endIso: dayStartUtc(addDays(ymd, 1), tz) };
}

/** 9 AM local in `tz` on a given date - the slot scheduled tasks land on. */
export function morningIso(ymd: string, tz: TimeZone = DEFAULT_TZ, hour = 9): string {
  return zonedIso(ymd, hour, 0, tz);
}

/** Calendar arithmetic on YYYY-MM-DD. Zone-free by design. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const at = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((at(to) - at(from)) / DAY_MS);
}

export function formatDateIn(iso: string, tz: TimeZone = DEFAULT_TZ): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  });
}

export function formatTimeIn(iso: string, tz: TimeZone = DEFAULT_TZ): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/** Short label for a zone, for a region badge: "MST", "CDT". */
export function zoneAbbrev(tz: TimeZone = DEFAULT_TZ, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(at);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}
