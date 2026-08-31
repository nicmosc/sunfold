import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * How far the crest rises above the dome's shoulders, as a fraction of width.
 * Shallow on purpose — the reference curve is a gentle swell, not a hill.
 */
const CREST_RATIO = 0.13;

export interface HorizonDomeProps {
  /** Full-bleed width. The dome should run edge to edge, past any padding. */
  width: number;
  /** Height of the drawn area below the crest. */
  height: number;
}

/**
 * The soft curved rise the greeting sits on, and the shape the sun sets behind.
 *
 * Drawn rather than composed from border radii: a `borderTopRadius` is clamped
 * to half the view's smaller side, so it yields rounded corners, never the wide
 * shallow arc the design calls for.
 *
 * The fill deliberately gets MORE opaque toward the bottom. The crest has to
 * stay translucent so the sun reads as sinking behind it, while the lower band
 * — where the greeting and countdown sit — needs to be solid enough to hold
 * text contrast whatever colour the sky is behind it.
 */
export function HorizonDome({ width, height }: HorizonDomeProps) {
  const rawId = useId();
  const gradientId = `horizon-dome-${rawId.replace(/:/g, '')}`;

  if (!Number.isFinite(width) || width <= 0 || height <= 0) {
    return null;
  }

  const crest = width * CREST_RATIO;
  const total = height + crest;

  /*
   * Quadratic curve from the left shoulder up over the crest to the right one,
   * then closed down the sides. The control point sits at twice the crest
   * height because a quadratic only reaches half way to its control.
   */
  const path = [
    `M 0 ${crest}`,
    `Q ${width / 2} ${-crest} ${width} ${crest}`,
    `L ${width} ${total}`,
    `L 0 ${total}`,
    'Z',
  ].join(' ');

  return (
    <Svg
      width={width}
      height={total}
      viewBox={`0 0 ${width} ${total}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={Colors.white} stopOpacity="0.42" />
          <Stop offset="0.35" stopColor={Colors.white} stopOpacity="0.68" />
          <Stop offset="1" stopColor={Colors.white} stopOpacity="0.86" />
        </LinearGradient>
      </Defs>
      <Path d={path} fill={`url(#${gradientId})`} />
    </Svg>
  );
}
