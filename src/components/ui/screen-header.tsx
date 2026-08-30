import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Type } from '@/constants/theme';

export interface ScreenHeaderProps {
  /** Leading slot — typically a "Today ⌄" or location pill. */
  left?: ReactNode;
  /** Trailing slot — typically icon-only pills (share, settings). */
  right?: ReactNode;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Top-of-screen slot row, with an optional centred title block beneath it.
 * Owns the top safe-area inset — `GradientBackground` deliberately does not.
 */
export function ScreenHeader({ left, right, title, subtitle, style }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const hasSlots = left !== undefined || right !== undefined;

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }, style]}>
      {hasSlots && (
        <View style={styles.slots}>
          <View style={styles.slot}>{left}</View>
          <View style={[styles.slot, styles.slotEnd]}>{right}</View>
        </View>
      )}

      {title !== undefined && (
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.base,
  },
  slots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  slotEnd: {
    justifyContent: 'flex-end',
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  title: {
    ...Type.title,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Type.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
