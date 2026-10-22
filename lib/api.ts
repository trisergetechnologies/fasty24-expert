import Constants from 'expo-constants';
import { router } from 'expo-router';
import { getToken, clearAll } from './storage';
import { disconnectSocket } from './socket';

const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://api.fasty24.com/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpertGender = 'male' | 'female' | 'other' | 'prefer_not_to_say' | '';

export interface Expert {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gender?: ExpertGender;
  bio?: string;
  photoUrl?: string;
  rating: number | null;
  ratingCount?: number;
  completedJobs?: number;
  isOnline: boolean;
  status?: string;
  activeBooking?: string | null;
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected';
  kycNote?: string;
  kycSubmittedAt?: string | null;
  /** null = legacy (no deposit gate). pending = must pay after KYC. */
  joiningFeeStatus?: 'pending' | 'paid' | 'waived' | null;
  joiningFeeAmount?: number;
  joiningFeePaidAt?: string | null;
  trainingStatus: 'pending' | 'not_started' | 'in_progress' | 'completed';
  skills: string[];
  enrolledCategories?: string[];
  excludedServiceIds?: string[];
  specialization?: string;
  documents?: {
    aadhaarNumber?: string;
    aadhaarFrontUrl?: string;
    aadhaarBackUrl?: string;
    panNumber?: string;
    panUrl?: string;
    selfieUrl?: string;
  };
  bank?: {
    accountNumber?: string;
    ifsc?: string;
    holderName?: string;
  };
  commissionRate: number;
}

export interface OnboardingPayload {
  name?: string;
  email?: string;
  gender?: ExpertGender;
  specialization: string;
  skills?: string[];
  enrolledCategories?: string[];
  excludedServiceIds?: string[];
  documents: {
    aadhaarNumber: string;
    aadhaarFrontUrl: string;
    aadhaarBackUrl: string;
    panNumber: string;
    panUrl: string;
    selfieUrl: string;
  };
  bank: {
    accountNumber: string;
    ifsc: string;
    holderName: string;
  };
}

export interface DashboardData {
  todayJobs: number;
  todayEarnings: number;
  commissionRate: number;
  recentOrders: BookingSummary[];
}

export interface EarningsSummary {
  period: string;
  total: number;
  jobs: number;
  commissionRate: number;
  breakdown: { date: string; amount: number; jobs: number }[];
}

export interface WalletBankSummary {
  hasBank: boolean;
  accountLast4: string;
  ifsc: string;
  holderName: string;
}

export interface ExpertWallet {
  availableBalance: number;
  pendingWithdrawal: number;
  lifetimeCredited: number;
  lifetimeWithdrawn: number;
  bank: WalletBankSummary;
}

export type WalletTxType =
  | 'job_credit'
  | 'admin_credit'
  | 'withdrawal_hold'
  | 'withdrawal_paid'
  | 'withdrawal_reject_release';

export interface WalletTransaction {
  id: string;
  type: WalletTxType;
  amount: number;
  direction: 'credit' | 'debit';
  balanceAfter: number;
  note: string;
  bookingId?: string | null;
  withdrawalId?: string | null;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  bankSnapshot: {
    accountNumber: string;
    ifsc: string;
    holderName: string;
  };
  adminNote?: string;
  processedAt?: string | null;
  createdAt: string;
}

