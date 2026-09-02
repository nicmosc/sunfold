/**
 * Whether a given tab is the one currently on screen.
 *
 * Derived from the router's public `usePathname` rather than react-navigation's
 * focus hooks, which expo-router only exposes at a deep build path
 * (`expo-router/build/react-navigation/core/useIsFocused`) that would break the
 * moment expo reorganises its build output.
 *
 * Used by `useScrollReset`. Tabs stay mounted between visits, so "am I the
 * visible one" is not something a screen otherwise knows.
 */

import { usePathname } from 'expo-router';

/** Tab paths, as `usePathname` reports them for the routes in `(tabs)/`. */
export const TAB_PATHS = ['/', '/timeline', '/cities'] as const;

export type TabPath = (typeof TAB_PATHS)[number];

export interface TabFocus {
  isFocused: boolean;
}

export function useTabFocus(tab: TabPath): TabFocus {
  const pathname = usePathname();

  /*
   * An unrecognised pathname — a route pushed on top of the tabs — must not
   * read as "no tab is focused", which would make every screen think it had
   * just been backgrounded. Treat it as no change: whoever was showing, stays
   * showing, and nothing resets its scroll behind the user's back.
   */
  if (!TAB_PATHS.includes(pathname as TabPath)) {
    return { isFocused: true };
  }

  return { isFocused: pathname === tab };
}
