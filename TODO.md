# TableLens implementation outcomes

## Implemented in source

- [x] Android MediaProjection per-session consent, foreground capture indication, native service, and blocked/unfamiliar-layout handling; no credentials, root, nonpublic access, injection, or bypass.
- [x] Compact movable native overlay with Pause/Resume, Review, Stop, source labeling, and freshness expiry; native capture/OCR does not depend on the foreground JavaScript interface. No automatic taps or wagers.
- [x] Regional ML Kit OCR adapter and strict parser for ranks, dealer upcard, total, balance, wager, rule text, controls, and betting/decision states in the supplied landscape profile. Actual on-phone accuracy remains unverified.
- [x] Conservative strategy engine exposing H17, 3:2, and insurance 2:1 as observed rules; missing rules explicitly unknown and rule-sensitive hands withheld. No RNG or profit claims.
- [x] Single-flight OCR, repeated-frame consistency, 1.5-second freshness watchdog, card/total and state completeness checks, and pause/stop invalidation.
- [x] Separate manual/reference/import review and current-fingerprint-bound native review. Local examples do not populate automatic live OCR. Captured, imported, and manually entered states remain source labeled.
- [x] Optical Night Scope companion (#071A24 / #35D0BA, IBM Plex Sans), supplied screenshot examples labeled manually transcribed, and explicit Android-build requirement for web/Expo Go.
- [x] TypeScript/lint, 47 passing Vitest tests (1 pre-existing auth skip), 7 passing pure Kotlin tests, generated Android permissions/autolinking checks, build/setup documentation, and source checkpoint preparation.

## Remaining verification

- [ ] Build and sign an actual Android APK from the saved checkpoint. Generated configuration and pure Kotlin tests are not a full Android Gradle build.
- [ ] Install and test on Pixel 10 Pro XL: real ML Kit screenshot recognition, capture framing/rotation, overlay interaction, fresh/uncertain states, pause/resume/stop, blocked content, and latency/battery behavior.
- [ ] Obtain the actual table's missing rules before extending the limited standing subset into a complete strategy engine. Betting automation and RNG prediction are outside the product.

Chumba's previously reviewed software-assisted participation restriction is displayed. Implementation does not establish operator permission. Screenshot 391 is manually transcribed as 9 + K = hard 19 versus dealer 9, balance 50.19 SC, wager 0.5 SC. Screenshot 390 is empty betting, balance 50.69 SC, wager 0 SC; no game result or profit is inferred.
