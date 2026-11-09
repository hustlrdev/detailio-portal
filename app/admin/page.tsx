import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { statusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function Admin() {
  const { supabase, isAdmin } = await requireAdmin();
  const { data } = await supabase.from("businesses").select("id,name,status,service_mode,created_at").order("created_at", { ascending: false }).limit(100);
  const all = data ?? [];
  const pending = all.filter((b) => b.status === "pending_verification");
  const rest = all.filter((b) => b.status !== "pending_verification");
  const row = (b: (typeof all)[number]) => (
    <li key={b.id}>
      <div className="list-main"><Link href={`/admin/${b.id}`}><strong>{b.name}</strong></Link>
        <div className="list-meta">{b.service_mode} · applied {new Date(b.created_at).toLocaleDateString("en-GB")}</div></div>
      <span className={b.status === "approved" ? "badge badge-ok" : b.status === "pending_verification" ? "badge badge-wait" : "badge badge-idle"}>{statusLabel[b.status]}</span>
    </li>
  );
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Applications</h1>
      <p className="page-sub">Review documents, then approve or reject each business.</p>
      <h2 className="sec-title">Waiting for review ({pending.length})</h2>
      <ul className="list">{pending.length === 0 && <li className="empty">Nothing waiting.</li>}{pending.map(row)}</ul>
      <h2 className="sec-title">All other businesses</h2>
      <ul className="list">{rest.length === 0 && <li className="empty">No other businesses yet.</li>}{rest.map(row)}</ul>
    </Shell>
  );
}
