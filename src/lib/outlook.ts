/**
 * Multi-day outlook: how the day drifts over the days ahead, and the notable
 * solar dates in the year ahead.
 *
 * Pure data: no React, no react-native, no side effects. Days are anchored to
 * LOCAL NOON at the location (see `getZonedNoon`) so a day's events stay correct
 * when the device's own timezone is hours away from the location's.
 *
 * Every date that may not occur is `Date | null` — never an Invalid Date, never
 * NaN. Above the Arctic Circle there is no sunrise in December, and the whole
 * module is written so that fact degrades into nulls rather than exceptions.
 */

import { formatDuration, formatTime, getZonedDayKey, getZonedNoon } from './format';
import { getDayEvents, getDaySummary, getSunPosition } from './sun';
import type { Location, SunEvent, SunEventKey } from './types';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const TWELVE_HOURS_MS = 12 * MS_PER_HOUR;

/**
 * 12 months plus a few days of slack, so every annual extreme (both solstices,
 * both equinoxes, both DST changes) falls inside the window exactly once.
 */
const SCAN_DAYS = 370;

/** Upper bound on `getOutlook`, so a bad `days` argument cannot spin the CPU. */
const OUTLOOK_MAX_DAYS = 400;

/** Emitted dates are limited to the 12 months following `from`. */
const NOTABLE_WINDOW_DAYS = 366;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface DayOutlook {
  /** Local noon at the location on this day — the anchor every time derives from. */
  date: Date;
  sunrise: Date | null;
  sunset: Date | null;
  goldenHourEveningStart: Date | null;
  goldenHourMorningEnd: Date | null;
  /** Sunset − sunrise in ms, or null when the sun does not rise/set. */
  dayLengthMs: number | null;
  /** Change in day length against the previous day; null if either is unknown. */
  deltaMs: number | null;
  /** Sun never sets on this day. */
  isPolarDay: boolean;
  /** Sun never rises on this day. */
  isPolarNight: boolean;
}

export type NotableKind =
  | 'equinox'
  | 'solstice'
  | 'earliestSunrise'
  | 'latestSunset'
  | 'earliestSunset'
  | 'latestSunrise'
  | 'dstChange';

export interface NotableDate {
  kind: NotableKind;
  /** e.g. "Autumn equinox", "Clocks go back", "Earliest sunrise". */
  label: string;
  date: Date;
  /** Short supporting detail, e.g. "12h 00m of daylight" or "clocks back 1 hour". */
  detail?: string;
}

/** One scanned day, before the day-over-day delta is known. */
type DayScan = Omit<DayOutlook, 'deltaMs'>;

/** Everything a single suncalc pass over one day yields. */
interface DayProbe {
  day: DayScan;
  /**
   * Solar noon. Always exists — even through a polar night — which is what makes
   * it the reliable instant to probe the sun's peak altitude at.
   */
  solarNoon: Date | null;
}

/** A probed day plus the zone offset that turns its events into clock times. */
interface ScannedDay extends DayProbe {
  /** Offset of the location's zone from UTC at local noon, in ms. */
  offsetMs: number;
}

/* -------------------------------------------------------------------------- */
/* Small numeric / date helpers                                                */
/* -------------------------------------------------------------------------- */

function isUsableDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function eventDate(events: SunEvent[], key: SunEventKey): Date | null {
  return events.find((e) => e.key === key)?.date ?? null;
}

/**
 * Offset of the location's zone from UTC at `noon`, in ms (positive east of
 * Greenwich). `noon` MUST already be a local-noon anchor.
 *
 * `format.ts` keeps its own offset helper private, so this derives the identical
 * number from what it does export: the anchor is 12:00 local by construction, so
 * the UTC instant of that same wall-clock reading minus the anchor IS the offset.
 * One `Intl` pass instead of the three a general-purpose version would cost.
 *
 * Noon is also the correct sample for DST detection: transitions land between
 * 01:00 and 03:00 local, so consecutive noons always straddle them.
 */
