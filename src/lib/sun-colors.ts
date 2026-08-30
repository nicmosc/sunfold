import { PhaseAccents, SkyGradients, SunPhaseGradients } from '@/constants/theme';

import type { SunEventKey } from './types';

/** A top -> bottom gradient triple for the sun disc. */
export type SunGradientTriple = readonly [string, string, string];

/** A four-stop top -> bottom gradient for the page canvas. */
export type SkyGradientStops = readonly [string, string, string, string];

/**
 * Solar altitude, in degrees, at which each gradient takes over. Between two
 * stops the colours are interpolated, so the disc changes continuously rather
 * than snapping between phases.
 *
 * The boundaries are the real ones photographers use: golden hour is the sun
 * between 0 and 6 degrees, civil twilight down to -6.
 */
const ALTITUDE_STOPS: { altitude: number; gradient: SunGradientTriple }[] = [
  { altitude: -6, gradient: SunPhaseGradients.night },
  { altitude: 0, gradient: SunPhaseGradients.horizon },
  { altitude: 6, gradient: SunPhaseGradients.golden },
  { altitude: 25, gradient: SunPhaseGradients.mid },
  { altitude: 55, gradient: SunPhaseGradients.peak },
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function toHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, '0');
}

/** Linear RGB interpolation. Good enough across these narrow hue ranges. */
export function lerpColor(from: string, to: string, t: number): string {
  const ratio = clamp01(t);
  const [r1, g1, b1] = parseHex(from);
  const [r2, g2, b2] = parseHex(to);

  return `#${toHex(r1 + (r2 - r1) * ratio)}${toHex(g1 + (g2 - g1) * ratio)}${toHex(
    b1 + (b2 - b1) * ratio,
  )}`;
}

function lerpTriple(from: SunGradientTriple, to: SunGradientTriple, t: number): SunGradientTriple {
  return [lerpColor(from[0], to[0], t), lerpColor(from[1], to[1], t), lerpColor(from[2], to[2], t)];
}

/**
 * The sun disc's gradient for a given solar altitude.
 *
 * Deep violet below the horizon, red as it crosses it, warming through gold to
 * a pale yellow near solar noon. Clamped at both ends, so an altitude of -90 or
 * +90 is safe.
 */
export function getSunGradient(altitudeDegrees: number): SunGradientTriple {
  if (!Number.isFinite(altitudeDegrees)) {
    return SunPhaseGradients.golden;
  }

  const first = ALTITUDE_STOPS[0];
  const last = ALTITUDE_STOPS[ALTITUDE_STOPS.length - 1];

  if (altitudeDegrees <= first.altitude) return first.gradient;
  if (altitudeDegrees >= last.altitude) return last.gradient;

  for (let index = 0; index < ALTITUDE_STOPS.length - 1; index += 1) {
    const lower = ALTITUDE_STOPS[index];
    const upper = ALTITUDE_STOPS[index + 1];

    if (altitudeDegrees >= lower.altitude && altitudeDegrees <= upper.altitude) {
      const span = upper.altitude - lower.altitude;
      const t = span === 0 ? 0 : (altitudeDegrees - lower.altitude) / span;
      return lerpTriple(lower.gradient, upper.gradient, t);
    }
  }

  return SunPhaseGradients.golden;
}

/** Altitudes at which each sky takes over, blended in between. */
const SKY_STOPS: { altitude: number; gradient: SkyGradientStops }[] = [
  { altitude: -8, gradient: SkyGradients.night },
  { altitude: 0, gradient: SkyGradients.horizon },
  { altitude: 8, gradient: SkyGradients.golden },
  { altitude: 30, gradient: SkyGradients.day },
];

function lerpStops(from: SkyGradientStops, to: SkyGradientStops, t: number): SkyGradientStops {
  return [
    lerpColor(from[0], to[0], t),
    lerpColor(from[1], to[1], t),
    lerpColor(from[2], to[2], t),
    lerpColor(from[3], to[3], t),
  ];
}

/**
 * The page canvas for a given solar altitude: mauve at night, pink at the
 * horizon, warm gold through golden hour, and light blue in full daylight.
 *
 * Keyed on absolute altitude rather than a per-day ratio, unlike the sun's
 * vertical position — the sky's colour depends on how high the sun actually is,
 * not on how high it manages to get that particular day. A shallow winter noon
 * genuinely does stay pinker than a summer one.
 */
export function getSkyGradient(altitudeDegrees: number): SkyGradientStops {
  if (!Number.isFinite(altitudeDegrees)) {
    return SkyGradients.horizon;
  }

  const first = SKY_STOPS[0];
  const last = SKY_STOPS[SKY_STOPS.length - 1];

  if (altitudeDegrees <= first.altitude) return first.gradient;
  if (altitudeDegrees >= last.altitude) return last.gradient;

  for (let index = 0; index < SKY_STOPS.length - 1; index += 1) {
    const lower = SKY_STOPS[index];
    const upper = SKY_STOPS[index + 1];

    if (altitudeDegrees >= lower.altitude && altitudeDegrees <= upper.altitude) {
      const span = upper.altitude - lower.altitude;
      const t = span === 0 ? 0 : (altitudeDegrees - lower.altitude) / span;
      return lerpStops(lower.gradient, upper.gradient, t);
    }
  }

  return SkyGradients.horizon;
}

/**
 * Sun diameter for a given position in the day, largest at the horizon and
 * smallest at the day's peak — the same apparent swelling the sun has low in
 * the sky.
 *
 * Takes a ratio against the day's own peak rather than absolute degrees, so the
 * sun still visibly shrinks as it climbs on a day when it never gets high.
 */
export function getSunSize(altitudeRatio: number, atHorizon: number, atPeak: number): number {
  const t = clamp01(altitudeRatio);
  return atHorizon + (atPeak - atHorizon) * t;
}

/**
 * The accent colour for one event's time, so each phase of the day reads as its
 * own colour rather than everything sharing a single orange.
 */
const EVENT_ACCENTS: Record<SunEventKey, string> = {
  nadir: PhaseAccents.nadir,
  firstLight: PhaseAccents.astronomical,
  blueHourMorningStart: PhaseAccents.blueHour,
  blueHourMorningEnd: PhaseAccents.blueHour,
  sunrise: PhaseAccents.sunrise,
  goldenHourMorningStart: PhaseAccents.goldenHour,
  goldenHourMorningEnd: PhaseAccents.goldenHour,
  solarNoon: PhaseAccents.solarNoon,
  goldenHourEveningStart: PhaseAccents.goldenHour,
  goldenHourEveningEnd: PhaseAccents.goldenHour,
  sunset: PhaseAccents.sunset,
  blueHourEveningStart: PhaseAccents.blueHour,
  blueHourEveningEnd: PhaseAccents.blueHour,
  lastLight: PhaseAccents.astronomical,
};

export function getPhaseAccent(key: SunEventKey): string {
  return EVENT_ACCENTS[key];
}
