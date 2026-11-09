import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { StepNav } from "@/components/StepNav";
import { requireBusiness } from "@/lib/auth";
import { getChecklist } from "@/lib/checklist";
import { statusLabel } from "@/lib/format";
import { submitForReview } from "../actions";

export const metadata: Metadata = { title: "Review and submit" };

export default async function ReviewStep({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await requireBusiness();
  const { items, ready } = await getChecklist(supabase, business);
  const canSubmit = ["draft", "rejected"].includes(business.status);
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Review and submit</h1>
      <StepNav current="/setup/review" />
      <Flash saved={sp.saved} error={sp.error} />
      <p className="page-sub">Status: <strong>{statusLabel[business.status]}</strong>.</p>
      <ul className="check-list">
        {items.map((i) => (
          <li key={i.label}><Link href={i.href}>{i.label}</Link><span className={i.done ? "badge badge-ok" : "badge badge-idle"}>{i.done ? "Done" : "To do"}</span></li>
        ))}
      </ul>
      {business.status === "pending_verification" && <p className="flash flash-ok">Your business is with the DETAILIO team. We'll email you when it's approved.</p>}
      {business.status === "approved" && <p className="flash flash-ok">Your business is approved.</p>}
      {canSubmit && (
        <form action={submitForReview}>
          <button className="btn btn-gold" type="submit" disabled={!ready}>Submit for review</button>
          {!ready && <p className="hint" style={{ marginTop: 12 }}>Finish every step above to submit.</p>}
        </form>
      )}
    </Shell>
  );
}
