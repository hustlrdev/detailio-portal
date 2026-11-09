/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireBusiness } from "@/lib/auth";
import { hoursLeft, money, when } from "@/lib/format";
import { complete, respond } from "./actions";

export const metadata: Metadata = { title: "Bookings" };
const TABS = [["pending", "Requests"], ["upcoming", "Upcoming"], ["complete", "To complete"], ["past", "Past"]] as const;
type Tab = (typeof TABS)[number][0];
const label: Record<string, string> = {
  confirmed: "Confirmed", completed: "Completed", no_show: "No-show", declined: "Declined", expired: "Expired",
  cancelled_by_customer: "Cancelled by customer", cancelled_by_business: "Cancelled by you", pending_approval: "Waiting for you",
  refunded: "Refunded", disputed: "In dispute",
};
const emptyText: Record<Tab, string> = {
  pending: "No requests waiting.", upcoming: "No upcoming bookings.", complete: "Nothing waiting to be marked complete.", past: "No past bookings yet.",
};

export default async function Bookings({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.some(([k]) => k === sp.tab) ? sp.tab : "pending") as Tab;
  const { supabase, isAdmin, business } = await requireBusiness();

  let q = supabase.from("bookings")
    .select("id,status,starts_at,ends_at,total_pence,approval_deadline,service_address,customer_notes,service:services(name),customer:profiles!customer_id(first_name,last_name)")
    .eq("business_id", business.id);
  const nowIso = new Date().toISOString();
  if (tab === "pending") q = q.eq("status", "pending_approval").order("starts_at");
  else if (tab === "upcoming") q = q.eq("status", "confirmed").gte("starts_at", nowIso).order("starts_at");
  // Confirmed jobs that have started: they need to be marked complete so the payout is released.
  else if (tab === "complete") q = q.eq("status", "confirmed").lt("starts_at", nowIso).order("starts_at");
  else q = q.in("status", ["completed", "no_show", "declined", "expired", "cancelled_by_customer", "cancelled_by_business", "refunded", "disputed"]).order("starts_at", { ascending: false }).limit(50);
  const { data } = await q;
  const rows = (data ?? []) as any[];

  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Bookings</h1>
      <nav className="tabs" aria-label="Booking filters">
        {TABS.map(([k, l]) => (<Link key={k} href={`/bookings?tab=${k}`} className={k === tab ? "tab tab-on" : "tab"}>{l}</Link>))}
      </nav>
      <Flash saved={sp.saved} error={sp.error} />
      <ul className="list">
        {rows.length === 0 && <li className="empty">{emptyText[tab]}</li>}
        {rows.map((b) => (
          <li key={b.id}>
            <div className="list-main">
              <strong>{b.service?.name}</strong> · {money(b.total_pence)}
              <div className="list-meta">{when(b.starts_at)} · {b.customer?.first_name ?? "Customer"} {b.customer?.last_name ?? ""}</div>
              {b.service_address && <div className="list-meta">At: {b.service_address}</div>}
              {b.customer_notes && <div className="list-meta">Note: {b.customer_notes}</div>}
              {b.status === "pending_approval" && b.approval_deadline && <div className="list-meta"><span className="badge badge-wait">Reply within {hoursLeft(b.approval_deadline)} hours</span></div>}
              {tab === "past" && <div className="list-meta">{label[b.status] ?? b.status}</div>}
            </div>
            {b.status === "pending_approval" && (
              <div className="actions">
                <form action={respond}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="accept" value="true" /><button className="btn btn-gold btn-small" type="submit">Accept</button></form>
                <form action={respond}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="accept" value="false" /><button className="btn btn-outline btn-small" type="submit">Decline</button></form>
              </div>
            )}
            {tab === "complete" && (
              <div className="actions">
                <form action={complete}><input type="hidden" name="id" value={b.id} /><button className="btn btn-gold btn-small" type="submit">Mark completed</button></form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
