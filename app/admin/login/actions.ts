"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminLoginState = { error?: string } | undefined;

export async function adminLogin(_prev: AdminLoginState, fd: FormData): Promise<AdminLoginState> {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const denied = { error: "Those details didn't work, or this account doesn't have admin access." };
  if (error || !data.user) return denied;

  const { data: admin } = await supabase.from("admins").select("role").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return denied;
  }
  redirect("/admin");
}