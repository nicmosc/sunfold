import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardDivider } from '@/components/ui/card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Spacing, TabBarInset, Type } from '@/constants/theme';
import { useCities } from '@/hooks/use-cities';
import { formatCountdown, formatTime } from '@/lib/format';
import { getLocationKey, PRESET_CITIES } from '@/lib/location';
import { getDaySummary, getNextEvent } from '@/lib/sun';
import type { Location } from '@/lib/types';

interface CityCardProps {
  city: Location;
  onRemove: (city: Location) => void;
}

/**
 * One saved city.
 *
 * Every time on this card is formatted in the CITY's own timezone, never the
 * device's — that distinction is the entire point of this screen.
 */
function CityCard({ city, onRemove }: CityCardProps) {
  const now = new Date();
  const summary = getDaySummary(now, city);
  const next = getNextEvent(now, city);

  const sunrise = formatTime(summary.sunrise, city.timeZone);
  const sunset = formatTime(summary.sunset, city.timeZone);

  return (
    <Card style={styles.cityCard}>
      <View style={styles.cityHeader}>
        <View style={styles.cityNameBlock}>
          <Text style={styles.cityName}>{city.name}</Text>
          {next !== null && (
            <Text style={styles.cityNext}>
              {next.event.label} in{' '}
              <Text style={styles.cityNextValue}>
                {formatCountdown(next.date.getTime() - now.getTime())}
              </Text>
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => onRemove(city)}
          hitSlop={Spacing.md}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${city.name}`}>
          <SymbolView name="xmark.circle.fill" size={22} tintColor={Colors.textTertiary} />
        </Pressable>
      </View>

      <CardDivider />

      <View style={styles.cityTimes}>
        <View style={styles.cityTimeCell}>
          <Text style={styles.cityTimeLabel}>Sunrise</Text>
          <View style={styles.cityTimeValueRow}>
            <Text style={styles.cityTimeValue}>{sunrise.time}</Text>
            <Text style={styles.cityTimeUnit}>{sunrise.period}</Text>
          </View>
        </View>

        <View style={styles.cityTimeCell}>
          <Text style={styles.cityTimeLabel}>Sunset</Text>
          <View style={styles.cityTimeValueRow}>
            <Text style={styles.cityTimeValue}>{sunset.time}</Text>
            <Text style={styles.cityTimeUnit}>{sunset.period}</Text>
          </View>
        </View>

        <View style={styles.cityTimeCell}>
          <Text style={styles.cityTimeLabel}>Timezone</Text>
          <Text style={styles.cityTimeZone}>{sunrise.tz || city.timeZone}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function CitiesScreen() {
  const { cities, addCity, removeCity, isLoading } = useCities();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const savedKeys = new Set(cities.map(getLocationKey));
  const available = PRESET_CITIES.filter((city) => !savedKeys.has(getLocationKey(city)));

  function handleAdd(city: Location) {
    addCity(city);
    setIsPickerOpen(false);
  }

  function renderCity({ item }: ListRenderItemInfo<Location>) {
    return <CityCard city={item} onRemove={removeCity} />;
  }

  return (
    <GradientBackground>
      <ScreenHeader
        title="Cities"
        right={
          <PillButton
            icon={<SymbolView name="plus" size={18} tintColor={Colors.text} />}
            accessibilityLabel="Add a city"
            onPress={() => setIsPickerOpen(true)}
          />
        }
      />

      <FlatList
        data={cities}
        keyExtractor={getLocationKey}
        renderItem={renderCity}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No cities yet</Text>
              <Text style={styles.emptyBody}>
                Add a city to compare its light with yours — useful when you are planning a
                shoot somewhere else.
              </Text>
            </View>
          )
        }
      />

      <Modal
        visible={isPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPickerOpen(false)}>
        <GradientBackground edges={['top', 'bottom']}>
          <SafeAreaView style={styles.modalRoot} edges={['bottom']}>
            <ScreenHeader
              title="Add a city"
              right={
                <PillButton
                  icon={<SymbolView name="xmark" size={16} tintColor={Colors.text} />}
                  accessibilityLabel="Close"
                  onPress={() => setIsPickerOpen(false)}
                />
              }
            />

            <FlatList
              data={available}
              keyExtractor={getLocationKey}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyBody}>Every available city has been added.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleAdd(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name}`}
                  style={({ pressed }) => [styles.presetRow, pressed && styles.presetRowPressed]}>
                  <Text style={styles.presetName}>{item.name}</Text>
                  <Text style={styles.presetZone}>{item.timeZone}</Text>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </GradientBackground>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: TabBarInset,
    gap: Spacing.md,
  },
  cityCard: {
    marginTop: Spacing.xs,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cityNameBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  cityName: {
    ...Type.label,
    fontSize: 20,
    color: Colors.text,
  },
  cityNext: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
  cityNextValue: {
    color: Colors.accent,
    fontWeight: '600',
  },
  cityTimes: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  cityTimeCell: {
    flex: 1,
    gap: Spacing.xs,
  },
  cityTimeLabel: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
  cityTimeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  cityTimeValue: {
    ...Type.label,
    fontSize: 19,
    color: Colors.text,
  },
  cityTimeUnit: {
    ...Type.unit,
    color: Colors.textSecondary,
  },
  cityTimeZone: {
    ...Type.unit,
    color: Colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.base,
  },
  emptyTitle: {
    ...Type.label,
    fontSize: 18,
    color: Colors.text,
  },
  emptyBody: {
    ...Type.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  presetRowPressed: {
    backgroundColor: Colors.cardElevated,
  },
  presetName: {
    ...Type.label,
    color: Colors.text,
  },
  presetZone: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
});
