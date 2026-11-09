"use server";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { syncBooking } from "@/lib/payments/sync";

/** Runs the Stripe step that is now due. Returns a warning message if it failed (the daily sweep retries). */
async function settle(id: string): Promise<string | null> {
  try {
    await syncBooking(id);
    return null;
  } catch (e) {
    console.error("[bookings] payment step failed", id, e);
    return "The booking was updated, but the payment step hit a problem. It will be retried automatically.";
  }
}

export async function respond(fd: FormData) {
  const { supabase } = await requireBusiness();
  const id = String(fd.get("id"));
  const accept = String(fd.get("accept")) === "true";
  const { error } = await supabase.rpc("respond_to_booking", { p_booking_id: id, p_accept: accept });
  if (error) {
    const msg = error.message.includes("request_expired") ? "That request has expired." : "We couldn't update that booking.";
    redirect(`/bookings?tab=pending&error=${encodeURIComponent(msg)}`);
  }
  // Accept = take the money from the card. Decline = release the card hold.
  const warning = await settle(id);
  if (warning) redirect(`/bookings?tab=pending&error=${encodeURIComponent(warning)}`);
  redirect(`/bookings?tab=pending&saved=1`);
}

export async function complete(fd: FormData) {
  const { supabase } = await requireBusiness();
  const id = String(fd.get("id"));
  const { error } = await supabase.rpc("complete_booking", { p_booking_id: id });
  if (error) {
    const msg = error.message.includes("too_early") ? "You can mark a job complete once it has started." : "We couldn't mark that booking complete.";
    redirect(`/bookings?tab=complete&error=${encodeURIComponent(msg)}`);
  }
  // Completing releases the detailer's payout.
  const warning = await settle(id);
  if (warning) redirect(`/bookings?tab=complete&error=${encodeURIComponent(warning)}`);
  redirect(`/bookings?tab=complete&saved=1`);
}
