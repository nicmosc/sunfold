import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { AppState, LayoutChangeEvent, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Card, CardDivider } from '@/components/ui/card';
import { EventRow, NO_EVENT_TIME } from '@/components/ui/event-row';
import { GradientBackground } from '@/components/ui/gradient-background';
import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { DayTimeline } from '@/components/viz/day-timeline';
import { SunSky } from '@/components/viz/sun-sky';
import { Colors, Radius, Spacing, TabBarInset, Type } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { formatCountdown, formatRelativeDay, formatTime, getGreeting } from '@/lib/format';
import { DEFAULT_LOCATION } from '@/lib/location';
import { getDayEvents, getDayProgress, getDaySummary, getNextEvent, getSunPosition } from '@/lib/sun';
import { getPhaseAccent, getSunGradient } from '@/lib/sun-colors';
import type { SunEvent, SunEventKey } from '@/lib/types';

const MS_PER_MINUTE = 60_000;
const SUN_SIZE = 132;
/** Height of the sky band above the horizon line the greeting sits on. */
const SKY_HEIGHT = 190;
/** Altitude ratio at or above which the text needs no scrim at all. */
const SCRIM_FADE_ABOVE = 0.38;
const SCRIM_MAX_INTENSITY = 60;

/** Rows shown in the summary card, in order, with the sublabel each should carry. */
const SUMMARY_ROWS: { key: SunEventKey; sublabel: string }[] = [
  { key: 'sunrise', sublabel: 'Today' },
  { key: 'goldenHourMorningEnd', sublabel: 'Morning · ends' },
  { key: 'solarNoon', sublabel: 'Sun at its highest' },
  { key: 'goldenHourEveningStart', sublabel: 'Evening · starts' },
  { key: 'sunset', sublabel: 'Today' },
];

function findEvent(events: SunEvent[], key: SunEventKey): SunEvent | undefined {
  return events.find((candidate) => candidate.key === key);
}

