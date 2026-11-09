import { admin } from "@/lib/supabase/admin";
import { isUuid, json, userFromBearer } from "@/lib/payments/auth";
import { syncBooking } from "@/lib/payments/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The phone app calls this after a customer cancels or releases a booking, so the card hold or
 * refund happens straight away instead of waiting for the daily sweep.
 * Body: { bookingId }   Header: Authorization: Bearer <access token>
 */
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return json({ error: "not_signed_in" }, 401);
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.bookingId)) return json({ error: "bad_request" }, 400);

  const { data: bk } = await admin().from("bookings").select("customer_id").eq("id", body.bookingId).maybeSingle();
  if (!bk || bk.customer_id !== user.id) return json({ error: "booking_not_found" }, 404);

  try {
    return json({ ok: true, ...(await syncBooking(body.bookingId)) });
  } catch (e) {
    console.error("[sync]", e instanceof Error ? e.message : e);
    return json({ error: "sync_failed" }, 500); // the daily sweep will retry
  }
}
