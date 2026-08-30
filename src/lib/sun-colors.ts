import { PhaseAccents, SunPhaseGradients } from '@/constants/theme';

import type { SunEventKey } from './types';

/** A top -> bottom gradient triple for the sun disc. */
export type SunGradientTriple = readonly [string, string, string];

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
