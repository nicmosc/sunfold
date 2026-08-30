import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';

/** Rendered when an event does not occur at this latitude (polar day/night). */
export const NO_EVENT_TIME = '—';

export interface EventRowProps {
  label: string;
  sublabel?: string;
  /** Time only, e.g. "6:42" — never concatenated with its period or timezone. */
  time: string;
  /** Small uppercase suffix, e.g. "AM". */
  period?: string;
  /** Small uppercase suffix, e.g. "CEST". */
  tz?: string;
  /** Colour of the large time. Blue-hour and moon rows pass `Colors.indigo`. */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The core repeated row: label (plus optional sublabel) on the left, a large
 * time on the right trailed by small uppercase unit runs, baseline-aligned.
 *
 * The time and its AM/PM + timezone are deliberately separate `Text` runs at
 * different sizes — concatenating them would break the type hierarchy.
 */
export function EventRow({
  label,
  sublabel,
  time,
  period,
  tz,
  accentColor = Colors.accent,
  style,
}: EventRowProps) {
  const hasTime = time !== NO_EVENT_TIME;
  const units = hasTime ? [period, tz].filter((unit): unit is string => Boolean(unit)) : [];

  const spokenTime = hasTime ? [time, ...units].join(' ') : 'Does not occur';
  const accessibilityLabel = [label, sublabel, spokenTime]
    .filter((part): part is string => Boolean(part))
    .join(', ');

  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {sublabel !== undefined && <Text style={styles.sublabel}>{sublabel}</Text>}
      </View>

      <View style={styles.value}>
        <Text style={[styles.time, hasTime ? { color: accentColor } : styles.timeMuted]}>
          {time}
        </Text>
        {units.map((unit) => (
          <Text key={unit} style={styles.unit}>
            {unit}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  labels: {
    flexShrink: 1,
    paddingRight: Spacing.md,
  },
  label: {
    ...Type.label,
    color: Colors.text,
  },
  sublabel: {
    ...Type.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs / 2,
  },
  value: {
    flexDirection: 'row',
    /**
     * The token lineHeights (eventTime 32, unit 14) are inherited as-is, NOT
     * stripped: iOS reports each run's baseline relative to its own line box, so
     * Yoga aligns the real baselines rather than the box tops. Both tokens sit
     * within ~1pt of the natural leading for their size, so the line boxes barely
     * move. If a visual check ever shows drift, nest the unit runs inside the time
     * `Text` — one paragraph baseline-aligns them in the text engine, and nested
     * runs are still separate runs, not a concatenated string.
     */
    alignItems: 'baseline',
  },
  time: {
    ...Type.eventTime,
  },
  timeMuted: {
    color: Colors.textTertiary,
  },
  unit: {
    ...Type.unit,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginLeft: Spacing.xs,
  },
});
