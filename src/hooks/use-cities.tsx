/**
 * The user's saved cities, persisted to AsyncStorage.
 *
 * Loaded once on mount and written back on every mutation. State is mirrored in
 * a ref so each mutation derives the next list from the committed value rather
 * than from a possibly-stale closure — otherwise two taps in the same frame
 * would race and the second would persist the first's list.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { getLocationKey, isLocation } from '@/lib/location';
import { getItem, setItem, StorageKeys } from '@/lib/storage';
import type { Location } from '@/lib/types';

export interface UseCitiesResult {
  cities: Location[];
  /** Adds a city unless one already exists at the same rounded coordinates. */
  addCity: (city: Location) => boolean;
  removeCity: (city: Location) => void;
  /** Moves the entry at `from` to index `to`; out-of-range indices are ignored. */
  reorderCities: (from: number, to: number) => void;
  isLoading: boolean;
}

/**
 * Keeps the first entry for each rounded coordinate. Applied on read as well as
 * on write, so a list persisted by an older build cannot resurrect duplicates.
 */
function dedupe(cities: Location[]): Location[] {
  const seen = new Set<string>();
  return cities.filter((city) => {
    const key = getLocationKey(city);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * The underlying implementation. Private: consumers go through the context so
 * every screen observes ONE list. Called directly from two places, the Cities
 * tab and the location picker would each hold their own state, and a city added
 * in one would be invisible to the other until a reload.
 */
function useCitiesState(): UseCitiesResult {
  const [cities, setCities] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const citiesRef = useRef<Location[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // setState only after an await (`react-hooks/set-state-in-effect`).
    const load = async (): Promise<void> => {
      const stored = await getItem<unknown>(StorageKeys.SAVED_CITIES);
      if (cancelled || !mountedRef.current) {
        return;
      }

      // Anything that is not a well-formed Location is dropped rather than
      // rendered as NaN times: a corrupt entry costs one city, not the app.
      const restored = Array.isArray(stored) ? dedupe(stored.filter(isLocation)) : [];

      citiesRef.current = restored;
      setCities(restored);
      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Single write path: ref, state, and disk always move together. */
  const commit = useCallback((next: Location[]): void => {
    citiesRef.current = next;
    setCities(next);
    // `setItem` never throws; a failed write is logged and the in-memory list
    // stays authoritative for this session.
    void setItem(StorageKeys.SAVED_CITIES, next);
  }, []);

  const addCity = useCallback(
    (city: Location): boolean => {
      if (!isLocation(city)) {
        console.warn('[cities] refused to add a malformed city', city);
        return false;
      }

      const key = getLocationKey(city);
      if (citiesRef.current.some((existing) => getLocationKey(existing) === key)) {
        return false;
      }

      commit([...citiesRef.current, city]);
      return true;
    },
    [commit],
  );

  const removeCity = useCallback(
    (city: Location): void => {
      const key = getLocationKey(city);
      const next = citiesRef.current.filter((existing) => getLocationKey(existing) !== key);
      if (next.length !== citiesRef.current.length) {
        commit(next);
      }
    },
    [commit],
  );

  const reorderCities = useCallback(
    (from: number, to: number): void => {
      const current = citiesRef.current;
      const isValidIndex = (index: number): boolean =>
        Number.isInteger(index) && index >= 0 && index < current.length;

      if (from === to || !isValidIndex(from) || !isValidIndex(to)) {
        return;
      }

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      commit(next);
    },
    [commit],
  );

  return { cities, addCity, removeCity, reorderCities, isLoading };
}

const CitiesContext = createContext<UseCitiesResult | null>(null);

export function CitiesProvider({ children }: { children: ReactNode }) {
  const value = useCitiesState();
  return <CitiesContext.Provider value={value}>{children}</CitiesContext.Provider>;
}

export function useCities(): UseCitiesResult {
  const context = useContext(CitiesContext);
  if (!context) {
    throw new Error('useCities must be used within a CitiesProvider');
  }
  return context;
}
