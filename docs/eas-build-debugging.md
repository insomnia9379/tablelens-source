# Capture TableLens's exact EAS Build failure

Run these steps on **your own computer**, in a complete checkout of the TableLens project. Do not run them on your phone or paste commands into the Manus chat. The directory must contain `package.json`, `eas.json`, `app.config.ts`, `plugins/`, and `modules/tablelens-capture/`.

The checked `eas.json` defines `preview` as an internal Android APK profile. `production` produces an AAB, so use `--profile preview` for this test.

## First: read an existing cloud build's log

This is the quickest route and does not require an Android SDK or starting another build.

Install the CLI and sign in to the Expo account that owns or can access the build:

```sh
npm install -g eas-cli@latest
eas login
eas whoami
```

From the project root:

```sh
eas build:list --platform android --limit 5
```

Copy the failed build's ID, then replace `BUILD_ID` below:

```sh
eas build:view BUILD_ID
```

Open the build-details/log URL shown by the CLI. Expand the **earliest failed phase**. Expo recommends the earliest failure because later phases may only show cascading errors. A `[stderr]` prefix alone is not evidence of a fatal error. [1] [2]

The CLI can also save build metadata:

```sh
eas build:view BUILD_ID --json > eas-build-details.json
```

This JSON is build metadata; **do not expect it to be the complete Gradle/compiler log**. Read the phase logs on the details page. If no matching build appears, verify the account and linked project. An absent entry does not prove the app's code failed; the attempted build may have failed before an EAS job was created, or it may belong to another account/project.

## Run EAS Build locally with the full terminal output

### Prerequisites

Use macOS or Linux for this Android local-build route. Expo does not officially support native Windows local EAS builds; WSL can be used, but Expo does not officially test/support that route. Cloud-build log inspection works without a local Android toolchain. [3]

Install Node.js, the project's pnpm package manager, and an Android build toolchain. You need a compatible JDK, Android SDK and NDK, and a correctly configured SDK path. Android Studio is a practical way to install/manage the Android SDK components. `java -version` should work and `ANDROID_HOME` should identify the actual SDK installation. Local EAS builds use your installed tooling rather than installing all the cloud builder's tools for you. [3]

Use the package-manager version pinned by this project: `pnpm@9.12.0`. If Corepack is available:

```sh
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```

Alternatively, install that version with your preferred package-manager setup. Do not silently replace it with an unrelated pnpm major version.

In the project root, restore the locked dependencies:

```sh
pnpm install --frozen-lockfile
```

Install/sign into EAS CLI if you have not already done so:

```sh
npm install -g eas-cli@latest
eas login
```

### Build and save stdout plus stderr

Run this in Bash on macOS/Linux. It creates a unique temporary working directory and retains the failed build's generated files for investigation:

```bash
set -o pipefail
export EAS_LOCAL_BUILD_SKIP_CLEANUP=1
export EAS_LOCAL_BUILD_WORKINGDIR="$(mktemp -d)"
printf 'Retained build directory: %s\n' "$EAS_LOCAL_BUILD_WORKINGDIR"

eas build \
  --platform android \
  --profile preview \
  --local \
  --verbose-logs \
  --build-logger-level debug \
  --output ./tablelens-preview.apk \
  2>&1 | tee eas-local-build.log
```

The `--local` flag runs the EAS build process on your machine. `2>&1 | tee` saves both output streams while displaying them in the terminal. `pipefail` prevents the logging command's success from hiding the build command's failure. The cleanup/working-directory environment variables are documented Expo debugging controls. [2] [3]

The resulting `eas-local-build.log` is the useful error output. `tablelens-preview.apk` is created only if the build succeeds. Keep the retained directory private: it can contain build material and signing-related files. Do not commit logs, APKs, credentials, or the retained directory to Git.

If the CLI first reports a login, project-linking, or credentials error, save that output too. It is not a compiler error. The inspected `app.config.ts` does not include a literal `extra.eas.projectId`; the managed Dashboard may supply additional configuration not present in this checkout. Do not create/relink a different EAS project or replace the Android package ID just to silence a prompt. Record the exact linking error first, and verify the intended Expo account/project.

Local builds still authenticate with Expo and may download managed signing credentials. Secret-visibility EAS environment variables are not automatically supported for local builds; any required values must be supplied locally. Missing local environment values can make the local error differ from the cloud error. Never paste tokens or passwords into chat. [3]

## Capture a new cloud CLI attempt only if needed

If no existing log is available, you can start a new cloud build without installing an Android SDK:

```bash
set -o pipefail
eas build --platform android --profile preview --wait \
  --verbose-logs --build-logger-level debug \
  2>&1 | tee eas-cloud-cli.log
```

**This starts a new build on Expo's servers.** The captured CLI file is particularly useful for errors before a build is queued. Once the CLI produces a build-details URL, open that page for the full failed-phase compiler/Gradle logs; do not assume the CLI's final summary contains them. [1] [2]

On Windows PowerShell, the cloud attempt can be captured with:

```powershell
eas build --platform android --profile preview --wait --verbose-logs --build-logger-level debug 2>&1 | Tee-Object -FilePath eas-cloud-cli.log
```

This is a cloud build, not a Windows local Android build. Login and existing-build list/view commands can be used from PowerShell as well.

## What to send back

Send the first error plus roughly 30–50 surrounding lines, or upload the log after checking for secrets. Particularly useful text includes:

- `FAILURE: Build failed with an exception.`
- `What went wrong:` and the failed Gradle task.
- Kotlin diagnostics such as `e: ...SomeFile.kt:line:column`.
- `Could not resolve ...`, `Manifest merger failed`, or `Unable to resolve module ...`.
- Authentication/project-linking failures if compilation never starts.

Do not send passwords, Expo tokens, signing keystores, or private environment values. A final generic “contact support” line is not enough to identify a source fix.

## References

[1]: https://docs.expo.dev/build-reference/troubleshooting/ "Expo: Troubleshoot build errors and crashes"
[2]: https://docs.expo.dev/eas/cli/ "Expo: EAS CLI command reference"
[3]: https://docs.expo.dev/build-reference/local-builds/ "Expo: Run EAS Build locally with local flag"