export interface BookingSummary {
  id: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  scheduledAt: string;
  status: BookingStatus;
  totalAmount: number;
  expertEarning: number;
  /** True when this is the expert's current focus job. */
  isActiveJob?: boolean;
  /** True when expert can switch focus to this job (assigned/travelling/arrived, not active). */
  canActivate?: boolean;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'travelling'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface BookingDetail extends BookingSummary {
  address: string;
  customerPhone: string;
  /** When true, Call starts a masked TeleCMI click-to-call (rings your phone first). */
  canCall?: boolean;
  /** Optional shared DID — dial-in fallback; primary UX is POST /bookings/:id/call */
  virtualNumber?: string | null;
  sessionOtp?: { startCode: string; endCode: string };
  addOns: { serviceId: string; name: string; amount: number }[];
  paymentMethod: string;
  /** True when the customer chose cash on delivery and cash is still due. */
  collectCash?: boolean;
  notes?: string;
  /** Raw backend lifecycle timestamps (assigned/arrived/started/completed/cancelled). */
  timeline?: Record<string, string | null | undefined>;
  arrivedAt?: string | null;
  /** Raw backend status string before mapping to the app's BookingStatus enum. */
  backendStatus?: string;
  location?: { address?: string; lat?: number; lng?: number } | null;
  distanceKm?: number | null;
  quotedEtaMin?: number | null;
  arrivalSelfie?: { url: string; capturedAt?: string | null } | null;
  bookingType?: 'instant' | 'scheduled';
  scheduledFor?: string | null;
  scheduledSlot?: {
    slotId?: string;
    date?: string;
    window?: string;
    label?: string;
    windowStart?: string;
    windowEnd?: string;
  } | null;
  /** Backend-tracked job clock, set once the expert starts the job. */
  jobTimer?: {
    durationMin?: number | null;
    startedAt?: string | null;
    endsAt?: string | null;
    overtimeMin?: number | null;
  } | null;
  categorySlugs?: string[];
  serviceSlug?: string;
  rateCard?: RateCard;
}

export interface RateCardItem {
  name: string;
  price: number;
  notes: string;
}

export interface RateCardBrand {
  name: string;
  items: RateCardItem[];
}

export interface RateCard {
  title: string;
  brands: RateCardBrand[];
}

export function rateCardBrands(rateCard?: RateCard | null): RateCardBrand[] {
  return (rateCard?.brands || []).filter((b) => (b.items?.length ?? 0) > 0);
}

export interface AvailableAddon {
  id: string;
  slug: string;
  name: string;
  price: number;
  durationMin: number;
}

export interface Part {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: string;
  description: string;
  imageUrl: string;
  categories: string[];
  kind: 'part' | 'kit' | 'consumable' | 'labour';
  unit: string;
  price: number;
}

export interface EstimateLine {
  id: string;
  partId: string | null;
  isCustom: boolean;
  name: string;
  sku: string;
  unit: string;
  kind: 'part' | 'labour';
  imageUrl: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  proofImages: { url: string; uploadedAt: string }[];
  installedAt: string | null;
}

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface Estimate {
  id: string;
  estimateNo: string;
  bookingId: string | null;
  status: EstimateStatus;
  diagnosisNotes: string;
  diagnosisImages: string[];
  lines: EstimateLine[];
  pricing: {
    subtotal: number;
    taxPercent: number;
    tax: number;
    discount: number;
    total: number;
    currency: string;
  };
  sentAt: string | null;
  respondedAt: string | null;
  rejectReason: string;
  expiresAt: string | null;
  payment: {
    status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
    method: 'razorpay' | 'cash' | null;
    paidAt: string | null;
    cashCollectedAt: string | null;
    shortUrl: string | null;
  };
  settled: boolean;
  proofComplete: boolean;
  expertEarning: number;
}

/** A line as assembled in the builder, before the server prices it. */
export interface EstimateLineInput {
  partId?: string | null;
  name?: string;
  sku?: string;
  brand?: string;
  unit?: string;
  kind?: 'part' | 'labour';
  imageUrl?: string;
  qty: number;
  unitPrice?: number;
  source?: 'catalog' | 'rate_card' | 'custom';
}

export interface Offer {
  bookingId: string;
  serviceName: string;
  customerDistance: number;
  eta: number;
  totalAmount: number;
  expertEarning: number;
  address: string;
  offerExpiresInSec: number;
  scheduledAt?: string;
  bookingType?: 'instant' | 'scheduled';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

// Centralised session-expiry handling: an authenticated request returning 401
// means the stored token is stale, so sign the expert out, drop realtime, and
// send them to the login screen. Guarded so simultaneous 401s don't loop.
let unauthorizedHandled = false;
async function handleUnauthorized() {
  if (unauthorizedHandled) return;
  unauthorizedHandled = true;
  try {
    disconnectSocket();
  } catch {}
  try {
    await clearAll();
  } catch {}
  try {
    router.replace('/login');
  } catch {}
  setTimeout(() => {
    unauthorizedHandled = false;
  }, 1500);
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  let sentToken = false;
  if (authenticated) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      sentToken = true;
    }
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    if (res.status === 401 && sentToken) {
      void handleUnauthorized();
    }
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.message ?? body.error ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function requestOtp(phone: string) {
  return request<{ message: string }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, role: 'expert' }),
  }, false);
}

export function verifyOtp(phone: string, code: string) {
  return request<{
    token: string;
    expert?: Expert;
    principal?: Expert;
    isNewUser?: boolean;
    needsOnboarding?: boolean;
  }>(
    '/auth/verify-otp',
    {
      method: 'POST',
      body: JSON.stringify({ phone, code, role: 'expert' }),
    },
    false,
  );
}

/** Saves this device's Expo push token so the backend can send job-offer alerts. */
export function savePushToken(pushToken: string) {
  return request<{ ok: boolean }>('/me/push-token', {
    method: 'POST',
    body: JSON.stringify({ pushToken }),
  });
}

// ─── Expert profile ───────────────────────────────────────────────────────────

