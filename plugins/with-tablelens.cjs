const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-tablelens';
const VERSION = '1.0.0';
const ns = 'android';

function attr(name, value) { return { [`${ns}:${name}`]: value }; }
function ensureNamed(list, key, value, extra = {}) {
  const items = Array.isArray(list) ? list : [];
  if (items.some((item) => item?.$?.[`${ns}:${key}`] === value)) return items;
  items.push({ $: attr(key, value), ...extra });
  return items;
}

function withTableLens(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const permission of [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
    ]) manifest['uses-permission'] = ensureNamed(manifest['uses-permission'], 'name', permission);

    const application = (manifest.application = manifest.application || [{}])[0];
    application.activity = application.activity || [];
    application.service = application.service || [];
    const addActivity = (name, options = {}) => {
      application.activity = ensureNamed(application.activity, 'name', name, {
        $: { ...attr('name', name), ...options },
      });
    };
    addActivity('expo.modules.tablelenscapture.CapturePermissionActivity', {
      ...attr('exported', 'false'), ...attr('excludeFromRecents', 'true'),
      ...attr('theme', '@android:style/Theme.DeviceDefault.NoActionBar'),
    });
    addActivity('expo.modules.tablelenscapture.ReviewActivity', {
      ...attr('exported', 'false'), ...attr('screenOrientation', 'portrait'),
    });
    addActivity('expo.modules.tablelenscapture.ImportImageActivity', {
      ...attr('exported', 'false'), ...attr('excludeFromRecents', 'true'),
    });
    application.service = ensureNamed(application.service, 'name', 'expo.modules.tablelenscapture.CaptureService', {
      $: {
        ...attr('name', 'expo.modules.tablelenscapture.CaptureService'),
        ...attr('exported', 'false'), ...attr('foregroundServiceType', 'mediaProjection'), ...attr('stopWithTask', 'false'),
      },
    });
    return config;
  });
}

module.exports = createRunOncePlugin(withTableLens, PLUGIN_NAME, VERSION);
module.exports.default = module.exports;
