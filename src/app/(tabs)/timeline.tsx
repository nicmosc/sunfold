import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, CardDivider } from '@/components/ui/card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Spacing, TabBarInset, Type } from '@/constants/theme';
import { useActiveLocation } from '@/hooks/use-active-location';
import { useSettings } from '@/hooks/use-settings';
import { formatDuration, formatTime } from '@/lib/format';
import { getNotableDates, getOutlook, type NotableKind } from '@/lib/outlook';
import { getSunPosition } from '@/lib/sun';
import { getSkyGradient } from '@/lib/sun-colors';

const OUTLOOK_DAYS = 14;
const EM_DASH = '—';

/** Glyph per notable-date kind, so the list scans without reading every label. */
const NOTABLE_ICONS: Record<NotableKind, SymbolViewProps['name']> = {
  equinox: 'circle.lefthalf.filled',
  solstice: 'sun.max.fill',
  earliestSunrise: 'sunrise.fill',
  latestSunrise: 'sunrise',
  earliestSunset: 'sunset',
  latestSunset: 'sunset.fill',
  dstChange: 'clock.arrow.circlepath',
};

function NOTABLE_TINT(kind: NotableKind): string {
  if (kind === 'dstChange') return Colors.indigo;
  if (kind === 'equinox') return Colors.indigoSoft;
  return Colors.accent;
}

/** "+2m" / "−3m" / "0m". The sign is the whole point of the column. */
function formatDelta(deltaMs: number | null): string {
  if (deltaMs === null) return EM_DASH;

  const totalMinutes = Math.round(deltaMs / 60_000);
  if (totalMinutes === 0) return '0m';

  // A true minus sign, not a hyphen — it aligns with the digits.
  const sign = totalMinutes < 0 ? '−' : '+';
  const absolute = Math.abs(totalMinutes);

  return absolute >= 60
    ? `${sign}${Math.floor(absolute / 60)}h ${absolute % 60}m`
    : `${sign}${absolute}m`;
}

