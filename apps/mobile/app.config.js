const appJson = require("./app.json");

const TEST_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const TEST_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const TEST_REWARDED_ANDROID = "ca-app-pub-3940256099942544/5224354917";
const TEST_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";

module.exports = ({ config }) => {
  const base = appJson.expo ?? config;
  return {
    ...base,
    plugins: [
      ...(base.plugins ?? []),
      [
        "react-native-google-mobile-ads",
        {
          androidAppId:
            process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? TEST_ANDROID_APP_ID,
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? TEST_IOS_APP_ID,
        },
      ],
    ],
    extra: {
      ...(base.extra ?? {}),
      admobRewardedAndroid:
        process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID ??
        TEST_REWARDED_ANDROID,
      admobRewardedIos:
        process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID ?? TEST_REWARDED_IOS,
    },
  };
};
