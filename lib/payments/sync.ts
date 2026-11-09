/* eslint-disable @typescript-eslint/no-explicit-any */
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";

/**
 * The money brain of DETAILIO. Every function here is safe to run more than once:
 * Stripe webhooks, the portal buttons, the phone app and the scheduled sweep can all call it
 * and the result is always the same (no double charges, double refunds or double payouts).
 *
 * How money flows (Stripe "separate charges and transfers"):
 *   1. The customer pays DETAILIO's own Stripe balance (instant booking = charged now,
 *      approval booking = card authorised only, captured when the detailer accepts).
 *   2. The database says what the commission is; it is copied onto the booking when it is made.
 *   3. After the job is completed, DETAILIO transfers  total - commission - card fee - refunds
 *      to the detailer's connected Stripe account.
 *   Every movement is written to the append-only ledger so the numbers can always be checked.
 */

const DEAD = ["declined", "expired", "cancelled_by_customer", "cancelled_by_business", "payment_failed"];
const log = (...a: unknown[]) => console.log("[payments]", ...a);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const stripeCode = (e: unknown) => (e as any)?.code as string | undefined;
const today = () => new Date().toISOString().slice(0, 10);

type LedgerRow = { business_id: string; booking_id: string; kind: string; amount_pence: number; ref: string; note?: string; payout_id?: string };

async function writeLedger(rows: LedgerRow[]) {
  const clean = rows.filter((r) => r.amount_pence !== 0);
  if (!clean.length) return;
  const { error } = await admin().from("ledger_entries").upsert(clean, { onConflict: "ref", ignoreDuplicates: true });
  if (error) throw new Error(`ledger write failed: ${error.message}`);
}

async function getBooking(id: string): Promise<any | null> {
  const { data } = await admin().from("bookings").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}
async function getPayment(bookingId: string): Promise<any | null> {
  const { data } = await admin().from("payments").select("*").eq("booking_id", bookingId).maybeSingle();
  return data ?? null;
}

/* ------------------------------------------------------------------ payment intent events */

/** Card authorised (approval bookings, manual capture): move the booking into "pending approval". */
export async function applyAuthorised(piId: string) {
  const db = admin();
  const pi = await stripe().paymentIntents.retrieve(piId);
  if (pi.status !== "requires_capture") return;
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return log("intent without booking id", pi.id);
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;

  await db.from("payments").update({ status: "requires_capture", authorised_at: new Date().toISOString(), stripe_charge_id: chargeId, last_error: null })
    .eq("booking_id", bookingId).in("status", ["requires_payment", "failed"]);

  const { error } = await db.rpc("confirm_booking_payment", { p_booking_id: bookingId });
  if (error) {
    const bk = await getBooking(bookingId);
    if (bk && DEAD.includes(bk.status)) {
      log("authorised too late, releasing the card hold", bookingId, error.message);
      const pay = await getPayment(bookingId);
      if (pay) await cancelIntent(pay);
    } else {
      log("confirm_booking_payment said:", error.message); // already moved on: fine
    }
  }
}

/** Money taken (instant bookings, or an approval booking after capture). */
export async function applyCaptured(piId: string) {
  const db = admin();
  const pi = await stripe().paymentIntents.retrieve(piId, { expand: ["latest_charge.balance_transaction"] });
  if (pi.status !== "succeeded") return;
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return log("intent without booking id", pi.id);

  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? (pi.latest_charge as Stripe.Charge) : null;
  const bt = charge && charge.balance_transaction && typeof charge.balance_transaction === "object" ? (charge.balance_transaction as Stripe.BalanceTransaction) : null;
  const fee = bt?.fee ?? 0;

  const bk = await getBooking(bookingId);
  const pay = await getPayment(bookingId);
  if (!bk || !pay) return log("captured payment has no booking or payment row", pi.id);

  const patch: Record<string, unknown> = { stripe_charge_id: charge?.id ?? pay.stripe_charge_id, processing_fee_pence: fee || pay.processing_fee_pence, captured_at: pay.captured_at ?? new Date().toISOString(), last_error: null };
  if (["requires_payment", "requires_capture", "failed"].includes(pay.status)) patch.status = "succeeded";
  await db.from("payments").update(patch).eq("id", pay.id);

  await writeLedger([
    { business_id: bk.business_id, booking_id: bk.id, kind: "gross", amount_pence: pi.amount_received || pi.amount, ref: `gross:${bk.id}`, note: "Customer payment" },
    { business_id: bk.business_id, booking_id: bk.id, kind: "commission", amount_pence: -(bk.commission_pence ?? 0), ref: `commission:${bk.id}`, note: "DETAILIO commission" },
    { business_id: bk.business_id, booking_id: bk.id, kind: "processing_fee", amount_pence: -fee, ref: `fee:${bk.id}`, note: "Card processing fee" },
  ]);

  if (bk.status === "held") {
    const { error } = await db.rpc("confirm_booking_payment", { p_booking_id: bk.id });
    if (error) {
      const now = await getBooking(bk.id);
      if (now && DEAD.includes(now.status)) {
        log("paid after the hold ended, refunding in full", bk.id, error.message);
        await refundForBooking(now, await getPayment(bk.id), 100);
      } else {
        log("confirm_booking_payment said:", error.message);
      }
    }
  }
}

