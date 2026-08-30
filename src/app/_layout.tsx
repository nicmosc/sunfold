import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingProvider, useOnboarding } from '@/hooks/use-onboarding';

SplashScreen.preventAutoHideAsync();

const rootStyle = { flex: 1 } as const;

/**
 * Routes between onboarding and the tabs.
 *
 * Split out from `RootLayout` because it has to sit *inside* the provider to
 * read the flag. Holds the splash screen until the flag resolves, so the tabs
 * never flash before a first-run redirect to onboarding.
 */
function RootNavigator() {
  const { hasOnboarded } = useOnboarding();

  const onLayout = useCallback(() => {
    if (hasOnboarded !== null) void SplashScreen.hideAsync();
  }, [hasOnboarded]);

  if (hasOnboarded === null) return null;

  return (
    <GestureHandlerRootView style={rootStyle} onLayout={onLayout}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}>
        <Stack.Protected guard={!hasOnboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={hasOnboarded}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <RootNavigator />
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
