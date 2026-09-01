/**
 * Makes incoming job-offer notifications take over the screen like a phone call:
 * full-screen intent, show-when-locked, turn-screen-on.
 * Expo's notification builder does not set setFullScreenIntent() by itself.
 */
const {
  withDangerousMod,
  withAndroidManifest,
  withMainActivity,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FSI_START = '// FASTY24_FSI_START';
const FSI_END = '// FASTY24_FSI_END';
const FSI_SNIPPET = `
    ${FSI_START}
    val isJobOffer = notificationContent.categoryId == "job_offer" ||
      notificationContent.body?.optString("kind") == "dispatch_offer"
    if (isJobOffer) {
      builder.setSilent(false)
      builder.setPriority(NotificationCompat.PRIORITY_MAX)
      builder.setCategory(NotificationCompat.CATEGORY_CALL)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      builder.setFullScreenIntent(
        createNotificationResponseIntent(context, notification, defaultAction),
        true
      )
    }
    ${FSI_END}
`;

function patchNotificationBuilder(projectRoot) {
  const builderPath = path.join(
    projectRoot,
    'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt',
  );
  if (!fs.existsSync(builderPath)) {
    console.warn('[withJobOfferFullScreenIntent] ExpoNotificationBuilder.kt not found');
    return;
  }
  let src = fs.readFileSync(builderPath, 'utf8');
  if (src.includes(FSI_START)) {
    src = src.replace(
      new RegExp(`${escapeRegex(FSI_START)}[\\s\\S]*?${escapeRegex(FSI_END)}`),
      `${FSI_START}\n    val isJobOffer = notificationContent.categoryId == "job_offer" ||\n      notificationContent.body?.optString("kind") == "dispatch_offer"\n    if (isJobOffer) {\n      builder.setSilent(false)\n      builder.setPriority(NotificationCompat.PRIORITY_MAX)\n      builder.setCategory(NotificationCompat.CATEGORY_CALL)\n      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)\n      builder.setFullScreenIntent(\n        createNotificationResponseIntent(context, notification, defaultAction),\n        true\n      )\n    }\n    ${FSI_END}`,
    );
    fs.writeFileSync(builderPath, src);
    return;
  }

  const anchor = `    builder.setContentIntent(
      createNotificationResponseIntent(
        context,
        notification,
        defaultAction
      )
    )`;
  if (!src.includes(anchor)) {
    console.warn('[withJobOfferFullScreenIntent] could not find setContentIntent anchor');
    return;
  }
  src = src.replace(anchor, `${anchor}\n${FSI_SNIPPET}`);
  fs.writeFileSync(builderPath, src);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withJobOfferFullScreenIntent(config) {
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      patchNotificationBuilder(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

  config = withAndroidManifest(config, (modConfig) => {
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(modConfig.modResults);
    main.$['android:showWhenLocked'] = 'true';
    main.$['android:turnScreenOn'] = 'true';
    main.$['android:resumeWhilePausing'] = 'true';
    if (!main.$['android:launchMode']) {
      main.$['android:launchMode'] = 'singleTask';
    }
    return modConfig;
  });

  config = withMainActivity(config, (modConfig) => {
    let src = modConfig.modResults.contents;
    if (src.includes('setShowWhenLocked')) {
      return modConfig;
    }
    const kotlinOnCreate = 'override fun onCreate(savedInstanceState: Bundle?) {';
    const javaOnCreate = 'protected void onCreate(Bundle savedInstanceState) {';
    const kotlinInject = `${kotlinOnCreate}
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }`;
    const javaInject = `${javaOnCreate}
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    }`;
    if (src.includes(kotlinOnCreate)) {
      src = src.replace(kotlinOnCreate, kotlinInject);
    } else if (src.includes(javaOnCreate)) {
      src = src.replace(javaOnCreate, javaInject);
    }
    modConfig.modResults.contents = src;
    return modConfig;
  });

  return config;
}

module.exports = withJobOfferFullScreenIntent;
