const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { XML } = require('@expo/config-plugins');

const root = process.cwd();
const result = execFileSync('pnpm', ['exec', 'expo', 'config', '--type', 'introspect', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const config = JSON.parse(result.slice(result.indexOf('{')));
const manifest = config._internal?.modResults?.android?.manifest?.manifest;
assert.ok(manifest, 'Android manifest introspection must produce a manifest');
const permissions = new Set((manifest['uses-permission'] || []).map(item => item.$['android:name']));
for (const permission of ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION', 'android.permission.POST_NOTIFICATIONS']) {
  assert.ok(permissions.has(permission), `Missing permission ${permission}`);
}
const app = manifest.application[0];
const service = (app.service || []).find(item => item.$['android:name'] === 'expo.modules.tablelenscapture.CaptureService');
assert.equal(service?.$['android:foregroundServiceType'], 'mediaProjection');
assert.equal(service?.$['android:exported'], 'false');
for (const name of ['CapturePermissionActivity', 'ReviewActivity', 'ImportImageActivity']) {
  const activity = (app.activity || []).find(item => item.$['android:name'] === `expo.modules.tablelenscapture.${name}`);
  assert.ok(activity, `Missing native activity ${name}`);
  assert.equal(activity.$['android:exported'], 'false');
  if (name === 'CapturePermissionActivity') assert.notEqual(activity.$['android:noHistory'], 'true');
}
const autolink = JSON.parse(execFileSync('pnpm', ['exec', 'expo-modules-autolinking', 'resolve', '--platform', 'android', '--json'], {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}));
const captureModule = autolink.modules.find(item => item.packageName === '@tablelens/capture');
assert.ok(captureModule, 'Local capture module must be discovered by Expo autolinking');
assert.ok(captureModule.projects.some(project => project.modules.some(mod => mod.classifier === 'expo.modules.tablelenscapture.TablelensCaptureModule')));
for (const file of ['icon.png', 'splash-icon.png', 'favicon.png', 'android-icon-foreground.png', 'android-icon-background.png', 'android-icon-monochrome.png']) assert.ok(fs.statSync(`assets/images/${file}`).size > 0);
assert.equal(config.android.package, 'space.manus.tablelens.t115810122895538');
assert.equal(config.slug, 'tablelens');
console.log('PASS: capture permissions, nonexported activities/service, consent lifecycle, Android autolinking, preserved identifiers, and native icon files.');
console.log('Not tested here: Android Gradle compilation, APK signing, Pixel permissions, actual OCR accuracy, capture/overlay behavior on device.');
