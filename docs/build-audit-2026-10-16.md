# TableLens Android build-source audit — October 16, 2026

Historical reference for source commit `ff802a14d8d0bd34704523791075bff11d68b68c`. This predates the October 17 module-metadata change and GitHub workflow extraction. See [the current status report](status-2026-10-17.md) for newer findings. Sandbox evidence paths below are historical local paths; generated logs/bundles are not part of this repository.

## Conclusion

No confirmed configuration, TypeScript, JavaScript syntax, or Kotlin/Expo API mismatch was found in the available project files. The Android JavaScript bundle exported successfully. **This does not establish that an Android APK compiles, signs, or runs on a phone.** No full Android Gradle, APK, or EAS build was run during this audit.

The actual managed-build error/log was unavailable. Consequently, the reported “contact support” failure cannot be assigned to a particular source file or build stage from the evidence collected here.

## Scope and version

- Project directory: `/home/ubuntu/tablelens`
- Source revision: `ff802a14d8d0bd34704523791075bff11d68b68c`
- Installed Expo: `57.0.24`
- Installed React Native: `0.86.3`
- Installed Expo Modules Core: `57.0.18`
- No application source, dependency declaration, or lockfile was changed.

## Checks and results

| Check | Result | What it establishes |
| --- | --- | --- |
| `pnpm check` | Passed | TypeScript type and syntax checks |
| `pnpm test` | 47 passed; 1 skipped | Existing strategy/parser and CORS tests; skipped authentication test remains unverified |
| `pnpm check:native-config` | Passed | Generated capture permissions, non-exported activities/service, media-projection service type, local Android module autolinking, preserved app identifiers, and icon-file presence |
| `node --check` on Babel, Metro, theme, Tailwind, plugin, and setup scripts | Passed | JavaScript configuration/script syntax |
| Project JSON and module Android manifest parsing | Passed | JSON/XML syntax |
| Local asset-reference scan | No missing referenced local assets found in the scanned configuration/components/screens | Selected local asset paths |
| `CI=1 pnpm exec expo export --platform android --output-dir /home/ubuntu/tablelens-audit/android-export` | Passed | Android JavaScript production bundling, including a Hermes bundle; 1,878 modules bundled and 62 assets exported |
| Read-only Kotlin/API review | No definite compile/API errors found | Compatibility of reviewed usage with installed Expo native source declarations; not a compiler result |

The Android JavaScript output is **not an APK** and cannot be installed as an Android app.

## Configuration and native-source findings

### Application and APK configuration

- `app.config.ts` resolves successfully through Expo configuration introspection.
- Package identifier is preserved as `space.manus.tablelens.t115810122895538`.
- The local `plugins/with-tablelens.cjs` plugin is registered and produces the expected capture components and permissions.
- `eas.json` has an internal `preview` profile with `android.buildType: "apk"`; the `production` profile requests an app bundle.
- Android is configured for `arm64-v8a` and minimum SDK 26.
- Build-time configuration loads without requiring the missing server environment values. That does not validate authentication/server behavior at runtime or remote-build account linkage.

### Kotlin and Gradle

- `modules/tablelens-capture/android/build.gradle` uses the same Android library/Expo Gradle-plugin pattern as installed Expo modules. The Expo plugin applies the Kotlin plugin and module-core dependencies; a missing explicit Kotlin-plugin line is not a confirmed defect.
- `expo-module.config.json` registers `expo.modules.tablelenscapture.TablelensCaptureModule`, and Expo autolinking discovers it under `modules/`.
- Reviewed `ModuleDefinition`, lifecycle hooks, event emission, asynchronous functions, and app-context properties match the installed Expo Modules Core API.
- The module manifest is intentionally minimal. Activities and the capture service are added at the application level by the registered config plugin, as confirmed by introspection.
- External Android artifacts such as ML Kit text recognition `16.0.1` and AndroidX Core KTX `1.15.0` were not resolved by a full native build. Repository, cache, generated Gradle files, signing, and remote build environment remain unverified.

## Dependency warnings—not proven causes

Expo's compatibility checker recommends these patch updates:

| Package | Installed | Recommended range |
| --- | --- | --- |
| `@expo/metro-runtime` | 57.0.16 | ~57.0.17 |
| `expo` | 57.0.24 | ~57.0.30 |
| `expo-asset` | 57.0.18 | ~57.0.20 |
| `expo-build-properties` | 57.0.21 | ~57.0.22 |
| `expo-constants` | 57.0.19 | ~57.0.22 |
| `expo-linking` | 57.0.10 | ~57.0.13 |
| `expo-notifications` | 57.0.20 | ~57.0.23 |
| `expo-router` | 57.0.22 | ~57.0.28 |
| `expo-splash-screen` | 57.0.9 | ~57.0.10 |
| `expo-video` | 57.0.4 | ~57.0.5 |

These are compatibility warnings, not observed compiler errors. The configuration and JavaScript bundle checks passed with the installed versions. The upgrade prompt was declined, so neither dependencies nor the lockfile were changed. Avoid treating a blanket dependency upgrade as a verified fix without the failing build log.

The package manager also warns that `pnpm.onlyBuiltDependencies` in `package.json` is ignored by the installed wrapper. Installation and the checked consumers succeeded; this warning was not shown to cause the reported APK failure.

## Separate device concern

`POST_NOTIFICATIONS` is declared, but the native source review did not find a runtime notification-permission request. On Android 13+, notification visibility can depend on the user's permission state. This is a runtime/device concern, **not a confirmed compile failure**, and was not changed during this build-source audit.

## Managed-build evidence unavailable

The project tool reports:

> Addon manus-webdev is not ready: its workspace recovery has not completed. Retry this addon later.

That observation explains why managed project/build state could not be inspected here. It does not prove the cause of the user's separate APK build failure. Automatic project diagnostics were unavailable, so existing command-line checks were used instead. No repository reconnection, build submission, publishing, or configuration changes were attempted.

## Next evidence needed

Provide the failed build's log or error details, ideally:

1. Build ID and the failed stage.
2. The first specific error, not only the final “contact support” summary.
3. For a Gradle failure, `FAILURE: Build failed with an exception`, `What went wrong`, and the failing task.
4. Any Kotlin `e: ... .kt:line:column` messages, dependency-resolution error, or manifest-merger error immediately above the summary.

Do not include tokens, passwords, signing credentials, or other secrets. This evidence will distinguish a correctable source/configuration problem from an account, build-service, dependency-download, or environment issue.

## Local evidence files

- `/home/ubuntu/tablelens-audit/checks.log`: TypeScript, native-configuration, and Vitest output.
- `/home/ubuntu/tablelens-audit/android-export.log`: Android JavaScript export output.
