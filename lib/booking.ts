import type { BookingDetail, BookingStatus, BookingSummary, Offer } from './api';

const COMMISSION_RATE = 0.75;

type RawBooking = Record<string, any>;

function estimateExpertEarning(raw: RawBooking): number {
  if (typeof raw.expertEarning === 'number' && Number.isFinite(raw.expertEarning)) {
    return raw.expertEarning;
  }
  const subtotal = raw.pricing?.subtotal;
  if (typeof subtotal === 'number' && Number.isFinite(subtotal)) {
    return Math.round(subtotal * COMMISSION_RATE);
  }
  if (typeof raw.total === 'number' && Number.isFinite(raw.total)) {
    return Math.round(raw.total * COMMISSION_RATE);
  }
  if (typeof raw.totalAmount === 'number' && Number.isFinite(raw.totalAmount)) {
    return Math.round(raw.totalAmount * COMMISSION_RATE);
  }
  return 0;
}

function resolveTotalAmount(raw: RawBooking): number {
  if (typeof raw.totalAmount === 'number' && Number.isFinite(raw.totalAmount)) return raw.totalAmount;
  if (typeof raw.total === 'number' && Number.isFinite(raw.total)) return raw.total;
  if (typeof raw.pricing?.total === 'number' && Number.isFinite(raw.pricing.total)) return raw.pricing.total;
  return 0;
}

function resolveScheduledAt(raw: RawBooking): string {
  const value =
    raw.scheduledAt ||
    raw.scheduledFor ||
    raw.scheduledSlot?.windowStart ||
    raw.createdAt ||
    null;
  if (!value) return new Date().toISOString();
  return typeof value === 'string' ? value : new Date(value).toISOString();
}

function resolveServiceName(raw: RawBooking): string {
  if (raw.serviceName) return String(raw.serviceName);
  const items = Array.isArray(raw.items) ? raw.items : [];
  const names = items.map((it) => it?.name).filter(Boolean);
  return names.length ? names.join(', ') : 'Service';
}

/** Map backend lifecycle statuses to the expert app UI statuses. */
export function mapBookingStatus(raw: RawBooking): BookingStatus {
  const status = String(raw.status || 'pending');
  const arrivedAt = raw.timeline?.arrivedAt || raw.arrivedAt;
  const enRouteAt = raw.timeline?.enRouteAt;

  if (status === 'arrived') return 'arrived';
  if (status === 'travelling') return 'travelling';

  if (status === 'assigned') {
    if (arrivedAt) return 'arrived';
    if (enRouteAt) return 'travelling';
    return 'confirmed';
  }
  if (status === 'searching' || status === 'scheduled') return 'confirmed';
  if (status === 'created') return 'pending';
  if (
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'dispatched' ||
    status === 'travelling' ||
    status === 'arrived' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'cancelled'
  ) {
    return status as BookingStatus;
  }
  return 'pending';
}

export function normalizeBookingSummary(raw: RawBooking): BookingSummary {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const primary = items.find((it) => !it?.isAddOn) || items[0];
  return {
    id: String(raw.id || raw.bookingId || ''),
    serviceId: String(raw.serviceId || primary?.serviceId || primary?._id || ''),
    serviceName: resolveServiceName(raw),
    customerName: String(raw.customerName || raw.customer?.name || 'Customer'),
    scheduledAt: resolveScheduledAt(raw),
    status: mapBookingStatus(raw),
    totalAmount: resolveTotalAmount(raw),
    expertEarning: estimateExpertEarning(raw),
  };
}

export function normalizeBookingDetail(raw: RawBooking): BookingDetail {
  const summary = normalizeBookingSummary(raw);
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    ...summary,
    address: String(raw.address || raw.location?.address || raw.pickupLocation?.address || ''),
    customerPhone: String(raw.customerPhone || raw.customer?.phone || ''),
    sessionOtp: raw.sessionOtp,
    addOns: items
      .filter((it) => it?.isAddOn)
      .map((it) => ({
        serviceId: String(it.serviceId || it._id || ''),
        name: String(it.name || 'Add-on'),
        amount: Number(it.price) || 0,
      })),
    paymentMethod: String(raw.paymentMethod || raw.payment?.method || raw.payment?.status || 'Online'),
    notes: raw.notes ? String(raw.notes) : undefined,
    timeline: raw.timeline,
    arrivedAt: raw.timeline?.arrivedAt || raw.arrivedAt || null,
    backendStatus: String(raw.status || summary.status || ''),
    location: raw.location ?? undefined,
    distanceKm: typeof raw.distanceKm === 'number' ? raw.distanceKm : null,
    quotedEtaMin: typeof raw.quotedEtaMin === 'number' ? raw.quotedEtaMin : null,
    arrivalSelfie: raw.arrivalSelfie?.url
      ? { url: String(raw.arrivalSelfie.url), capturedAt: raw.arrivalSelfie.capturedAt ?? null }
      : null,
    jobTimer: raw.jobTimer
      ? {
          durationMin: typeof raw.jobTimer.durationMin === 'number' ? raw.jobTimer.durationMin : null,
          startedAt: raw.jobTimer.startedAt ?? null,
          endsAt: raw.jobTimer.endsAt ?? null,
          overtimeMin: typeof raw.jobTimer.overtimeMin === 'number' ? raw.jobTimer.overtimeMin : null,
        }
      : null,
  };
}

export function normalizeOffer(raw: RawBooking | null | undefined): Offer | null {
  if (!raw) return null;
  const summary = normalizeBookingSummary(raw);
  return {
    bookingId: summary.id,
    serviceName: summary.serviceName,
    customerDistance:
      typeof raw.customerDistance === 'number'
        ? raw.customerDistance
        : typeof raw.distanceKm === 'number'
          ? raw.distanceKm
          : 0,
    eta:
      typeof raw.eta === 'number'
        ? raw.eta
        : typeof raw.etaMin === 'number'
          ? Math.round(raw.etaMin)
          : 0,
    totalAmount: summary.totalAmount,
    expertEarning: summary.expertEarning,
    address: String(raw.address || raw.location?.address || raw.pickupLocation?.address || ''),
    offerExpiresInSec:
      typeof raw.offerExpiresInSec === 'number' && raw.offerExpiresInSec > 0
        ? raw.offerExpiresInSec
        : 60,
    scheduledAt: summary.scheduledAt,
  };
}

export function formatInr(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return value.toLocaleString('en-IN');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN');
}

export function mergeBookingDetail(
  prev: BookingDetail | null,
  patch: RawBooking | null | undefined,
): BookingDetail | null {
  if (!patch) return prev;
  if (!prev) return normalizeBookingDetail(patch);
  // `patch` carries the raw (pre-normalization) shape from the socket event; it takes
  // precedence for fields like pricing/customer/location that don't survive normalization
  // onto `prev`. Only `timeline` needs an explicit deep-merge since it accumulates over time.
  return normalizeBookingDetail({
    ...prev,
    ...patch,
    timeline: { ...(prev.timeline || {}), ...(patch.timeline || {}) },
    location: patch.location ?? prev.location,
  });
}
