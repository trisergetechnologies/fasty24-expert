import { Platform, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerForPushNotifications,
  requestNotificationPermission,
} from './push';
import {
  canUseFullScreenIntent,
  openFullScreenIntentSettings,
} from './jobOfferNotify';

const PERMS_ASKED_KEY = 'fasty_home_permissions_v3';

function androidPackage() {
  return Constants.expoConfig?.android?.package || 'com.fasty24.expert';
}

async function openPackageIntent(action: string): Promise<boolean> {
  try {
    await IntentLauncher.startActivityAsync(action, {
      data: `package:${androidPackage()}`,
    });
    return true;
  } catch {
    return false;
  }
}

/** Opens this app's Display-over-other-apps page (not the generic Settings root). */
export async function openDisplayOverAppsSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (await openPackageIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION')) return;
  if (await openPackageIntent('android.settings.APPLICATION_DETAILS_SETTINGS')) return;
  await Linking.openSettings();
}

export async function openJobPopupSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (await openFullScreenIntentSettings()) return;
  if (await openPackageIntent('android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT')) return;
  await openDisplayOverAppsSettings();
}

async function askFullScreenAlerts(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (await canUseFullScreenIntent()) return;
  await new Promise<void>((resolve) => {
    Alert.alert(
      'Show incoming jobs on the lock screen',
      'Android will open Full-screen alerts for Fasty24 Expert. Turn the toggle ON so a new job pops up over the home screen instead of sitting in the shade.',
      [
        {
          text: 'Open setting',
          onPress: async () => {
            await openJobPopupSettings();
            resolve();
          },
        },
      ],
      { cancelable: false },
    );
  });
}

async function askOverlay(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await new Promise<void>((resolve) => {
    Alert.alert(
      'Show jobs over other apps',
      'On some phones (Xiaomi, Oppo, Vivo) you also need “Display over other apps” so a new job can appear while you are in WhatsApp.',
      [
        {
          text: 'Open setting',
          onPress: async () => {
            await openDisplayOverAppsSettings();
            resolve();
          },
        },
        { text: 'Skip', onPress: () => resolve(), style: 'cancel' },
      ],
    );
  });
}

/**
 * First time the expert reaches Home (KYC verified): notifications, location, full-screen alerts.
 * Full-screen alerts are re-prompted until Android grants them — required for the home-screen popup.
 */
export async function requestHomePermissions(): Promise<void> {
  let asked = false;
  try {
    asked = (await AsyncStorage.getItem(PERMS_ASKED_KEY)) === '1';
  } catch {
    asked = false;
  }

  await requestNotificationPermission();
  await registerForPushNotifications();

  if (!asked) {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status === 'granted') {
      await Location.requestBackgroundPermissionsAsync();
    }
  }

  if (Platform.OS === 'android' && !(await canUseFullScreenIntent())) {
    await askFullScreenAlerts();
  }

  if (!asked) {
    await askOverlay();
    try {
      await AsyncStorage.setItem(PERMS_ASKED_KEY, '1');
    } catch {
      //
    }
  }
}