export async function applyFailed(pi: Stripe.PaymentIntent) {
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return;
  await admin().from("payments").update({ status: "failed", last_error: pi.last_payment_error?.message ?? "Payment failed" })
    .eq("booking_id", bookingId).in("status", ["requires_payment", "failed"]);
  // The booking stays "held": the customer can try another card until the 10-minute hold ends.
}

export async function applyCanceled(pi: Stripe.PaymentIntent) {
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return;
  await admin().from("payments").update({ status: "canceled" }).eq("booking_id", bookingId).in("status", ["requires_payment", "requires_capture", "failed"]);
}

/* ------------------------------------------------------------------ actions on Stripe */

async function cancelIntent(pay: any) {
  const db = admin();
  try {
    await stripe().paymentIntents.cancel(pay.stripe_payment_intent_id);
    await db.from("payments").update({ status: "canceled" }).eq("id", pay.id).in("status", ["requires_payment", "requires_capture", "failed"]);
  } catch (e) {
    if (stripeCode(e) === "payment_intent_unexpected_state") {
      const pi = await stripe().paymentIntents.retrieve(pay.stripe_payment_intent_id);
      if (pi.status === "succeeded") await applyCaptured(pi.id);
      else if (pi.status === "canceled") await applyCanceled(pi);
      return;
    }
    throw e;
  }
}

async function capturePayment(pay: any) {
  try {
    await stripe().paymentIntents.capture(pay.stripe_payment_intent_id);
  } catch (e) {
    if (stripeCode(e) !== "payment_intent_unexpected_state") throw e; // already captured is fine
  }
  await applyCaptured(pay.stripe_payment_intent_id);
}

/** Copies every Stripe refund for this payment into our tables and the ledger. */
async function reconcileRefunds(bk: any, pay: any) {
  const db = admin();
  const list = await stripe().refunds.list({ payment_intent: pay.stripe_payment_intent_id, limit: 100 });
  let total = 0;
  for (const r of list.data) {
    if (r.status === "failed" || r.status === "canceled") continue;
    total += r.amount;
    await db.from("refunds").upsert({ payment_id: pay.id, amount_pence: r.amount, reason: r.reason ?? null, stripe_refund_id: r.id }, { onConflict: "stripe_refund_id", ignoreDuplicates: true });
    const rebate = bk.total_pence > 0 ? Math.round(((bk.commission_pence ?? 0) * r.amount) / bk.total_pence) : 0;
    await writeLedger([
      { business_id: bk.business_id, booking_id: bk.id, kind: "refund", amount_pence: -r.amount, ref: `refund:${r.id}`, note: "Refund to customer" },
      { business_id: bk.business_id, booking_id: bk.id, kind: "adjustment", amount_pence: rebate, ref: `commreb:${r.id}`, note: "Commission returned on refund" },
    ]);
  }
  const full = bk.total_pence > 0 && total >= bk.total_pence;
  if (full && (pay.processing_fee_pence ?? 0) > 0) {
    // Business cancelled or the customer got everything back: the business does not pay the card fee.
    await writeLedger([{ business_id: bk.business_id, booking_id: bk.id, kind: "adjustment", amount_pence: pay.processing_fee_pence, ref: `feeabs:${bk.id}`, note: "Card fee absorbed by DETAILIO on a full refund" }]);
  }
  if (total > 0) {
    await db.from("payments").update({ refunded_pence: total, status: full ? "refunded" : "partially_refunded" }).eq("id", pay.id);
    if (full && ["cancelled_by_customer", "cancelled_by_business"].includes(bk.status)) {
      await db.from("bookings").update({ status: "refunded" }).eq("id", bk.id); // legal move; ignore if refused
    }
  }
  return { total, full };
}

