import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';

import { Colors, Spacing, Type } from '@/constants/theme';

/** Intrinsic drawing geometry, in points. Colour and type come from tokens. */
const ARC_STROKE = 10;
const MARKER_RADIUS = 7;
const MARKER_GLOW_RADIUS = 18;
const GLYPH_RADIUS = 5;
/** Horizontal breathing room so the marker glow never clips the SVG bounds. */
const EDGE_INSET = MARKER_GLOW_RADIUS;
/** Vertical gap between the arc baseline and the sunrise/sunset glyphs. */
const GLYPH_GAP = ARC_STROKE / 2 + Spacing.sm;

const DEG_TO_RAD = Math.PI / 180;

interface Point {
  x: number;
  y: number;
}

/**
 * A point on a circle in SVG user space, where 0deg is the right end, 90deg is
 * the top and 180deg is the left end.
 *
 * Screen y grows downward, so the sine term is subtracted rather than added —
 * that is what makes increasing angles travel *up* and over the arc.
 */
export function pointOnArc(cx: number, cy: number, r: number, angleDeg: number): Point {
  const radians = angleDeg * DEG_TO_RAD;
  return { x: cx + r * Math.cos(radians), y: cy - r * Math.sin(radians) };
}

const fmt = (value: number): string => String(Math.round(value * 1000) / 1000);

/**
 * An `A` command from `startDeg` to `endDeg` over the top of the circle.
 *
 * Returns `null` rather than a path containing `NaN` (which blanks or crashes
 * the view on iOS) when any input is non-finite, and for a zero-length sweep,
 * which would otherwise emit a degenerate segment.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string | null {
  if (![cx, cy, r, startDeg, endDeg].every(Number.isFinite) || r <= 0) {
    return null;
  }
  const sweptDeg = Math.abs(endDeg - startDeg);
  if (sweptDeg < 0.01) {
    return null;
  }
  const start = pointOnArc(cx, cy, r, startDeg);
  const end = pointOnArc(cx, cy, r, endDeg);
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) {
    return null;
  }
  const largeArcFlag = sweptDeg > 180 ? 1 : 0;
  // Angles decrease from 180deg (left) to 0deg (right). With y growing
  // downward that traversal is clockwise on screen, which SVG encodes as
  // sweep-flag 1. Flipping it would silently draw the arc under the baseline.
  const sweepFlag = 1;
  return `M ${fmt(start.x)} ${fmt(start.y)} A ${fmt(r)} ${fmt(r)} 0 ${largeArcFlag} ${sweepFlag} ${fmt(
    end.x,
  )} ${fmt(end.y)}`;
}

/** Clamps to [0,1], mapping NaN/Infinity to 0 so no coordinate can go bad. */
function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

export interface DaylightArcProps {
  /** Sun position along the day, 0 at sunrise to 1 at sunset. */
  progress: number;
  /** Rendered width in points. */
  width: number;
  sunriseLabel?: string;
  sunsetLabel?: string;
}

/**
 * The sun's path across the day as a semicircle, with a marker at `progress`.
 */
export function DaylightArc({ progress, width, sunriseLabel, sunsetLabel }: DaylightArcProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const glowId = `daylight-arc-glow-${uid}`;

  const radius = (width - EDGE_INSET * 2) / 2;

  // `width` is 0 or NaN before layout, and a container narrower than the insets
  // yields a negative radius — draw nothing rather than emit a broken path.
  if (!Number.isFinite(width) || radius <= 0) {
    return null;
  }

  const cx = width / 2;
  const cy = EDGE_INSET + radius;
  const glyphY = cy + GLYPH_GAP;
  const svgHeight = glyphY + GLYPH_RADIUS + Spacing.xs;

  const clamped = clampUnit(progress);
  const angle = 180 - 180 * clamped;
  const marker = pointOnArc(cx, cy, radius, angle);

  const trackPath = arcPath(cx, cy, radius, 180, 0);
  const progressPath = arcPath(cx, cy, radius, 180, angle);
  const droplineLength = cy - marker.y;

  const percent = Math.round(clamped * 100);
  const accessibilityLabel = [
    sunriseLabel ? `Sunrise ${sunriseLabel}` : null,
    sunsetLabel ? `sunset ${sunsetLabel}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      style={[styles.root, { width }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel || 'Sun path across the day'}
      accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <Svg
        width={width}
        height={svgHeight}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={Colors.accent} stopOpacity="0.35" />
            <Stop offset="0.6" stopColor={Colors.accent} stopOpacity="0.12" />
            <Stop offset="1" stopColor={Colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Line
          x1={cx - radius}
          y1={cy}
          x2={cx + radius}
          y2={cy}
          stroke={Colors.accentMuted}
          strokeOpacity={0.7}
          strokeWidth={1}
        />

        {trackPath ? (
          <Path
            d={trackPath}
            stroke={Colors.accentMuted}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}

        {progressPath ? (
          <Path
            d={progressPath}
            stroke={Colors.accent}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}

        {droplineLength > 1 ? (
          <Line
            x1={marker.x}
            y1={marker.y}
            x2={marker.x}
            y2={cy}
            stroke={Colors.accent}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
        ) : null}

        <SunGlyph x={cx - radius} y={glyphY} />
        <SunGlyph x={cx + radius} y={glyphY} />

        <Circle cx={marker.x} cy={marker.y} r={MARKER_GLOW_RADIUS} fill={`url(#${glowId})`} />
        <Circle
          cx={marker.x}
          cy={marker.y}
          r={MARKER_RADIUS}
          fill={Colors.accent}
          stroke={Colors.white}
          strokeWidth={2}
        />
      </Svg>

      {sunriseLabel || sunsetLabel ? (
        <View style={styles.labels}>
          <Text style={styles.label} numberOfLines={1}>
            {sunriseLabel ?? ''}
          </Text>
          <Text style={[styles.label, styles.labelEnd]} numberOfLines={1}>
            {sunsetLabel ?? ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** A sun cresting a horizon line, drawn at the arc's left and right endpoints. */
function SunGlyph({ x, y }: Point) {
  return (
    <G x={x} y={y}>
      <Path
        d={`M ${-GLYPH_RADIUS} 0 A ${GLYPH_RADIUS} ${GLYPH_RADIUS} 0 0 1 ${GLYPH_RADIUS} 0 Z`}
        fill={Colors.accent}
        fillOpacity={0.75}
      />
      <Line
        x1={-GLYPH_RADIUS - 2}
        y1={1}
        x2={GLYPH_RADIUS + 2}
        y2={1}
        stroke={Colors.accent}
        strokeOpacity={0.45}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </G>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: Spacing.xs,
  },
  label: {
    ...Type.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  labelEnd: {
    textAlign: 'right',
  },
});
