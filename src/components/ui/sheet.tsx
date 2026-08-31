import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GradientBackground } from '@/components/ui/gradient-background';
import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Size, Spacing, Type } from '@/constants/theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Bottom-sheet modal shell: gradient canvas, a title row with a close button,
 * and a scrolling body.
 *
 * Exists so the day, location and settings pickers share one presentation
 * rather than each re-deriving Modal + background + header, which is how the
 * three drift apart.
 */
export function Sheet({ visible, onClose, title, subtitle, children }: SheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <GradientBackground edges={['top', 'bottom']}>
        <ScreenHeader
          title={title}
          subtitle={subtitle}
          right={
            <PillButton
              icon={<SymbolView name="xmark" size={16} tintColor={Colors.text} />}
              accessibilityLabel="Close"
              onPress={onClose}
            />
          }
        />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </GradientBackground>
    </Modal>
  );
}

export interface OptionRowProps {
  label: string;
  /** Supporting line beneath the label. */
  detail?: string;
  selected?: boolean;
  onPress: () => void;
  /** Leading icon slot. */
  icon?: ReactNode;
}

/**
 * A selectable row inside a `Sheet`. Shared by the day, location and settings
 * pickers so selection reads identically in all three.
 */
export function OptionRow({ label, detail, selected = false, onPress, icon }: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={detail === undefined ? label : `${label}, ${detail}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}>
      {icon !== undefined && (
        <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
          {icon}
        </View>
      )}

      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}
      </View>

      {selected && <SymbolView name="checkmark" size={16} tintColor={Colors.accent} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: Size.hairline,
    borderColor: Colors.borderLight,
  },
  rowSelected: {
    backgroundColor: Colors.accentMuted,
  },
  rowPressed: {
    opacity: 0.7,
  },
  icon: {
    width: Spacing.lg,
    alignItems: 'center',
  },
  labels: {
    flex: 1,
    gap: Spacing.xs,
  },
  label: {
    ...Type.label,
    color: Colors.text,
  },
  detail: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
});
