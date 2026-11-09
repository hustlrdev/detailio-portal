import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { getSession } from "@/lib/auth";
import { getChecklist } from "@/lib/checklist";
import { statusLabel, when, money } from "@/lib/format";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await getSession();
  if (!business) redirect("/setup");

  const nowIso = new Date().toISOString();
  const [pending, upcoming, next, sub, check] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "pending_approval"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "confirmed").gte("starts_at", nowIso),
    supabase.from("bookings").select("id,starts_at,total_pence,service:services(name),customer:profiles!customer_id(first_name,last_name)")
      .eq("business_id", business.id).eq("status", "confirmed").gte("starts_at", nowIso).order("starts_at").limit(5),
    supabase.from("subscriptions").select("plan_id").eq("business_id", business.id).maybeSingle(),
    getChecklist(supabase, business),
  ]);
  const live = business.status === "approved";
  const rows = (next.data ?? []) as any[];

  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">{business.name}</h1>
      <p className="page-sub">
        <span className={live ? "badge badge-ok" : business.status === "rejected" || business.status === "suspended" ? "badge badge-no" : "badge badge-wait"}>{statusLabel[business.status]}</span>{" "}
        · {(sub.data?.plan_id ?? "starter").replace(/^./, (c: string) => c.toUpperCase())} plan
      </p>
      <Flash saved={sp.saved} error={sp.error} />

      {!live && (
        <div className="flash flash-ok" style={{ background: "#faeeda", color: "#633806" }}>
          {business.status === "pending_verification"
            ? "Your business is being checked. You'll appear to customers once it's approved."
            : check.ready ? <>You're ready to submit. <Link href="/setup/review">Review and submit</Link>.</> : <>Finish setting up to go live. <Link href="/setup">Continue set-up</Link>.</>}
        </div>
      )}

      <div className="stats">
        <div className="stat"><span className="stat-n">{pending.count ?? 0}</span><span className="stat-l">Requests waiting</span></div>
        <div className="stat"><span className="stat-n">{upcoming.count ?? 0}</span><span className="stat-l">Upcoming bookings</span></div>
        <div className="stat"><span className="stat-n">{business.rating_count ? Number(business.rating_avg).toFixed(1) : "–"}</span><span className="stat-l">Average rating ({business.rating_count} reviews)</span></div>
      </div>

      {(pending.count ?? 0) > 0 && <p><Link className="btn btn-gold" href="/bookings?tab=pending">Respond to {pending.count} request{pending.count === 1 ? "" : "s"}</Link></p>}

      <h2 className="sec-title" style={{ marginTop: 32 }}>Next appointments</h2>
      <ul className="list">
        {rows.length === 0 && <li className="empty">No upcoming appointments yet.</li>}
        {rows.map((b) => (
          <li key={b.id}>
            <div className="list-main"><strong>{when(b.starts_at)}</strong>
              <div className="list-meta">{b.service?.name} · {b.customer?.first_name ?? "Customer"} {b.customer?.last_name ?? ""}</div></div>
            <span>{money(b.total_pence)}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
