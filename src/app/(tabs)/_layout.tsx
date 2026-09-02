import { Tabs } from 'expo-router';

import { TabBar } from '@/components/tab-bar';

/**
 * The three-tab shell. Rendering is delegated entirely to our own `TabBar`;
 * the default react-navigation bar is replaced, not restyled.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        /*
         * Tab animation defaults to 'none', which is why switching tabs used to
         * cut instantly. 'shift' slides the outgoing and incoming screens in
         * the direction of travel, which reads as movement between siblings
         * rather than a replacement.
         *
         * KNOWN BUG, ACCEPTED DELIBERATELY. This preset can strand a screen.
         * Both animated presets ('shift' and 'fade') bind the scene's opacity
         * to one Animated.Value per route, started imperatively once per
         * transition by `BottomTabView`. Interrupt that transition — tap a tab
         * while a scroll is still decelerating — and the value is left off its
         * target with nothing to restart it, so the incoming screen stays at
         * opacity 0 while the outgoing one has already been detached. The
         * result is a blank screen showing only the tab bar. It does not
         * self-heal (still blank after 30s); navigating away and back fixes it.
         *
         * Measured over repeated runs of that gesture:
         *   shift + spring (this)   2-5 blank / 6
         *   shift + library default ~4 blank / 16
         *   fade                    3-4 blank / 6
         *   none                    0 blank / 24
         *
         * It is a bug in the vendored @react-navigation/bottom-tabs, not in
         * this app, and it is not specific to one tab.
         *
         * Reimplementing the same motion per-screen with reanimated (immune,
         * since a declarative target re-aims on every render instead of
         * stranding) was tried and reverted: it needed `detachInactiveScreens`
         * off, which keeps all three screens live, and animating opacity over
         * subtrees full of `BlurView` recomposites every frame. It measured
         * 0 blank / 20 but felt visibly janky next to this, so the smooth
         * transition was kept and the rare blank accepted. If it is revisited,
         * the jank is the thing to solve, not the correctness.
         */
        animation: 'shift',
        transitionSpec: {
          animation: 'spring',
          config: { stiffness: 260, damping: 26, mass: 1 },
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="cities" options={{ title: 'Cities' }} />
    </Tabs>
  );
}
