import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { OptionRow, Sheet } from '@/components/ui/sheet';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';

/*
 * TODO: Replace with a real, reachable page before App Store submission —
 * App Review follows this link.
 *
 * A privacy policy URL is mandatory in App Store Connect for every app. There
 * is deliberately no Terms of Use: Apple only requires an EULA for apps with
 * subscriptions or auto-renewing purchases, and a dead placeholder link is
 * worse than no link at all.
 *
 * The page itself can be short, because the honest version is short: the app
 * reads your location on device to compute sun times and uploads nothing.
 */
const PRIVACY_URL = 'https://example.com/privacy';

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Settings.
 *
 * Deliberately only contains switches that do something. A notifications
 * toggle belongs here, but not before `expo-notifications` is wired up — a
 * control that silently does nothing is worse than an absent one.
 */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { settings, update } = useSettings();

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings">
      <Text style={styles.heading}>Time format</Text>

      <OptionRow
        label="24-hour"
        detail="20:30"
        selected={!settings.hour12}
        onPress={() => void update({ hour12: false })}
      />
      <OptionRow
        label="12-hour"
        detail="8:30 PM"
        selected={settings.hour12}
        onPress={() => void update({ hour12: true })}
      />

      <Text style={styles.heading}>Events</Text>

      <OptionRow
        label="Show twilight"
        detail="First light, blue hour and last light"
        selected={settings.showTwilight}
        onPress={() => void update({ showTwilight: !settings.showTwilight })}
        icon={
          <SymbolView
            name={settings.showTwilight ? 'moon.stars.fill' : 'moon'}
            size={16}
            tintColor={Colors.indigo}
          />
        }
      />

      <Text style={styles.heading}>About</Text>

      <Text style={styles.about}>
        Golden Hour computes every time on your device from your coordinates. Nothing is uploaded
        and there is no account.
      </Text>

      <Text style={styles.links}>
        <ExternalLink href={PRIVACY_URL} style={styles.link}>
          Privacy Policy
        </ExternalLink>
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...Type.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.base,
    marginLeft: Spacing.xs,
  },
  about: {
    ...Type.caption,
    color: Colors.textSecondary,
    lineHeight: 19,
    paddingHorizontal: Spacing.xs,
  },
  links: {
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  link: {
    ...Type.caption,
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
});