function zoneOffsetAtNoon(noon: Date, timeZone: string): number {
  const key = getZonedDayKey(noon, timeZone);
  const asUtc = Date.UTC(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
    12,
    0,
    0,
  );
  const offset = asUtc - noon.getTime();
  // getZonedDayKey always returns a padded YYYY-MM-DD, so this cannot fire — but
  // a NaN offset would poison every clock time downstream, so it is not assumed.
  return Number.isFinite(offset) ? offset : 0;
}

/**
 * Signed ms from the day's local-noon anchor to one of its events. Negative
 * before noon, positive after.
 *
 * This is the metric the clock extremes are ranked on, rather than the event's
 * wall-clock time of day. For any ordinary location the two are the same
 * ordering — the anchor IS 12:00 local, so this is just the clock reading minus
 * twelve hours — but it does not wrap at midnight, and midnight is exactly where
 * a naive clock comparison breaks: at the edge of a polar day the sun sets at
 * 00:02, and 00:02 is the LATEST a sunset can be, not the earliest of the year.
 */
function msFromNoon(event: Date, anchor: Date): number {
  return event.getTime() - anchor.getTime();
}

/**
 * `count` consecutive local-noon anchors, the first `offsetDays` from `from`.
 *
 * Every anchor is re-derived from the fixed base rather than accumulated from
 * the previous one: base + n·24h lands within an hour of local noon even across
 * a DST shift, so it always resolves to the intended calendar day and the
 * sequence cannot drift over a 370-day scan.
 */
function dayAnchors(from: Date, offsetDays: number, count: number, timeZone: string): Date[] {
  const base = getZonedNoon(from, timeZone).getTime();
  const anchors: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    anchors.push(getZonedNoon(new Date(base + (offsetDays + i) * MS_PER_DAY), timeZone));
  }
  return anchors;
}

/* -------------------------------------------------------------------------- */
/* Day scan                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One day's rise/set/golden-hour times plus its polar state.
 *
 * `getDaySummary` returns all of this already, but it costs four suncalc calls
 * per day — it recomputes the sun times and adds a full moon calculation — which
 * a 370-day scan cannot afford. `getDayEvents` gives the same times in one call,
 * and the summary is consulted only for the polar verdict on the rare days that
 * need it. Nothing here is reimplemented.
 */
function probeDay(anchor: Date, loc: Location): DayProbe {
  const events = getDayEvents(anchor, loc);
  const sunrise = eventDate(events, 'sunrise');
  const sunset = eventDate(events, 'sunset');
  const solarNoon = eventDate(events, 'solarNoon');

  let isPolarDay = false;
  let isPolarNight = false;

  if (sunrise === null && sunset === null) {
    /*
     * The sun never crossed the rise/set altitude, so it stayed on one side of
     * it all day — but WHICH side cannot be read off the sun's altitude. suncalc
     * decides rise/set against -0.833°, which folds in refraction and the solar
     * disc, while `getSunPosition` reports a bare geometric altitude; at the
     * boundary the two disagree by a few tenths of a degree. Tromsø on
     * 28 Nov 2026 is the case in point: suncalc reports polar night, yet the
     * geometric altitude at solar noon is -0.51°, *above* the threshold.
     *
     * So suncalc's own verdict is asked for. `getDaySummary` costs four suncalc
     * calls, but it is only reached on days already known to be polar — i.e.
     * never at all outside the Arctic and Antarctic circles.
     */
    const summary = getDaySummary(anchor, loc);
    isPolarDay = summary.isPolarDay;
    isPolarNight = summary.isPolarNight;
  }

  return {
    day: {
      date: anchor,
      sunrise,
      sunset,
      goldenHourEveningStart: eventDate(events, 'goldenHourEveningStart'),
      goldenHourMorningEnd: eventDate(events, 'goldenHourMorningEnd'),
      dayLengthMs:
        sunrise !== null && sunset !== null ? sunset.getTime() - sunrise.getTime() : null,
      isPolarDay,
      isPolarNight,
    },
    solarNoon,
  };
}

