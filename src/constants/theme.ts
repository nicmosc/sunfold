/**
 * Design tokens for Golden Hour.
 *
 * Extracted from the reference design: soft pastel gradient canvas (pink -> peach
 * -> lavender), frosted translucent cards, a single warm orange accent, and one
 * cool indigo accent reserved for blue-hour values.
 *
 * Light-mode only for v1 — the design is built around a warm pastel canvas that
 * has no meaningful dark equivalent. Dark mode is a deliberate follow-up, not an
 * oversight; see README.
 */

import { Platform, StyleSheet } from 'react-native';

/** Vertical page gradient, top -> bottom. Pink dawn fading into warm paper. */
export const CanvasGradient = ['#F0D8E6', '#FADDCD', '#FBF4F1', '#FDFAF8'] as const;

/**
 * The canvas at four points through the day, interpolated by solar altitude in
 * `lib/sun-colors.ts`. All four are four-stop gradients so any pair can be
 * blended stop-for-stop.
 *
 * The lower stops stay near-white across every phase on purpose: cards and body
 * text sit down there, and tinting that region would wreck contrast.
 */
export const SkyGradients = {
  /** Sun below the horizon — dusky mauve. */
  night: ['#C4B2D6', '#DCC7D6', '#F0E6EA', '#F9F4F6'],
  /** Sunrise and sunset — the pink and peach of the reference design. */
  horizon: CanvasGradient,
  /** Golden hour, warmer and yellower than the horizon. */
  golden: ['#F7DFC9', '#FDE8C6', '#FDF6EC', '#FEFBF7'],
  /** Full daylight — the sky actually goes blue. */
  day: ['#BAD7F2', '#D4E6F8', '#EEF5FC', '#FAFCFE'],
} as const;

/** The sun disc / icon gradient, top -> bottom. Neutral mid-morning default. */
export const SunGradient = ['#FFC978', '#FF9C3F', '#F4761B'] as const;

/**
 * The sun disc's colour at five points through the day, each a top->bottom
 * gradient triple. Interpolated by solar altitude in `lib/sun-colors.ts`, so the
 * disc warms from a deep red at the horizon to a pale yellow at solar noon.
 *
 * Ordered darkest-to-brightest; the interpolator depends on that order.
 */
export const SunPhaseGradients = {
  /** Sun below the horizon — twilight violet. */
  night: ['#7C5A93', '#5C3F73', '#3E2A55'],
  /** At the horizon — the deep red of sunrise and sunset. */
  horizon: ['#FF9068', '#EF4E2B', '#C2331C'],
  /** Golden hour, sun low and warm. */
  golden: ['#FFBC63', '#FF8E2B', '#EC6A16'],
  /** Mid-morning / mid-afternoon. */
  mid: ['#FFD277', '#FFA733', '#F2851C'],
  /** Near solar noon — bright, almost white-yellow. */
  peak: ['#FFF0B0', '#FFCE52', '#FCA81C'],
} as const;

/**
 * Per-phase accent for the large times in event rows.
 *
 * The design gives each phase its own value colour rather than one warm and one
 * cool: the day reads as a gradient from violet through red and gold to bright
 * orange at noon, then back. `lib/sun-colors.ts` maps event keys onto these.
 */
export const PhaseAccents = {
  astronomical: '#6B5DD3',
  blueHour: '#4F46E5',
  sunrise: '#F4703A',
  goldenHour: '#FFAE3D',
  solarNoon: '#FA9500',
  sunset: '#EE5F2B',
  moon: '#5B4FE0',
  nadir: '#3F3A6B',
} as const;

/** Primary CTA button gradient, left -> right. */
export const ButtonGradient = ['#FFA451', '#FB7A1E'] as const;

export const Colors = {
  /** Warm accent — sunrise, sunset, golden hour, active tab, CTAs. */
  accent: '#FA7A18',
  accentSoft: '#FFB067',
  accentMuted: '#FFD9B5',

  /** Cool accent — reserved for blue hour and moon values only. */
  indigo: '#4F46E5',
  indigoSoft: '#8B84EF',

  text: '#16161A',
  textSecondary: '#8A8A90',
  textTertiary: '#B4B4BA',

  /** Frosted card sitting on the gradient canvas. */
  card: 'rgba(255, 255, 255, 0.58)',
  /** Light wash layered *on top of* a blur, not a replacement for one. */
  cardWash: 'rgba(255, 255, 255, 0.3)',
  cardSolid: '#F2F2F5',
  cardElevated: 'rgba(255, 255, 255, 0.82)',

  /** Floating pill controls (Today ⌄, location, share, settings). */
  pill: 'rgba(255, 255, 255, 0.75)',

  tabBar: 'rgba(255, 255, 255, 0.88)',
  separator: 'rgba(22, 22, 26, 0.06)',
  /** Hairline highlight along the top edge of frosted surfaces. */
  borderLight: 'rgba(255, 255, 255, 0.7)',
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof Colors;

/** 4pt base scale. Name by size, not by index, so usage reads clearly. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const Radius = {
  /** Inner rows and small controls. */
  sm: 12,
  md: 18,
  /** Standard card. */
  lg: 24,
  /** Primary button. */
  xl: 30,
  pill: 999,
} as const;

/**
 * Type scale. `unit` is the small uppercase AM/PM/DST suffix that trails the
 * large times — the design always renders it as a separate, smaller run of text,
 * never concatenated into the time string.
 */
export const Type = {
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  headline: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  eventTime: { fontSize: 27, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  unit: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.3 },
  tab: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
} as const;

/**
 * Control sizing. `minTouchTarget` is Apple's 44pt HIG minimum — controls that
 * render smaller than this must make up the difference with `hitSlop`, never by
 * growing their visual bounds.
 */
export const Size = {
  pillHeight: 36,
  iconButton: 40,
  minTouchTarget: 44,
  /** Crisper than a literal 1 on 2x/3x displays. */
  hairline: StyleSheet.hairlineWidth,
} as const;

/** Soft, wide, low-opacity — the design has no hard shadows. */
export const Shadow = {
  card: {
    shadowColor: '#B08068',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  pill: {
    shadowColor: '#B08068',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  tabBar: {
    shadowColor: '#8A6A58',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 10,
  },
} as const;

/** Height of the floating tab bar plus its bottom margin, for scroll insets. */
export const TabBarHeight = 68;
export const TabBarInset = TabBarHeight + Spacing.xl;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
})!;
