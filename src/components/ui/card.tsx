import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Size, Spacing, Type } from '@/constants/theme';

/** Enough to read as frosted without turning the card opaque. */
const CARD_BLUR_INTENSITY = 28;

export interface CardProps {
  children: ReactNode;
  /** Applied to the outer (shadow-casting) layer. */
  style?: StyleProp<ViewStyle>;
  /** Applied to the inner padded surface — use to override the default padding. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Small bold heading rendered as the first row inside the card. */
  title?: string;
  /** Leading icon slot for `title`. Ignored when `title` is absent. */
  titleIcon?: ReactNode;
}

/**
 * Frosted translucent card sitting on the gradient canvas.
 *
 * Two layers on purpose: the outer view casts the shadow (iOS drops shadows on
 * any view with `overflow: 'hidden'`), the inner one clips content to the radius.
 */
export function Card({ children, style, contentStyle, title, titleIcon }: CardProps) {
  return (
    <View style={[styles.shadow, style]}>
      {/*
        A real blur rather than a translucent fill. A flat rgba background looks
        convincing over the pastel canvas but goes thin and washy over the
        moving sun behind it — the blur keeps the card readable regardless of
        what passes underneath.

        `overflow: 'hidden'` is required here to clip the blur to the radius.
        (Note this is the opposite of GlassView, which masks its own corners and
        breaks if clipped externally.)
      */}
      <BlurView
        intensity={CARD_BLUR_INTENSITY}
        tint="light"
        style={[styles.surface, contentStyle]}>
        {title !== undefined && (
          <View style={styles.titleRow}>
            {titleIcon !== undefined && (
              <View
                style={styles.titleIcon}
                accessibilityElementsHidden
                importantForAccessibility="no">
                {titleIcon}
              </View>
            )}
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
        )}
        {children}
      </BlurView>
    </View>
  );
}

export interface CardDividerProps {
  style?: StyleProp<ViewStyle>;
}

/** Hairline rule between stacked rows inside a `Card`. */
export function CardDivider({ style }: CardDividerProps) {
  return (
    <View
      style={[styles.divider, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  surface: {
    borderRadius: Radius.lg,
    /*
     * A light wash on top of the blur. Without it the blur alone samples the
     * canvas too faithfully and the card loses its edge against the background.
     */
    backgroundColor: Colors.cardWash,
    borderWidth: Size.hairline,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  titleIcon: {
    marginRight: Spacing.sm,
  },
  title: {
    ...Type.label,
    color: Colors.text,
    flexShrink: 1,
  },
  divider: {
    height: Size.hairline,
    backgroundColor: Colors.separator,
  },
});
