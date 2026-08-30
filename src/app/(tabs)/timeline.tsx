import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { AppState, LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, CardDivider } from '@/components/ui/card';
import { EventRow } from '@/components/ui/event-row';
import { GradientBackground } from '@/components/ui/gradient-background';
import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { DaylightArc } from '@/components/viz/daylight-arc';
import { SunDisc } from '@/components/viz/sun-disc';
import { Colors, Spacing, TabBarInset, Type } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { formatDuration, formatTime } from '@/lib/format';
import { DEFAULT_LOCATION } from '@/lib/location';
import { getDayProgress, getDaylightRemaining, getDaySummary, getSunPosition } from '@/lib/sun';
import { getPhaseAccent, getSkyGradient, getSunGradient } from '@/lib/sun-colors';
import type { SunEventKey } from '@/lib/types';

const MS_PER_MINUTE = 60_000;
const SUN_SIZE = 130;

/**
 * The full day, first light to last light. Each row's value colour comes from
 * `getPhaseAccent`, so the list reads as the day's own gradient — violet at the
 * edges, through red and gold, to bright orange at noon.
 */
const TIMELINE_ROWS: SunEventKey[] = [
  'firstLight',
  'blueHourMorningStart',
  'sunrise',
  'goldenHourMorningEnd',
  'solarNoon',
  'goldenHourEveningStart',
  'sunset',
  'blueHourEveningEnd',
  'lastLight',
];

export default function TimelineScreen() {
  const { location } = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [arcWidth, setArcWidth] = useState(0);

  /* Minute resolution is enough here — nothing on this screen counts seconds. */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      timer ??= setInterval(() => setNow(new Date()), MS_PER_MINUTE);
    };

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    start();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, []);

  const loc = location ?? DEFAULT_LOCATION;

  /* Minute-truncated clock, so these memos depend on something they actually read. */
  const minuteKey = Math.floor(now.getTime() / MS_PER_MINUTE);
  const minuteNow = useMemo(() => new Date(minuteKey * MS_PER_MINUTE), [minuteKey]);

  const summary = useMemo(() => getDaySummary(minuteNow, loc), [minuteNow, loc]);
  const daylight = useMemo(() => getDaylightRemaining(minuteNow, loc), [minuteNow, loc]);
  const progress = useMemo(() => getDayProgress(minuteNow, loc), [minuteNow, loc]);

  /* Shared with Home so the canvas matches when switching tabs. */
  const sunAltitude = getSunPosition(minuteNow, loc).altitude;
  const skyGradient = getSkyGradient(sunAltitude);

  const remaining = formatDuration(daylight.remainingMs);
  const sunriseTime = formatTime(summary.sunrise, loc.timeZone);
  const sunsetTime = formatTime(summary.sunset, loc.timeZone);

  const { moon } = summary;
  const moonIllumination = `${Math.round(moon.illumination * 100)}`;

  function handleArcLayout(event: LayoutChangeEvent) {
    setArcWidth(event.nativeEvent.layout.width);
  }

  return (
    <GradientBackground colors={skyGradient}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          left={
            <PillButton
              icon={<SymbolView name="gearshape.fill" size={18} tintColor={Colors.text} />}
              accessibilityLabel="Settings"
              // TODO: Settings screen — units, notification preferences, theme.
              onPress={() => undefined}
            />
          }
          right={
            <PillButton
              icon={<SymbolView name="location.fill" size={14} tintColor={Colors.accent} />}
              label={loc.name}
              // TODO: Opens the location picker once Cities supports selection.
              onPress={() => undefined}
            />
          }
          title="Today's Light"
          subtitle="Perfect conditions for photography"
        />

        <View style={styles.sun}>
          <SunDisc size={SUN_SIZE} gradient={getSunGradient(sunAltitude)} />
        </View>

        <Card contentStyle={styles.listCard}>
          {TIMELINE_ROWS.map((key, index) => {
            const event = summary.events.find((candidate) => candidate.key === key);
            const formatted = formatTime(event?.date ?? null, loc.timeZone);

            return (
              <View key={key}>
                {index > 0 && <CardDivider />}
                <EventRow
                  label={event?.label ?? key}
                  sublabel={event?.sublabel}
                  time={formatted.time}
                  period={formatted.period}
                  tz={formatted.tz}
                  accentColor={getPhaseAccent(key)}
                />
              </View>
            );
          })}

          <CardDivider />
          {/*
            The reference mockup puts a clock time on this row, which is wrong —
            a moon phase is a state, not an instant. Showing illumination instead.
          */}
          <EventRow
            label="Moon phase"
            sublabel={moon.phaseName}
            time={moonIllumination}
            period="%"
            tz="lit"
            accentColor={Colors.indigo}
          />
        </Card>

        <Card title="Daylight Remaining" style={styles.card}>
          <View onLayout={handleArcLayout} style={styles.arcSlot}>
            {arcWidth > 0 && (
              <DaylightArc
                progress={progress}
                width={arcWidth}
                sunriseLabel={sunriseTime.time}
                sunsetLabel={sunsetTime.time}
              />
            )}
          </View>

          <View style={styles.remaining}>
            <Text style={styles.remainingValue}>{remaining.hours}</Text>
            <Text style={styles.remainingUnit}>hr</Text>
            <Text style={styles.remainingValue}>{remaining.minutes}</Text>
            <Text style={styles.remainingUnit}>min</Text>
          </View>
          <Text style={styles.remainingCaption}>
            {daylight.isPolarNight
              ? 'Polar night — the sun stays below the horizon'
              : daylight.isPolarDay
                ? 'Polar day — the sun does not set'
                : 'of daylight left'}
          </Text>
        </Card>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: TabBarInset,
  },
  sun: {
    alignItems: 'center',
    marginVertical: Spacing.base,
  },
  card: {
    marginTop: Spacing.base,
  },
  listCard: {
    paddingVertical: Spacing.xs,
  },
  arcSlot: {
    marginBottom: Spacing.sm,
  },
  remaining: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  remainingValue: {
    ...Type.display,
    color: Colors.text,
  },
  remainingUnit: {
    ...Type.unit,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  remainingCaption: {
    ...Type.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
