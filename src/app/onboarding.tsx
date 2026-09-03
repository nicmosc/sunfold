import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/gradient-background';
import { ButtonGradient, Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { useActiveLocation } from '@/hooks/use-active-location';
import { useOnboarding } from '@/hooks/use-onboarding';

/*
 * The app mark is the ICON itself, not the in-app SunDisc component. Onboarding
 * is the first thing seen after tapping the home-screen icon, so showing the
 * same artwork makes the two read as one app rather than two similar drawings.
 *
 * It is the FULL icon, background field included, clipped to the tile's radius —
 * i.e. the home-screen icon reproduced, mask and all.
 *
 * It used to be splash-icon.png, the icon with its background stripped, floated
 * at 122pt inside a 150pt white tile. That looked wrong on device and a tester
 * reported it as broken: the artwork bleeds to the left, right and bottom of its
 * own square (opaque bounds start at y=97 and run to every other edge), which is
 * invisible under the iOS icon mask but becomes a hard flat crop with square
 * corners once the square is floated, unmasked, inside a rounded box.
 */
const APP_MARK = require('../../assets/images/icon.png');

const TILE_SIZE = 150;
const BUTTON_GRADIENT_START = { x: 0, y: 0 };
const BUTTON_GRADIENT_END = { x: 1, y: 0 };

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { refreshDevice } = useActiveLocation();
  const [isRequesting, setIsRequesting] = useState(false);

  async function handleGetStarted() {
    if (isRequesting) return;
    setIsRequesting(true);

    /*
     * This tap is the app's ONLY permission prompt: `ActiveLocationProvider`
     * suppresses its own until onboarding is done, so asking here is what puts
     * the dialog in front of a user who has just read what it is for.
     *
     * Going through the provider rather than calling `requestLocationPermission`
     * directly means the resulting fix lands in the state the tabs then render,
     * instead of being thrown away and rediscovered a moment later.
     *
     * Nothing is checked afterwards: a denial is a valid outcome. The app falls
     * back to DEFAULT_LOCATION rather than trapping the user on this screen,
     * and the Cities tab still works entirely without location access.
     */
    await refreshDevice();
    await complete();

    router.replace('/(tabs)');
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.wordmark}>Sunfold</Text>

          {/*
            Two layers, as in `Card` and for the same reason: iOS drops the
            shadow on any view with `overflow: 'hidden'`, so the outer view
            casts it and the inner one does the masking.
          */}
          <View style={styles.tile}>
            <View style={styles.tileMask}>
              <Image
                source={APP_MARK}
                style={styles.mark}
                contentFit="cover"
                accessible={false}
              />
            </View>
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
            Times are computed on your device. Nothing is sent to us.
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
  /** Outer layer: carries the shadow, and must NOT clip or iOS drops it. */
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: Radius.lg * 1.6,
    marginVertical: Spacing.lg,
    ...Shadow.card,
  },
  /**
   * Inner layer: the mask. `Colors.white` shows only in the frame before the
   * image decodes, so the tile never flashes as a dark or empty hole.
   */
  tileMask: {
    flex: 1,
    borderRadius: Radius.lg * 1.6,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  /** Fills the mask edge to edge: this is the icon, not a mark inset within it. */
  mark: {
    width: '100%',
    height: '100%',
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
