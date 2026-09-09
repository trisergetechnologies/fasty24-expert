/**
 * Native Razorpay Checkout (react-native-razorpay).
 *
 * Requires a development / production build with the native module linked.
 * Expo Go will throw `native_sdk_unavailable` — run:
 *   npx expo prebuild
 *   npx expo run:android   (or eas build --profile development)
 */

export interface RazorpayOrderPayload {
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
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export class PaymentCancelledError extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'PaymentCancelledError';
  }
}

export class NativeSdkUnavailableError extends Error {
  constructor() {
    super(
      'Razorpay native SDK is not in this build. Create a development build (expo run:android / EAS) — Expo Go will not work.',
    );
    this.name = 'NativeSdkUnavailableError';
  }
}

function loadCheckout(): { open: (opts: Record<string, unknown>) => Promise<RazorpaySuccess> } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-razorpay');
    return mod?.default ?? mod;
  } catch {
    throw new NativeSdkUnavailableError();
  }
}

/**
 * Opens the native Razorpay sheet for a server-created Order.
 * Resolves with the payment ids + signature that must be POSTed to /payment/verify.
 */
export async function payWithRazorpay(order: RazorpayOrderPayload): Promise<RazorpaySuccess> {
  const Checkout = loadCheckout();

  const options = {
    key: order.keyId,
    amount: String(order.amountPaise),
    currency: order.currency || 'INR',
    name: order.name || 'Fasty24',
    description: order.description || 'Fasty24 payment',
    order_id: order.orderId,
    prefill: {
      name: order.prefill?.name || '',
      contact: order.prefill?.contact || '',
      email: order.prefill?.email || '',
    },
    theme: { color: '#FFC400' },
  };

  try {
    const data = await Checkout.open(options);
    if (!data?.razorpay_payment_id || !data?.razorpay_order_id || !data?.razorpay_signature) {
      throw new Error('Incomplete payment response from Razorpay');
    }
    return data;
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err && 'code' in err
        ? String((err as { code?: string | number }).code)
        : '';
    const message = err instanceof Error ? err.message : String(err ?? '');
    if (
      code === '0' ||
      code === '2' ||
      /cancel/i.test(message) ||
      /back.?press/i.test(message)
    ) {
      throw new PaymentCancelledError();
    }
    throw err instanceof Error ? err : new Error(message || 'Payment failed');
  }
}
