import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const user = data.user;

  const [{ data: admin }, { data: memberships }] = await Promise.all([
    supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("business_members").select("role, businesses(*)").eq("user_id", user.id).eq("active", true).limit(1),
  ]);
  const business: any = (memberships as any)?.[0]?.businesses ?? null;
  const memberRole: string | null = (memberships as any)?.[0]?.role ?? null;
  return { supabase, user, isAdmin: Boolean(admin), business, memberRole };
}

export async function requireBusiness() {
  const s = await getSession();
  if (!s.business) redirect("/setup");
  return { ...s, business: s.business as any };
}

export async function requireAdmin() {
  const s = await getSession();
  if (!s.isAdmin) redirect("/dashboard");
  return s;
}
