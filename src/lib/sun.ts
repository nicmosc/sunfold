import { getMoonIllumination, getMoonTimes, getPosition, getTimes } from 'suncalc';
import type { SunTimes } from 'suncalc';

import { getZonedDayKey, getZonedNoon } from './format';
import type {
  DaylightRemaining,
  DaySummary,
  Location,
  MoonInfo,
  MoonPhaseName,
  NextEvent,
  SunEvent,
  SunEventKey,
  SunPosition,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** How many days ahead `getNextEvent` will look before giving up. */
const NEXT_EVENT_SEARCH_DAYS = 7;

/**
 * Guards every date coming out of suncalc.
 *
 * suncalc 2.x reports a non-occurring event as `null`, but older builds (and the
 * still-published @types/suncalc@1.x contract) hand back an Invalid Date whose
 * `getTime()` is NaN. Both collapse to `null` here so an Invalid Date can never
 * reach the UI — callers render an em dash for null and nothing else.
 */
function toValidDate(value: Date | null | undefined): Date | null {
  if (!(value instanceof Date)) {
    return null;
  }
  return Number.isNaN(value.getTime()) ? null : value;
}

/**
 * suncalc resolves the solar day from the *UTC* day of the instant it is given,
 * so anchoring on local noon at the location keeps a day's events correct even
 * when the device's own timezone is hours away from the location's.
 */
function solarDayAnchor(date: Date, loc: Location): Date {
  return getZonedNoon(date, loc.timeZone);
}

function sunTimes(date: Date, loc: Location): SunTimes {
  return getTimes(solarDayAnchor(date, loc), loc.latitude, loc.longitude);
}

function event(key: SunEventKey, label: string, date: Date | null, sublabel?: string): SunEvent {
  return sublabel === undefined ? { key, label, date } : { key, label, sublabel, date };
}

/**
 * Every event the day screen renders, in chronological order.
 *
 * Nulls are preserved in place rather than filtered out: the UI renders the row
 * with an em dash, so a Tromsø user in December can see *which* events are gone.
 */
export function getDayEvents(date: Date, loc: Location): SunEvent[] {
  const t = sunTimes(date, loc);

  const sunrise = toValidDate(t.sunrise);
  const sunset = toValidDate(t.sunset);

  /*
   * GOLDEN HOUR NAMING — do not "fix" this.
   *
   * suncalc names these for the sun's altitude, not the time of day, which reads
   * backwards:
   *   - `goldenHourEnd` is the END of the MORNING golden hour (sun climbs past 6°).
   *   - `goldenHour`    is the START of the EVENING golden hour (sun drops below 6°).
   *
   * So: morning golden hour = sunrise → goldenHourEnd
   *     evening golden hour = goldenHour → sunset
   */
  const goldenHourMorningEnd = toValidDate(t.goldenHourEnd);
  const goldenHourEveningStart = toValidDate(t.goldenHour);

  /*
   * BLUE HOUR is not a suncalc primitive; it is derived from the twilight bands.
   *   Morning blue hour = nauticalDawn → dawn (civil)
   *   Evening blue hour = dusk (civil)  → nauticalDusk
   */
  const blueHourMorningStart = toValidDate(t.nauticalDawn);
  const blueHourMorningEnd = toValidDate(t.dawn);
  const blueHourEveningStart = toValidDate(t.dusk);
  const blueHourEveningEnd = toValidDate(t.nauticalDusk);

  return [
    event('nadir', 'Nadir', toValidDate(t.nadir), 'Darkest point'),
    event('firstLight', 'First light', toValidDate(t.nightEnd), 'Astronomical dawn'),
    event('blueHourMorningStart', 'Blue hour', blueHourMorningStart, 'Morning · starts'),
    event('blueHourMorningEnd', 'Blue hour', blueHourMorningEnd, 'Morning · ends · civil dawn'),
    event('sunrise', 'Sunrise', sunrise),
    event('goldenHourMorningStart', 'Golden hour', sunrise, 'Morning · starts'),
    event('goldenHourMorningEnd', 'Golden hour', goldenHourMorningEnd, 'Morning · ends'),
    event('solarNoon', 'Solar noon', toValidDate(t.solarNoon), 'Sun at its highest'),
    event('goldenHourEveningStart', 'Golden hour', goldenHourEveningStart, 'Evening · starts'),
    event('goldenHourEveningEnd', 'Golden hour', sunset, 'Evening · ends'),
    event('sunset', 'Sunset', sunset),
    event('blueHourEveningStart', 'Blue hour', blueHourEveningStart, 'Evening · starts · civil dusk'),
    event('blueHourEveningEnd', 'Blue hour', blueHourEveningEnd, 'Evening · ends'),
    event('lastLight', 'Last light', toValidDate(t.night), 'Astronomical dusk'),
  ];
}

/**
 * Sun altitude and compass azimuth in degrees.
 *
 * suncalc 2.x already returns degrees with a north-based clockwise azimuth
 * (0 = N, 90 = E), so this is a pass-through — no radian conversion, which is
 * what the 1.x API required.
 */
export function getSunPosition(date: Date, loc: Location): SunPosition {
  const { altitude, azimuth } = getPosition(date, loc.latitude, loc.longitude);
  return { altitude, azimuth };
}

/** Eight equal buckets, each centred on its named phase. */
function phaseName(phase: number): MoonPhaseName {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.0625 || p >= 0.9375) return 'New Moon';
  if (p < 0.1875) return 'Waxing Crescent';
  if (p < 0.3125) return 'First Quarter';
  if (p < 0.4375) return 'Waxing Gibbous';
  if (p < 0.5625) return 'Full Moon';
  if (p < 0.6875) return 'Waning Gibbous';
  if (p < 0.8125) return 'Last Quarter';
  return 'Waning Crescent';
}

