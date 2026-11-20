// Play treats features implied by permissions/orientation as required, which
// hides the app from devices without them (tablets, Chromebooks, XR).
// Declare them optional so the manifest stops filtering those devices out.
const { withAndroidManifest } = require("expo/config-plugins");

const OPTIONAL_FEATURES = ["android.hardware.screen.portrait", "android.hardware.wifi"];

module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest["uses-feature"] ??= []);
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((f) => f.$["android:name"] === name);
      if (existing) existing.$["android:required"] = "false";
      else features.push({ $: { "android:name": name, "android:required": "false" } });
    }
    return cfg;
  });
};
