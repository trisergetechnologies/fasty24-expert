import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type JobOfferNotifyNative = {
  canUseFullScreenIntent: () => boolean | Promise<boolean>;
  openFullScreenIntentSettings: () => Promise<void>;
  present: (title: string, body: string, bookingId: string) => Promise<void>;
  dismiss: () => Promise<void>;
};

const native = requireOptionalNativeModule<JobOfferNotifyNative>('JobOfferNotify');

export function isNativeJobNotifyAvailable(): boolean {
  return Platform.OS === 'android' && native != null;
}

export async function canUseFullScreenIntent(): Promise<boolean> {
  if (!native) return Platform.OS !== 'android';
  try {
    return !!(await native.canUseFullScreenIntent());
  } catch {
    return false;
  }
}

export async function openFullScreenIntentSettings(): Promise<boolean> {
  if (!native) return false;
  try {
    await native.openFullScreenIntentSettings();
    return true;
  } catch {
    return false;
  }
}

export async function presentNativeJobOffer(
  title: string,
  body: string,
  bookingId: string,
): Promise<boolean> {
  if (!native) return false;
  try {
    await native.present(title, body, bookingId || 'unknown');
    return true;
  } catch (err) {
    console.warn('[jobOfferNotify] present failed', err);
    return false;
  }
}

export async function dismissNativeJobOffer(): Promise<void> {
  if (!native) return;
  try {
    await native.dismiss();
  } catch {
    //
  }
}
