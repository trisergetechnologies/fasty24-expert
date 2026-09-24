import * as Location from 'expo-location';
import { emitLocation } from './socket';
import { getPreciseCoords } from './gps';

let interval: ReturnType<typeof setInterval> | null = null;

async function sendLocation() {
  try {
    const { lat, lng } = await getPreciseCoords();
    emitLocation(lat, lng);
  } catch {
    // GPS can fail in the background; next tick retries.
  }
}

/** Keeps lastLocation fresh while the expert is online so dispatch can find them. */
export async function startOnlineHeartbeat() {
  if (interval) return;
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return;
  await sendLocation();
  interval = setInterval(sendLocation, 15_000);
}

export function stopOnlineHeartbeat() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
