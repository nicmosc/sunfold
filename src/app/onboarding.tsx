import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { GradientBackground } from '@/components/ui/gradient-background';
import { SunDisc } from '@/components/viz/sun-disc';
import { ButtonGradient, Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { useOnboarding } from '@/hooks/use-onboarding';
import { requestLocationPermission } from '@/lib/location';

// TODO: Replace with a real, reachable Terms of Use URL before App Store
// submission — App Review rejects placeholder or dead legal links.
const TERMS_URL = 'https://example.com/terms';

const MARK_SIZE = 150;
const SUN_SIZE = 110;
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

          <View style={styles.mark}>
            <SunDisc size={SUN_SIZE} />
          </View>

          <Text style={styles.tagline}>
            <Text style={styles.taglineStrong}>Know</Text>
            <Text style={styles.taglineSoft}> exactly when the light is </Text>
            <Text style={styles.taglineStrong}>perfect.</Text>
          </Text>
        </View>

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
            By tapping &lsquo;Get started&rsquo; you agree to our{' '}
            <ExternalLink href={TERMS_URL} style={styles.termsLink}>
              Terms of Use
            </ExternalLink>
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
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: Radius.lg * 1.6,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.lg,
    ...Shadow.card,
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
  termsLink: {
    ...Type.caption,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
