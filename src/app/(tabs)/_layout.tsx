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
