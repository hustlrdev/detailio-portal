"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { syncBooking, sweep } from "@/lib/payments/sync";
import { isTestMode } from "@/lib/stripe";

const done = (msg: string, kind: "msg" | "error" = "msg"): never => redirect(`/admin/payments?${kind}=${encodeURIComponent(msg)}`);
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Runs the same job Vercel runs every morning, right now. */
export async function runSweep() {
  await requireAdmin();
  try {
    const r = await sweep();
    done(`Maintenance done. Expired ${r.expiredBookings}, auto-completed ${r.autoCompleted}, checked ${r.bookingsChecked} bookings, tried ${r.payoutsTried} payouts.${r.errors.length ? ` Problems: ${r.errors.slice(0, 3).join(" | ")}` : ""}`, r.errors.length ? "error" : "msg");
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    done(`Maintenance failed: ${e instanceof Error ? e.message : e}`, "error");
  }
}

/** Re-checks one booking against Stripe and does whatever step is due. */
export async function resync(fd: FormData) {
  await requireAdmin();
  try {
    const r = await syncBooking(text(fd, "booking_id"));
    done(`Checked: ${r.action}`);
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    done(`Check failed: ${e instanceof Error ? e.message : e}`, "error");
  }
}

/** TEST MODE ONLY. Pretends the job has been done so you can test payouts without waiting for the appointment. */
export async function forceComplete(fd: FormData) {
  await requireAdmin();
  if (!isTestMode()) done("Sandbox tools only work with Stripe test keys.", "error");
  const id = text(fd, "booking_id");
  const { data, error } = await admin().from("bookings").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id).eq("status", "confirmed").select("id");
  if (error || !data?.length) done(`Could not complete: ${error?.message ?? "booking is not in the confirmed state"}`, "error");
  await resync(fd);
}

/** TEST MODE ONLY. Pretends the detailer cancelled, so you can test the full-refund path. */
export async function forceBusinessCancel(fd: FormData) {
  await requireAdmin();
  if (!isTestMode()) done("Sandbox tools only work with Stripe test keys.", "error");
  const id = text(fd, "booking_id");
  const { data, error } = await admin().from("bookings").update({ status: "cancelled_by_business", cancelled_at: new Date().toISOString(), cancel_reason: "Test: cancelled by detailer" })
    .eq("id", id).in("status", ["confirmed", "pending_approval"]).select("id");
  if (error || !data?.length) done(`Could not cancel: ${error?.message ?? "booking is not confirmed or pending"}`, "error");
  await resync(fd);
}
