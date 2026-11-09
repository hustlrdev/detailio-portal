import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLogin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: admin } = await supabase.from("admins").select("role").eq("user_id", data.user.id).maybeSingle();
    redirect(admin ? "/admin" : "/dashboard");
  }
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Image src="/logo-lockup.png" alt="DETAILIO" width={240} height={48} className="logo-big" priority />
        <p className="auth-sub">Restricted area. DETAILIO team only.</p>
        <AdminLoginForm />
      </div>
    </div>
  );
}