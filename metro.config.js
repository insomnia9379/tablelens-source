const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Metro 0.84 no longer accepts the old virtual haste-change payload.
  // NativeWind's supported filesystem mode avoids that incompatible callback.
  forceWriteFileSystem: true,
});
