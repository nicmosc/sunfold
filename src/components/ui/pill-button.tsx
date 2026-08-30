import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Size, Spacing, Type } from '@/constants/theme';

/**
 * Both pill shapes render smaller than the 44pt HIG minimum, so the difference is
 * made up with hitSlop rather than by inflating their visual bounds.
 */
const LABEL_HIT_SLOP = (Size.minTouchTarget - Size.pillHeight) / 2;
const ICON_HIT_SLOP = (Size.minTouchTarget - Size.iconButton) / 2;

interface PillButtonBaseProps {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Either a labelled pill (label, optionally with leading/trailing icons) or a
 * circular icon-only pill — which *must* carry an `accessibilityLabel`, since it
 * has no text for VoiceOver to read.
 */
export type PillButtonProps = PillButtonBaseProps &
  (
    | {
        label: string;
        icon?: ReactNode;
        trailingIcon?: ReactNode;
        accessibilityLabel?: string;
      }
    | {
        label?: undefined;
        icon: ReactNode;
        trailingIcon?: undefined;
        accessibilityLabel: string;
      }
  );

/** Floating translucent control used in headers: "Today ⌄", "📍 New York", share, settings. */
export function PillButton({
  label,
  icon,
  trailingIcon,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: PillButtonProps) {
  const isIconOnly = label === undefined;

  function handlePress() {
    void Haptics.selectionAsync();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={isIconOnly ? ICON_HIT_SLOP : LABEL_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        isIconOnly ? styles.iconOnly : styles.labelled,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon !== undefined && (
        <View
          style={isIconOnly ? undefined : styles.leadingIcon}
          accessibilityElementsHidden
          importantForAccessibility="no">
          {icon}
        </View>
      )}
      {label !== undefined && (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
      {trailingIcon !== undefined && (
        <View style={styles.trailingIcon} accessibilityElementsHidden importantForAccessibility="no">
          {trailingIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pill,
    borderRadius: Radius.pill,
    ...Shadow.pill,
  },
  labelled: {
    minHeight: Size.pillHeight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  iconOnly: {
    width: Size.iconButton,
    height: Size.iconButton,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...Type.label,
    color: Colors.text,
  },
  leadingIcon: {
    marginRight: Spacing.sm,
  },
  trailingIcon: {
    marginLeft: Spacing.xs,
  },
});
