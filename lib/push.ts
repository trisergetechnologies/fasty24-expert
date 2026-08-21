import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { savePushToken } from './api';
import { getToken } from './storage';

export const JOB_OFFERS_CHANNEL = 'job_offers';
export const JOB_ALERT_SOUND = 'job_alert.wav';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let listenersAttached = false;

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  // Max-importance channel so job offers break through even when backgrounded.
  await Notifications.setNotificationChannelAsync(JOB_OFFERS_CHANNEL, {
    name: 'New job offers',
    importance: Notifications.AndroidImportance.MAX,
    sound: JOB_ALERT_SOUND,
    vibrationPattern: [0, 400, 200, 400, 200, 600],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: '#FFC400',
  });
}

function getProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

/** Requests permission, ensures the loud channel, and saves the Expo token to the backend. */
export async function registerForPushNotifications(): Promise<void> {
  try {
    await ensureChannels();

    const auth = await getToken();
    if (!auth) return;

    if (!Device.isDevice) return;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (tokenData?.data) {
      await savePushToken(tokenData.data);
    }
  } catch (err) {
    console.warn('[push] register failed', err);
  }
}

/**
 * Fires the loud local alert when an offer arrives while the app is foregrounded,
 * so experts hear the buzzer even with the app open (remote push covers background).
 */
export async function presentForegroundJobAlert(bookingId?: string): Promise<void> {
  try {
    await ensureChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New job nearby!',
        body: 'A customer needs an expert. Tap to view the offer.',
        sound: JOB_ALERT_SOUND,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { kind: 'dispatch_offer', bookingId },
      },
      trigger: Platform.OS === 'android' ? { channelId: JOB_OFFERS_CHANNEL } : null,
    });
  } catch (err) {
    console.warn('[push] foreground alert failed', err);
  }
}

function routeFromData(data: Record<string, any> | undefined) {
  if (!data) return;
  if (data.kind === 'dispatch_offer') {
    router.push('/(tabs)/home');
    return;
  }
  const bookingId = data.bookingId as string | undefined;
  if (bookingId) router.push(`/job/${bookingId}`);
}

/** Wires tap handlers (foreground, background, and cold-start). Call once at app root. */
export function attachNotificationListeners(): () => void {
  if (listenersAttached) return () => {};
  listenersAttached = true;

  const responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    routeFromData(resp.notification.request.content.data as Record<string, any>);
  });

  Notifications.getLastNotificationResponseAsync().then((resp) => {
    if (resp) routeFromData(resp.notification.request.content.data as Record<string, any>);
  });

  return () => {
    responseSub.remove();
    listenersAttached = false;
  };
}
