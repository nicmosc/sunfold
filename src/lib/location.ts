/**
 * Device-location helpers and the offline city catalogue.
 *
 * `expo-location` is imported as `ExpoLocation` because our own domain type is
 * also called `Location` — the alias keeps both usable in one file without
 * shadowing.
 *
 * Everything here is failure-tolerant: the GPS chip, the reverse geocoder and
 * the permission dialog can all fail or hang, and none of those may leave the
 * app without something to render.
 */

import * as ExpoLocation from 'expo-location';

import type { Location } from '@/lib/types';

/** How long we wait for a GPS fix before falling back to the last known one. */
const POSITION_TIMEOUT_MS = 10_000;

/** Coordinate precision used for identity/dedupe. ~11 m at the equator. */
const COORDINATE_PRECISION = 4;

export type LocationPermissionStatus = 'granted' | 'denied';

/**
 * Shown before permission is resolved and whenever it is denied, so the app is
 * never blank and never blocks on a dialog the user may ignore forever.
 */
export const DEFAULT_LOCATION: Location = {
  latitude: 40.7128,
  longitude: -74.006,
  timeZone: 'America/New_York',
  name: 'New York',
};

/**
 * The offline "add a city" catalogue.
 *
 * Hardcoded on purpose: this app ships with no backend and no geocoding key,
 * so the catalogue is data, not a network call. Coordinates are city centres
 * and timezones are IANA identifiers, both stored with the entry — a saved
 * remote city must never be rendered in the device's timezone.
 *
 * Deliberately spread across the latitude range so the sun-math edge cases are
 * reachable from the UI: Tromsø and Reykjavík exercise polar day/night and
 * hour-long golden hours, while Sydney, Cape Town and Rio invert the seasons.
 * Alphabetical, which is the order the picker renders.
 */
export const PRESET_CITIES: Location[] = [
  { name: 'Cape Town', latitude: -33.9249, longitude: 18.4241, timeZone: 'Africa/Johannesburg' },
  { name: 'Dubai', latitude: 25.2048, longitude: 55.2708, timeZone: 'Asia/Dubai' },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
  { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, timeZone: 'America/Los_Angeles' },
  { name: 'New York', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
  { name: 'Paris', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris' },
  { name: 'Reykjavík', latitude: 64.1466, longitude: -21.9426, timeZone: 'Atlantic/Reykjavik' },
  { name: 'Rio de Janeiro', latitude: -22.9068, longitude: -43.1729, timeZone: 'America/Sao_Paulo' },
  { name: 'Singapore', latitude: 1.3521, longitude: 103.8198, timeZone: 'Asia/Singapore' },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' },
  { name: 'Tromsø', latitude: 69.6492, longitude: 18.9553, timeZone: 'Europe/Oslo' },
];

/**
 * Stable identity for a place, rounded to ~11 m so two fixes of the same city
 * collapse to one entry. Shared by the saved-cities list so the dedupe rule
 * lives in exactly one place.
 */
export function getLocationKey(location: Pick<Location, 'latitude' | 'longitude'>): string {
  return `${location.latitude.toFixed(COORDINATE_PRECISION)},${location.longitude.toFixed(
    COORDINATE_PRECISION,
  )}`;
}

/**
 * Runtime shape check for a `Location` that came from disk.
 *
 * `getItem` returns an unchecked assertion, and persisted data outlives schema
 * changes, so anything read back from storage passes through here before the UI
 * is allowed to trust it. Rejects NaN/out-of-range coordinates and unusable
 * timezones — both of which would otherwise surface as `Invalid Date`.
 */
export function isLocation(value: unknown): value is Location {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { latitude, longitude, timeZone, name } = value as Partial<Record<keyof Location, unknown>>;

  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof name === 'string' &&
    name.length > 0 &&
    typeof timeZone === 'string' &&
    isValidTimeZone(timeZone)
  );
}

/** Rejects a persisted or geocoder-supplied zone that this runtime cannot use. */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The device's own IANA timezone.
 *
 * IMPORTANT: this is only correct for wherever the device physically is. It
 * must never be applied to a saved remote city — every `Location` carries its
 * own `timeZone`, and that stored value is the only correct one for rendering
 * that city's sun times. Using the device zone for a remote city is how you
 * end up showing a Tokyo sunrise on a New York clock.
 */
export function getDeviceTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(timeZone) ? timeZone : DEFAULT_LOCATION.timeZone;
  } catch {
    return DEFAULT_LOCATION.timeZone;
  }
}

/** Non-prompting permission check — safe to call on mount behind onboarding. */
export async function getLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const { granted } = await ExpoLocation.getForegroundPermissionsAsync();
    return granted ? 'granted' : 'denied';
  } catch (error) {
    console.warn('[location] permission check failed', error);
    return 'denied';
  }
}

/**
 * Prompts for foreground location. Resolves `denied` rather than throwing, and
 * on a second call after a denial iOS resolves immediately without re-showing
 * the dialog, so this is safe to call more than once.
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const { granted } = await ExpoLocation.requestForegroundPermissionsAsync();
    return granted ? 'granted' : 'denied';
  } catch (error) {
    console.warn('[location] permission request failed', error);
    return 'denied';
  }
}

/**
 * A GPS fix, or `null`.
 *
 * `getCurrentPositionAsync` can sit indoors for a very long time, so it races a
 * timeout and falls back to the cached OS fix — a slightly stale position is
 * far better UX than a spinner that never resolves.
 */
async function getPosition(): Promise<ExpoLocation.LocationObject | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS);
    });

    const position = await Promise.race([
      ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }),
      timeout,
    ]);

    if (position) {
      return position;
    }

    return await ExpoLocation.getLastKnownPositionAsync();
  } catch (error) {
    console.warn('[location] could not obtain a position', error);
    return null;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Best available display name for a fix: city, then region, then country.
 * A geocoder failure is not fatal — coordinates alone are enough to compute sun
 * times, so we degrade to a generic label instead of losing the whole location.
 */
async function resolvePlace(
  latitude: number,
  longitude: number,
): Promise<{ name: string; timeZone: string | null }> {
  try {
    const [address] = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    if (!address) {
      return { name: 'Current Location', timeZone: null };
    }

    return {
      name: address.city ?? address.region ?? address.country ?? 'Current Location',
      // iOS-only field, and the most authoritative zone we can get for a fix.
      timeZone: isValidTimeZone(address.timezone) ? address.timezone : null,
    };
  } catch (error) {
    console.warn('[location] reverse geocode failed', error);
    return { name: 'Current Location', timeZone: null };
  }
}

/**
 * Resolves the device's current position into a fully-formed `Location`.
 *
 * Returns `null` only when there is no position at all; callers fall back to
 * `DEFAULT_LOCATION`. Assumes permission has already been granted — it does not
 * prompt, so it can be called from a refresh handler without surprising the user.
 */
export async function getCurrentLocation(): Promise<Location | null> {
  const position = await getPosition();
  if (!position) {
    return null;
  }

  const { latitude, longitude } = position.coords;
  const place = await resolvePlace(latitude, longitude);

  return {
    latitude,
    longitude,
    name: place.name,
    // Prefer the zone the geocoder reports for these exact coordinates; the
    // device zone is the fallback and is only correct because this IS the
    // device's own position. Saved remote cities use their stored `timeZone`.
    timeZone: place.timeZone ?? getDeviceTimeZone(),
  };
}
