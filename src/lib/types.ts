/**
 * Domain types for the Golden Hour app.
 *
 * This module is pure data: no React, no react-native, no side effects.
 */

/** A geographic point plus the IANA timezone used to render its times. */
export interface Location {
  latitude: number;
  longitude: number;
  /** IANA timezone identifier, e.g. "America/New_York". */
  timeZone: string;
  /** Human readable place name shown in the UI, e.g. "New York". */
  name: string;
}

/**
 * Every discrete moment the UI can render, in chronological order over a day.
 *
 * Phases that span time (blue hour, golden hour) are represented as an explicit
 * start/end pair so the timeline can draw a band and the list can show a range.
 */
export type SunEventKey =
  | 'nadir'
  | 'firstLight'
  | 'blueHourMorningStart'
  | 'blueHourMorningEnd'
  | 'sunrise'
  | 'goldenHourMorningStart'
  | 'goldenHourMorningEnd'
  | 'solarNoon'
  | 'goldenHourEveningStart'
  | 'goldenHourEveningEnd'
  | 'sunset'
  | 'blueHourEveningStart'
  | 'blueHourEveningEnd'
  | 'lastLight';

/**
 * A single point in time on a given day.
 *
 * `date` is `null` when the event does not occur at this latitude/season
 * (polar day, polar night, or a twilight boundary the sun never reaches).
 * It is NEVER an Invalid Date — callers can safely render "—" for null.
 */
export interface SunEvent {
  key: SunEventKey;
  label: string;
  sublabel?: string;
  date: Date | null;
}

/** Sun altitude/azimuth at an instant, in degrees. */
export interface SunPosition {
  /** Degrees above the horizon. Negative means below. */
  altitude: number;
  /** Degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number;
}

export type MoonPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent';

export interface MoonInfo {
  /** Raw suncalc phase, 0 = new, 0.5 = full, →1 back to new. */
  phase: number;
  phaseName: MoonPhaseName;
  /** Illuminated fraction of the disc, 0..1. */
  illumination: number;
  /** Position angle of the bright limb, degrees. */
  angle: number;
  /** True while waxing (new → full), false while waning. */
  waxing: boolean;
  moonrise: Date | null;
  moonset: Date | null;
  /** Moon stays above the horizon for the whole day. */
  alwaysUp: boolean;
  /** Moon never rises on this day. */
  alwaysDown: boolean;
}

/** Everything needed to render one day's screen. */
export interface DaySummary {
  /** The instant the summary was computed for (the "day" it describes). */
  date: Date;
  location: Location;
  /** Chronological, nulls preserved so the UI can render placeholders. */
  events: SunEvent[];
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
  /** Sunset − sunrise in ms, or null when the sun does not rise/set. */
  dayLengthMs: number | null;
  /** Sun never sets on this day. */
  isPolarDay: boolean;
  /** Sun never rises on this day. */
  isPolarNight: boolean;
  moon: MoonInfo;
}

/** The next upcoming event, driving the hero countdown. */
export interface NextEvent {
  event: SunEvent;
  /** The event's time. Non-null by construction. */
  date: Date;
  /** Milliseconds from "now" until the event. Always >= 0. */
  msUntil: number;
  /** True when the event belongs to a later calendar day than "now". */
  isTomorrow: boolean;
}

/** Daylight budget for the "x hr y min of daylight left" display. */
export interface DaylightRemaining {
  /** Milliseconds of daylight left, 0 before sunrise and after sunset. */
  remainingMs: number;
  /** Total sunrise→sunset length in ms for the day. */
  totalMs: number;
  isBeforeSunrise: boolean;
  isAfterSunset: boolean;
  isPolarDay: boolean;
  isPolarNight: boolean;
}
