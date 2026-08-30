import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
 * render — the answer cannot change during a session. Below iOS 26 the bar
 * falls back to a flat translucent fill, which is the same silhouette without
 * the refraction or the touch response.
 */
const CAN_GLASS = isLiquidGlassAvailable();

/**
 * The floating pill tab bar from the design: a translucent rounded bar inset
 * from the screen edges, sitting above the content rather than docked to it.
 *
 * Replaces the default react-navigation bar entirely, so it owns its own
 * safe-area handling — screens reserve room for it with `TabBarInset`.
 */
export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const tabs = state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

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
              <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
                <SymbolView
                  name={ICONS[route.name] ?? FALLBACK_ICON}
                  size={ICON_SIZE}
                  tintColor={isFocused ? Colors.accent : Colors.textSecondary}
                  resizeMode="scaleAspectFit"
                />
                <Text
                  style={[styles.label, isFocused && styles.labelActive]}
                  numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      {CAN_GLASS ? (
        /*
         * `isInteractive` is what gives the bar the Liquid Glass touch response
         * — without it the glass renders but sits inert. No backgroundColor
         * here on purpose: a solid fill would sit in front of the refraction
         * and flatten the whole effect.
         */
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={Colors.tabBar}
          style={[styles.bar, styles.barGlass]}>
          {tabs}
        </GlassView>
      ) : (
        <View style={[styles.bar, styles.barFallback]}>{tabs}</View>
      )}
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TabBarHeight,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
    borderRadius: Radius.pill,
  },
  /*
   * No `overflow: 'hidden'` here: GlassView masks its own corners, and clipping
   * it externally suppresses the material entirely — the bar renders fully
   * transparent with the content showing straight through.
   */
  barGlass: {
    ...Shadow.tabBar,
  },
  barFallback: {
    backgroundColor: Colors.tabBar,
    overflow: 'hidden',
    ...Shadow.tabBar,
  },
  tab: {
    minWidth: 84,
    minHeight: Size.minTouchTarget,
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  tabInnerActive: {
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
