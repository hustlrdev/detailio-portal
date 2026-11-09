"use server";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";

export async function reply(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const id = String(fd.get("id"));
  const text = String(fd.get("reply") ?? "").trim();
  const tab = String(fd.get("tab")) === "all" ? "all" : "unreplied";

  if (text.length > 1000) {
    redirect(`/reviews?tab=${tab}&error=${encodeURIComponent("Replies can be up to 1000 characters.")}`);
  }

  // Only business_reply is sent. The database trigger sets replied_at and blocks any other change.
  const { data, error } = await supabase.from("reviews")
    .update({ business_reply: text || null })
    .eq("id", id).eq("business_id", business.id)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("[reviews] reply failed", { error, rows: data?.length, id, business: business.id });
    redirect(`/reviews?tab=${tab}&error=${encodeURIComponent("We couldn't save that reply.")}`);
  }
  redirect(`/reviews?tab=${tab}&saved=1`);
}