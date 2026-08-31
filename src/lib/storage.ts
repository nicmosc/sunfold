/**
 * Typed, crash-proof wrapper over AsyncStorage.
 *
 * Contract: this module NEVER throws. A corrupted, truncated, or
 * schema-drifted value must not be able to take down app startup — every
 * failure path logs and degrades to `null` / a no-op. Callers therefore only
 * ever branch on "did I get a value or not", never on try/catch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Every key this app persists. Centralised so a rename is a single edit and a
 * typo is a compile error rather than a silently-empty read.
 */
export const StorageKeys = {
  SAVED_CITIES: 'goldenhour:saved-cities',
  ONBOARDING_COMPLETE: 'goldenhour:onboarding-complete',
  LAST_KNOWN_LOCATION: 'goldenhour:last-known-location',
  SETTINGS: 'goldenhour:settings',
  ACTIVE_LOCATION: 'goldenhour:active-location',
} as const;

/** Union of the concrete key strings, so callers cannot invent new ones. */
export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/**
 * Reads and JSON-parses a value.
 *
 * Returns `null` for: missing key, unreadable store, and unparseable payload.
 * The caller cannot distinguish these cases by design — in every one of them
 * the correct behaviour is "fall back to a default".
 *
 * NOTE: the `T` here is an unchecked assertion, not a validation. Persisted
 * data can outlive a schema change, so consumers that care (see `useCities`)
 * re-validate the parsed shape before trusting it.
 */
export async function getItem<T>(key: StorageKey): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    // Corrupted or unreadable: log, forget, carry on with defaults.
    console.warn(`[storage] failed to read "${key}"`, error);
    return null;
  }
}

/**
 * JSON-serialises and writes a value. Resolves `true` when the write landed,
 * `false` when it failed — so a caller that must reflect persistence in the UI
 * can, while a fire-and-forget caller can simply ignore the result.
 */
export async function setItem<T>(key: StorageKey, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Disk full, quota, or a value containing a circular reference.
    console.warn(`[storage] failed to write "${key}"`, error);
    return false;
  }
}

/** Deletes a key. Resolves `true` when the key is definitely gone. */
export async function removeItem(key: StorageKey): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] failed to remove "${key}"`, error);
    return false;
  }
}
