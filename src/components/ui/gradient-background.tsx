import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { CanvasGradient } from '@/constants/theme';

export interface GradientBackgroundProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Safe-area edges the *content* insets from. The gradient itself always runs
   * edge to edge behind them.
   *
   * Defaults to the horizontal edges only: `ScreenHeader` owns the top inset and
   * the floating tab bar owns the bottom (via `TabBarInset`), so insetting them
   * here as well would double up.
   */
  edges?: readonly Edge[];
}

/** Vertical page gradient, top -> bottom, per the design canvas. */
const GRADIENT_START = { x: 0.5, y: 0 };
const GRADIENT_END = { x: 0.5, y: 1 };
const DEFAULT_EDGES: readonly Edge[] = ['left', 'right'];

/** Full-bleed pastel canvas that every screen sits on. */
export function GradientBackground({
  children,
  style,
  edges = DEFAULT_EDGES,
}: GradientBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={CanvasGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.gradient}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <SafeAreaView style={styles.content} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  content: {
    flex: 1,
  },
});
