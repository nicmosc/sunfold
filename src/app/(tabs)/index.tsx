import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  LayoutChangeEvent,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DayPickerSheet } from '@/components/day-picker-sheet';
import { LocationPickerSheet } from '@/components/location-picker-sheet';
import { SettingsSheet } from '@/components/settings-sheet';
import { Card, CardDivider } from '@/components/ui/card';
import { EventRow, NO_EVENT_TIME } from '@/components/ui/event-row';
import { GradientBackground } from '@/components/ui/gradient-background';
import { PillButton } from '@/components/ui/pill-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { DayTimeline } from '@/components/viz/day-timeline';
import { DaylightArc } from '@/components/viz/daylight-arc';
import { SunSky } from '@/components/viz/sun-sky';
import { Colors, Radius, Size, Spacing, TabBarInset, Type } from '@/constants/theme';
import { useActiveLocation } from '@/hooks/use-active-location';
import { useScrollReset } from '@/hooks/use-scroll-reset';
import { useSettings } from '@/hooks/use-settings';
import { useTabFocus } from '@/hooks/use-tab-focus';
import {
  formatCountdown,
  formatDuration,
  formatRelativeDay,
  formatTime,
  getGreeting,
} from '@/lib/format';
import {
  getDayEvents,
  getDayProgress,
  getDaylightRemaining,
  getDaySummary,
  getNextEvent,
  getSunPosition,
} from '@/lib/sun';
import { getPhaseAccent, getSkyGradient, getSunGradient, getSunSize } from '@/lib/sun-colors';
import type { SunEventKey } from '@/lib/types';

const MS_PER_MINUTE = 60_000;
/** The sun swells near the horizon and shrinks at its peak, as the real one does. */
const SUN_SIZE_HORIZON = 160;
const SUN_SIZE_PEAK = 106;
/** Height of the sky band above the horizon line the greeting sits on. */
const SKY_HEIGHT = 190;
/**
 * The scrim is permanent, so it keeps a floor of blur and only intensifies as
 * the sun drops in behind it. Vanishing entirely read as a rendering bug.
 */
const SCRIM_MIN_INTENSITY = 30;
const SCRIM_MAX_INTENSITY = 72;
const SCRIM_FADE_ABOVE = 0.38;

/** Twilight rows, hidden when the `showTwilight` setting is off. */
const TWILIGHT_KEYS = new Set<SunEventKey>([
  'firstLight',
  'blueHourMorningStart',
  'blueHourEveningEnd',
  'lastLight',
]);

