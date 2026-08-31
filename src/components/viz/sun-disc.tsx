import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { Colors, SunGradient } from '@/constants/theme';

/**
 * All geometry below is expressed in a normalised 100x100 user space and scaled
 * to `size` by the viewBox, so a single set of ratios drives every render size.
 * These are intrinsic proportions of the drawing, not layout spacing — spacing
 * and colour still come from the theme tokens.
 */
const VIEW_BOX = 100;
const SUN_CENTER = VIEW_BOX / 2;
const SUN_RADIUS = 26;
const GLOW_RADIUS = 48;

/**
 * The horizon the sun rises out of: a wide, soft ellipse whose upper edge sits
 * across the sun's lower third. Kept just inside the viewBox on every axis so
 * nothing clips — the radial fade does the rest.
 */
const HORIZON_CENTER_Y = 88;
const HORIZON_RX = 46;
const HORIZON_RY = 30;

export interface SunDiscProps {
  /** Rendered width and height in points. */
  size: number;
  /** Draw the soft horizon the sun rises out of. Defaults to `true`. */
  showHorizon?: boolean;
  /**
   * Top -> bottom gradient triple. Pass the output of `getSunGradient(altitude)`
   * to make the disc reflect the sun's real position — deep red at the horizon,
   * pale yellow at noon. Defaults to the static brand gradient.
   */
  gradient?: readonly [string, string, string];
}

/**
 * The app's sun motif: a gradient disc blooming behind a soft horizon curve.
 *
 * Purely decorative — it carries no information a screen reader needs, so the
 * whole subtree is hidden from the accessibility layer.
 */
export function SunDisc({ size, showHorizon = true, gradient = SunGradient }: SunDiscProps) {
  // `useId` emits colons, which are not valid inside an SVG url(#...) reference.
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const sunId = `sun-disc-fill-${uid}`;
  const sheenId = `sun-disc-sheen-${uid}`;
  const rimId = `sun-disc-rim-${uid}`;
  const topLightId = `sun-disc-toplight-${uid}`;
  const glowId = `sun-disc-glow-${uid}`;
  const horizonId = `sun-disc-horizon-${uid}`;

  // Width can be 0 or NaN before layout; a zero-size viewBox blanks the view.
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}>
        <Defs>
          {/*
            Radial rather than linear, with the centre pushed up and left. A
            linear top-to-bottom ramp reads as a flat disc; offsetting a radial
            one puts the light source above the sphere and lets the terminator
            curve around the lower edge, which is what makes it read as a ball.
          */}
          <RadialGradient id={sunId} cx="42%" cy="32%" r="78%">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="0.5" stopColor={gradient[1]} />
            <Stop offset="1" stopColor={gradient[2]} />
          </RadialGradient>
          {/* Specular sheen — a small bright spot offset toward the light. */}
          <RadialGradient id={sheenId} cx="38%" cy="26%" r="42%">
            <Stop offset="0" stopColor={Colors.white} stopOpacity="0.5" />
            <Stop offset="0.55" stopColor={Colors.white} stopOpacity="0.14" />
            <Stop offset="1" stopColor={Colors.white} stopOpacity="0" />
          </RadialGradient>
          {/* Bounce light along the bottom rim, so the shaded side is not dead. */}
          <RadialGradient id={rimId} cx="50%" cy="88%" r="55%">
            <Stop offset="0" stopColor={gradient[1]} stopOpacity="0.55" />
            <Stop offset="1" stopColor={gradient[1]} stopOpacity="0" />
          </RadialGradient>
          {/*
            A light source directly above. The radial sheen alone gives a
            highlight but no sense of direction — this vertical wash brightens
            the whole upper cap and falls away by the equator, which is what
            makes it read as lit from above rather than merely glossy.
          */}
          <LinearGradient id={topLightId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.white} stopOpacity="0.46" />
            <Stop offset="0.28" stopColor={Colors.white} stopOpacity="0.16" />
            <Stop offset="0.55" stopColor={Colors.white} stopOpacity="0" />
          </LinearGradient>
          {/* The bloom picks up the disc's own top colour so it warms with it. */}
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={gradient[0]} stopOpacity="0.45" />
            <Stop offset="0.55" stopColor={gradient[0]} stopOpacity="0.16" />
            <Stop offset="1" stopColor={gradient[0]} stopOpacity="0" />
          </RadialGradient>
          {/*
            Radial, not linear. A linear fade only softens the bottom — the
            shape still clips to hard vertical edges where it crosses the
            viewBox sides, which reads as a box behind the sun. Fading outward
            in every direction is what makes it a soft mound.
          */}
          <RadialGradient id={horizonId} cx="50%" cy="42%" r="52%">
            <Stop offset="0" stopColor={Colors.accentMuted} stopOpacity="0.7" />
            <Stop offset="0.6" stopColor={Colors.accentMuted} stopOpacity="0.3" />
            <Stop offset="1" stopColor={Colors.accentMuted} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={SUN_CENTER} cy={SUN_CENTER} r={GLOW_RADIUS} fill={`url(#${glowId})`} />
        {/* Body, then bounce light, then sheen — painted back to front. */}
        <Circle cx={SUN_CENTER} cy={SUN_CENTER} r={SUN_RADIUS} fill={`url(#${sunId})`} />
        <Circle cx={SUN_CENTER} cy={SUN_CENTER} r={SUN_RADIUS} fill={`url(#${rimId})`} />
        <Circle cx={SUN_CENTER} cy={SUN_CENTER} r={SUN_RADIUS} fill={`url(#${topLightId})`} />
        <Circle cx={SUN_CENTER} cy={SUN_CENTER} r={SUN_RADIUS} fill={`url(#${sheenId})`} />

        {/*
          Drawn as an ellipse rather than the closed curve: the curve's straight
          closing edges along the viewBox are precisely what produced the boxy
          silhouette. An ellipse has no corners to clip.
        */}
        {showHorizon ? (
          <Ellipse
            cx={SUN_CENTER}
            cy={HORIZON_CENTER_Y}
            rx={HORIZON_RX}
            ry={HORIZON_RY}
            fill={`url(#${horizonId})`}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
