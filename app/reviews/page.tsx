/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireBusiness } from "@/lib/auth";
import { when } from "@/lib/format";
import { reply } from "./actions";

export const metadata: Metadata = { title: "Reviews" };
const TABS = [["unreplied", "To reply"], ["all", "All reviews"]] as const;
type Tab = (typeof TABS)[number][0];
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function Reviews({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.some(([k]) => k === sp.tab) ? sp.tab : "unreplied") as Tab;
  const { supabase, isAdmin, business } = await requireBusiness();

  const { data: stats } = await supabase.from("businesses")
    .select("rating_avg,rating_count").eq("id", business.id).maybeSingle();

  let q = supabase.from("reviews")
    .select("id,rating,body,business_reply,replied_at,created_at,reviewer_name")
    .eq("business_id", business.id).neq("status", "hidden")
    .order("created_at", { ascending: false }).limit(50);
  if (tab === "unreplied") q = q.is("business_reply", null);
  const { data } = await q;
  const rows = (data ?? []) as any[];

  const count = stats?.rating_count ?? 0;

  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Reviews</h1>
      <p className="list-meta">
        {count === 0 ? "No reviews yet." : `${Number(stats?.rating_avg).toFixed(1)} average from ${count} review${count === 1 ? "" : "s"}`}
      </p>
      <nav className="tabs" aria-label="Review filters">
        {TABS.map(([k, l]) => (<Link key={k} href={`/reviews?tab=${k}`} className={k === tab ? "tab tab-on" : "tab"}>{l}</Link>))}
      </nav>
      <Flash saved={sp.saved} error={sp.error} />
      <ul className="list">
        {rows.length === 0 && <li className="empty">{tab === "unreplied" ? "No reviews waiting for a reply." : "No reviews yet."}</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <div className="list-main">
              <strong aria-label={`${r.rating} out of 5 stars`}>{stars(r.rating)}</strong> · {r.reviewer_name ?? "Customer"}
              <div className="list-meta">{when(r.created_at)}</div>
              {r.body && <p style={{ margin: "8px 0" }}>{r.body}</p>}
              {r.business_reply && (
                <div className="list-meta"><strong>Your reply:</strong> {r.business_reply}</div>
              )}
              <details style={{ marginTop: 8 }}>
                <summary>{r.business_reply ? "Edit reply" : "Reply"}</summary>
                <form action={reply} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="tab" value={tab} />
                  <textarea name="reply" defaultValue={r.business_reply ?? ""} maxLength={1000} rows={4}
                    aria-label="Your reply" style={{ width: "100%", font: "inherit", padding: 8, boxSizing: "border-box" }} />
                  <div className="actions" style={{ marginTop: 8 }}>
                    <button className="btn btn-gold btn-small" type="submit">Save reply</button>
                  </div>
                </form>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}