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
  if (socket?.connected) return socket;
  const token = await getToken();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
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

export function subscribeBooking(bookingId: string, handler: (data: unknown) => void) {
  socket?.emit('booking:subscribe', { bookingId });
  socket?.emit('join:booking', bookingId);
  socket?.on(`booking:${bookingId}`, handler);
  return () => {
    socket?.emit('booking:unsubscribe', { bookingId });
    socket?.emit('leave:booking', bookingId);
    socket?.off(`booking:${bookingId}`, handler);
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
