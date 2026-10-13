# TableLens

TableLens is an advisory Android blackjack screen-reading prototype with an Expo/React Native companion and a local Kotlin capture module. It targets the user-supplied landscape Chumba blackjack layout on a Google Pixel 10 Pro XL.

The interface uses the approved Optical Night Scope direction: deep midnight surfaces, restrained cyan signals, compact readouts, and IBM Plex Sans. The live panel is separate from manually transcribed reference screenshots and manual practice inputs. The application does not request casino credentials or automate wagers or game taps.

## Project structure

`app/` contains the Expo Router interface. `components/tablelens/` contains the reusable optical-style panels, cards, controls, and readouts. `hooks/use-tablelens.ts` manages the native bridge and separate review state. `lib/blackjack.ts` contains the shared conservative decision engine and manually transcribed screenshot facts; `lib/capture.ts` provides the guarded Android module bridge.

`modules/tablelens-capture/` contains the Kotlin MediaProjection service, system consent and image-picker activities, floating panel, ML Kit regional OCR, state validation, and native manual review. `plugins/with-tablelens.cjs` generates Android permission/activity/service declarations. `assets/reference/` contains the two user-supplied screenshots. `docs/` explains the layout profile and Pixel build/setup. The supplied managed `server/` and `drizzle/` starter remains present, but the recognizer does not send game frames to it or require a login.

## Running the companion

Use `pnpm dev` to run Metro on 8081 and the managed starter API on 3000. `pnpm check` checks TypeScript, `pnpm test` runs the source tests, and `pnpm check:native-config` verifies Android manifest and module registration. `metro.config.js` uses NativeWind's filesystem mode to avoid the observed incompatible virtual-file watcher payload in this Metro version.

## Android is not Expo Go

The custom native module is not present in a browser or stock Expo Go. An actual Android build is required for capture and floating overlays. `eas.json` supplies an internal APK profile; the managed mobile Dashboard is the intended native build handoff. No APK build or real Pixel recognition session has yet been verified.

See `docs/pixel-setup.md` for the build and phone steps. No Store submission has been made.

## Strategy boundary

The only visibly confirmed table rules are dealer hits soft 17, blackjack 3:2, and insurance 2:1. Version 1 implements a small ordinary-blackjack standing subset and withholds rule-sensitive, unclear, incomplete, inconsistent, or stale decisions. It is not a complete blackjack optimizer. It does not identify or predict the casino RNG, guarantee earnings, infer hidden cards, or bypass protected-screen restrictions.

Chumba's previously reviewed software-assisted participation restriction remains relevant. Technical implementation does not establish operator permission.

## Evidence boundary

Tests of source-transcribed screenshot facts and pure parser logic do not establish OCR accuracy. Generated manifest checks do not establish Android Gradle compilation. The real APK and Pixel capture, overlay timing, screen-layout recognition, and lifecycle behavior must be checked before calling this a working live phone overlay.
