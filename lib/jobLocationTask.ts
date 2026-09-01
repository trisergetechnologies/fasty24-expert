import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { connectSocket, emitLocation } from './socket';

export const JOB_LOCATION_TASK = 'fasty24-job-location';

let activeBookingId: string | null = null;

export function setTrackingBookingId(id: string | null) {
  activeBookingId = id;
}

export function getTrackingBookingId() {
  return activeBookingId;
}

TaskManager.defineTask(JOB_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: LocationObject[] } | undefined)?.locations;
  const loc = locations?.[0];
  if (!loc) return;
  try {
    await connectSocket();
    emitLocation(loc.coords.latitude, loc.coords.longitude, activeBookingId ?? undefined);
  } catch {
    // location pings are best-effort
  }
});
