import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";
import { applyAccount, applyAuthorised, applyCanceled, applyCaptured, applyFailed, applyRefundEvent, syncBooking } from "@/lib/payments/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe tells us here what happened to every payment. This is the source of truth for payment status. */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const raw = await req.text(); // the raw text is needed to check the signature
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
  if (!signature || secrets.length === 0) return new Response("webhook not configured", { status: 400 });

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try { event = stripe().webhooks.constructEvent(raw, signature, secret); break; } catch { /* try the next secret */ }
  }
  if (!event) return new Response("bad signature", { status: 400 });

  const db = admin();
  const { error: insertError } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (insertError) {
    const { data: seen } = await db.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle();
    if (seen?.processed_at) return Response.json({ received: true, duplicate: true });
    // seen before but never finished: run it again
  }

  try {
    await handle(event);
    await db.from("stripe_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event.id);
    return Response.json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook]", event.type, message);
    await db.from("stripe_events").update({ error: message.slice(0, 500) }).eq("id", event.id);
    return new Response("handler error", { status: 500 }); // Stripe will retry
  }
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
      return applyAuthorised((event.data.object as Stripe.PaymentIntent).id);
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await applyCaptured(pi.id);
      if (pi.metadata?.booking_id) await syncBooking(pi.metadata.booking_id); // pays out / refunds if now due
      return;
    }
    case "payment_intent.payment_failed":
      return applyFailed(event.data.object as Stripe.PaymentIntent);
    case "payment_intent.canceled":
      return applyCanceled(event.data.object as Stripe.PaymentIntent);
    case "charge.refunded":
    case "charge.refund.updated": {
      const obj = event.data.object as Stripe.Charge | Stripe.Refund;
      const pi = (obj as { payment_intent?: string | { id: string } | null }).payment_intent;
      const id = typeof pi === "string" ? pi : pi?.id;
      if (id) await applyRefundEvent(id);
      return;
    }
    case "account.updated":
      return applyAccount(event.data.object as Stripe.Account);
    default:
      return; // other events are recorded in stripe_events and ignored
  }
}
