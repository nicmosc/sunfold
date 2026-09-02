/**
 * Device location, resolved for rendering.
 *
 * Startup strategy — first paint must never wait on GPS:
 *   1. read the last known location from disk and show it immediately,
 *   2. resolve permission,
 *   3. quietly swap in a fresh fix when one arrives, and persist it.
 *
 * `location` is only `null` for the very first tick before the cache read
 * settles; from then on it is always something renderable, falling back to
 * `DEFAULT_LOCATION` when permission is refused or the fix fails.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_LOCATION,
  getCurrentLocation,
  getLocationPermission,
  isLocation,
  requestLocationPermission,
  type LocationPermissionStatus,
} from '@/lib/location';
import { getItem, setItem, StorageKeys } from '@/lib/storage';
import type { Location } from '@/lib/types';

export type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied';

export interface UseLocationOptions {
  /**
   * Show the system permission dialog on mount. Pass `false` while onboarding
   * is on screen so the prompt is not fired behind it, then call `refresh()`
   * from the onboarding CTA to ask at a moment the user understands.
   */
  requestOnMount?: boolean;
}

export interface UseLocationResult {
  location: Location | null;
  status: LocationStatus;
  /** Human-readable reason the location is a fallback, else `null`. */
  error: string | null;
  /** Re-asks for permission (no-op after a hard denial) and re-fetches. */
  refresh: () => Promise<void>;
}

/*
 * Names no city on purpose. The denied branch below keeps a cached position if
 * there is one and only falls back to DEFAULT_LOCATION when there is not, so
 * this message cannot know which place is on screen — an earlier version said
 * "New York" and was wrong for anyone who granted access once and later revoked
 * it. Describing what is missing instead is true in both cases.
 *
 * It also stops at the diagnosis: both places that render it supply their own
 * next step (the home screen opens Settings, the picker is already the place
 * you choose a city from), so spelling one out here would duplicate them.
 */
const DENIED_MESSAGE = 'Location access is off, so times are not following you.';
const NO_FIX_MESSAGE = 'Could not get a location fix. Showing the last known position.';

export function useLocation({ requestOnMount = true }: UseLocationOptions = {}): UseLocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // expo-location promises routinely resolve after the screen is gone; every
  // setState below is gated on this.
  const mountedRef = useRef(true);
  // Monotonic token so a slow in-flight request can never clobber the result
  // of a newer one (mount race vs. a pull-to-refresh, for example).
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolvePermission = useCallback(
    async (permission: LocationPermissionStatus): Promise<void> => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isCurrent = (): boolean => mountedRef.current && requestIdRef.current === requestId;

      if (permission === 'denied') {
        if (isCurrent()) {
          setStatus('denied');
          setError(DENIED_MESSAGE);
          // Keep a cached position if we have one; otherwise never render blank.
          setLocation((current) => current ?? DEFAULT_LOCATION);
        }
        return;
      }

      const fresh = await getCurrentLocation();
      if (!isCurrent()) {
        return;
      }

      if (!fresh) {
        setStatus('granted');
        setError(NO_FIX_MESSAGE);
        setLocation((current) => current ?? DEFAULT_LOCATION);
        return;
      }

      setLocation(fresh);
      setStatus('granted');
      setError(null);
      // Fire-and-forget: `setItem` swallows its own failures, and a failed
      // write only costs us a slower cold start next launch.
      void setItem(StorageKeys.LAST_KNOWN_LOCATION, fresh);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    // Every setState happens after an await, never synchronously in the effect
    // body (`react-hooks/set-state-in-effect`).
    const bootstrap = async (): Promise<void> => {
      const cached = await getItem<unknown>(StorageKeys.LAST_KNOWN_LOCATION);
      if (cancelled || !mountedRef.current) {
        return;
      }

      if (isLocation(cached)) {
        setLocation(cached);
      }
      setStatus('loading');

      const permission = requestOnMount
        ? await requestLocationPermission()
        : await getLocationPermission();
      if (cancelled || !mountedRef.current) {
        return;
      }

      await resolvePermission(permission);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [requestOnMount, resolvePermission]);

  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading');
    const permission = await requestLocationPermission();
    if (!mountedRef.current) {
      return;
    }
    await resolvePermission(permission);
  }, [resolvePermission]);

  return { location, status, error, refresh };
}
