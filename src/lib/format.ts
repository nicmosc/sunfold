/**
 * Timezone-aware formatting helpers.
 *
 * `Intl.DateTimeFormat` only — no date libraries, no extra dependencies.
 * Every date argument is nullable because sun events legitimately do not
 * occur at high latitudes; those render as an em dash.
 */

/** Rendered in place of a time that does not occur. */
export const EM_DASH = '—';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Builds a formatter that degrades to UTC instead of throwing when handed an
 * unknown IANA zone (stale persisted location, bad API payload).
 */
function createFormatter(options: Intl.DateTimeFormatOptions, locale = 'en-US'): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  }
}

function isValidDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function partsToRecord(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const part of parts) {
    record[part.type] = part.value;
  }
  return record;
}

/* -------------------------------------------------------------------------- */
/* Timezone primitives (shared with the sun domain module)                     */
/* -------------------------------------------------------------------------- */

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = partsToRecord(
    createFormatter({
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset of `timeZone` from UTC at `date`, in ms (positive east of Greenwich). */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Drop the ms component so the diff is a clean offset, never off by a fraction.
  return asUtc - Math.floor(date.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
}

/** Stable "YYYY-MM-DD" calendar-day key for an instant, in a given timezone. */
export function getZonedDayKey(date: Date, timeZone: string): string {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Local hour (0-23) of an instant in a given timezone. */
export function getZonedHour(date: Date, timeZone: string): number {
  return getZonedDateParts(date, timeZone).hour;
}

/**
 * The instant of 12:00 local time on the calendar day that `date` falls on in
 * `timeZone`. suncalc picks the solar day nearest the instant it is given, so
 * anchoring at local noon keeps a day's events stable no matter what timezone
 * the device itself is in.
 */
export function getZonedNoon(date: Date, timeZone: string): Date {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  const wallClockNoon = Date.UTC(year, month - 1, day, 12, 0, 0);

  // Two passes: the first offset is sampled at the wrong instant across a DST
  // boundary, the second is sampled at the candidate instant and settles it.
  const firstPass = wallClockNoon - getTimeZoneOffsetMs(date, timeZone);
  const offset = getTimeZoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(wallClockNoon - offset);
}

/* -------------------------------------------------------------------------- */
/* Public formatting API                                                       */
/* -------------------------------------------------------------------------- */

export interface FormattedTime {
  /** "6:08" — rendered large. */
  time: string;
  /** "AM" / "PM" — rendered small. Empty when the time does not exist. */
  period: string;
  /** "EDT" — timezone abbreviation. Empty when the time does not exist. */
  tz: string;
}

/**
 * Splits a time into its display parts so the UI can size them independently.
 * Never pre-concatenated: the hero renders `time` at 48pt and `period`/`tz` at 13pt.
 */
export function formatTime(date: Date | null | undefined, timeZone: string): FormattedTime {
  if (!isValidDate(date)) {
    return { time: EM_DASH, period: '', tz: '' };
  }

  const parts = partsToRecord(
    createFormatter({
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).formatToParts(date),
  );

  const hour = parts.hour ?? '';
  const minute = parts.minute ?? '00';

  return {
    time: `${hour}:${minute}`,
    period: (parts.dayPeriod ?? '').toUpperCase(),
    tz: parts.timeZoneName ?? '',
  };
}

/**
 * Compact human countdown: "45 sec", "12 min", "2 hr 5 min", "1 day 3 hr".
 * No leading zeros, no zero-valued trailing units.
 */
export function formatCountdown(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) {
    return EM_DASH;
  }
  if (ms <= 0) {
    return 'now';
  }

  if (ms < MS_PER_MINUTE) {
    const seconds = Math.max(1, Math.round(ms / MS_PER_SECOND));
    // 59.6s rounds to 60, which must read as "1 min", never "60 sec".
    return seconds < 60 ? `${seconds} sec` : '1 min';
  }

  if (ms < MS_PER_HOUR) {
    return `${Math.floor(ms / MS_PER_MINUTE)} min`;
  }

  if (ms < MS_PER_DAY) {
    const hours = Math.floor(ms / MS_PER_HOUR);
    const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
  }

  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const dayLabel = days === 1 ? 'day' : 'days';
  return hours === 0 ? `${days} ${dayLabel}` : `${days} ${dayLabel} ${hours} hr`;
}

export interface FormattedDuration {
  hours: number;
  minutes: number;
}

/** Splits a span into whole hours and minutes for "10 hr 45 min of daylight left". */
export function formatDuration(ms: number | null | undefined): FormattedDuration {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return { hours: 0, minutes: 0 };
  }

  return {
    hours: Math.floor(ms / MS_PER_HOUR),
    minutes: Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE),
  };
}

/**
 * Greeting based on the hour AT THE LOCATION, not on the device timezone —
 * `date.getHours()` would say "Good evening" in Singapore while the user is
 * looking at a New York sunrise.
 */
export function getGreeting(date: Date, timeZone: string): string {
  if (!isValidDate(date)) {
    return 'Hello';
  }

  const hour = getZonedHour(date, timeZone);
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * "Today" / "Tomorrow" / "Mon 3 Sep", relative to `now` in `timeZone`.
 *
 * `now` is injectable so this stays deterministic in tests; it defaults to the
 * wall clock because the label is inherently relative to the present moment.
 */
export function formatRelativeDay(
  date: Date | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): string {
  if (!isValidDate(date)) {
    return EM_DASH;
  }

  const target = getZonedDayKey(date, timeZone);
  if (target === getZonedDayKey(now, timeZone)) {
    return 'Today';
  }
  if (target === getZonedDayKey(new Date(now.getTime() + MS_PER_DAY), timeZone)) {
    return 'Tomorrow';
  }
  if (target === getZonedDayKey(new Date(now.getTime() - MS_PER_DAY), timeZone)) {
    return 'Yesterday';
  }

  const parts = partsToRecord(
    createFormatter(
      { timeZone, weekday: 'short', day: 'numeric', month: 'short' },
    ).formatToParts(date),
  );

  return `${parts.weekday} ${parts.day} ${parts.month}`;
}
