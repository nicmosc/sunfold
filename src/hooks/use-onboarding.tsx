import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getItem, setItem, StorageKeys } from '@/lib/storage';

interface OnboardingContextValue {
  /** `null` while the persisted flag is still being read. */
  hasOnboarded: boolean | null;
  complete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/**
 * Owns the "has the user seen onboarding" flag.
 *
 * This lives in context rather than in the root layout's local state because
 * the onboarding screen — several levels down the router tree — is what
 * completes it, and expo-router gives us no way to pass a callback down to a
 * routed screen.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const seen = await getItem<boolean>(StorageKeys.ONBOARDING_COMPLETE);
      if (!cancelled) setHasOnboarded(seen === true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(async () => {
    // Flip the UI first so the transition is immediate; persistence is a
    // best-effort follow-up. Worst case the user sees onboarding once more.
    setHasOnboarded(true);
    await setItem(StorageKeys.ONBOARDING_COMPLETE, true);
  }, []);

  const value = useMemo(() => ({ hasOnboarded, complete }), [hasOnboarded, complete]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
