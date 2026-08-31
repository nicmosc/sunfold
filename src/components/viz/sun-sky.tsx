import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { SunDisc } from './sun-disc';

/** Clear of the top edge so the disc never crops at solar noon. */
const TOP_MARGIN = 6;
/** How far the sun's centre sits above the horizon line at altitude 0. */
const HORIZON_LIFT = 10;
/**
 * How far below the horizon the sun is allowed to sink, as a fraction of the
 * sky's height. Deep enough to disappear behind the text, shallow enough that
 * it is still visibly *about* to rise.
 */
const MAX_DIP = 0.42;
/**
 * Half the horizontal travel, as a fraction of width. The sun tracks left to
 * right across the middle ~56% rather than the full width, so it stays clear of
 * the screen edges at both ends of the day.
 */
const ARC_HALF_WIDTH = 0.28;

/**
 * Long enough to read as the sun drifting rather than teleporting, short enough
 * that dragging the scrubber still feels directly connected to the handle.
 * `Easing.out` so it decelerates into place instead of stopping dead.
 */
const MOTION = { duration: 520, easing: Easing.out(Easing.cubic) } as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface SunSkyProps {
  /** Available width in points. */
  width: number;
  /** Height of the sky band, measured down to the horizon line. */
  height: number;
  /** Target diameter. Animated via scale, not by re-rendering the SVG. */
  size: number;
  /**
   * The largest diameter `size` will ever take. The disc is rendered once at
   * this size and scaled down, so changing `size` costs a transform rather than
   * an SVG re-render and a layout pass.
   */
  baseSize: number;
  /** Current solar altitude in degrees. Negative means below the horizon. */
  altitude: number;
  /** The day's maximum altitude (altitude at solar noon), in degrees. */
  peakAltitude: number;
  /** Day progress, 0 at sunrise to 1 at sunset, driving horizontal travel. */
  progress: number;
  /** Sun gradient, normally from `getSunGradient(altitude)`. */
  gradient?: readonly [string, string, string];
}

/**
 * Places the sun in the sky by its real position: horizontal travel follows the
 * day's progress, vertical follows solar altitude normalised against the day's
 * own peak.
 *
 * Normalising against the day's peak rather than a fixed 90 degrees is what
 * makes this work everywhere — a December day in Tromsø peaks a couple of
 * degrees above the horizon, and against an absolute scale the sun would never
 * visibly leave the ground.
 *
 * The disc deliberately overflows the bottom of this view so that at and below
 * the horizon it passes behind whatever is rendered next in the parent.
 */
export function SunSky({
  width,
  height,
  size,
  baseSize,
  altitude,
  peakAltitude,
  progress,
  gradient,
}: SunSkyProps) {
  const radius = size / 2;
  const topY = radius + TOP_MARGIN;
  const horizonY = Math.max(topY, height - HORIZON_LIFT);

  // A polar-night day has a negative peak; treat it as "never rises".
  const normalised = peakAltitude > 0 ? clamp(altitude / peakAltitude, -MAX_DIP, 1) : -MAX_DIP;

  const centerY = horizonY - normalised * (horizonY - topY);
  const centerX = width / 2 + (clamp(progress, 0, 1) - 0.5) * 2 * (width * ARC_HALF_WIDTH);

  const scale = baseSize > 0 ? clamp(size / baseSize, 0.1, 1) : 1;

  /*
   * Transform-only, so the whole thing runs on the UI thread with no layout
   * pass. `withTiming` inside `useAnimatedStyle` animates whenever the captured
   * JS value changes, which avoids the shared-value-mutated-in-an-effect
   * pattern that React Compiler's hooks lint rejects.
   *
   * Translate before scale: scaling happens about the element's own centre, so
   * the centre stays put at (centerX, centerY) as the disc grows and shrinks.
   */
  const discStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(centerX - baseSize / 2, MOTION) },
      { translateY: withTiming(centerY - baseSize / 2, MOTION) },
      { scale: withTiming(scale, MOTION) },
    ],
  }));

  if (!Number.isFinite(width) || width <= 0 || baseSize <= 0) {
    return null;
  }

  return (
    <View
      style={[styles.sky, { width, height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.disc, { width: baseSize, height: baseSize }, discStyle]}>
        {/* The horizon is drawn by the scrim in the parent, not by the disc. */}
        <SunDisc size={baseSize} showHorizon={false} gradient={gradient} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: {
    // No overflow: 'hidden' — the disc must be able to sink past the bottom
    // edge and slide behind the content that follows it.
    position: 'relative',
  },
  disc: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