/**
 * Day length with the polar cases filled in — a full 24 h when the sun never
 * sets, none at all when it never rises — so the annual extremes still resolve
 * above the Arctic Circle, where `dayLengthMs` is null for months at a time.
 */
function effectiveDayLengthMs(day: DayScan): number | null {
  if (day.dayLengthMs !== null) {
    return day.dayLengthMs;
  }
  if (day.isPolarDay) {
    return MS_PER_DAY;
  }
  if (day.isPolarNight) {
    return 0;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Outlook                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `days` consecutive days starting at `from`, in chronological order.
 *
 * One day before `from` is scanned as well but not returned, so the first row
 * carries a real `deltaMs` instead of a null the UI would have to special-case.
 */
export function getOutlook(from: Date, days: number, loc: Location): DayOutlook[] {
  if (!isUsableDate(from) || !Number.isFinite(days)) {
    return [];
  }

  const count = Math.min(Math.max(0, Math.floor(days)), OUTLOOK_MAX_DAYS);
  if (count === 0) {
    return [];
  }

  const scanned = dayAnchors(from, -1, count + 1, loc.timeZone).map(
    (anchor) => probeDay(anchor, loc).day,
  );

  const outlook: DayOutlook[] = [];
  for (let i = 1; i < scanned.length; i += 1) {
    const day = scanned[i];
    const previousLength = scanned[i - 1].dayLengthMs;
    const length = day.dayLengthMs;
    outlook.push({
      ...day,
      deltaMs: length !== null && previousLength !== null ? length - previousLength : null,
    });
  }

  return outlook;
}

/* -------------------------------------------------------------------------- */
/* Notable dates                                                               */
/* -------------------------------------------------------------------------- */

function daylightDetail(dayLengthMs: number | null): string | undefined {
  if (dayLengthMs === null) {
    return undefined;
  }
  const { hours, minutes } = formatDuration(dayLengthMs);
  return `${hours}h ${String(minutes).padStart(2, '0')}m of daylight`;
}

/** "Longest day · 16h 42m of daylight", degrading gracefully at polar latitudes. */
function solsticeDetail(day: DayScan, superlative: string): string {
  if (day.isPolarDay) {
    return `${superlative} · sun never sets`;
  }
  if (day.isPolarNight) {
    return `${superlative} · sun never rises`;
  }
  const daylight = daylightDetail(day.dayLengthMs);
  return daylight === undefined ? superlative : `${superlative} · ${daylight}`;
}

/** "5:29 AM" — the clock reading, without the zone suffix `formatTime` adds. */
function clockDetail(date: Date, timeZone: string): string {
  const { time, period } = formatTime(date, timeZone);
  return period === '' ? time : `${time} ${period}`;
}

/**
 * Index of the day with the longest (`max`) or shortest (`min`) day.
 *
 * Ties are the polar case: inside a polar day every day is exactly 24 h, so day
 * length alone points at the first day of the plateau rather than the solstice.
 * The sun's peak altitude breaks the tie exactly, and is only computed for the
 * tied days — a handful of extra suncalc calls, none at all outside the Arctic.
 */
function extremeDayLengthIndex(
  scans: ScannedDay[],
  loc: Location,
  direction: 'max' | 'min',
): number | null {
  const sign = direction === 'max' ? 1 : -1;
  let best: number | null = null;
  let tied: number[] = [];

  for (let i = 0; i < scans.length; i += 1) {
    const length = effectiveDayLengthMs(scans[i].day);
    if (length === null) {
      continue;
    }
    if (best === null || sign * (length - best) > 0) {
      best = length;
      tied = [i];
    } else if (length === best) {
      tied.push(i);
    }
  }

  if (tied.length <= 1) {
    return tied[0] ?? null;
  }

  let bestIndex = tied[0];
  let bestAltitude: number | null = null;
  for (const index of tied) {
    const { solarNoon } = scans[index];
    if (solarNoon === null) {
      continue;
    }
    const { altitude } = getSunPosition(solarNoon, loc);
    if (!Number.isFinite(altitude)) {
      continue;
    }
    if (bestAltitude === null || sign * (altitude - bestAltitude) > 0) {
      bestAltitude = altitude;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/**
 * The longest and the shortest day.
 *
 * Labelled by what the day actually is, so the southern hemisphere comes out
 * right for free: Sydney's longest day is in December, and December is Sydney's
 * summer.
 */
function findSolstices(scans: ScannedDay[], loc: Location): NotableDate[] {
  const found: NotableDate[] = [];

  const longest = extremeDayLengthIndex(scans, loc, 'max');
  const shortest = extremeDayLengthIndex(scans, loc, 'min');

  if (longest !== null) {
    const { day } = scans[longest];
    found.push({
      kind: 'solstice',
      label: 'Summer solstice',
      date: day.date,
      detail: solsticeDetail(day, 'Longest day'),
    });
  }

  if (shortest !== null && shortest !== longest) {
    const { day } = scans[shortest];
    found.push({
      kind: 'solstice',
      label: 'Winter solstice',
      date: day.date,
      detail: solsticeDetail(day, 'Shortest day'),
    });
  }

  return found;
}

/**
 * Where day length crosses 12 h.
 *
 * Only real sunrise→sunset lengths are considered, so a polar latitude simply
 * yields nothing for the months it has no rise or set — and an equatorial
 * location, where refraction keeps the day just over 12 h all year and there is
 * no crossing at all, yields nothing rather than a bogus date.
 */
function findEquinoxes(scans: ScannedDay[]): NotableDate[] {
  const found: NotableDate[] = [];

  for (let i = 1; i < scans.length; i += 1) {
    const previous = scans[i - 1].day;
    const current = scans[i].day;
    if (previous.dayLengthMs === null || current.dayLengthMs === null) {
      continue;
    }

    const before = previous.dayLengthMs - TWELVE_HOURS_MS;
    const after = current.dayLengthMs - TWELVE_HOURS_MS;
    if (before === 0 || (before > 0) === (after > 0)) {
      continue;
    }

    // The crossing lies between the two days; attribute it to the closer one.
    const day = Math.abs(before) <= Math.abs(after) ? previous : current;
    found.push({
      kind: 'equinox',
      // Rising towards a long day is spring, falling towards a short one autumn.
      label: after > before ? 'Spring equinox' : 'Autumn equinox',
      date: day.date,
      detail: daylightDetail(day.dayLengthMs),
    });
  }

  return found;
}

/**
 * The extremes of the *clock* time of sunrise and sunset.
 *
 * These deliberately do not come from the solstices: the equation of time skews
 * solar noon against the clock, so the earliest sunrise runs days ahead of the
 * longest day and the earliest sunset weeks ahead of the shortest. That
 * asymmetry is the interesting part, so each is found independently.
 *
 * Readings are wall-clock times, DST included — that is what the user reads off
 * the phone, so a jump across a clock change is real and is kept. Ranking is by
 * `msFromNoon` so that midnight does not wrap; see that helper.
 */
function findClockExtremes(scans: ScannedDay[], timeZone: string): NotableDate[] {
  interface Extreme {
    index: number;
    fromNoon: number;
  }

  let earliestSunrise: Extreme | null = null;
  let latestSunrise: Extreme | null = null;
  let earliestSunset: Extreme | null = null;
  let latestSunset: Extreme | null = null;

  for (let i = 0; i < scans.length; i += 1) {
    const { day } = scans[i];

    if (day.sunrise !== null) {
      const fromNoon = msFromNoon(day.sunrise, day.date);
      if (earliestSunrise === null || fromNoon < earliestSunrise.fromNoon) {
        earliestSunrise = { index: i, fromNoon };
      }
      if (latestSunrise === null || fromNoon > latestSunrise.fromNoon) {
        latestSunrise = { index: i, fromNoon };
      }
    }

    if (day.sunset !== null) {
      const fromNoon = msFromNoon(day.sunset, day.date);
      if (earliestSunset === null || fromNoon < earliestSunset.fromNoon) {
        earliestSunset = { index: i, fromNoon };
      }
      if (latestSunset === null || fromNoon > latestSunset.fromNoon) {
        latestSunset = { index: i, fromNoon };
      }
    }
  }

  const rows: [NotableKind, string, Extreme | null, 'sunrise' | 'sunset'][] = [
    ['earliestSunrise', 'Earliest sunrise', earliestSunrise, 'sunrise'],
    ['latestSunrise', 'Latest sunrise', latestSunrise, 'sunrise'],
    ['earliestSunset', 'Earliest sunset', earliestSunset, 'sunset'],
    ['latestSunset', 'Latest sunset', latestSunset, 'sunset'],
  ];

  const found: NotableDate[] = [];
  for (const [kind, label, extreme, which] of rows) {
    if (extreme === null) {
      continue;
    }
    const { day } = scans[extreme.index];
    const moment = which === 'sunrise' ? day.sunrise : day.sunset;
    if (moment === null) {
      continue;
    }
    found.push({ kind, label, date: day.date, detail: clockDetail(moment, timeZone) });
  }

  return found;
}

/** "1 hour", "30 minutes" — the size of a clock change. */
function offsetAmount(deltaMs: number): string {
  const magnitude = Math.abs(deltaMs);
  const hours = Math.floor(magnitude / MS_PER_HOUR);
  const minutes = Math.round((magnitude % MS_PER_HOUR) / MS_PER_MINUTE);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }
  return parts.length === 0 ? 'no change' : parts.join(' ');
}

/** Days on which the location's UTC offset changes from the day before. */
function findDstChanges(scans: ScannedDay[]): NotableDate[] {
  const found: NotableDate[] = [];

  for (let i = 1; i < scans.length; i += 1) {
    const delta = scans[i].offsetMs - scans[i - 1].offsetMs;
    if (delta === 0) {
      continue;
    }
    const forward = delta > 0;
    found.push({
      kind: 'dstChange',
      label: forward ? 'Clocks go forward' : 'Clocks go back',
      date: scans[i].day.date,
      detail: `clocks ${forward ? 'forward' : 'back'} ${offsetAmount(delta)}`,
    });
  }

  return found;
}

/**
 * Notable dates in the 12 months following `from`, chronological.
 *
 * All of these are derived per-location by scanning, not read off a calendar:
 * the equation of time and the location's longitude within its timezone move
 * them by days, and the hemisphere swaps the solstices outright.
 *
 * PERFORMANCE: this scans ~370 days and runs one suncalc pass per day (plus a
 * handful more inside a polar day), so it costs a few hundred milliseconds.
 * It is a one-off, NOT a per-render call — memoize it on `[location]`.
 */
export function getNotableDates(from: Date, loc: Location): NotableDate[] {
  if (!isUsableDate(from)) {
    return [];
  }

  const scans: ScannedDay[] = dayAnchors(from, 0, SCAN_DAYS, loc.timeZone).map((anchor) => ({
    ...probeDay(anchor, loc),
    offsetMs: zoneOffsetAtNoon(anchor, loc.timeZone),
  }));

  const horizon = getZonedNoon(from, loc.timeZone).getTime() + NOTABLE_WINDOW_DAYS * MS_PER_DAY;

  return [
    ...findSolstices(scans, loc),
    ...findEquinoxes(scans),
    ...findClockExtremes(scans, loc.timeZone),
    ...findDstChanges(scans),
  ]
    .filter((notable) => notable.date.getTime() <= horizon)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
