/* eslint-disable @typescript-eslint/no-explicit-any */
import { stripe } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";
import { isUuid, json, userFromBearer } from "@/lib/payments/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The phone app calls this when the customer taps Pay.
 * Body: { bookingId }   Header: Authorization: Bearer <the customer's Supabase access token>
 * The amount is read from the database, never from the app, so it cannot be tampered with.
 */
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId;
  if (!isUuid(bookingId)) return json({ error: "bad_request" }, 400);

  const db = admin();
  const { data: bk } = await db.from("bookings")
    .select("id,customer_id,business_id,status,total_pence,hold_expires_at,currency").eq("id", bookingId).maybeSingle();
  if (!bk || bk.customer_id !== user.id) return json({ error: "booking_not_found" }, 404);
  if (bk.status !== "held") return json({ error: "booking_not_held" }, 409);
  if (!bk.hold_expires_at || new Date(bk.hold_expires_at).getTime() <= Date.now()) return json({ error: "hold_expired" }, 409);
  if (bk.total_pence < 30) return json({ error: "amount_too_small" }, 400); // Stripe's minimum is 30p

  const { data: biz } = await db.from("businesses").select("name,booking_mode,status").eq("id", bk.business_id).single();
  if (!biz) return json({ error: "booking_not_found" }, 404);
  // Approval bookings only authorise the card; the money is taken when the detailer accepts.
  const capture: "manual" | "automatic" = biz.booking_mode === "approval" ? "manual" : "automatic";

  try {
    const s = stripe();
    const { data: existing } = await db.from("payments").select("*").eq("booking_id", bk.id).maybeSingle();

    // Customer tapped Pay twice, or came back to the sheet: reuse the open payment.
    if (existing?.stripe_payment_intent_id) {
      const pi = await s.paymentIntents.retrieve(existing.stripe_payment_intent_id);
      const open = ["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status);
      if (open && pi.amount === bk.total_pence && pi.client_secret) {
        return json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, captureMethod: capture });
      }
      if (pi.status === "requires_capture" || pi.status === "succeeded" || pi.status === "processing") {
        return json({ error: "already_paid" }, 409);
      }
    }

    const pi = await s.paymentIntents.create(
      {
        amount: bk.total_pence,
        currency: "gbp",
        capture_method: capture,
        automatic_payment_methods: { enabled: true },
        transfer_group: bk.id,
        description: `DETAILIO booking ${bk.id} with ${biz.name}`,
        receipt_email: user.email,
        metadata: { booking_id: bk.id, business_id: bk.business_id, customer_id: user.id },
      },
      { idempotencyKey: `intent:${bk.id}:${existing?.stripe_payment_intent_id ?? "first"}` },
    );

    const { error } = await db.from("payments").upsert(
      { booking_id: bk.id, stripe_payment_intent_id: pi.id, amount_pence: bk.total_pence, status: "requires_payment", capture_method: capture, last_error: null },
      { onConflict: "booking_id" },
    );
    if (error) {
      await s.paymentIntents.cancel(pi.id).catch(() => {});
      console.error("[create-intent] could not save payment row", error.message);
      return json({ error: "server_error" }, 500);
    }
    return json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, captureMethod: capture });
  } catch (e) {
    console.error("[create-intent]", e instanceof Error ? e.message : e);
    return json({ error: "stripe_error" }, 502);
  }
}
