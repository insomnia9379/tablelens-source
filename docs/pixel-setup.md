# TableLens: Android build and Pixel setup

## What this delivery is

TableLens is an Expo/React Native companion with a local Kotlin Android module. The companion interface and conservative strategy engine can be previewed. The Android module implements user-consented screen capture, a native floating panel, regional ML Kit OCR, and system image import. Native source is not the same as a compiled or device-tested APK.

**An Android APK has not yet been built or tested on the Pixel 10 Pro XL.** A browser preview and Expo Go cannot host this custom native screen-capture module. Do not expect the preview link to float over another app.

## Build the Android app

Use this project's Android APK build action in the Manus mobile Dashboard from the saved checkpoint. This build must include the local `modules/tablelens-capture` module and `plugins/with-tablelens.cjs`; do not use Expo Go as a substitute. The app identifier remains `space.manus.tablelens.t115810122895538`. Android targets arm64 with a minimum supported SDK of 26.

If the build interface requests Expo authorization, connect the appropriate account using its account form, not by sending credentials in chat. A successful build must return an actual APK before installation can proceed. AAB is a store bundle, not the straightforward sideload artifact needed for this phone test.

This delivery does not submit a Play Store listing. Screen-capture and overlay permissions are explained in the app; distribution acceptance is a separate matter.

## On the Pixel

Install only the APK produced from this source checkpoint. Android may require permission to install from the source application used to open the APK. Open TableLens first and allow its notification if requested. Start capture; the first attempt can open Android's **Display over other apps** settings. Enable TableLens, return to it, and press Start capture again.

Android presents its screen-capture consent dialog for each session. Begin with the landscape Chumba blackjack layout shown in your screenshots. The current bounded recognition profile is based on the full landscape display; a single-app capture can change the framing. If a selected capture is rejected as an unfamiliar layout, stop and use full-display capture if Android offers it. This captures whatever is visible on that display: keep other private apps and notifications away from the capture session.

Capture runs locally without a casino login inside TableLens, and no frames are intentionally uploaded by the recognizer. The panel can be moved and has pause/resume/stop controls. Stop must remove the panel and foreground capture notification. Android's own capture-stop control also ends the session.

Use **Analyze screenshot** to test an image through the actual native OCR path before trying live capture. The supplied #391/#390 examples in the companion are explicitly manually transcribed; loading them does not test OCR. Reference/manual editing is separate from live capture; use the dedicated native review action for a live reading.

## First device checks

For screenshot 391, verify the native analyzer actually reads player 9 and K, total 19, dealer 9, wager 0.5 SC, and balance 50.19 SC. The limited recommendation should be Stand. For screenshot 390 it should detect betting/no active hand and produce no next-move recommendation. Do not infer a win from the balances.

Test an unrelated screen, blocked/blank content, portrait orientation, rapid animation, and several different hands. These should be withheld or unsupported, not interpreted as the sample hand. Pause/stop and leave the game: old advice must disappear or expire rather than remain visible. OCR reads are provisional until those checks pass on the phone.

## Scope and limitations

The visible rules are H17, blackjack 3:2, and insurance 2:1. Deck count, shuffle, dealer peek, splitting, surrender, doubling, and special-hand rules remain unknown. Version 1 intentionally gives only a narrow rule-robust standing recommendation and abstains on other hands. It is not yet a complete blackjack strategy product.

Chumba's previously reviewed terms restrict software-assisted participation. This implementation is not operator permission. It does not predict RNG outcomes, guarantee profit, place bets, automate taps, read hidden cards, access private game systems, or bypass blocked capture. If content is protected or overlays are disallowed, the app must stop or report unsupported capture.

## Source checks

From the project directory, run `pnpm check`, `pnpm test`, and `node scripts/check-native-config.cjs`. These check TypeScript, strategy logic, and generated native configuration. They do not replace an Android Gradle build or device testing.

The local Kotlin module also contains pure parser/strategy JUnit tests. Android UI classes, MediaProjection timing, ML Kit accuracy, and actual overlay behavior require the native build and phone.
