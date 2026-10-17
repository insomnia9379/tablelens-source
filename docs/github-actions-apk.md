# GitHub Actions APK builds

The repository includes `.github/workflows/android-apk.yml`. On each push to `main`, GitHub Actions validates the project and requests an Android APK build from **EAS cloud**, using the existing `preview` profile in `eas.json`. It also supports manual runs. The APK is built on Expo's builders, not the GitHub runner. [1]

A committed workflow is not proof of a successful build. Authentication, project linking, signing, and native compilation must succeed. The checked source still needs its real Expo project ID in `app.config.ts`; the availability of `EXPO_TOKEN` and Android signing credentials has not been verified.

## One-time Expo setup

On your computer, inside this checkout:

```sh
npm install -g eas-cli@latest
eas login
eas init
```

Link the intended Expo account/project. If it already exists, select that project rather than creating an unrelated replacement. Preserve the `tablelens` slug and Android package `space.manus.tablelens.t115810122895538`.

The dynamic TypeScript configuration currently has `extra: publicRuntime`. If EAS asks you to add its project ID manually, replace that one property with:

```ts
extra: {
  ...publicRuntime,
  eas: {
    projectId: "YOUR_ACTUAL_EXPO_PROJECT_UUID",
  },
},
```

Use the real ID supplied by EAS. Do not use a Manus project ID or put an access token there. This is an edit to the existing property, not a duplicate `extra` property or replacement for the whole application configuration.

Then complete an interactive build:

```sh
eas build --platform android --profile preview
```

This requests a cloud build while allowing prompts on your computer. It establishes the required project/signing setup. Expo recommends completing this setup before unattended CI. Keep signing files and passwords out of Git. If the build fails, inspect the earliest failed build phase; automation does not repair compiler errors. [1]

Commit the correct public project-ID configuration once linked.

## Add the Expo token in GitHub

Create an access token through the intended Expo account's account settings. Open [this repository's Actions secrets settings](https://github.com/insomnia9379/tablelens-source/settings/secrets/actions) and add a repository secret:

- Name: `EXPO_TOKEN`
- Value: your Expo access token

The GitHub path is **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Put the value in GitHub's secret field, not chat, source code, or a workflow literal. [2] [3]

GitHub repository authentication and Expo authentication are separate. The connected integration previously received HTTP 403 when listing Actions secrets. That does not establish whether a secret exists. No secret values were read and no attempt was made to bypass the restriction; a repository owner can check the setup directly.

## Watch a run

Open [the repository's Actions page](https://github.com/insomnia9379/tablelens-source/actions) and select **Build Android APK**. A commit to `main` triggers a run. For a manual run, select **Run workflow** and choose `main`.

The workflow uses Node.js 22 and pnpm 9.12.0, installs the lockfile, checks the EAS project ID, runs TypeScript/native configuration/tests, and executes:

```sh
eas build --platform android --profile preview --non-interactive --wait --verbose-logs --build-logger-level debug
```

`--wait` waits for the EAS result. A workflow using only `--no-wait` could succeed after queuing a build even if the subsequent compilation fails. [1] [4]

Open the **EAS build-details URL** from the build step for the APK and native Gradle/compiler logs. The GitHub artifact named `eas-cli-log-...` contains CLI output, **not the APK** and not necessarily the complete remote compiler logs.

The workflow never submits to an app store, publishes a GitHub Release, or switches the Manus project's primary repository. If credentials are absent, it fails with a setup message before requesting a native build. If the job times out after requesting a build, check that EAS build before retrying; it may still be running.

## Troubleshooting

A missing `EXPO_TOKEN` requires the repository secret. A missing `extra.eas.projectId` requires correct EAS linking and a committed public ID. Signing errors require the interactive EAS setup. Validation errors appear in the earliest failed Actions step; native errors appear in the earliest failed EAS phase. See [EAS debugging](eas-build-debugging.md) for complete log-capture commands.

If repository policy blocks a referenced action or workflow, the owner must review that specific authorization requirement. Do not work around a denied permission using an unrelated credential.

## References

[1]: https://docs.expo.dev/build/building-on-ci/ "Expo: Trigger builds from CI"
[2]: https://github.com/expo/expo-github-action "Expo GitHub Action"
[3]: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions "GitHub: Using secrets in GitHub Actions"
[4]: https://docs.expo.dev/eas/cli/ "Expo: EAS CLI command reference"
