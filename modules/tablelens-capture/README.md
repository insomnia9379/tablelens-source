# TableLens native capture module

This is a local Expo module for Android only. It exposes `TablelensCapture`:

- `getStatus()`
- `requestOverlayPermission()`
- `startCapture()`
- `pause()` / `resume()` / `stop()`
- `openReview()`
- `pickAndAnalyze()` (native `ACTION_OPEN_DOCUMENT` image picker)
- `analyzeImage(uri)` (ContentResolver-only import; no upload)
- `applyCorrection(player, dealer, total, wager, phase)`
- `onStateChange` event

The module requests MediaProjection through its own `CapturePermissionActivity`, runs a foreground `mediaProjection` service, and processes latest-only `ImageReader` frames at about four frames per second. ML Kit Latin text recognition is bundled (`com.google.mlkit:text-recognition:16.0.1`). The service and overlay continue when JavaScript is backgrounded.

The overlay is a small movable/positioned advisory panel with Pause/Resume, Review, and Stop controls; Review hides the panel while the manual editor is open and restores the live panel afterward. It never injects taps, reads credentials, automates the table, or uses root. The notification mirrors the active/paused state and includes explicit Pause/Resume and Stop actions.

Recognition is deliberately fail-closed: only a bounded green-table layout, H17/3:2/insurance 2:1 rule text, recognized rank tokens, a cross-checked total, visible Hit+Stand controls, and complete card geometry can produce an accepted decision. Unknown/incomplete frames return empty ranks, null values, no recommendation, and `accepted: false`. The strategy subset only stands on hard 18–20, hard 17 except dealer Ace, and soft 20; all other hands report `Rules incomplete — review manually`.

All returned states use the contract fields `phase`, `player`, `dealer`, `total`, `balance`, `wager`, `actions`, `capturedAt`, `source`, `accepted`, `message`, `recommendation`, `captureStatus`, and `latencyMs`. Manual review is marked `source: manual`, must match a fresh accepted live visual fingerprint, is shown as manual in the overlay, and expires on visual/capture changes or the native freshness watchdog. Imported-image review events stay separate from live capture state and do not replace its fingerprint or capture status.

No APK is built by this module in the sandbox. The parent project must include `./plugins/with-tablelens.cjs` in its Expo plugins list.
