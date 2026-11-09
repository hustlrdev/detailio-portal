/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireBusiness } from "@/lib/auth";
import { money, when } from "@/lib/format";
import { refreshAccount } from "@/lib/payments/sync";
import { openStripeDashboard, startOnboarding } from "./actions";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const payoutLabel: Record<string, string> = { scheduled: "Scheduled", held: "On hold", paid: "Paid", failed: "Failed" };

export default async function Payments({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; returned?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business, memberRole } = await requireBusiness();

  let account: any = null;
  let stripeProblem = "";
  try { account = await refreshAccount(business.id); } catch (e) { console.error("[payments page]", e); stripeProblem = "We couldn't check your Stripe account just now."; }

  const [{ data: ledger }, { data: payouts }] = await Promise.all([
    supabase.from("ledger_entries").select("kind,amount_pence").eq("business_id", business.id).limit(2000),
    supabase.from("payouts").select("id,amount_pence,status,paid_at,scheduled_for,created_at,last_error").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const sum = (kind?: string) => ((ledger ?? []) as any[]).filter((l) => !kind || l.kind === kind).reduce((n, l) => n + l.amount_pence, 0);
  const waiting = sum(); // everything earned minus everything already paid out

  const ready = Boolean(account?.charges_enabled && account?.payouts_enabled);
  const due: string[] = account?.requirements?.currently_due ?? [];

  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Payments</h1>
      <p className="page-sub">Customers pay DETAILIO. After each job is marked complete, we send your share to your bank through Stripe.</p>
      <Flash saved={sp.saved} error={sp.error} />
      {sp.returned && <p className="flash flash-ok">Welcome back. We've checked your Stripe account below.</p>}
      {stripeProblem && <p className="flash flash-err">{stripeProblem}</p>}

      <h2 className="sec-title">Payout account</h2>
      <ul className="list">
        <li>
          <div className="list-main">
            <strong>Stripe</strong>{" "}
            <span className={ready ? "badge badge-ok" : account ? "badge badge-wait" : "badge badge-idle"}>
              {ready ? "Ready for payouts" : account ? "Finish set-up" : "Not set up"}
            </span>
            <div className="list-meta">
              {ready ? "Your payouts will be sent automatically after each completed job."
                : account ? `Stripe still needs a few details${due.length ? ` (${due.length} item${due.length === 1 ? "" : "s"})` : ""}. Until then, your money is kept safely on hold.`
                : "Connect your bank details so we can pay you. Customers can still book you in the meantime and your money is held until you finish."}
            </div>
          </div>
          <div className="actions">
            {memberRole === "owner" && (
              <form action={startOnboarding}><button className="btn btn-gold btn-small" type="submit">{account ? (ready ? "Update details" : "Continue set-up") : "Set up payouts"}</button></form>
            )}
            {account?.details_submitted && (
              <form action={openStripeDashboard}><button className="btn btn-outline btn-small" type="submit">Open Stripe dashboard</button></form>
            )}
          </div>
        </li>
      </ul>

      <h2 className="sec-title">Your earnings</h2>
      <div className="stats">
        <div className="stat"><span className="stat-n">{money(sum("gross"))}</span><span className="stat-l">Customer payments</span></div>
        <div className="stat"><span className="stat-n">{money(-sum("commission"))}</span><span className="stat-l">DETAILIO commission</span></div>
        <div className="stat"><span className="stat-n">{money(-sum("processing_fee"))}</span><span className="stat-l">Card fees</span></div>
        <div className="stat"><span className="stat-n">{money(-sum("refund"))}</span><span className="stat-l">Refunds to customers</span></div>
        <div className="stat"><span className="stat-n">{money(-sum("payout"))}</span><span className="stat-l">Paid to you</span></div>
        <div className="stat"><span className="stat-n">{money(waiting)}</span><span className="stat-l">Still to come (after jobs are completed)</span></div>
      </div>

      <h2 className="sec-title" style={{ marginTop: 32 }}>Payouts</h2>
      <ul className="list">
        {(payouts ?? []).length === 0 && <li className="empty">No payouts yet.</li>}
        {((payouts ?? []) as any[]).map((p) => (
          <li key={p.id}>
            <div className="list-main"><strong>{money(p.amount_pence)}</strong>
              <div className="list-meta">{p.paid_at ? `Paid ${when(p.paid_at)}` : `Created ${when(p.created_at)}`}{p.last_error ? ` · ${p.last_error}` : ""}</div></div>
            <span className={p.status === "paid" ? "badge badge-ok" : p.status === "failed" ? "badge badge-no" : "badge badge-wait"}>{payoutLabel[p.status] ?? p.status}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
