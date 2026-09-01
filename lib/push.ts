import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { savePushToken } from './api';
import { getToken } from './storage';
import {
  clearIncomingOffer,
  ingestIncomingOffer,
  offerFromPushData,
  respondIncomingOffer,
} from './offerBridge';
import {
  dismissNativeJobOffer,
  isNativeJobNotifyAvailable,
  presentNativeJobOffer,
} from './jobOfferNotify';

export const JOB_OFFERS_CHANNEL = 'job_offers';
export const JOB_OFFERS_UI_CHANNEL = 'job_offers_ui';
export const JOB_ALERT_SOUND = 'job_alert.wav';
export const JOB_OFFER_CATEGORY = 'job_offer';
export const ACCEPT_ACTION = 'accept';
export const DECLINE_ACTION = 'decline';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const kind = (notification.request.content.data as Record<string, any> | undefined)?.kind;
    const isJob = kind === 'dispatch_offer';
    const nativePostsJob = isJob && isNativeJobNotifyAvailable();
    return {
      // Native module posts the call-style popup. Suppress the silent Expo copy.
      shouldShowAlert: !nativePostsJob,
      shouldPlaySound: !nativePostsJob,
      shouldSetBadge: false,
      priority: isJob
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

let listenersAttached = false;

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.deleteNotificationChannelAsync(JOB_OFFERS_UI_CHANNEL);
  } catch {
    //
  }
  await Notifications.setNotificationChannelAsync(JOB_OFFERS_CHANNEL, {
    name: 'New job offers',
    importance: Notifications.AndroidImportance.MAX,
    sound: JOB_ALERT_SOUND,
    vibrationPattern: [0, 400, 200, 400, 200, 600],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: '#FFC400',
    enableLights: true,
  });
}

async function ensureCategory() {
  await Notifications.setNotificationCategoryAsync(JOB_OFFER_CATEGORY, [
    {
      identifier: DECLINE_ACTION,
      buttonTitle: 'Decline',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
        isAuthenticationRequired: false,
      },
    },
  ]);
}

function getProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannels();
    await ensureCategory();
    if (!Device.isDevice) return false;
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    return status === 'granted';
  } catch (err) {
    console.warn('[push] permission failed', err);
    return false;
  }
}

/** Requests permission, ensures the loud channel, and saves the Expo token to the backend. */
export async function registerForPushNotifications(): Promise<boolean> {
  try {
    const granted = await requestNotificationPermission();
    const auth = await getToken();
    if (!auth || !granted) return granted;

    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (tokenData?.data) {
      await savePushToken(tokenData.data);
    }
    return true;
  } catch (err) {
    console.warn('[push] register failed', err);
    return false;
  }
}

/**
 * Sticky heads-up + full-screen intent so the offer takes over the home screen.
 * Prefers the native Android builder (release/preview). Falls back to Expo notifications.
 */
export async function presentJobOfferNotification(raw: Record<string, any> | undefined): Promise<void> {
  try {
    await ensureChannels();
    await ensureCategory();
    const bookingId = raw?.bookingId ? String(raw.bookingId) : undefined;
    const service = raw?.serviceName ? String(raw.serviceName) : 'A customer needs an expert';
    const earning = raw?.expertEarning != null ? ` · ₹${raw.expertEarning}` : '';
    const title = 'New job nearby!';
    const body = `${service}${earning}. Accept or decline now.`;

    const nativeOk = await presentNativeJobOffer(title, body, bookingId || '');
    if (nativeOk) {
      await dismissExpoJobNotifications(bookingId);
      return;
    }

    if (bookingId) {
      try {
        await Notifications.dismissNotificationAsync(`job-offer-${bookingId}`);
      } catch {
        //
      }
    }
    await Notifications.scheduleNotificationAsync({
      identifier: bookingId ? `job-offer-${bookingId}` : `job-offer-${Date.now()}`,
      content: {
        title,
        body,
        sound: JOB_ALERT_SOUND,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: JOB_OFFER_CATEGORY,
        sticky: true,
        autoDismiss: false,
        data: { kind: 'dispatch_offer', ...(raw || {}), bookingId },
      },
      trigger: Platform.OS === 'android' ? { channelId: JOB_OFFERS_CHANNEL } : null,
    });
  } catch (err) {
    console.warn('[push] job offer notification failed', err);
  }
}

async function dismissExpoJobNotifications(bookingId?: string) {
  try {
    if (bookingId) {
      await Notifications.dismissNotificationAsync(`job-offer-${bookingId}`);
    }
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => (n.request.content.data as any)?.kind === 'dispatch_offer')
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    //
  }
}

/** @deprecated Use presentJobOfferNotification */
export const presentForegroundJobAlert = presentJobOfferNotification;

export async function dismissJobOfferNotification(bookingId?: string): Promise<void> {
  await dismissNativeJobOffer();
  await dismissExpoJobNotifications(bookingId);
}

function hydrateFromData(data: Record<string, any> | undefined) {
  if (!data || data.kind !== 'dispatch_offer') return;
  const payload = offerFromPushData(data);
  if (payload) ingestIncomingOffer(payload);
}

async function handleResponse(
  resp: Notifications.NotificationResponse,
  { fromColdStart = false }: { fromColdStart?: boolean } = {},
) {
  const data = resp.notification.request.content.data as Record<string, any> | undefined;
  const action = resp.actionIdentifier;
  const bookingId = data?.bookingId ? String(data.bookingId) : '';

  // Cold start / full-screen open must only show the card — never auto-accept.
  if (fromColdStart || action !== DECLINE_ACTION) {
    hydrateFromData(data);
    return;
  }

  if (action === DECLINE_ACTION && bookingId) {
    try {
      await respondIncomingOffer(bookingId, false);
    } catch (err) {
      console.warn('[push] decline action failed', err);
    }
    clearIncomingOffer(bookingId);
    void dismissJobOfferNotification(bookingId);
  }
}

/** Wires tap handlers (foreground, background, and cold-start). Call once at app root. */
export function attachNotificationListeners(): () => void {
  if (listenersAttached) return () => {};
  listenersAttached = true;
  void ensureChannels();
  void ensureCategory();

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as Record<string, any> | undefined;
    hydrateFromData(data);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    void handleResponse(resp);
  });

  Notifications.getLastNotificationResponseAsync().then((resp) => {
    if (resp) void handleResponse(resp, { fromColdStart: true });
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
    listenersAttached = false;
  };
}
