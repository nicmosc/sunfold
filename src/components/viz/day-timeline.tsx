import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

/** Intrinsic drawing geometry, in points. Colour and type come from tokens. */
const TICK_COUNT = 48;
const TICK_WIDTH = 2;
const TICK_HEIGHT_PAST = 26;
const TICK_HEIGHT_FUTURE = 14;
const TRACK_HEIGHT = 44;
const HANDLE_WIDTH = 10;
const HANDLE_HEIGHT = 40;
/** Keeps the handle's rounded ends inside the component's own width. */
const EDGE_INSET = HANDLE_WIDTH / 2;

const LAST_TICK = TICK_COUNT - 1;

/** Clamps to [0,1], mapping NaN/Infinity to 0. Runs on the JS and UI threads. */
function clampUnit(value: number): number {
  'worklet';
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

/** The tick the handle currently sits on. Drives both tick colour and haptics. */
function tickIndexForProgress(value: number): number {
  'worklet';
  return Math.round(clampUnit(value) * LAST_TICK);
}

export interface DayTimelineProps {
  /** Position along the day, 0 to 1. */
  progress: number;
  /** Time shown in the bubble above the handle, e.g. "14:32". */
  timeLabel: string;
  /**
   * Called as the handle crosses each tick, and once more when the drag ends.
   * Tick granularity keeps the UI thread from flooding the JS thread and
   * matches the resolution the timeline can actually display.
   *
   * Omit it to render a static, non-interactive timeline.
   */
  onScrub?: (progress: number) => void;
  /** Rendered width in points. */
  width: number;
}

/**
 * A horizontal day scrubber: elapsed ticks are tall and warm, remaining ticks
 * short and dim, with a draggable pill handle and a floating time bubble.
 */
export function DayTimeline({ progress, timeLabel, onScrub, width }: DayTimelineProps) {
  const interactive = onScrub !== undefined;
  const trackWidth = width - HANDLE_WIDTH;
  const usable = Number.isFinite(width) && trackWidth > 0;
  const propProgress = clampUnit(progress);

  // Written only from gesture worklets, so the handle stays on the UI thread
  // even while the JS thread is busy re-rendering the parent.
  const dragPosition = useSharedValue(propProgress);
  const gestureActive = useSharedValue(false);
  const lastTick = useSharedValue(tickIndexForProgress(propProgress));

  /**
   * Local override so the ticks and handle keep tracking a finished drag when
   * the caller does not feed `progress` back. Cleared the moment the prop moves
   * on its own, which is React's documented "adjust state during render".
   */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [seenProgress, setSeenProgress] = useState(propProgress);
  const [bubbleWidth, setBubbleWidth] = useState(0);

  if (propProgress !== seenProgress) {
    setSeenProgress(propProgress);
    setDragIndex(null);
  }

  const hasOverride = dragIndex !== null;
  const activeIndex = dragIndex ?? tickIndexForProgress(propProgress);

  function emit(index: number, value: number, haptic: boolean) {
    setDragIndex(index);
    if (haptic && Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    onScrub?.(value);
  }

  const pan = Gesture.Pan()
    .enabled(interactive && usable)
    .minDistance(0)
    // onStart, not onBegin: onBegin fires on touch-down even when the pan never
    // activates (a parent scroll winning the gesture), which would jump the
    // handle and fire onScrub for a touch the user never meant as a scrub.
    .onStart((event) => {
      gestureActive.set(true);
      const next = clampUnit((event.x - EDGE_INSET) / trackWidth);
      dragPosition.set(next);
      lastTick.set(tickIndexForProgress(next));
      runOnJS(emit)(tickIndexForProgress(next), next, false);
    })
    .onUpdate((event) => {
      const next = clampUnit((event.x - EDGE_INSET) / trackWidth);
      dragPosition.set(next);
      const index = tickIndexForProgress(next);
      if (index !== lastTick.get()) {
        lastTick.set(index);
        runOnJS(emit)(index, next, true);
      }
    })
    // onEnd only runs for an activated gesture, so a stray tap cannot emit.
    .onEnd(() => {
      const final = dragPosition.get();
      runOnJS(emit)(tickIndexForProgress(final), final, false);
    })
    .onFinalize(() => {
      gestureActive.set(false);
    });

  const handleStyle = useAnimatedStyle(() => {
    const value = gestureActive.get() || hasOverride ? dragPosition.get() : propProgress;
    return { transform: [{ translateX: value * trackWidth }] };
  });

  // Centre the bubble on the handle, then hold it inside the component bounds.
  const bubbleStyle = useAnimatedStyle(() => {
    const value = gestureActive.get() || hasOverride ? dragPosition.get() : propProgress;
    const center = EDGE_INSET + value * trackWidth;
    const maxLeft = Math.max(0, width - bubbleWidth);
    return { transform: [{ translateX: Math.min(Math.max(center - bubbleWidth / 2, 0), maxLeft) }] };
  });

  function handleBubbleLayout(event: LayoutChangeEvent) {
    setBubbleWidth(event.nativeEvent.layout.width);
  }

  function adjust(delta: number) {
    const next = clampUnit((activeIndex + delta) / LAST_TICK);
    emit(tickIndexForProgress(next), next, false);
  }

  // Width is 0 or NaN before layout; drawing then would emit broken geometry.
  if (!usable) {
    return null;
  }

  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const isPast = index <= activeIndex;
    const height = isPast ? TICK_HEIGHT_PAST : TICK_HEIGHT_FUTURE;
    return {
      key: index,
      x: EDGE_INSET + (index / LAST_TICK) * trackWidth - TICK_WIDTH / 2,
      y: (TRACK_HEIGHT - height) / 2,
      height,
      fill: isPast ? Colors.accent : Colors.textTertiary,
    };
  });

  return (
    <View
      style={[styles.root, { width }]}
      accessible
      accessibilityRole={interactive ? 'adjustable' : 'progressbar'}
      accessibilityLabel="Time of day"
      accessibilityValue={{
        min: 0,
        max: LAST_TICK,
        now: activeIndex,
        text: timeLabel,
      }}
      accessibilityActions={
        interactive ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          adjust(1);
        } else if (event.nativeEvent.actionName === 'decrement') {
          adjust(-1);
        }
      }}>
      <Animated.View style={[styles.bubble, bubbleStyle]} onLayout={handleBubbleLayout}>
        <Text style={styles.bubbleLabel} numberOfLines={1}>
          {timeLabel}
        </Text>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <View style={styles.track}>
          <Svg
            width={width}
            height={TRACK_HEIGHT}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {ticks.map((tick) => (
              <Rect
                key={tick.key}
                x={tick.x}
                y={tick.y}
                width={TICK_WIDTH}
                height={tick.height}
                rx={TICK_WIDTH / 2}
                fill={tick.fill}
              />
            ))}
          </Svg>
          <Animated.View style={[styles.handle, handleStyle]} pointerEvents="none" />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-start',
  },
  bubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardElevated,
    ...Shadow.pill,
  },
  bubbleLabel: {
    ...Type.caption,
    color: Colors.text,
  },
  track: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  handle: {
    position: 'absolute',
    left: 0,
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    ...Shadow.pill,
  },
});
