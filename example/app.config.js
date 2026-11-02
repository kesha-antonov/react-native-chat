// Metro's port for debug iOS builds, baked into Info.plist at prebuild time:
// `RCT_METRO_PORT=8082 npx expo prebuild --clean`. Without it the app looks for Metro on 8081.
// (Android takes the port at build time instead: `-PreactNativeDevServerPort=8082`.)
module.exports = ({ config }) => {
  const port = process.env.RCT_METRO_PORT
  if (!port)
    return config

  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: { ...config.ios?.infoPlist, RCTMetroPort: String(port) },
    },
  }
}
