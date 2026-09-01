import * as Location from 'expo-location';
import { JOB_LOCATION_TASK, getTrackingBookingId, setTrackingBookingId } from './jobLocationTask';
import { emitLocation } from './socket';
import { startOnlineHeartbeat, stopOnlineHeartbeat } from './onlineHeartbeat';

export type PresenceMode = 'offline' | 'online' | 'job';

let mode: PresenceMode = 'offline';
let wantsOnline = false;
let watchSub: Location.LocationSubscription | null = null;

async function stopForegroundWatch() {
  watchSub?.remove();
  watchSub = null;
}

async function restartLocationService(opts: {
  title: string;
  body: string;
  accuracy: number;
  timeInterval: number;
  distanceInterval: number;
}) {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(JOB_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(JOB_LOCATION_TASK);
  } catch {
    //
  }
  await Location.startLocationUpdatesAsync(JOB_LOCATION_TASK, {
    accuracy: opts.accuracy,
    timeInterval: opts.timeInterval,
    distanceInterval: opts.distanceInterval,
    foregroundService: {
      notificationTitle: opts.title,
      notificationBody: opts.body,
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

/** Persistent "You are online" FG notification + GPS pings for dispatch. */
export async function startOnlinePresence(): Promise<void> {
  wantsOnline = true;
  if (mode === 'job') {
    startOnlineHeartbeat();
    return;
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;

  await stopForegroundWatch();
  watchSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15_000,
      distanceInterval: 50,
    },
    (loc) => {
      emitLocation(loc.coords.latitude, loc.coords.longitude);
    },
  );

  startOnlineHeartbeat();

  try {
    await restartLocationService({
      title: 'You are online',
      body: 'Waiting for jobs — Fasty24 is sharing your location with dispatch.',
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15_000,
      distanceInterval: 50,
    });
  } catch {
    // Foreground watch still covers presence while the app is open.
  }
  if (mode !== 'job') mode = 'online';
}

export function markOnJob(bookingId?: string): void {
  if (bookingId) setTrackingBookingId(bookingId);
  mode = 'job';
}

export async function startJobLocationTracking(bookingId: string): Promise<void> {
  markOnJob(bookingId);
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;

  await stopForegroundWatch();
  watchSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 20,
    },
    (loc) => {
      emitLocation(loc.coords.latitude, loc.coords.longitude, bookingId);
    },
  );

  try {
    await restartLocationService({
      title: 'Sharing your location',
      body: 'The customer can see your live location until you arrive.',
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 20,
    });
  } catch {
    // In-app watch still covers the job screen if the foreground service cannot start.
  }
}

export async function stopJobLocationTracking(): Promise<void> {
  setTrackingBookingId(null);
  await stopForegroundWatch();
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(JOB_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(JOB_LOCATION_TASK);
  } catch {
    //
  }
  mode = 'offline';
  if (wantsOnline) {
    await startOnlinePresence();
  } else {
    stopOnlineHeartbeat();
  }
}

export async function stopOnlinePresence(): Promise<void> {
  wantsOnline = false;
  stopOnlineHeartbeat();
  if (mode === 'job') return;
  await stopForegroundWatch();
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(JOB_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(JOB_LOCATION_TASK);
  } catch {
    //
  }
  mode = 'offline';
}

/** Stops the in-app watcher but keeps the background service if a job is still active. */
export async function pauseForegroundJobTracking() {
  await stopForegroundWatch();
}

export function isTrackingBooking(bookingId: string) {
  return getTrackingBookingId() === bookingId;
}

export function getPresenceMode() {
  return mode;
}
