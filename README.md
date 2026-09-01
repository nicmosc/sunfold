# Sunfold

Sunrise, sunset, golden hour and blue hour times for wherever you are — computed
entirely on device.

No backend, no API keys, no account. Sun and moon positions are pure astronomy
(`suncalc`), so the app works offline, on a plane, in a canyon.

## Why it is built this way

The constraints were chosen to keep App Review simple and the code honest:

- **One permission.** Location, when-in-use. Denying it is a first-class path —
  the app falls back to New York and the Cities tab still works completely.
- **No network.** Nothing to secure, no key to leak, no privacy policy beyond
  the location disclosure, no "server is down" state.
- **Light mode only.** The design is built on a warm pastel canvas that has no
  meaningful dark equivalent. `userInterfaceStyle` is pinned to `light` rather
  than shipping a half-hearted dark theme.

## Architecture

```
src/
  app/                    expo-router file-based routes
    _layout.tsx           providers + onboarding gate
    onboarding.tsx        first-run screen
    (tabs)/
      _layout.tsx         tab shell (custom tab bar)
      index.tsx           Home — live countdown to the next event
      timeline.tsx        Today's Light — full day + daylight remaining
      cities.tsx          Saved cities, each in its own timezone
  components/
    ui/                   presentational primitives (Card, EventRow, PillButton…)
    viz/                  SVG visualisations (SunDisc, DaylightArc, DayTimeline)
    tab-bar.tsx           floating pill tab bar
  lib/                    pure domain layer — no React, no react-native
    sun.ts                suncalc wrapper: events, moon, daylight, progress
    format.ts             timezone-aware formatting via Intl
    location.ts           permissions, reverse geocoding, preset cities
    storage.ts            typed AsyncStorage wrapper that never throws
  hooks/                  stateful glue between lib/ and app/
  constants/theme.ts      every colour, size, radius, shadow and type style
```

The dependency direction is strictly one-way: `app → components → lib`. Nothing
in `lib/` imports React, which keeps the astronomy testable in isolation.

### Things that are easy to get wrong, and are handled

- **suncalc's golden hour naming reads backwards.** `goldenHourEnd` is the end of
  the *morning* golden hour; `goldenHour` is the start of the *evening* one.
  See the comment block in `lib/sun.ts` before "fixing" it.
- **Blue hour is not a suncalc primitive.** It is derived from the nautical and
  civil twilight bands.
- **Events can genuinely not exist.** Above the Arctic Circle there is no sunrise
  in December. Every event date is `Date | null`, never an Invalid Date, and the
  UI renders an em dash. Verified against Tromsø in both June and December.
- **Days anchor to local noon at the location**, not the device, so a saved city
  eight timezones away still shows the right day's events.
- **`suncalc@2.x` ships its own types** which override `@types/suncalc@1.x`. The
  1.x types describe a different API (radians, Invalid Dates). Do not reinstall
  `@types/suncalc` — it is wrong for the installed version.

## Running locally

```bash
npm install
npx expo run:ios          # native build → simulator (needed for SF Symbols, SVG, Reanimated)
```

`npx expo start` alone only works for JS-only changes once a native build exists.
Anything touching `app.json`, a config plugin, or a native dependency needs
`run:ios` again.

`ios/` and `android/` are gitignored — this project uses Continuous Native
Generation, so those directories are build output, regenerated from `app.json`.
Never edit them by hand; the next prebuild discards it.

### Verification

```bash
npx tsc --noEmit          # must be zero
npx expo lint             # must be zero
npx expo export --platform ios   # proves every import resolves
```

## Shipping to the App Store

The part that is actually new if you already know React.

### One-time setup

1. **Apple Developer Program** — $99/year, per account, unlimited apps. Enrolment
   can take days; start it before you need it. Individual publishes under your
   legal name (publicly visible); Organization needs a D-U-N-S number. Migrating
   later is painful, so decide up front.
2. `npm install -g eas-cli && eas login`
3. `eas build:configure` — creates `eas.json`.

### Each release

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

EAS manages certificates and provisioning profiles for you, which removes the
single most painful part of iOS release engineering. The build runs on Expo's
macOS infrastructure, so it does not matter what your local Xcode is doing.

Then in App Store Connect: screenshots (6.9" and 6.5" are required; iPad is not,
because `supportsTablet` is `false`), description, keywords, App Privacy
questionnaire, age rating. Review is typically 24–48h.

### Configuration already handled

- `ITSAppUsesNonExemptEncryption: false` — skips the export compliance question
  on every single upload.
- `NSLocationWhenInUseUsageDescription` — a specific purpose string. Apple
  rejects vague ones ("to improve your experience").
- `supportsTablet: false` — avoids needing iPad screenshots.
- `bundleIdentifier` — `com.nicolaos.sunfold`.

### Before the first submission

- [ ] Replace the placeholder Terms of Use URL in `app/onboarding.tsx` with a
      real, reachable page. App Review follows the link.
- [ ] Replace the Expo default app icon in `assets/`.
- [ ] Decide Individual vs Organization enrolment.

## Deliberately not built yet

Each is a clean follow-up that teaches exactly one new piece of tooling:

| Feature | What it teaches |
|-|-|
| Golden hour notification | `expo-notifications`, permissions, scheduling |
| Home screen widget | config plugins, real Swift, app groups |
| Dark mode | theming a design that has no obvious dark equivalent |
| Unit tests for `lib/sun.ts` | the domain layer is already pure and testable |