export function getMoonInfo(date: Date, loc: Location): MoonInfo {
  const anchor = solarDayAnchor(date, loc);
  const { fraction, phase, angle, waxing } = getMoonIllumination(anchor);
  // The moon can skip a rise or a set on a given day; those keys are then absent.
  const times = getMoonTimes(anchor, loc.latitude, loc.longitude);

  return {
    phase,
    phaseName: phaseName(phase),
    illumination: fraction,
    angle,
    waxing,
    moonrise: toValidDate(times.rise),
    moonset: toValidDate(times.set),
    alwaysUp: times.alwaysUp === true,
    alwaysDown: times.alwaysDown === true,
  };
}

/**
 * Polar day (sun never sets) / polar night (sun never rises).
 * suncalc sets these flags itself whenever the sun misses the rise/set altitude.
 */
function getPolarState(t: SunTimes): { isPolarDay: boolean; isPolarNight: boolean } {
  return { isPolarDay: t.alwaysUp === true, isPolarNight: t.alwaysDown === true };
}

/** Everything one day screen needs, computed in a single pass. */
export function getDaySummary(date: Date, loc: Location): DaySummary {
  const t = sunTimes(date, loc);
  const sunrise = toValidDate(t.sunrise);
  const sunset = toValidDate(t.sunset);
  const { isPolarDay, isPolarNight } = getPolarState(t);

  return {
    date,
    location: loc,
    events: getDayEvents(date, loc),
    sunrise,
    sunset,
    solarNoon: toValidDate(t.solarNoon),
    dayLengthMs: sunrise && sunset ? sunset.getTime() - sunrise.getTime() : null,
    isPolarDay,
    isPolarNight,
    moon: getMoonInfo(date, loc),
  };
}

/**
 * The next event after `now`, rolling into following days once today's are
 * exhausted. Null events are skipped; solar noon and nadir always exist, so this
 * returns a result at every latitude — polar night included.
 */
export function getNextEvent(now: Date, loc: Location): NextEvent | null {
  const nowMs = now.getTime();
  const todayKey = getZonedDayKey(now, loc.timeZone);

  for (let dayOffset = 0; dayOffset <= NEXT_EVENT_SEARCH_DAYS; dayOffset += 1) {
    const [next] = getDayEvents(new Date(nowMs + dayOffset * MS_PER_DAY), loc)
      .filter((e): e is SunEvent & { date: Date } => e.date !== null && e.date.getTime() > nowMs)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (next !== undefined) {
      return {
        event: next,
        date: next.date,
        msUntil: next.date.getTime() - nowMs,
        isTomorrow: getZonedDayKey(next.date, loc.timeZone) !== todayKey,
      };
    }
  }

  return null;
}

/**
 * Daylight left today: zero before sunrise and after sunset, a full 24 h during
 * a polar day and none during a polar night.
 */
export function getDaylightRemaining(now: Date, loc: Location): DaylightRemaining {
  const t = sunTimes(now, loc);
  const sunrise = toValidDate(t.sunrise);
  const sunset = toValidDate(t.sunset);
  const { isPolarDay, isPolarNight } = getPolarState(t);

  if (sunrise === null || sunset === null) {
    const span = isPolarDay ? MS_PER_DAY : 0;
    return {
      remainingMs: span,
      totalMs: span,
      isBeforeSunrise: false,
      isAfterSunset: false,
      isPolarDay,
      isPolarNight,
    };
  }

  const nowMs = now.getTime();
  const sunriseMs = sunrise.getTime();
  const sunsetMs = sunset.getTime();

  const isBeforeSunrise = nowMs < sunriseMs;
  const isAfterSunset = nowMs > sunsetMs;

  return {
    remainingMs: isBeforeSunrise || isAfterSunset ? 0 : sunsetMs - nowMs,
    totalMs: Math.max(0, sunsetMs - sunriseMs),
    isBeforeSunrise,
    isAfterSunset,
    isPolarDay: false,
    isPolarNight: false,
  };
}

/**
 * Position of `now` between sunrise and sunset as 0..1, clamped outside that
 * range, for the timeline scrubber. Falls back to the civil twilight band and
 * then to a nadir-anchored 24 h window when the sun does not rise or set.
 */
export function getDayProgress(now: Date, loc: Location): number {
  const t = sunTimes(now, loc);
  const nadir = toValidDate(t.nadir);

  const spans: [Date | null, Date | null][] = [
    [toValidDate(t.sunrise), toValidDate(t.sunset)],
    [toValidDate(t.dawn), toValidDate(t.dusk)],
    [nadir, nadir === null ? null : new Date(nadir.getTime() + MS_PER_DAY)],
  ];

  for (const [start, end] of spans) {
    if (start === null || end === null) {
      continue;
    }
    const span = end.getTime() - start.getTime();
    if (span <= 0) {
      continue;
    }
    return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / span));
  }

  return 0;
}
