import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { OptionRow, Sheet } from '@/components/ui/sheet';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useActiveLocation } from '@/hooks/use-active-location';
import { useCities } from '@/hooks/use-cities';
import { getLocationKey } from '@/lib/location';
import type { Location } from '@/lib/types';

export interface LocationPickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Switches which location the app is showing: back to the device, or to one of
 * the saved cities.
 *
 * This is what makes the Cities tab more than a read-only list — without it,
 * saving a city has no effect on anything.
 */
export function LocationPickerSheet({ visible, onClose }: LocationPickerSheetProps) {
  const { location, isDeviceLocation, deviceLocation, deviceError, setLocation, followDevice } =
    useActiveLocation();
  const { cities } = useCities();

  const activeKey = getLocationKey(location);

  function handleUseDevice() {
    void followDevice();
    onClose();
  }

  function handlePick(city: Location) {
    void setLocation(city);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Location">
      <OptionRow
        label={deviceLocation === null ? 'My location' : `My location · ${deviceLocation.name}`}
        detail={deviceError ?? 'Follows wherever you are'}
        selected={isDeviceLocation}
        onPress={handleUseDevice}
        icon={<SymbolView name="location.fill" size={16} tintColor={Colors.accent} />}
      />

      {cities.length > 0 && <Text style={styles.heading}>Saved cities</Text>}

      {cities.map((city) => (
        <OptionRow
          key={getLocationKey(city)}
          label={city.name}
          detail={city.timeZone}
          selected={!isDeviceLocation && getLocationKey(city) === activeKey}
          onPress={() => handlePick(city)}
          icon={<SymbolView name="building.2.fill" size={16} tintColor={Colors.textSecondary} />}
        />
      ))}

      {cities.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyBody}>
            Add cities from the Cities tab to switch between them here.
          </Text>
        </View>
      )}
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
  empty: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  emptyBody: {
    ...Type.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
