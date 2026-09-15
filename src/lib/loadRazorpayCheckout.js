'use client';

// Razorpay's Checkout.js widget is a plain <script> tag the vendor expects
// you to load yourself — there is no npm package for the client-side
// widget (only the server-side `razorpay` SDK, already used by
// razorpayClient.js). Neither layout.js nor any other module loads it yet,
// so both billing (BillingCheckoutPage) and wallet recharge (WalletPage)
// share this one lazy loader instead of each hand-rolling a <script> tag.
// Mirrors flutter_app's recharge_sheet.dart / bill sheet, which get the
// widget for free via the razorpay_flutter package's native SDK.
let loadPromise = null;

export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout can only be opened in the browser'));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay checkout script loaded but window.Razorpay is missing'));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load the Razorpay checkout script — check your connection'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

/**
 * Opens the Razorpay Checkout widget and resolves/rejects based on its
 * callbacks — wraps the vendor's callback-style API in a Promise so callers
 * can `await` it like any other async action. `PAYMENT_CANCELLED` (the user
 * closing the widget) resolves with `{ cancelled: true }` rather than
 * rejecting, since that's a normal outcome, not an error — same distinction
 * recharge_sheet.dart's _onPaymentError draws.
 */
export async function openRazorpayCheckout({ keyId, amount, currency, orderId, name, description, prefill }) {
  const Razorpay = await loadRazorpayCheckout();

  return new Promise((resolve, reject) => {
    const instance = new Razorpay({
      key: keyId,
      amount,
      currency,
      order_id: orderId,
      name: name || 'Cremen Smart Spaces',
      description,
      prefill: prefill || {},
      modal: {
        ondismiss: () => resolve({ cancelled: true })
      },
      handler: (response) => resolve({ cancelled: false, response })
    });
    instance.on('payment.failed', (response) => reject(response?.error || new Error('Payment failed')));
    instance.open();
  });
}
