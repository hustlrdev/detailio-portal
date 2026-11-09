"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function review(status: "approved" | "rejected", fd: FormData) {
  const { supabase } = await requireAdmin();
  const business = text(fd, "business_id");
  const { error } = await supabase.rpc("admin_review_document", { p_document_id: text(fd, "id"), p_status: status, p_note: text(fd, "note") || null });
  redirect(error ? `/admin/${business}?error=${encodeURIComponent(error.message)}` : `/admin/${business}?saved=1`);
}

async function setStatus(status: "approved" | "rejected" | "suspended", fd: FormData) {
  const { supabase } = await requireAdmin();
  const business = text(fd, "business_id");
  const { error } = await supabase.rpc("admin_set_business_status", { p_business_id: business, p_status: status, p_note: text(fd, "note") || null });
  redirect(error ? `/admin/${business}?error=${encodeURIComponent(error.message)}` : `/admin/${business}?saved=1`);
}

export async function approveDocument(fd: FormData) { return review("approved", fd); }
export async function rejectDocument(fd: FormData) { return review("rejected", fd); }
export async function approveBusiness(fd: FormData) { return setStatus("approved", fd); }
export async function rejectBusiness(fd: FormData) { return setStatus("rejected", fd); }
export async function suspendBusiness(fd: FormData) { return setStatus("suspended", fd); }