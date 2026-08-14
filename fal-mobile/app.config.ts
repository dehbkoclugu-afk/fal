const { expo } = require('./app.base.json');

export default {
  ...expo,
  extra: {
    ...expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? expo.extra.apiUrl,
    rcAndroidKey: process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? null,
    buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE ?? 'development',
    eas: {
      ...expo.extra.eas,
      projectId: process.env.EAS_PROJECT_ID ?? null,
    },
  },
};
