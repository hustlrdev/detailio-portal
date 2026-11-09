"use server";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { portalUrl, stripe } from "@/lib/stripe";

const back = (key: "error" | "saved", msg = "1"): never => redirect(`/payments?${key}=${encodeURIComponent(msg)}`);

/** Creates the detailer's Stripe account (first time) and sends them to Stripe's own onboarding pages. */
export async function startOnboarding() {
  const { business, user, memberRole } = await requireBusiness();
  if (memberRole !== "owner") back("error", "Only the business owner can set up payouts.");

  let url = "";
  try {
    const db = admin();
    const s = stripe();
    const { data: bp } = await db.from("business_private").select("stripe_account_id").eq("business_id", business.id).maybeSingle();
    let accountId: string | undefined = bp?.stripe_account_id ?? undefined;
    if (!accountId) {
      const account = await s.accounts.create({
        country: "GB",
        email: user.email ?? undefined,
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: business.name, product_description: "Car detailing services" },
        metadata: { business_id: business.id },
      });
      accountId = account.id;
      const { error } = await db.from("business_private").upsert({ business_id: business.id, stripe_account_id: accountId }, { onConflict: "business_id" });
      if (error) throw new Error(error.message);
    }
    const link = await s.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${portalUrl()}/payments?refresh=1`,
      return_url: `${portalUrl()}/payments?returned=1`,
    });
    url = link.url;
  } catch (e) {
   console.error("Stripe error:", e);
   back("error", "We couldn't complete that with Stripe just now. Please try again, and contact support if it keeps happening.");
  }
  redirect(url);
}

/** Opens the detailer's own Stripe Express dashboard (payouts, bank details). */
export async function openStripeDashboard() {
  const { business } = await requireBusiness();
  let url = "";
  try {
    const { data: bp } = await admin().from("business_private").select("stripe_account_id").eq("business_id", business.id).maybeSingle();
    if (!bp?.stripe_account_id) back("error", "Set up payouts first.");
    const link = await stripe().accounts.createLoginLink(bp.stripe_account_id);
    url = link.url;
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    console.error("[payments] dashboard link failed", e instanceof Error ? e.message : e);
    back("error", "Finish the Stripe set-up first, then the dashboard link will work.");
  }
  redirect(url);
}