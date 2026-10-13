# TableLens verification record

## Passed in this workspace

TypeScript source checks pass. The Vitest suite reports 47 passed tests and one pre-existing authentication test skipped. Twenty-two tests cover the conservative strategy engine, the two manually transcribed reference states, strict ranks, missing rules, incomplete states, and freshness rejection.

Seven pure Kotlin JUnit tests compile and pass with Kotlin 2.1.20. These exercise the parser's synthetic screenshot coordinates, strict numeric parsing, unsupported/confusable text, unknown rules, conflicting evidence, and null recommendations for abstention. Synthetic OCR inputs are not a real ML Kit recognition test.

Expo Android introspection verifies the screen-capture/overlay/foreground notification permissions, non-exported native activities and mediaProjection service, consent activity lifecycle, preserved package identifier, native assets, and autolinking of the local TablelensCapture module. Public preview and local Metro respond with HTTP 200; the managed starter API health responds successfully.

A read-only implementation review checked interface wiring, source separation, conservative advice, controls, and disclosures. Concrete provenance and inactive-status messaging findings were corrected. A NativeWind/Metro virtual-file watcher crash was corrected through the supported filesystem mode without replacing the mobile starter.

## Not yet verified

No Android Gradle build, APK signing result, installed Pixel session, real screenshot ML Kit accuracy, frame latency, phone rotation/capture framing, battery/thermal behavior, or on-phone pause/stop/overlay lifecycle test exists. The current deliverable is a source prototype and companion preview, not a verified working live overlay on the phone.

Native code includes single-flight OCR, repeated-frame validation, a 1.5-second freshness watchdog, pause/resume/stop version guards, separate image-import results, and current-fingerprint-bound manual review. These implementation checks still need a real native build and device execution.

## First next action

Build an Android APK from the saved project checkpoint using the mobile Dashboard, then test native screenshot import with the supplied #391/#390 images before live capture. Record the actual detected fields rather than treating the manually transcribed examples as OCR evidence. Full-display landscape framing is the initial supported layout profile. Missing rule-sensitive strategy remains deliberately unsupported.