/** Refund up to pct% of the booking total (minus anything already refunded). */
async function refundForBooking(bk: any, pay: any, pct: number) {
  if (!pay) return;
  const target = Math.round((bk.total_pence * pct) / 100);
  const already = pay.refunded_pence ?? 0;
  const amount = target - already;
  if (amount > 0) {
    await stripe().refunds.create(
      { payment_intent: pay.stripe_payment_intent_id, amount, reason: "requested_by_customer", metadata: { booking_id: bk.id } },
      { idempotencyKey: `refund:${bk.id}:${already}:${amount}` },
    );
  }
  await reconcileRefunds(bk, (await getPayment(bk.id)) ?? pay);
}

/** Called for refund events that started in the Stripe dashboard. */
export async function applyRefundEvent(piId: string) {
  const pi = await stripe().paymentIntents.retrieve(piId);
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return;
  await applyCaptured(piId);
  const bk = await getBooking(bookingId);
  const pay = await getPayment(bookingId);
  if (bk && pay) await reconcileRefunds(bk, pay);
}

/* ------------------------------------------------------------------ the reconciler */

/** Looks at a booking and its payment and does whatever Stripe step is now due. Safe to repeat. */
export async function syncBooking(bookingId: string) {
  const bk = await getBooking(bookingId);
  const pay = await getPayment(bookingId);
  if (!bk || !pay?.stripe_payment_intent_id) return { action: "nothing_to_do" };
  const dead = DEAD.includes(bk.status);
  let action = "nothing_to_do";

  if (pay.status === "requires_capture") {
    if (["confirmed", "completed"].includes(bk.status)) { await capturePayment(pay); action = "captured"; }
    else if (dead) { await cancelIntent(pay); action = "released_card_hold"; }
  } else if (pay.status === "requires_payment" || pay.status === "failed") {
    if (dead) { await cancelIntent(pay); action = "cancelled_unpaid_intent"; }
  } else if (pay.status === "succeeded" || pay.status === "partially_refunded") {
    if (dead) {
      const { data: pct } = await admin().rpc("booking_refund_pct", { p_booking_id: bk.id });
      await refundForBooking(bk, pay, typeof pct === "number" ? pct : 0);
      action = "refunded";
    }
  }

  const fresh = (await getBooking(bookingId)) ?? bk;
  const freshPay = (await getPayment(bookingId)) ?? pay;
  if (["succeeded", "partially_refunded", "refunded"].includes(freshPay.status)) {
    const p = await releasePayout(fresh.id);
    if (p.state !== "skipped") action += ` + payout ${p.state}`;
  }
  return { action };
}

/* ------------------------------------------------------------------ payouts to detailers */

function payoutEligible(bk: any): boolean {
  const now = Date.now();
  if (bk.status === "completed") return true;
  if (bk.status === "cancelled_by_customer") return new Date(bk.starts_at).getTime() < now; // late cancellation: keep once the slot has passed
  if (bk.status === "no_show") return new Date(bk.ends_at).getTime() + 48 * 3600e3 < now; // customer has 48h to contest
  return false;
}