function formatDayLength(ms: number | null): string {
  if (ms === null) return EM_DASH;
  const { hours, minutes } = formatDuration(ms);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function TimelineScreen() {
  const { location } = useActiveLocation();
  const { settings } = useSettings();
  const { hour12 } = settings;

  /*
   * Anchored to the calendar day, not the clock. Both of these are expensive —
   * `getNotableDates` sweeps 400 days of suncalc — and neither changes within a
   * day, so recomputing on a ticking clock would be pure waste.
   */
  const dayKey = new Date().toDateString();
  /** Local midnight today, derived from the key so the memo deps are honest. */
  const today = useMemo(() => new Date(dayKey), [dayKey]);

  const outlook = useMemo(() => getOutlook(today, OUTLOOK_DAYS, location), [today, location]);
  const notable = useMemo(() => getNotableDates(today, location), [today, location]);

  /*
   * The canvas follows the sun's CURRENT altitude, not `today` — that is local
   * midnight, which would paint a night sky at noon. Unmemoized on purpose:
   * this screen has no ticking state, so it renders rarely and one
   * getSunPosition call costs nothing.
   */
  const skyGradient = getSkyGradient(getSunPosition(new Date(), location).altitude);

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: location.timeZone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [location.timeZone],
  );

  const notableFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: location.timeZone,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [location.timeZone],
  );

  return (
    <GradientBackground colors={skyGradient}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Outlook"
          subtitle={`How the light is shifting in ${location.name}`}
        />

        <Card contentStyle={styles.listCard} style={styles.card}>
          <View style={styles.columnHeader}>
            <Text style={[styles.columnLabel, styles.dayColumn]}>Day</Text>
            <Text style={[styles.columnLabel, styles.timeColumn]}>Sunrise</Text>
            <Text style={[styles.columnLabel, styles.timeColumn]}>Sunset</Text>
            {/*
              `lengthColumn` sets alignItems, which does nothing to a Text — the
              header needs textAlign or it butts straight into "Sunset".
            */}
            <Text style={[styles.columnLabel, styles.lengthColumn, styles.alignRight]}>
              Daylight
            </Text>
          </View>

          {outlook.map((day, index) => {
            const rise = formatTime(day.sunrise, location.timeZone, hour12);
            const set = formatTime(day.sunset, location.timeZone, hour12);
            const isToday = index === 0;
            const delta = formatDelta(day.deltaMs);
            const losing = day.deltaMs !== null && day.deltaMs < 0;

            return (
              <View key={day.date.toISOString()}>
                <CardDivider />
                <View style={styles.row}>
                  <Text
                    style={[styles.day, styles.dayColumn, isToday && styles.today]}
                    numberOfLines={1}>
                    {isToday ? 'Today' : weekdayFormatter.format(day.date)}
                  </Text>
                  <Text style={[styles.time, styles.timeColumn]}>{rise.time}</Text>
                  <Text style={[styles.time, styles.timeColumn]}>{set.time}</Text>
                  <View style={styles.lengthColumn}>
                    <Text style={styles.length}>{formatDayLength(day.dayLengthMs)}</Text>
                    <Text style={[styles.delta, losing ? styles.deltaLosing : styles.deltaGaining]}>
                      {delta}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>

        <Card title="Coming up" style={styles.card} contentStyle={styles.listCard}>
          {notable.length === 0 && (
            <Text style={styles.emptyNotable}>
              Nothing notable in the next year at this latitude.
            </Text>
          )}

          {notable.map((entry, index) => (
            <View key={`${entry.kind}-${entry.date.toISOString()}`}>
              {index > 0 && <CardDivider />}
              <View style={styles.notableRow}>
                <View
                  style={styles.notableIcon}
                  accessibilityElementsHidden
                  importantForAccessibility="no">
                  <SymbolView
                    name={NOTABLE_ICONS[entry.kind]}
                    size={18}
                    tintColor={NOTABLE_TINT(entry.kind)}
                  />
                </View>

                <View style={styles.notableLabels}>
                  <Text style={styles.notableLabel}>{entry.label}</Text>
                  {entry.detail !== undefined && (
                    <Text style={styles.notableDetail}>{entry.detail}</Text>
                  )}
                </View>

                <Text style={styles.notableDate}>{notableFormatter.format(entry.date)}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={styles.footnote}>
          Earliest sunrise and the summer solstice fall on different days — the equation of time
          shifts them apart by a week or more.
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: TabBarInset,
  },
  card: {
    marginTop: Spacing.base,
  },
  listCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: Spacing.sm,
  },
  columnLabel: {
    ...Type.unit,
    color: Colors.textTertiary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  dayColumn: {
    flex: 1.5,
  },
  timeColumn: {
    flex: 1.1,
    textAlign: 'right',
  },
  lengthColumn: {
    flex: 1.6,
    alignItems: 'flex-end',
  },
  alignRight: {
    textAlign: 'right',
  },
  day: {
    ...Type.label,
    color: Colors.textSecondary,
  },
  today: {
    color: Colors.text,
  },
  time: {
    ...Type.label,
    fontWeight: '400',
    color: Colors.text,
  },
  length: {
    ...Type.label,
    color: Colors.text,
  },
  delta: {
    ...Type.unit,
    marginTop: 2,
  },
  deltaLosing: {
    color: Colors.indigoSoft,
  },
  deltaGaining: {
    color: Colors.accent,
  },
  notableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  notableIcon: {
    width: Spacing.xl,
    alignItems: 'center',
  },
  notableLabels: {
    flex: 1,
    gap: 2,
  },
  notableLabel: {
    ...Type.label,
    color: Colors.text,
  },
  notableDetail: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
  notableDate: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
  emptyNotable: {
    ...Type.caption,
    color: Colors.textSecondary,
    paddingVertical: Spacing.md,
  },
  footnote: {
    ...Type.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    lineHeight: 18,
  },
});
