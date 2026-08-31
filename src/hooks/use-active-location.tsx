import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useCities } from '@/hooks/use-cities';
import { useLocation } from '@/hooks/use-location';
import { DEFAULT_LOCATION, getLocationKey, isLocation } from '@/lib/location';
import { getItem, removeItem, setItem, StorageKeys } from '@/lib/storage';
import type { Location } from '@/lib/types';

interface ActiveLocationContextValue {
  /** The location every screen should display. Never null after the first tick. */
  location: Location;
  /** True when `location` is the device's own position rather than a saved city. */
  isDeviceLocation: boolean;
  /** The device's position, for offering "use my location" in a picker. */
  deviceLocation: Location | null;
  /** Human-readable reason the device position is a fallback, else null. */
  deviceError: string | null;
  /** Pin a specific city. */
  setLocation: (location: Location) => Promise<void>;
  /** Go back to following the device. */
  followDevice: () => Promise<void>;
  /** Re-ask for permission and re-fetch the device position. */
  refreshDevice: () => Promise<void>;
}

const ActiveLocationContext = createContext<ActiveLocationContextValue | null>(null);

/**
 * Which location the app is currently showing.
 *
 * Separate from `useLocation`, which only ever reports where the *device* is.
 * This adds the user's choice on top: pinning a saved city has to outrank the
 * GPS fix, and it has to persist, but the device position must stay available
 * so the picker can offer to go back to it.
 */
export function ActiveLocationProvider({ children }: { children: ReactNode }) {
  const { location: deviceLocation, error: deviceError, refresh } = useLocation();
  const { cities, isLoading: citiesLoading } = useCities();
  const [pinned, setPinned] = useState<Location | null>(null);

  const citiesLoaded = !citiesLoading;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const stored = await getItem<Location>(StorageKeys.ACTIVE_LOCATION);
      if (cancelled) return;
      // Guard the read: a corrupt entry costs the pin, not app startup.
      setPinned(isLocation(stored) ? stored : null);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocation = useCallback(async (next: Location) => {
    setPinned(next);
    await setItem(StorageKeys.ACTIVE_LOCATION, next);
  }, []);

  const followDevice = useCallback(async () => {
    setPinned(null);
    await removeItem(StorageKeys.ACTIVE_LOCATION);
  }, []);

  const value = useMemo<ActiveLocationContextValue>(() => {
    /*
     * A pin whose city has been deleted must stop driving the app. Resolved by
     * DERIVING rather than by clearing the pin in an effect: an effect would
     * both trip `react-hooks/set-state-in-effect` and render one frame of the
     * removed city before correcting itself.
     *
     * Gated on `citiesLoaded` — the saved list arrives from disk a tick after
     * mount, and treating a perfectly good pin as stale during that window
     * would flicker to the device location and back on every launch.
     */
    const isStalePin =
      pinned !== null &&
      citiesLoaded &&
      !cities.some((city) => getLocationKey(city) === getLocationKey(pinned));

    const activePin = isStalePin ? null : pinned;

    /*
     * Precedence: a live pin, the device, the first remaining saved city, then
     * New York. The saved-city step is what catches deleting the active city
     * while location permission is denied — without it the app would jump to
     * New York even though the user has other cities saved.
     */
    const resolved = activePin ?? deviceLocation ?? cities[0] ?? DEFAULT_LOCATION;
    const isDevice =
      activePin === null &&
      deviceLocation !== null &&
      getLocationKey(resolved) === getLocationKey(deviceLocation);

    return {
      location: resolved,
      isDeviceLocation: isDevice,
      deviceLocation,
      deviceError,
      setLocation,
      followDevice,
      refreshDevice: refresh,
    };
  }, [
    pinned,
    cities,
    citiesLoaded,
    deviceLocation,
    deviceError,
    setLocation,
    followDevice,
    refresh,
  ]);

  return <ActiveLocationContext.Provider value={value}>{children}</ActiveLocationContext.Provider>;
}

export function useActiveLocation(): ActiveLocationContextValue {
  const context = useContext(ActiveLocationContext);
  if (!context) {
    throw new Error('useActiveLocation must be used within an ActiveLocationProvider');
  }
  return context;
}
