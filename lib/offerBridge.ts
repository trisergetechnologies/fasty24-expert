import { respondToOffer, type Offer } from './api';

type IngestFn = (raw: unknown) => void;
type RespondFn = (bookingId: string, accepted: boolean) => Promise<void>;
type ClearFn = (bookingId?: string) => void;

let ingestFn: IngestFn | null = null;
let respondFn: RespondFn | null = null;
let clearFn: ClearFn | null = null;

export function bindOfferBridge(handlers: {
  ingest: IngestFn;
  respond: RespondFn;
  clear: ClearFn;
}) {
  ingestFn = handlers.ingest;
  respondFn = handlers.respond;
  clearFn = handlers.clear;
  return () => {
    ingestFn = null;
    respondFn = null;
    clearFn = null;
  };
}

export function ingestIncomingOffer(raw: unknown) {
  ingestFn?.(raw);
}

export async function respondIncomingOffer(bookingId: string, accepted: boolean) {
  if (respondFn) {
    await respondFn(bookingId, accepted);
    return;
  }
  await respondToOffer(bookingId, accepted);
}

export function clearIncomingOffer(bookingId?: string) {
  clearFn?.(bookingId);
}

let resumeFn: (() => void) | null = null;

export function bindResumeOffers(fn: () => void) {
  resumeFn = fn;
  return () => {
    resumeFn = null;
  };
}

/** Call after login so the root offer listener attaches with a token. */
export function resumeOfferSession() {
  resumeFn?.();
}

export function offerFromPushData(data: Record<string, any> | undefined): Partial<Offer> | null {
  if (!data) return null;
  const bookingId = String(data.bookingId || '');
  if (!bookingId) return null;
  return data as Partial<Offer>;
}