export function getMe() {
  return request<Expert>('/expert/me');
}

export function updateMe(
  data: Partial<
    Pick<
      Expert,
      'name' | 'email' | 'gender' | 'bio' | 'photoUrl' | 'skills' | 'enrolledCategories' | 'excludedServiceIds'
    >
  >,
) {
  return request<Expert>('/expert/me', { method: 'PATCH', body: JSON.stringify(data) });
}

export function submitOnboarding(payload: OnboardingPayload) {
  return request<Expert>('/expert/kyc', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadImage(uri: string): Promise<{ url: string; publicId?: string }> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', {
    uri,
    name: `photo-${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as any);

  const res = await fetch(`${BASE}/expert/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.message ?? body.error ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export function submitTraining(status: 'in_progress' | 'completed') {
  return request<{ trainingStatus: string }>('/expert/training', {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export function goOnline(lat: number, lng: number) {
  return request<{ isOnline: boolean }>('/expert/online', {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
}

export function goOffline() {
  return request<{ isOnline: boolean }>('/expert/offline', { method: 'POST' });
}

// ─── Dashboard & earnings ─────────────────────────────────────────────────────

export function getDashboard() {
  return request<DashboardData>('/expert/dashboard');
}

export function getEarnings(period: 'today' | 'week') {
  return request<EarningsSummary>(`/expert/earnings?period=${period}`);
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export function getWallet() {
  return request<ExpertWallet>('/expert/wallet');
}

export function getWalletTransactions(limit = 40) {
  return request<{ transactions: WalletTransaction[] }>(
    `/expert/wallet/transactions?limit=${limit}`,
  );
}

export function requestWithdrawal(amount: number) {
  return request<{ withdrawal: WithdrawalRequest; wallet: ExpertWallet }>(
    '/expert/wallet/withdraw',
    { method: 'POST', body: JSON.stringify({ amount }) },
  );
}

// ─── Offer ────────────────────────────────────────────────────────────────────

export async function getPendingOffers() {
  const raw = await request<Offer | Offer[] | null>('/expert/pending-offer');
  if (!raw) return [] as Offer[];
  return Array.isArray(raw) ? raw : [raw];
}

/** @deprecated Use getPendingOffers — the API returns a list. */
export async function getPendingOffer() {
  const list = await getPendingOffers();
  return list[0] ?? null;
}

export async function respondToOffer(bookingId: string, accepted: boolean) {
  const result = await request<{ ok?: boolean; status?: string; goOnJob?: boolean }>('/expert/offer/respond', {
    method: 'POST',
    body: JSON.stringify({ bookingId, accepted }),
  });
  if (accepted && result?.ok === false) {
    throw new ApiError(409, 'This job is no longer available.');
  }
  return result;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export function listBookings(scope: 'today' | 'history') {
  return request<BookingSummary[]>(`/bookings?scope=${scope}`);
}

export function getBooking(id: string) {
  return request<BookingDetail>(`/bookings/${id}`);
}

/** Starts a masked TeleCMI call (rings your phone first, then the customer). */
export function requestBookingCall(id: string) {
  return request<{ ok: boolean; callSid?: string; status?: string; message?: string }>(
    `/bookings/${id}/call`,
    { method: 'POST' },
  );
}

/** Switch focus to this job when the expert has multiple assigned bookings. */
export function activateJob(id: string) {
  return request<BookingDetail>(`/bookings/${id}/activate`, { method: 'POST' });
}

export function markEnRoute(id: string) {
  return request<BookingDetail>(`/bookings/${id}/en-route`, { method: 'POST' });
}

export function markArrived(id: string, selfieUrl: string) {
  return request<BookingDetail>(`/bookings/${id}/arrived`, {
    method: 'POST',
    body: JSON.stringify({ selfieUrl }),
  });
}

export function startJob(id: string, otp: string) {
  return request<BookingDetail>(`/bookings/${id}/start`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export function completeJob(id: string, otp: string) {
  return request<BookingDetail>(`/bookings/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export function suggestAddon(id: string, serviceId: string, message?: string) {
  return request<{ status: string }>(`/bookings/${id}/addon/suggest`, {
    method: 'POST',
    body: JSON.stringify({ serviceId, message }),
  });
}

export function listAvailableAddons(id: string) {
  return request<AvailableAddon[]>(`/bookings/${id}/addons/available`);
}

// ─── Parts catalog ────────────────────────────────────────────────────────────

export function listParts(params: { category?: string; serviceId?: string; q?: string; kind?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.serviceId) qs.set('serviceId', params.serviceId);
  if (params.q) qs.set('q', params.q);
  if (params.kind) qs.set('kind', params.kind);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<Part[]>(`/parts${suffix}`);
}

// ─── Estimates ────────────────────────────────────────────────────────────────

export function listBookingEstimates(bookingId: string) {
  return request<Estimate[]>(`/bookings/${bookingId}/estimates`);
}

export function getEstimate(id: string) {
  return request<Estimate>(`/estimates/${id}`);
}

export function createEstimate(
  bookingId: string,
  payload: { lines: EstimateLineInput[]; diagnosisNotes?: string; diagnosisImages?: string[] },
) {
  return request<Estimate>(`/bookings/${bookingId}/estimates`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEstimate(
  id: string,
  payload: { lines?: EstimateLineInput[]; diagnosisNotes?: string; diagnosisImages?: string[] },
) {
  return request<Estimate>(`/estimates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function sendEstimate(id: string) {
  return request<Estimate>(`/estimates/${id}/send`, { method: 'POST' });
}

export function cancelEstimate(id: string) {
  return request<Estimate>(`/estimates/${id}/cancel`, { method: 'POST' });
}

export function addLineProof(estimateId: string, lineId: string, url: string) {
  return request<Estimate>(`/estimates/${estimateId}/lines/${lineId}/proof`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

// ─── Estimate settlement ──────────────────────────────────────────────────────

export interface PaymentLinkResponse {
  shortUrl: string;
  linkId: string;
  qrDataUrl: string | null;
  amount: number;
  status: string;
}

export function createEstimatePaymentLink(estimateId: string) {
  return request<PaymentLinkResponse>(`/estimates/${estimateId}/payment/link`, { method: 'POST' });
}

export function markEstimateCash(estimateId: string) {
  return request<Estimate>(`/estimates/${estimateId}/payment/cash`, { method: 'POST' });
}

export function markBookingCash(bookingId: string) {
  return request<BookingDetail>(`/bookings/${bookingId}/payment/cash`, { method: 'POST' });
}

export function getEstimatePaymentStatus(estimateId: string) {
  return request<{
    status: string;
    method: string | null;
    paidAt: string | null;
    settled: boolean;
    amount: number;
  }>(`/estimates/${estimateId}/payment/status`);
}

// ─── App version / force update ───────────────────────────────────────────────

export interface AppVersionConfig {
  app: 'expert' | 'customer';
  minVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  androidPackage: string;
  storeUrl: string;
  forceUpdate: boolean;
  title: string;
  message: string;
}

export function getAppConfig(app: 'expert' | 'customer' = 'expert') {
  return request<AppVersionConfig>(`/app-config?app=${app}`, {}, false);
}

export interface CatalogService {
  id: string;
  slug: string;
  name: string;
  skillTag: string;
  serviceKind?: string;
  categories?: string[];
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  imageUrl?: string;
  joiningFee?: number;
  providesMaterials?: boolean;
  providedMaterialsNote?: string;
  services: CatalogService[];
}

export function getCatalog() {
  return request<CatalogCategory[]>('/categories', {}, false);
}

export interface JoiningFeeLine {
  slug: string;
  name: string;
  joiningFee: number;
  providesMaterials: boolean;
  providedMaterialsNote: string;
}

export interface JoiningFeeQuote {
  status: 'pending' | 'paid' | 'waived' | null;
  amount: number;
  totalAmount: number;
  currency: string;
  cleared: boolean;
  paidAt?: string | null;
  lines: JoiningFeeLine[];
  materials: JoiningFeeLine[];
  expert?: Expert;
}

export interface JoiningFeeOrder {
  keyId: string;
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  waived?: boolean;
  lines?: JoiningFeeLine[];
  materials?: JoiningFeeLine[];
  expert?: Expert;
}

export function getJoiningFee() {
  return request<JoiningFeeQuote>('/expert/joining-fee');
}

export function createJoiningFeeOrder() {
  return request<JoiningFeeOrder>('/expert/joining-fee/order', { method: 'POST' });
}

export function verifyJoiningFeeOrder(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return request<{
    cleared: boolean;
    status: JoiningFeeQuote['status'];
    amount?: number;
    paidAt?: string | null;
    expert?: Expert;
  }>('/expert/joining-fee/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getJoiningFeeStatus() {
  return request<{
    status: JoiningFeeQuote['status'];
    amount: number;
    cleared: boolean;
    paidAt?: string | null;
    expert?: Expert;
  }>('/expert/joining-fee/status');
}

/** True when KYC is done but category joining deposit is still unpaid. */
export function needsJoiningDeposit(expert: Pick<Expert, 'kycStatus' | 'joiningFeeStatus'> | null | undefined) {
  return expert?.kycStatus === 'verified' && expert?.joiningFeeStatus === 'pending';
}
