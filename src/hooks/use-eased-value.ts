import { useEffect, useRef, useState } from 'react';

/** Below this the target counts as reached, so the loop never idles awake. */
const EPSILON = 0.001;
const DEFAULT_DURATION_MS = 520;

/** Cubic ease-out, matching the sun's transform easing. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Tweens a number toward `target` on the JS thread and returns the current value.
 *
 * Deliberately a JS tween rather than a Reanimated shared value. This exists to
 * animate things DERIVED from a number — gradient stop colours here — and those
 * derivations run in JS. Driving them from the UI thread would mean animating
 * SVG stop props and `LinearGradient` colours individually, and interpolating
 * every stop separately; easing the single input instead animates the sun's
 * gradient and the sky's together, in step, for free.
 *
 * The cost is a re-render per frame while a transition is in flight. That is
 * acceptable here because transitions are short and infrequent, and the screen
 * already re-renders every second for its countdown. Do not reach for this to
 * animate transforms — Reanimated does that without re-rendering at all.
 */
export function useEasedValue(target: number, duration = DEFAULT_DURATION_MS): number {
  const [value, setValue] = useState(target);
  /*
   * The live value, so a transition interrupted mid-flight resumes from where
   * it actually is rather than snapping back to the last committed state. Kept
   * in a ref so the effect does not have to depend on `value` — depending on it
   * would restart the tween on every frame it produces.
   */
  const currentRef = useRef(target);

  useEffect(() => {
    const from = currentRef.current;

    if (!Number.isFinite(target)) {
      return;
    }

    if (Math.abs(target - from) < EPSILON) {
      currentRef.current = target;
      return;
    }

    let frame: number;
    let startedAt: number | null = null;

    const tick = (now: number) => {
      startedAt ??= now;
      const elapsed = duration <= 0 ? 1 : (now - startedAt) / duration;
      const progress = Math.min(1, elapsed);
      const next = from + (target - from) * easeOutCubic(progress);

      currentRef.current = next;
      // Inside the frame callback, not the effect body — a synchronous setState
      // in an effect is what `react-hooks/set-state-in-effect` rejects.
      setValue(next);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