/** The full day, first light to last light, in order. */
const EVENT_KEYS: SunEventKey[] = [
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

interface HeroEvent {
  label: string;
  date: Date;
}

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { isFocused } = useTabFocus('/');
  useScrollReset(scrollRef, isFocused);

  const { location, isDeviceLocation, deviceError, deviceStatus } = useActiveLocation();
  const { settings } = useSettings();
  const { hour12, showTwilight } = settings;

  /*
   * Why `deviceStatus` and not just `deviceError`: the error is also set for a
   * failed fix, where permission is fine and pointing the user at Settings
   * would be wrong advice. Only a standing denial is actionable there.
   *
   * `isDeviceLocation` gates it too — under a pinned city the device position
   * is not what is on screen, so the notice would be explaining nothing.
   */
  const showLocationNotice = deviceStatus === 'denied' && isDeviceLocation && deviceError !== null;

  const [now, setNow] = useState(() => new Date());
  const [dayOffset, setDayOffset] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [arcWidth, setArcWidth] = useState(0);
  const [skyWidth, setSkyWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const [openSheet, setOpenSheet] = useState<'day' | 'location' | 'settings' | null>(null);

  /*
   * Ticks the countdown once a second, but only in the foreground — a 1s timer
   * left running in the background drains battery and is the kind of thing App
   * Review notices.
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

  /*
   * `now` ticks every second for the countdown, but nothing derived from
   * suncalc needs that resolution. Truncating to the minute gives those memos a
   * dependency that changes 60x less often — and one the body actually reads.
   */
  const minuteKey = Math.floor(now.getTime() / MS_PER_MINUTE);
  const minuteNow = useMemo(() => new Date(minuteKey * MS_PER_MINUTE), [minuteKey]);

  const selectedDate = useMemo(() => {
    const target = new Date(minuteNow);
    target.setDate(target.getDate() + dayOffset);
    return target;
  }, [minuteNow, dayOffset]);

  const events = useMemo(() => getDayEvents(selectedDate, location), [selectedDate, location]);
  const summary = useMemo(() => getDaySummary(selectedDate, location), [selectedDate, location]);
  const daylight = useMemo(
    () => getDaylightRemaining(selectedDate, location),
    [selectedDate, location],
  );

  /*
   * The hero countdown follows the SELECTED day: the first event on it that has
   * not passed. Using `getNextEvent(now)` alone described today even while the
   * rows below described a different day.
   *
   * When the selected day is fully elapsed — late tonight, or a past day — it
   * falls back to the rolling next event, which crosses into following days.
   */
  const rollingNext = useMemo(() => getNextEvent(minuteNow, location), [minuteNow, location]);

  const hero = useMemo<HeroEvent | null>(() => {
    const nowMs = minuteNow.getTime();
    const upcoming = events.find(
      (candidate) => candidate.date !== null && candidate.date.getTime() > nowMs,
    );

    if (upcoming !== undefined && upcoming.date !== null) {
      return { label: upcoming.label, date: upcoming.date };
    }

    return rollingNext === null
      ? null
      : { label: rollingNext.event.label, date: rollingNext.date };
  }, [events, minuteNow, rollingNext]);

  /*
   * Scrubber position, measured against the SELECTED day's span. Clamping then
   * expresses the whole rule: live during that day's light, pinned to sunset
   * after it, pinned to sunrise before it.
   */
  const liveProgress = useMemo(() => {
    const { sunrise, sunset } = summary;
    if (sunrise === null || sunset === null) {
      return getDayProgress(minuteNow, location);
    }
    const span = sunset.getTime() - sunrise.getTime();
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (minuteNow.getTime() - sunrise.getTime()) / span));
  }, [summary, minuteNow, location]);

  const timelineProgress = scrubProgress ?? liveProgress;

  /** The instant the scrubber points at, for the bubble and the sun's colour. */
  const scrubbedTime = useMemo(() => {
    const { sunrise, sunset } = summary;
    if (sunrise === null || sunset === null) return null;
    const span = sunset.getTime() - sunrise.getTime();
    return new Date(sunrise.getTime() + timelineProgress * span);
  }, [summary, timelineProgress]);

  const sunAltitude = getSunPosition(scrubbedTime ?? minuteNow, location).altitude;
  const sunGradient = getSunGradient(sunAltitude);
  const skyGradient = getSkyGradient(sunAltitude);

  /*
   * Normalised against the day's OWN peak, not a fixed 90 degrees — otherwise a
   * winter day, where the sun barely clears the horizon, would never visibly
   * rise at all.
   */
  const peakAltitude =
    summary.solarNoon === null ? 0 : getSunPosition(summary.solarNoon, location).altitude;
  const altitudeRatio = peakAltitude > 0 ? sunAltitude / peakAltitude : 0;

  const scrimRamp = Math.min(1, Math.max(0, (SCRIM_FADE_ABOVE - altitudeRatio) / SCRIM_FADE_ABOVE));
  const scrimIntensity = Math.round(
    SCRIM_MIN_INTENSITY + scrimRamp * (SCRIM_MAX_INTENSITY - SCRIM_MIN_INTENSITY),
  );

  const sunSize = getSunSize(altitudeRatio, SUN_SIZE_HORIZON, SUN_SIZE_PEAK);

  const bubbleLabel = (() => {
    const formatted = formatTime(scrubbedTime, location.timeZone, hour12);
    return formatted.time === NO_EVENT_TIME
      ? NO_EVENT_TIME
      : `${formatted.time} ${formatted.period}`.trim();
  })();

  /*
   * Two clocks meet here, and they disagree by up to a minute: `hero` is picked
   * against `minuteNow` so its memo does not rerun every second, while the
   * countdown has to be measured against `now` to tick. An event inside the
   * current minute therefore reads as upcoming but yields a delta of <= 0,
   * which `formatCountdown` renders as "now" — and the phrasing below has to
   * cope with that rather than emitting "Golden hour in now".
   */
  const heroDeltaMs = hero === null ? null : hero.date.getTime() - now.getTime();
  const countdown = heroDeltaMs === null ? null : formatCountdown(heroDeltaMs);
  /** The event's moment has arrived: "Golden hour now", not "... in now". */
  const heroIsNow = heroDeltaMs !== null && heroDeltaMs <= 0;
  const remaining = formatDuration(daylight.remainingMs);
  const sunriseTime = formatTime(summary.sunrise, location.timeZone, hour12);
  const sunsetTime = formatTime(summary.sunset, location.timeZone, hour12);
  /*
   * The cell between sunrise and sunset used to be an icon and the fixed words
   * "Good Sun", which never changed with the day, the location or anything
   * else — it read as a stat that had not been wired up. Solar noon is the real
   * value that belongs there: it is the peak the arc above it is drawing, it
   * exists even through a polar night, and `getDaySummary` already returns it.
   */
  const solarNoonTime = formatTime(summary.solarNoon, location.timeZone, hour12);

  const goldenHourStart = events.find((event) => event.key === 'goldenHourEveningStart');
  const goldenHourTime = formatTime(goldenHourStart?.date ?? null, location.timeZone, hour12);

  const visibleKeys = showTwilight
    ? EVENT_KEYS
    : EVENT_KEYS.filter((key) => !TWILIGHT_KEYS.has(key));

  const { moon } = summary;

  const getDayTimes = useCallback(
    (date: Date) => {
      const day = getDaySummary(date, location);
      return { sunrise: day.sunrise, sunset: day.sunset };
    },
    [location],
  );

  function handleSelectDay(offset: number) {
    setDayOffset(offset);
    setScrubProgress(null);
    setOpenSheet(null);
  }

  function handleOpenSettings() {
    // Rejects only if the OS declines to open the pane, and there is no second
    // route to offer if it does, so the failure is a no-op rather than an alert.
    void Linking.openSettings().catch(() => undefined);
  }

  function handleTimelineLayout(event: LayoutChangeEvent) {
    setTimelineWidth(event.nativeEvent.layout.width);
  }

  function handleArcLayout(event: LayoutChangeEvent) {
    setArcWidth(event.nativeEvent.layout.width);
  }

  function handleSkyLayout(event: LayoutChangeEvent) {
    setSkyWidth(event.nativeEvent.layout.width);
  }

  /*
   * The pinned sky layer sits directly below the header, so it has to know how
   * tall the header actually is — that varies with the safe-area inset.
   */
  function handleHeaderLayout(event: LayoutChangeEvent) {
    setHeaderHeight(event.nativeEvent.layout.height);
  }

  return (
    <GradientBackground colors={skyGradient}>
      {/*
        The sun is pinned outside the ScrollView rather than scrolling with it,
        so the content rides up and over it. Sibling order matters: this layer
        is first, so everything in the ScrollView paints on top of it.
      */}
      <View
        style={[styles.skyLayer, { top: headerHeight }]}
        pointerEvents="none"
        onLayout={handleSkyLayout}>
        <SunSky
          width={skyWidth}
          height={SKY_HEIGHT}
          size={sunSize}
          baseSize={SUN_SIZE_HORIZON}
          altitude={sunAltitude}
          peakAltitude={peakAltitude}
          progress={timelineProgress}
          gradient={sunGradient}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}>
        <View onLayout={handleHeaderLayout}>
          <ScreenHeader
            left={
              <PillButton
                label={formatRelativeDay(selectedDate, location.timeZone, minuteNow)}
                trailingIcon={
                  <SymbolView name="chevron.down" size={12} tintColor={Colors.textSecondary} />
                }
                onPress={() => setOpenSheet('day')}
              />
            }
            right={
              <View style={styles.headerActions}>
                <PillButton
                  icon={<SymbolView name="location.fill" size={14} tintColor={Colors.accent} />}
                  label={location.name}
                  onPress={() => setOpenSheet('location')}
                />
                <PillButton
                  icon={<SymbolView name="gearshape.fill" size={17} tintColor={Colors.text} />}
                  accessibilityLabel="Settings"
                  onPress={() => setOpenSheet('settings')}
                />
              </View>
            }
          />

          {/*
            Sits inside the measured header block, under the location pill it
            explains, so it reads as a footnote to the location rather than an
            error banner over the hero — and so the pinned sun layer, which is
            offset by this block's height, moves down with it.
          */}
          {showLocationNotice && (
            <Pressable
              onPress={handleOpenSettings}
              accessibilityRole="button"
              accessibilityLabel={`${deviceError} Opens Settings, where you can turn location access on.`}
              style={({ pressed }) => [styles.notice, pressed && styles.noticePressed]}>
              <SymbolView name="location.slash.fill" size={13} tintColor={Colors.textSecondary} />
              <Text style={styles.noticeText}>
                {deviceError} <Text style={styles.noticeAction}>Open Settings ›</Text>
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.skySpacer} />

        <BlurView intensity={scrimIntensity} tint="light" style={styles.scrim}>
          {/*
            A greeting only makes sense for today. On any other day it says
            "Good afternoon" over data from a day that is not this afternoon, so
            the line names the day instead.
          */}
          <Text style={styles.greeting}>
            {dayOffset === 0
              ? `${getGreeting(now, location.timeZone)}, `
              : `${formatRelativeDay(selectedDate, location.timeZone, minuteNow)} in `}
            <Text style={styles.greetingName}>{location.name}</Text>
          </Text>

          {hero !== null && countdown !== null && (
            <Text style={styles.hero}>
              {hero.label}
              {heroIsNow ? ' ' : ' in '}
              <Text style={styles.heroValue}>{countdown}</Text>
            </Text>
          )}

          <Text style={styles.subline}>
            <Text style={styles.sublineStrong}>Golden hour</Text>
            {goldenHourTime.time === NO_EVENT_TIME
              ? ' does not occur on this day'
              : ` starts at ${goldenHourTime.time} ${goldenHourTime.period}`.trimEnd()}
          </Text>
        </BlurView>

        <Card
          /* Same reason as the greeting: "Today" is a lie on any other day. */
          title={
            dayOffset === 0
              ? 'Sun Today'
              : `Sun · ${formatRelativeDay(selectedDate, location.timeZone, minuteNow)}`
          }
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
              <Text style={styles.summaryValue}>{solarNoonTime.time}</Text>
              <Text style={styles.summaryLabel}>Solar noon</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{sunsetTime.time}</Text>
              <Text style={styles.summaryLabel}>Sunset</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card} contentStyle={styles.listCard}>
          {visibleKeys.map((key, index) => {
            const event = events.find((candidate) => candidate.key === key);
            const formatted = formatTime(event?.date ?? null, location.timeZone, hour12);

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
            a moon phase is a state, not an instant. Showing illumination.
          */}
          <EventRow
            label="Moon phase"
            sublabel={moon.phaseName}
            time={`${Math.round(moon.illumination * 100)}`}
            period="%"
            tz="lit"
            accentColor={getPhaseAccent('nadir')}
          />
        </Card>

        <Card title="Daylight Remaining" style={styles.card}>
          <View onLayout={handleArcLayout} style={styles.arcSlot}>
            {arcWidth > 0 && (
              <DaylightArc
                progress={timelineProgress}
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

      <DayPickerSheet
        visible={openSheet === 'day'}
        onClose={() => setOpenSheet(null)}
        dayOffset={dayOffset}
        onSelect={handleSelectDay}
        location={location}
        hour12={hour12}
        now={minuteNow}
        getDayTimes={getDayTimes}
      />
      <LocationPickerSheet
        visible={openSheet === 'location'}
        onClose={() => setOpenSheet(null)}
      />
      <SettingsSheet visible={openSheet === 'settings'} onClose={() => setOpenSheet(null)} />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: TabBarInset,
    gap: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  /*
   * Deliberately quiet: this explains a fallback, it does not report a failure,
   * so it is frosted like the pills above it rather than tinted as a warning.
   */
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.pill,
    borderWidth: Size.hairline,
    borderColor: Colors.borderLight,
  },
  noticePressed: {
    opacity: 0.7,
  },
  noticeText: {
    ...Type.caption,
    flex: 1,
    color: Colors.textSecondary,
  },
  /** The tap affordance — nothing else on this row looks interactive. */
  noticeAction: {
    color: Colors.accent,
    fontWeight: '600',
  },
  /** Pinned sun layer, inset to match the scroll content's horizontal padding. */
  skyLayer: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
  },
  skySpacer: {
    height: SKY_HEIGHT,
  },
  /*
   * Negative top margin pulls the scrim up over the bottom of the sky band, so
   * the sun is already partly behind the text at altitude 0 rather than
   * touching its top edge. `overflow: hidden` keeps the blur inside the radius.
   */
  scrim: {
    marginTop: -Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    marginHorizontal: -Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: Size.hairline,
    borderColor: Colors.borderLight,
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
  arcSlot: {
    marginBottom: Spacing.sm,
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
