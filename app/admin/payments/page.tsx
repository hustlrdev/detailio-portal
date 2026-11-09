/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { money, when } from "@/lib/format";
import { admin } from "@/lib/supabase/admin";
import { isTestMode } from "@/lib/stripe";
import { forceBusinessCancel, forceComplete, resync, runSweep } from "./actions";

export const metadata: Metadata = { title: "Payment tools" };
export const dynamic = "force-dynamic";

export default async function PaymentTools({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const { isAdmin } = await requireAdmin();
  const test = isTestMode();
  const db = admin();

  const [payments, payouts, events] = await Promise.all([
    db.from("payments").select("id,booking_id,status,amount_pence,processing_fee_pence,refunded_pence,capture_method,stripe_payment_intent_id,last_error,created_at,bookings(status,commission_pence,commission_bps,starts_at,business:businesses(name))").order("created_at", { ascending: false }).limit(25),
    db.from("payouts").select("id,booking_id,amount_pence,status,last_error,paid_at,stripe_transfer_id,business:businesses(name)").order("created_at", { ascending: false }).limit(15),
    db.from("stripe_events").select("id,type,received_at,processed_at,error").order("received_at", { ascending: false }).limit(15),
  ]);

  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Payment tools</h1>
      <p className="page-sub">
        <span className={test ? "badge badge-wait" : "badge badge-no"}>{test ? "Stripe TEST mode" : "Stripe LIVE mode"}</span>{" "}
        Every payment, payout and Stripe message in one place.
      </p>
      {sp.msg && <p className="flash flash-ok" role="status">{sp.msg}</p>}
      {sp.error && <p className="flash flash-err" role="alert">{sp.error}</p>}

      <form action={runSweep}><button className="btn btn-gold btn-small" type="submit">Run payment maintenance now</button></form>
      <p className="list-meta" style={{ marginTop: 6 }}>Expires old holds, auto-completes finished jobs, releases card holds, issues refunds and sends any payouts that are due.</p>

      <h2 className="sec-title" style={{ marginTop: 28 }}>Latest payments</h2>
      <ul className="list">
        {(payments.data ?? []).length === 0 && <li className="empty">No payments yet.</li>}
        {((payments.data ?? []) as any[]).map((p) => (
          <li key={p.id}>
            <div className="list-main">
              <strong>{money(p.amount_pence)}</strong> · {p.bookings?.business?.name ?? "Business"} · {p.capture_method === "manual" ? "approval booking" : "instant booking"}
              <div className="list-meta">Payment: <strong>{p.status}</strong> · Booking: <strong>{p.bookings?.status}</strong> · Commission {money(p.bookings?.commission_pence ?? 0)} ({(p.bookings?.commission_bps ?? 0) / 100}%) · Card fee {money(p.processing_fee_pence)} · Refunded {money(p.refunded_pence)}</div>
              <div className="list-meta">Booking {p.booking_id.slice(0, 8)} · {p.bookings?.starts_at ? when(p.bookings.starts_at) : ""}{p.last_error ? ` · ${p.last_error}` : ""}</div>
              {test && p.stripe_payment_intent_id && <div className="list-meta"><a href={`https://dashboard.stripe.com/test/payments/${p.stripe_payment_intent_id}`} target="_blank" rel="noreferrer">Open in Stripe</a></div>}
            </div>
            <div className="actions">
              <form action={resync}><input type="hidden" name="booking_id" value={p.booking_id} /><button className="btn btn-outline btn-small" type="submit">Re-check</button></form>
              {test && p.bookings?.status === "confirmed" && (
                <form action={forceComplete}><input type="hidden" name="booking_id" value={p.booking_id} /><button className="btn btn-outline btn-small" type="submit">Test: mark complete</button></form>
              )}
              {test && ["confirmed", "pending_approval"].includes(p.bookings?.status) && (
                <form action={forceBusinessCancel}><input type="hidden" name="booking_id" value={p.booking_id} /><button className="btn btn-outline btn-small" type="submit">Test: detailer cancels</button></form>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="sec-title">Payouts to detailers</h2>
      <ul className="list">
        {(payouts.data ?? []).length === 0 && <li className="empty">No payouts yet.</li>}
        {((payouts.data ?? []) as any[]).map((p) => (
          <li key={p.id}>
            <div className="list-main"><strong>{money(p.amount_pence)}</strong> · {p.business?.name}
              <div className="list-meta">Booking {String(p.booking_id).slice(0, 8)}{p.stripe_transfer_id ? ` · ${p.stripe_transfer_id}` : ""}{p.last_error ? ` · ${p.last_error}` : ""}</div></div>
            <span className={p.status === "paid" ? "badge badge-ok" : p.status === "failed" ? "badge badge-no" : "badge badge-wait"}>{p.status}</span>
          </li>
        ))}
      </ul>

      <h2 className="sec-title">Stripe messages received</h2>
      <ul className="list">
        {(events.data ?? []).length === 0 && <li className="empty">Nothing received yet. If you have paid in the app and this is empty, the webhook is not connected.</li>}
        {((events.data ?? []) as any[]).map((e) => (
          <li key={e.id}>
            <div className="list-main"><strong>{e.type}</strong><div className="list-meta">{when(e.received_at)}{e.error ? ` · ERROR: ${e.error}` : ""}</div></div>
            <span className={e.error ? "badge badge-no" : e.processed_at ? "badge badge-ok" : "badge badge-wait"}>{e.error ? "Failed" : e.processed_at ? "Done" : "Working"}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
