import Stripe from "stripe";

let client: Stripe | null = null;

/** The one Stripe connection used by the whole backend. */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(key);
  return client;
}

/** True while you are using test keys (they start with sk_test_). Sandbox tools only work in test mode. */
export const isTestMode = () => (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

/** Public address of this portal, used for Stripe return links. */
export const portalUrl = () => (process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://business.getdetailio.co.uk").replace(/\/$/, "");
