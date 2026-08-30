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
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="cities" options={{ title: 'Cities' }} />
    </Tabs>
  );
}
