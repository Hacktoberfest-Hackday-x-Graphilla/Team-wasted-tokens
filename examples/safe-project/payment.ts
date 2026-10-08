const stripeKey = process.env.STRIPE_SECRET_KEY;

export function createPayment() {
  return new Stripe(stripeKey);
}
