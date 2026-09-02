/**
 * Sends a tab's list back to the top when you return to it.
 *
 * TIMING IS THE WHOLE TRICK. Resetting on blur would jump the content while
 * the screen is still animating out, which reads as a flinch. Resetting on
 * FOCUS is free instead: the navigator's 'shift' transition brings a screen in
 * from opacity 0, so the jump lands in a frame nobody can see.
 *
 * Screens stay mounted between visits, so without this a tab reopens wherever
 * it was left — halfway down a table, with the header scrolled away.
 */

import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * The two scroll APIs in this app: `ScrollView` (Home, Timeline) and
 * `FlatList` (Cities) spell the same operation differently.
 */
export interface Scrollable {
  scrollTo?: (options: { y: number; animated: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated: boolean }) => void;
}

export function useScrollReset(ref: RefObject<Scrollable | null>, isFocused: boolean): void {
  const wasFocused = useRef(isFocused);

  /*
   * A layout effect, not a passive one: this has to land in the same frame the
   * screen becomes focused, before anything is drawn. A `useEffect` runs after
   * paint, which is exactly one visible frame too late.
   */
  useLayoutEffect(() => {
    const gainedFocus = isFocused && !wasFocused.current;
    wasFocused.current = isFocused;

    if (!gainedFocus) {
      return;
    }

    const target = ref.current;
    // `animated: false` on purpose — this is meant to be invisible, and an
    // animated scroll would still be running once the screen is opaque.
    target?.scrollTo?.({ y: 0, animated: false });
    target?.scrollToOffset?.({ offset: 0, animated: false });
  }, [isFocused, ref]);
}
