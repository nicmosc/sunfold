import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/gradient-background';
import { ButtonGradient, Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/hooks/use-onboarding';
import { requestLocationPermission } from '@/lib/location';

/*
 * The app mark is the ICON artwork, not the in-app SunDisc component. Onboarding
 * is the first thing seen after tapping the home-screen icon, so using the same
 * image makes the two read as one app rather than two similar drawings.
 *
 * splash-icon.png is the icon without its background field, which is what sits
 * correctly inside the white tile.
 */
const APP_MARK = require('../../assets/images/splash-icon.png');

const TILE_SIZE = 150;
const MARK_SIZE = 122;
const BUTTON_GRADIENT_START = { x: 0, y: 0 };
const BUTTON_GRADIENT_END = { x: 1, y: 0 };

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const [isRequesting, setIsRequesting] = useState(false);

  async function handleGetStarted() {
    if (isRequesting) return;
    setIsRequesting(true);

    // The result is deliberately ignored: a denial is a valid outcome. The app
    // falls back to DEFAULT_LOCATION rather than trapping the user on this
    // screen, and the Cities tab still works entirely without location access.
    await requestLocationPermission();
    await complete();

    router.replace('/(tabs)');
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.wordmark}>Golden Hour</Text>

          <View style={styles.tile}>
            <Image
              source={APP_MARK}
              style={styles.mark}
              contentFit="contain"
              accessible={false}
            />
          </View>

          <Text style={styles.tagline}>
            <Text style={styles.taglineStrong}>Know</Text>
            <Text style={styles.taglineSoft}> exactly when the light is </Text>
            <Text style={styles.taglineStrong}>perfect.</Text>
          </Text>
        </View>

        {/*
          No Terms of Use link. Apple only requires an EULA for apps with
          subscriptions or auto-renewing purchases; this one is free with no
          account. A privacy policy IS required, but it belongs in App Store
          Connect and in Settings, not gating the first tap — and a placeholder
          legal link is worse than none, since App Review follows them.
        */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleGetStarted}
            disabled={isRequesting}
            accessibilityRole="button"
            accessibilityLabel="Get started"
            accessibilityState={{ disabled: isRequesting, busy: isRequesting }}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <LinearGradient
              colors={ButtonGradient}
              start={BUTTON_GRADIENT_START}
              end={BUTTON_GRADIENT_END}
              style={styles.ctaGradient}>
              {isRequesting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.ctaLabel}>Get started</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.finePrint}>
            Times are computed on your device. Nothing is uploaded.
          </Text>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  welcome: {
    ...Type.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  wordmark: {
    ...Type.display,
    color: Colors.text,
    textAlign: 'center',
    marginTop: -Spacing.md,
  },
  /** The white rounded tile the mark sits in — carries the shadow. */
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: Radius.lg * 1.6,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.lg,
    ...Shadow.card,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  tagline: {
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
  },
  taglineStrong: {
    ...Type.headline,
    color: Colors.text,
  },
  taglineSoft: {
    ...Type.headline,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  footer: {
    gap: Spacing.base,
    paddingBottom: Spacing.base,
  },
  cta: {
    borderRadius: Radius.xl,
    ...Shadow.card,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaGradient: {
    height: 58,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    ...Type.label,
    fontSize: 18,
    color: Colors.white,
  },
  finePrint: {
    ...Type.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
