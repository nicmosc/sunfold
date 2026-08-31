import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { OptionRow, Sheet } from '@/components/ui/sheet';
import { Colors, Radius, Size, Spacing, Type } from '@/constants/theme';
import { getLocationKey, PRESET_CITIES, searchCities } from '@/lib/location';
import type { Location } from '@/lib/types';

/**
 * How long typing must pause before a lookup fires. The platform geocoder is
 * rate-limited and errors out under concurrent requests, so a keystroke must
 * not equal a request.
 */
const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 2;

export interface CitySearchSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Already-saved cities, filtered out of both the presets and the results. */
  savedKeys: Set<string>;
  onAdd: (city: Location) => void;
}

/**
 * Add-a-city sheet: search by name, falling back to the curated offline list
 * when the field is empty.
 *
 * Search is the one networked action in this app — everything the app displays
 * is computed on device. So the presets stay visible and usable with no
 * connection, and a failed lookup degrades to "no matches" rather than an error.
 */
export function CitySearchSheet({ visible, onClose, savedKeys, onAdd }: CitySearchSheetProps) {
  const [query, setQuery] = useState('');
  /*
   * Results carry the query they answer. That one field removes the need for
   * separate `isSearching` / `hasSearched` flags: if the stored query does not
   * match what is typed, a lookup is still outstanding. It also invalidates
   * stale results for free, and keeps every setState inside the async callback
   * rather than the effect body, which `react-hooks/set-state-in-effect`
   * rightly rejects.
   */
  const [found, setFound] = useState<{ query: string; cities: Location[] }>({
    query: '',
    cities: [],
  });

  const trimmed = query.trim();
  const isSearchMode = trimmed.length >= MIN_QUERY_LENGTH;
  const isResolved = found.query === trimmed;
  const isSearching = isSearchMode && !isResolved;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      const cities = await searchCities(trimmed);
      /*
       * The geocoder is slow enough that a stale response routinely lands after
       * a newer keystroke; without this guard the older result would overwrite
       * the newer one.
       */
      if (!cancelled) {
        setFound({ query: trimmed, cities });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const presets = PRESET_CITIES.filter((city) => !savedKeys.has(getLocationKey(city)));
  const visibleResults = isResolved
    ? found.cities.filter((city) => !savedKeys.has(getLocationKey(city)))
    : [];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add a city"
      subtitle="Search anywhere, or pick from the offline list">
      <View style={styles.searchField}>
        <SymbolView name="magnifyingglass" size={16} tintColor={Colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a city"
          placeholderTextColor={Colors.textTertiary}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search for a city"
        />
        {isSearching && <ActivityIndicator size="small" color={Colors.textSecondary} />}
      </View>

      {isSearchMode ? (
        <>
          {visibleResults.map((city) => (
            <OptionRow
              key={getLocationKey(city)}
              label={city.name}
              detail={city.timeZone}
              onPress={() => onAdd(city)}
              icon={<SymbolView name="plus.circle" size={16} tintColor={Colors.accent} />}
            />
          ))}

          {isResolved && visibleResults.length === 0 && (
            <Text style={styles.note}>
              No matches. Search needs a connection — the list below always works offline.
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.heading}>Offline list</Text>
          {presets.map((city) => (
            <OptionRow
              key={getLocationKey(city)}
              label={city.name}
              detail={city.timeZone}
              onPress={() => onAdd(city)}
              icon={<SymbolView name="plus.circle" size={16} tintColor={Colors.accent} />}
            />
          ))}
          {presets.length === 0 && (
            <Text style={styles.note}>Every city in the offline list has been added.</Text>
          )}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardElevated,
    borderWidth: Size.hairline,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Type.body,
    color: Colors.text,
  },
  heading: {
    ...Type.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  note: {
    ...Type.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    lineHeight: 18,
  },
});
