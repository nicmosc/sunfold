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
         * NO TAB ANIMATION, AND IT IS NOT A STYLE CHOICE. 'shift' looked much
         * better and is what this app shipped with until 1.0 review prep; it
         * was removed because every animated preset here can strand a screen
         * permanently blank.
         *
         * Both presets ('shift' and 'fade') bind the scene's opacity to one
         * Animated.Value per route, started imperatively once per transition by
         * `BottomTabView`. Interrupt that transition — tap a tab while a scroll
         * is still decelerating, which is what anyone does on a long screen —
         * and the value is left off its target with nothing to restart it. The
         * incoming screen stays at opacity 0 while the outgoing one has already
         * been detached, leaving a blank screen with only the tab bar. It never
         * self-heals; it was still blank after 30s untouched.
         *
         * Measured over repeated runs of that gesture:
         *   shift + spring          2-5 blank / 6
         *   shift + library default ~4 blank / 16
         *   fade                    3-4 blank / 6
         *   none (this)             0 blank / 24
         *
         * That is a bug in the vendored @react-navigation/bottom-tabs, not in
         * this app, and it affects all three tabs equally. A blank screen with
         * only a tab bar is the textbook 2.1 rejection screenshot, and App
         * Review moves fast, so a missing transition is the cheap side of that
         * trade for a first submission.
         *
         * TO BRING THE MOTION BACK: reimplementing it per-screen with
         * reanimated is immune by construction, because a declarative target is
         * re-evaluated every render and an interrupted animation re-aims rather
         * than stranding. That was built and measured 0 blank / 20, but it
         * needed `detachInactiveScreens` off — keeping all three screens live —
         * and animating opacity across subtrees full of `BlurView` recomposites
         * every frame, so it felt janky and was reverted. The remaining problem
         * is the jank, not the correctness: animate an inner wrapper that
         * excludes the blurred cards, or slide without fading.
         */
        animation: 'none',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="cities" options={{ title: 'Cities' }} />
    </Tabs>
  );
}