export default function HomeScreen() {
  const { location } = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [dayOffset, setDayOffset] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [skyWidth, setSkyWidth] = useState(0);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);

  /*
   * Ticks the hero countdown once a second, but only while the app is in the
   * foreground — a 1s timer left running in the background drains battery and
   * is the kind of thing App Review notices.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      timer ??= setInterval(() => setNow(new Date()), 1000);
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

  /*
   * `now` ticks every second to drive the countdown, but nothing derived from
   * suncalc needs that resolution. Truncating to the minute gives those memos a
   * dependency that only changes 60x less often — and, unlike passing a bare
   * cache-busting key, it is a dependency the memo body genuinely reads.
   */
  const minuteKey = Math.floor(now.getTime() / MS_PER_MINUTE);
  const minuteNow = useMemo(() => new Date(minuteKey * MS_PER_MINUTE), [minuteKey]);

  const selectedDate = useMemo(() => {
    const target = new Date(minuteNow);
    target.setDate(target.getDate() + dayOffset);
    return target;
  }, [minuteNow, dayOffset]);

  const events = useMemo(() => getDayEvents(selectedDate, loc), [selectedDate, loc]);
  const summary = useMemo(() => getDaySummary(selectedDate, loc), [selectedDate, loc]);
  const nextEvent = useMemo(() => getNextEvent(minuteNow, loc), [minuteNow, loc]);
  const liveProgress = useMemo(() => getDayProgress(minuteNow, loc), [minuteNow, loc]);

  const timelineProgress = scrubProgress ?? liveProgress;

  /** The instant the scrubber currently points at, for the bubble label. */
  const scrubbedTime = useMemo(() => {
    const { sunrise, sunset } = summary;
    if (sunrise === null || sunset === null) return null;
    const span = sunset.getTime() - sunrise.getTime();
    return new Date(sunrise.getTime() + timelineProgress * span);
  }, [summary, timelineProgress]);

  const bubbleLabel = (() => {
    const formatted = formatTime(scrubbedTime, loc.timeZone);
    return formatted.time === NO_EVENT_TIME
      ? NO_EVENT_TIME
      : `${formatted.time} ${formatted.period}`;
  })();

  /*
   * The disc's colour and height both track the sun's real altitude at whatever
   * instant the scrubber points at, so dragging across the day lifts it out
   * from behind the greeting, arcs it overhead, and sets it again.
   */
  const sunAltitude = getSunPosition(scrubbedTime ?? minuteNow, loc).altitude;
  const sunGradient = getSunGradient(sunAltitude);

  /*
   * Normalised against the day's OWN peak, not a fixed 90 degrees — otherwise a
   * winter day, where the sun barely clears the horizon, would never visibly
   * rise at all.
   */
  const peakAltitude =
    summary.solarNoon === null ? 0 : getSunPosition(summary.solarNoon, loc).altitude;
  const altitudeRatio = peakAltitude > 0 ? sunAltitude / peakAltitude : 0;

  /*
   * The scrim only blurs when it needs to. With the sun high there is nothing
   * behind the text to obscure, so the blur fades out entirely and the pastel
   * canvas shows through clean.
   */
  const scrimIntensity = Math.round(
    Math.min(1, Math.max(0, (SCRIM_FADE_ABOVE - altitudeRatio) / SCRIM_FADE_ABOVE)) *
      SCRIM_MAX_INTENSITY,
  );

  const countdown =
    nextEvent === null ? null : formatCountdown(nextEvent.date.getTime() - now.getTime());

  const goldenHourMorning = findEvent(events, 'goldenHourMorningStart');
  const goldenHourTime = formatTime(goldenHourMorning?.date ?? null, loc.timeZone);
  const sunriseTime = formatTime(summary.sunrise, loc.timeZone);
  const sunsetTime = formatTime(summary.sunset, loc.timeZone);

  async function handleShare() {
    const parts = [
      `${loc.name} — ${formatRelativeDay(selectedDate, loc.timeZone)}`,
      `Sunrise ${sunriseTime.time} ${sunriseTime.period}`,
      `Sunset ${sunsetTime.time} ${sunsetTime.period}`,
      `Golden hour ${goldenHourTime.time} ${goldenHourTime.period}`,
    ];
    await Share.share({ message: parts.join('\n') });
  }

  function handleTimelineLayout(event: LayoutChangeEvent) {
    setTimelineWidth(event.nativeEvent.layout.width);
  }

  function handleSkyLayout(event: LayoutChangeEvent) {
    setSkyWidth(event.nativeEvent.layout.width);
  }

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}>
        <ScreenHeader
          left={
            <PillButton
              label={formatRelativeDay(selectedDate, loc.timeZone)}
              trailingIcon={
                <SymbolView name="chevron.down" size={12} tintColor={Colors.textSecondary} />
              }
              onPress={() => setDayOffset((offset) => (offset === 0 ? 1 : 0))}
            />
          }
          right={
            <PillButton
              icon={
                <SymbolView name="square.and.arrow.up" size={18} tintColor={Colors.text} />
              }
              accessibilityLabel="Share today's sun times"
              onPress={() => void handleShare()}
            />
          }
        />

        {/*
          The sky and the text below it are siblings on purpose: the sun
          overflows the bottom of SunSky, and because the scrim is the later
          sibling it paints over the disc. That is what lets the sun rise from
          behind the greeting instead of floating above it.
        */}
        <View onLayout={handleSkyLayout}>
          <SunSky
            width={skyWidth}
            height={SKY_HEIGHT}
            size={SUN_SIZE}
            altitude={sunAltitude}
            peakAltitude={peakAltitude}
            progress={timelineProgress}
            gradient={sunGradient}
          />
        </View>

        <BlurView intensity={scrimIntensity} tint="light" style={styles.scrim}>
          <Text style={styles.greeting}>
            {getGreeting(now, loc.timeZone)}, <Text style={styles.greetingName}>{loc.name}</Text>
          </Text>

          {nextEvent !== null && countdown !== null && (
            <Text style={styles.hero}>
              {nextEvent.event.label} in <Text style={styles.heroValue}>{countdown}</Text>
            </Text>
          )}

          <Text style={styles.subline}>
            <Text style={styles.sublineStrong}>Golden hour</Text>
            {goldenHourTime.time === NO_EVENT_TIME
              ? ' does not occur today'
              : ` starts at ${goldenHourTime.time} ${goldenHourTime.period}`}
          </Text>
        </BlurView>

        <Card
          title="Sun Today"
          titleIcon={<SymbolView name="sun.max.fill" size={16} tintColor={Colors.accent} />}
          style={styles.card}>
          <View onLayout={handleTimelineLayout} style={styles.timelineSlot}>
            {timelineWidth > 0 && (
              <DayTimeline
                progress={timelineProgress}
                timeLabel={bubbleLabel}
                width={timelineWidth}
                onScrub={setScrubProgress}
              />
            )}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{sunriseTime.time}</Text>
              <Text style={styles.summaryLabel}>Sunrise</Text>
            </View>
            <View style={styles.summaryCell}>
              <SymbolView name="sun.horizon.fill" size={22} tintColor={Colors.accent} />
              <Text style={styles.summaryLabel}>Good Sun</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{sunsetTime.time}</Text>
              <Text style={styles.summaryLabel}>Sunset</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card} contentStyle={styles.listCard}>
          {SUMMARY_ROWS.map(({ key, sublabel }, index) => {
            const event = findEvent(events, key);
            const formatted = formatTime(event?.date ?? null, loc.timeZone);

            return (
              <View key={key}>
                {index > 0 && <CardDivider />}
                <EventRow
                  label={event?.label ?? key}
                  sublabel={sublabel}
                  time={formatted.time}
                  period={formatted.period}
                  tz={formatted.tz}
                  accentColor={getPhaseAccent(key)}
                />
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: TabBarInset,
    gap: Spacing.sm,
  },
  /*
   * Negative top margin pulls the scrim up over the bottom of the sky band, so
   * the sun is already partly behind the text at altitude 0 rather than
   * touching its top edge. `overflow: hidden` keeps the blur inside the radius.
   */
  scrim: {
    marginTop: -Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: -Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  greeting: {
    ...Type.body,
    color: Colors.textSecondary,
  },
  greetingName: {
    color: Colors.text,
    fontWeight: '600',
  },
  hero: {
    ...Type.headline,
    color: Colors.text,
  },
  heroValue: {
    color: Colors.accent,
  },
  subline: {
    ...Type.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  sublineStrong: {
    color: Colors.text,
    fontWeight: '600',
  },
  card: {
    marginTop: Spacing.md,
  },
  listCard: {
    paddingVertical: Spacing.xs,
  },
  timelineSlot: {
    marginBottom: Spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  summaryValue: {
    ...Type.label,
    fontSize: 20,
    color: Colors.text,
  },
  summaryLabel: {
    ...Type.caption,
    color: Colors.textSecondary,
  },
});