/** Pays the detailer for one booking, once, when it is due and their Stripe account is ready. */
export async function releasePayout(bookingId: string): Promise<{ state: string; detail?: string }> {
  const db = admin();
  const bk = await getBooking(bookingId);
  const pay = await getPayment(bookingId);
  if (!bk || !pay || !["succeeded", "partially_refunded", "refunded"].includes(pay.status)) return { state: "skipped" };
  if (!payoutEligible(bk)) return { state: "skipped" };

  const { data: dispute } = await db.from("disputes").select("id").eq("booking_id", bk.id).neq("status", "resolved").limit(1);
  if (dispute && dispute.length) return { state: "held", detail: "open dispute" };

  const { data: existing } = await db.from("payouts").select("*").eq("booking_id", bk.id).maybeSingle();
  if (existing?.status === "paid") return { state: "paid" };

  const { data: lines } = await db.from("ledger_entries").select("kind,amount_pence").eq("booking_id", bk.id);
  const net = (lines ?? []).filter((l: any) => l.kind !== "payout").reduce((n: number, l: any) => n + l.amount_pence, 0);
  if (net <= 0) return { state: "skipped", detail: "nothing to pay out" };

  const { data: bp } = await db.from("business_private").select("stripe_account_id,payouts_enabled").eq("business_id", bk.business_id).maybeSingle();
  const ready = Boolean(bp?.stripe_account_id && bp?.payouts_enabled);

  if (existing) await db.from("payouts").update({ amount_pence: net, status: ready ? "scheduled" : "held" }).eq("id", existing.id);
  else await db.from("payouts").upsert({ booking_id: bk.id, business_id: bk.business_id, amount_pence: net, status: ready ? "scheduled" : "held", scheduled_for: today() }, { onConflict: "booking_id", ignoreDuplicates: true });
  const { data: payout } = await db.from("payouts").select("*").eq("booking_id", bk.id).single();

  if (!ready) return { state: "held", detail: "detailer has not finished Stripe set-up" };

  try {
    let chargeId: string | null = pay.stripe_charge_id;
    if (!chargeId) {
      const pi = await stripe().paymentIntents.retrieve(pay.stripe_payment_intent_id);
      chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;
    }
    const transfer = await stripe().transfers.create(
      {
        amount: net, currency: "gbp", destination: bp.stripe_account_id, transfer_group: bk.id,
        ...(chargeId ? { source_transaction: chargeId } : {}),
        description: `DETAILIO booking ${bk.id}`, metadata: { booking_id: bk.id, business_id: bk.business_id },
      },
      { idempotencyKey: `payout:${bk.id}:${net}` },
    );
    await db.from("payouts").update({ status: "paid", stripe_transfer_id: transfer.id, paid_at: new Date().toISOString(), last_error: null }).eq("id", payout.id);
    await writeLedger([{ business_id: bk.business_id, booking_id: bk.id, payout_id: payout.id, kind: "payout", amount_pence: -net, ref: `payout:${bk.id}`, note: "Paid to detailer" }]);
    return { state: "paid" };
  } catch (e) {
    await db.from("payouts").update({ status: "failed", last_error: errMsg(e) }).eq("id", payout.id);
    log("payout failed", bk.id, errMsg(e));
    return { state: "failed", detail: errMsg(e) };
  }
}

/* ------------------------------------------------------------------ detailer's Stripe account */

export async function applyAccount(account: Stripe.Account) {
  const db = admin();
  const { data } = await db.from("business_private").update({ charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled })
    .eq("stripe_account_id", account.id).select("business_id").maybeSingle();
  if (data?.business_id && account.payouts_enabled) {
    const { data: open } = await db.from("payouts").select("booking_id").eq("business_id", data.business_id).in("status", ["held", "failed", "scheduled"]);
    for (const p of open ?? []) await releasePayout(p.booking_id);
  }
}

export async function refreshAccount(businessId: string) {
  const { data: bp } = await admin().from("business_private").select("stripe_account_id").eq("business_id", businessId).maybeSingle();
  if (!bp?.stripe_account_id) return null;
  const account = await stripe().accounts.retrieve(bp.stripe_account_id);
  await applyAccount(account);
  return account;
}

/* ------------------------------------------------------------------ scheduled safety net */

/** Runs everything that might have been missed. Triggered daily by Vercel, or by the admin button. */
export async function sweep() {
  const db = admin();
  const out = { expiredBookings: 0, autoCompleted: 0, bookingsChecked: 0, payoutsTried: 0, errors: [] as string[] };

  const a = await db.rpc("expire_stale_bookings");
  if (a.error) out.errors.push(`expire_stale_bookings: ${a.error.message}`); else out.expiredBookings = a.data ?? 0;
  const b = await db.rpc("auto_complete_bookings");
  if (b.error) out.errors.push(`auto_complete_bookings: ${b.error.message}`); else out.autoCompleted = b.data ?? 0;

  const { data: pays } = await db.from("payments").select("booking_id,status,bookings(status)")
    .in("status", ["requires_payment", "failed", "requires_capture", "succeeded", "partially_refunded"])
    .order("created_at", { ascending: false }).limit(300);
  for (const p of pays ?? []) {
    const bs = p.bookings?.status as string | undefined;
    if (!bs || bs === "held" || bs === "pending_approval") continue;
    if (bs === "confirmed" && p.status !== "requires_capture") continue;
    try { await syncBooking(p.booking_id); out.bookingsChecked++; } catch (e) { out.errors.push(`${p.booking_id}: ${errMsg(e)}`); }
  }

  const { data: open } = await db.from("payouts").select("booking_id").in("status", ["held", "scheduled", "failed"]).not("booking_id", "is", null).limit(200);
  for (const p of open ?? []) {
    try { await releasePayout(p.booking_id); out.payoutsTried++; } catch (e) { out.errors.push(`payout ${p.booking_id}: ${errMsg(e)}`); }
  }
  return out;
}
