import * as Location from 'expo-location';

const GPS_ACCURACY = Location.Accuracy.BestForNavigation;

/** High-accuracy fix so dispatch distance is not Wi‑Fi/cell-snapped hundreds of metres away. */
export async function getPreciseCoords(): Promise<{ lat: number; lng: number }> {
  try {
    await Location.enableNetworkProviderAsync();
  } catch {
    // High-accuracy mode already on, or the prompt was dismissed.
  }

  const last = await Location.getLastKnownPositionAsync({
    maxAge: 15_000,
    requiredAccuracy: 35,
  }).catch(() => null);

  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: GPS_ACCURACY,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('gps_timeout')), 12_000);
      }),
    ]);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    throw new Error('location_unavailable');
  }
}

export const PRECISE_WATCH = {
  accuracy: GPS_ACCURACY,
  timeInterval: 8_000,
  distanceInterval: 10,
  mayShowUserSettingsDialog: true,
} as const;

export const PRECISE_JOB_WATCH = {
  accuracy: GPS_ACCURACY,
  timeInterval: 4_000,
  distanceInterval: 8,
  mayShowUserSettingsDialog: true,
} as const;
