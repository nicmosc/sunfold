import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getDeviceUses12Hour } from '@/lib/format';
import { getItem, setItem, StorageKeys } from '@/lib/storage';

export interface Settings {
  /** 12-hour clock with AM/PM, versus 24-hour. */
  hour12: boolean;
  /** Show the twilight rows (first light, blue hour, last light) on Home. */
  showTwilight: boolean;
}

/**
 * Defaults follow the device where there is a sensible signal to follow. A
 * Belgian user expects 20:30 and should not have to find a setting first.
 */
function defaultSettings(): Settings {
  return { hour12: getDeviceUses12Hour(), showTwilight: true };
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  /** False until the persisted value has been read. */
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const stored = await getItem<Partial<Settings>>(StorageKeys.SETTINGS);
      if (cancelled) return;

      /*
       * Merged over the defaults rather than replacing them, so a value added
       * in a later version is populated instead of arriving as undefined for
       * everyone who already has settings on disk.
       */
      setSettings((current) => ({ ...current, ...(stored ?? {}) }));
      setIsLoaded(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    let merged: Settings | null = null;

    setSettings((current) => {
      merged = { ...current, ...patch };
      return merged;
    });

    if (merged !== null) {
      await setItem(StorageKeys.SETTINGS, merged);
    }
  }, []);

  const value = useMemo(() => ({ settings, update, isLoaded }), [settings, update, isLoaded]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
