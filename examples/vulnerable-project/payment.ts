const stripeKey = "sk_live_FAKE_DEMO_SECRET";

export function createPayment() {
  return new Stripe(stripeKey);
}
