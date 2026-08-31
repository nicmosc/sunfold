import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Colors, Radius, Shadow, Size, Spacing, TabBarHeight, Type } from '@/constants/theme';

/**
 * expo-router 57 vendors react-navigation internally, so `BottomTabBarProps`
 * has no public import path. Infer it from the public `Tabs` component instead
 * of deep-importing `expo-router/build/react-navigation/...`, which would break
 * the moment expo reorganises its build output.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * SF Symbol per route. Keyed by the route name that expo-router derives from
 * the filename in `src/app/(tabs)/`, so renaming a screen file must be mirrored
 * here — there is no runtime error if it is not, only a missing glyph.
 */
const ICONS: Record<string, SymbolViewProps['name']> = {
  index: 'house.fill',
  timeline: 'clock.fill',
  cities: 'building.2.fill',
};

const FALLBACK_ICON: SymbolViewProps['name'] = 'circle.fill';
const ICON_SIZE = 22;

/**
 * Liquid Glass needs iOS 26+. Checked once at module load rather than per
 * render — the answer cannot change during a session.
 */
const CAN_GLASS = isLiquidGlassAvailable();

/**
 * How close sibling glass views must be before they bleed into one another.
 * This is what makes the travelling pill and the bar read as one body of glass
 * rather than a pane floating inside a pane.
 */
const GLASS_MERGE_DISTANCE = 28;

/**
 * Each tab is a fixed width so the pill's target position is pure arithmetic —
 * `PILL_INSET + index * TAB_WIDTH`. Measuring the bar with `onLayout` instead
 * would leave the pill unplaced for the first frame and mispositioned whenever
 * a label's width changed.
 */
const TAB_WIDTH = 92;
/**
 * Uniform gap between the bar's edge and the pill, on all four sides. One
 * constant on purpose — separate horizontal and vertical values drift, and the
 * mismatch is plainly visible on the leading edge when the first tab is active.
 */
const PILL_INSET = 6;

/** Firm enough to feel connected to the tap, loose enough for the glass to flow. */
const PILL_SPRING = { stiffness: 220, damping: 22, mass: 0.9 } as const;

/**
 * The floating pill tab bar from the design: a translucent rounded bar inset
 * from the screen edges, sitting above the content rather than docked to it.
 *
 * Three layers, in paint order:
 *   1. the bar         — one body of glass
 *   2. the active pill — a second body of glass, animated between slots
 *   3. the icon row    — plain views on top of both
 *
 * The two glass layers are deliberately *siblings* inside a `GlassContainer`.
 * Nesting the pill inside the bar would render it, but `spacing` only makes
 * sibling glass elements affect one another, so it would never morph.
 */
export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const activeIndex = state.index;

  /*
   * `withSpring` inside `useAnimatedStyle` animates whenever the captured JS
   * value changes, so no shared value or effect is needed. That matters here:
   * React Compiler is enabled, and its hooks lint rejects the usual
   * shared-value-mutated-in-an-effect pattern.
   */
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(PILL_INSET + activeIndex * TAB_WIDTH, PILL_SPRING) }],
  }));

  const tabs = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const isFocused = activeIndex === index;
    const label =
      typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (isFocused || event.defaultPrevented) return;

      Haptics.selectionAsync();
      navigation.navigate(route.name);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}>
        <SymbolView
          name={ICONS[route.name] ?? FALLBACK_ICON}
          size={ICON_SIZE}
          tintColor={isFocused ? Colors.accent : Colors.textSecondary}
          resizeMode="scaleAspectFit"
        />
        <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  });

  const pill = (
    <Animated.View style={[styles.pillHolder, pillStyle]} pointerEvents="none">
      {CAN_GLASS ? (
        /*
         * 'clear' rather than 'regular': the pill sits on top of the bar's own
         * glass, and stacking two 'regular' materials reads as a grey smudge.
         * `isInteractive` gives it the Liquid Glass touch response.
         */
        <GlassView glassEffectStyle="clear" isInteractive style={styles.pillFill} />
      ) : (
        <View style={[styles.pillFill, styles.pillFallback]} />
      )}
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      <View style={styles.barArea}>
        {CAN_GLASS ? (
          <GlassContainer spacing={GLASS_MERGE_DISTANCE} style={styles.glassLayer}>
            {/*
              The radius has to live on the GlassView itself. The parent cannot
              clip it — `overflow: 'hidden'` suppresses the material outright —
              so a GlassView without its own borderRadius renders as a hard
              rectangle regardless of the rounded wrapper around it.

              No tintColor anywhere: a white tint paints in front of the
              refraction and flattens the effect into flat milk.
            */}
            <GlassView glassEffectStyle="regular" style={styles.glassLayer} />
            {pill}
          </GlassContainer>
        ) : (
          <>
            <View style={[styles.glassLayer, styles.barFallback]} />
            {pill}
          </>
        )}

        <View style={styles.tabsRow} pointerEvents="box-none">
          {tabs}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  /*
   * Carries the shadow and the pill silhouette. No `overflow: 'hidden'` —
   * GlassView masks its own corners and clipping it externally suppresses the
   * material entirely. (BlurView is the opposite: it needs the clip.)
   */
  barArea: {
    height: TabBarHeight,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
    ...Shadow.tabBar,
  },
  /** Absolute fill that carries its own pill radius, for glass and fallback alike. */
  glassLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.pill,
  },
  barFallback: {
    backgroundColor: Colors.tabBar,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: PILL_INSET,
  },
  tab: {
    width: TAB_WIDTH,
    minHeight: Size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  pillHolder: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    left: 0,
    width: TAB_WIDTH,
  },
  pillFill: {
    flex: 1,
    borderRadius: Radius.pill,
  },
  pillFallback: {
    backgroundColor: Colors.accentMuted,
  },
  label: {
    ...Type.tab,
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.accent,
  },
});
