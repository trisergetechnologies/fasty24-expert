import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { getToken } from './storage';
import type { Offer } from './api';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ??
  (Constants.expoConfig?.extra?.socketUrl as string | undefined) ??
  'https://api.fasty24.com';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  // Reuse the single instance even while temporarily disconnected — Socket.IO
  // reconnects it internally, so building a new instance here would leak the old
  // one and duplicate listeners. A fresh socket (with the current token) is only
  // built after an explicit disconnectSocket() (logout / session expiry).
  if (socket) return socket;
  const token = await getToken();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });
  socket.on('connect_error', (err) => {
    console.warn('[socket] connect error', err.message);
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ─── Expert: emit location ────────────────────────────────────────────────────

export function emitLocation(lat: number, lng: number, bookingId?: string) {
  socket?.emit('expert:location', bookingId ? { lat, lng, bookingId } : { lat, lng });
}

// ─── Subscribe to incoming dispatch offer ─────────────────────────────────────

export function onOffer(handler: (offer: Offer) => void) {
  socket?.on('dispatch:offer', handler);
  return () => socket?.off('dispatch:offer', handler);
}

// ─── Subscribe to booking status updates ─────────────────────────────────────

/**
 * Named realtime events the backend emits into the `booking:{publicId}` room.
 * A few status-specific events carry only partial data, so we fold the implied
 * status into the patch before handing it to the caller (mirrors the customer app).
 */
const BOOKING_PATCH_EVENTS: Record<string, { status?: string }> = {
  'booking:update': {},
  'booking:status': {},
  'booking:assigned': { status: 'assigned' },
  'booking:arrived': { status: 'arrived' },
  'booking:en_route': { status: 'travelling' },
};

export function subscribeBooking(bookingId: string, handler: (data: unknown) => void) {
  socket?.emit('booking:subscribe', { bookingId });
  const bound = Object.entries(BOOKING_PATCH_EVENTS).map(([event, implied]) => {
    const fn = (data: unknown) => {
      const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      handler({ ...implied, ...payload });
    };
    socket?.on(event, fn);
    return { event, fn };
  });
  return () => {
    socket?.emit('booking:unsubscribe', { bookingId });
    bound.forEach(({ event, fn }) => socket?.off(event, fn));
  };
}

/** Listens to named server events (e.g. estimate:paid) scoped to a booking room. */
export function subscribeBookingEvents(
  bookingId: string,
  events: string[],
  handler: (event: string, data: unknown) => void,
) {
  socket?.emit('booking:subscribe', { bookingId });
  const bound = events.map((event) => {
    const fn = (data: unknown) => handler(event, data);
    socket?.on(event, fn);
    return { event, fn };
  });
  return () => {
    bound.forEach(({ event, fn }) => socket?.off(event, fn));
  };
}
