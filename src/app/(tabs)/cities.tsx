import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { Card, CardDivider } from '@/components/ui/card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CitySearchSheet } from '@/components/city-search-sheet';
import { Colors, Size, Spacing, TabBarInset, Type } from '@/constants/theme';
import { useActiveLocation } from '@/hooks/use-active-location';
import { useCities } from '@/hooks/use-cities';
import { useScrollReset } from '@/hooks/use-scroll-reset';
import { useSettings } from '@/hooks/use-settings';
import { useTabFocus } from '@/hooks/use-tab-focus';
import { formatCountdown, formatTime } from '@/lib/format';
import { getLocationKey } from '@/lib/location';
import { getDaySummary, getNextEvent, getSunPosition } from '@/lib/sun';
import { getPhaseAccent, getSkyGradient } from '@/lib/sun-colors';
import type { Location } from '@/lib/types';

/**
 * The light right now, as a phrase rather than a number. This is the thing the
 * screen exists to answer: where is the light good at this moment.
 *
 * Thresholds are the ones photographers use — golden hour is the sun between 0
 * and 6 degrees, civil twilight down to −6.
 */
function describeLight(altitude: number): { label: string; accent: string } {
  if (altitude >= 6) return { label: 'Daylight', accent: getPhaseAccent('solarNoon') };
  if (altitude >= 0) return { label: 'Golden hour', accent: getPhaseAccent('goldenHourMorningEnd') };
  if (altitude >= -6) return { label: 'Blue hour', accent: getPhaseAccent('blueHourMorningStart') };
  if (altitude >= -18) return { label: 'Twilight', accent: getPhaseAccent('firstLight') };
  return { label: 'Night', accent: getPhaseAccent('nadir') };
}

interface CityCardProps {
  city: Location;
  isActive: boolean;
  hour12: boolean;
  onSelect: (city: Location) => void;
  onRemove: (city: Location) => void;
}

/**
 * One saved city.
 *
 * Every time here is formatted in the CITY's own timezone, never the device's.
 * That is the entire point of the screen, and getting it wrong would look
 * completely plausible while being hours out.
 */
function CityCard({ city, isActive, hour12, onSelect, onRemove }: CityCardProps) {
  const now = new Date();
  const summary = getDaySummary(now, city);
  const next = getNextEvent(now, city);
  const altitude = getSunPosition(now, city).altitude;
  const light = describeLight(altitude);

  const sunrise = formatTime(summary.sunrise, city.timeZone, hour12);
  const sunset = formatTime(summary.sunset, city.timeZone, hour12);
  const localNow = formatTime(now, city.timeZone, hour12);

  return (
    <Pressable
      onPress={() => onSelect(city)}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${city.name}, ${light.label}, local time ${localNow.time} ${localNow.period}. Tap to show this location.`}>
      <Card style={[styles.cityCard, isActive && styles.cityCardActive]}>
        <View style={styles.cityHeader}>
          <View style={styles.cityNameBlock}>
            <View style={styles.cityNameRow}>
              <Text style={styles.cityName}>{city.name}</Text>
              {isActive && (
                <SymbolView name="location.fill" size={13} tintColor={Colors.accent} />
              )}
            </View>
            <Text style={[styles.lightLabel, { color: light.accent }]}>
              {light.label}
              <Text style={styles.localTime}>
                {'  ·  '}
                {localNow.time}
                {localNow.period === '' ? '' : ` ${localNow.period}`} local
              </Text>
            </Text>
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
            <Text style={styles.cityTimeValue}>{sunrise.time}</Text>
          </View>

          <View style={styles.cityTimeCell}>
            <Text style={styles.cityTimeLabel}>Sunset</Text>
            <Text style={styles.cityTimeValue}>{sunset.time}</Text>
          </View>

          <View style={[styles.cityTimeCell, styles.nextCell]}>
            <Text style={styles.cityTimeLabel}>Next</Text>
            {next === null ? (
              <Text style={styles.cityTimeValue}>—</Text>
            ) : (
              <Text style={styles.nextValue} numberOfLines={1}>
                {next.event.label}
                <Text style={styles.nextCountdown}>
                  {'  '}
                  {formatCountdown(next.date.getTime() - now.getTime())}
                </Text>
              </Text>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function CitiesScreen() {
  const listRef = useRef<FlatList<Location>>(null);
  const { isFocused } = useTabFocus('/cities');
  useScrollReset(listRef, isFocused);

  const { cities, addCity, removeCity, isLoading } = useCities();
  const { location, setLocation } = useActiveLocation();
  const { settings } = useSettings();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const activeKey = getLocationKey(location);
  const savedKeys = new Set(cities.map(getLocationKey));

  /*
   * Sorted by how high the sun is right now, so the cities with usable light
   * rise to the top. That ordering is the reason to have this screen rather
   * than a plain list.
   */
  const sorted = [...cities].sort(
    (a, b) => getSunPosition(new Date(), b).altitude - getSunPosition(new Date(), a).altitude,
  );

  const skyGradient = getSkyGradient(getSunPosition(new Date(), location).altitude);

  function handleAdd(city: Location) {
    addCity(city);
    setIsPickerOpen(false);
  }

  function handleSelect(city: Location) {
    void setLocation(city);
  }

  function renderCity({ item }: ListRenderItemInfo<Location>) {
    return (
      <CityCard
        city={item}
        isActive={getLocationKey(item) === activeKey}
        hour12={settings.hour12}
        onSelect={handleSelect}
        onRemove={removeCity}
      />
    );
  }

  return (
    <GradientBackground colors={skyGradient}>
      <ScreenHeader
        title="Cities"
        subtitle="Tap a city to show its light on Home"
        right={
          <PillButton
            icon={<SymbolView name="plus" size={18} tintColor={Colors.text} />}
            accessibilityLabel="Add a city"
            onPress={() => setIsPickerOpen(true)}
          />
        }
      />

      <FlatList
        ref={listRef}
        data={sorted}
        keyExtractor={getLocationKey}
        renderItem={renderCity}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No cities yet</Text>
              <Text style={styles.emptyBody}>
                Add a city to see where the light is good right now — and tap one to switch Home
                to it.
              </Text>
            </View>
          )
        }
      />

      {/* Keyed so opening the sheet remounts it with an empty field, rather
          than resetting state from an effect. */}
      <CitySearchSheet
        key={isPickerOpen ? 'open' : 'closed'}
        visible={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        savedKeys={savedKeys}
        onAdd={handleAdd}
      />
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
  cityCardActive: {
    borderWidth: Size.hairline * 2,
    borderColor: Colors.accentSoft,
    borderRadius: Spacing.xl,
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
  cityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cityName: {
    ...Type.label,
    fontSize: 20,
    color: Colors.text,
  },
  lightLabel: {
    ...Type.caption,
    fontWeight: '600',
  },
  localTime: {
    ...Type.caption,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  cityTimes: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  cityTimeCell: {
    flex: 1,
    gap: Spacing.xs,
  },
  nextCell: {
    flex: 1.6,
  },
  cityTimeLabel: {
    ...Type.unit,
    color: Colors.textTertiary,
  },
  cityTimeValue: {
    ...Type.label,
    fontSize: 19,
    color: Colors.text,
  },
  nextValue: {
    ...Type.caption,
    fontWeight: '600',
    color: Colors.text,
  },
  nextCountdown: {
    ...Type.caption,
    fontWeight: '400',
    color: Colors.accent,
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
});
