import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireAdmin } from "@/lib/auth";
import { statusLabel } from "@/lib/format";
import { approveDocument, rejectDocument, approveBusiness, rejectBusiness, suspendBusiness } from "../actions";

export const metadata: Metadata = { title: "Review business" };
const kindLabel: Record<string, string> = { owner_id: "Photo ID", business_registration: "Business registration", insurance: "Public liability insurance", other: "Other" };
const badge: Record<string, string> = { pending: "badge badge-wait", approved: "badge badge-ok", rejected: "badge badge-no" };

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, isAdmin } = await requireAdmin();
  const { data: b } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();
  const [{ data: docs }, { data: locs }, { data: services }, { data: contact }] = await Promise.all([
    supabase.from("verification_documents").select("*").eq("business_id", id).order("created_at", { ascending: false }),
    supabase.from("business_locations").select("postcode,town").eq("business_id", id),
    supabase.from("services").select("id,name,base_price_pence").eq("business_id", id),
    supabase.from("business_contacts").select("phone,email").eq("business_id", id).maybeSingle(),
  ]);
  const signed = await Promise.all((docs ?? []).map(async (d) => {
    const { data } = await supabase.storage.from("verification-docs").createSignedUrl(d.storage_path, 600);
    return { ...d, url: data?.signedUrl as string | undefined };
  }));

  return (
    <Shell isAdmin={isAdmin}>
      <p><Link href="/admin">← All applications</Link></p>
      <h1 className="page-title">{b.name}</h1>
      <p className="page-sub"><span className="badge badge-wait">{statusLabel[b.status]}</span> · {b.service_mode} · {locs?.[0]?.postcode ?? "no address"} · {contact?.email ?? "no email"} · {contact?.phone ?? "no phone"}</p>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="measure">{b.description || "No description."}</p>
      <p className="list-meta">{services?.length ?? 0} service(s) listed.</p>

      <h2 className="sec-title" style={{ marginTop: 32 }}>Documents</h2>
      <ul className="list">
        {signed.length === 0 && <li className="empty">No documents uploaded.</li>}
        {signed.map((d) => (
          <li key={d.id} className="doc-row">
            <div className="list-main">
              <strong>{kindLabel[d.kind]}</strong> <span className={badge[d.status]}>{d.status}</span>
              <div className="list-meta">{d.expires_on ? `Expires ${d.expires_on}` : ""} {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer">Open file (link lasts 10 minutes)</a> : "File unavailable"}</div>
            </div>
            {d.status === "pending" ? (
              <form action={approveDocument} className="actions">
                <input type="hidden" name="id" value={d.id} /><input type="hidden" name="business_id" value={id} />
                <input name="note" placeholder="Note (optional)" aria-label="Note" style={{ minHeight: 40, padding: "0 10px", border: "1px solid #b9b7ae", borderRadius: 6 }} />
                <button className="btn btn-gold btn-small" type="submit">Approve</button>
                <button className="btn btn-outline btn-small" type="submit" formAction={rejectDocument}>Reject</button>
              </form>
            ) : (
              <p className="list-meta">{d.status === "approved" ? "Approved" : "Rejected"}{d.note ? `: ${d.note}` : ""}</p>
            )}
          </li>
        ))}
      </ul>

      <h2 className="sec-title">Decision</h2>
      {b.status === "draft" ? (
        <p className="hint">This business hasn’t submitted its application yet.</p>
      ) : (
        <form action={approveBusiness} className="form-wide">
          <input type="hidden" name="business_id" value={id} />
          <label className="field"><span className="field-label">Note (kept in the audit log)</span><input name="note" /></label>
          <div className="actions">
            {(b.status === "pending_verification" || b.status === "rejected") && (
              <button className="btn btn-gold" type="submit">Approve business</button>
            )}
            {b.status === "suspended" && (
              <button className="btn btn-gold" type="submit">Restore business</button>
            )}
            {b.status === "pending_verification" && (
              <button className="btn btn-outline" type="submit" formAction={rejectBusiness}>Reject</button>
            )}
            {b.status === "approved" && (
              <button className="btn btn-outline" type="submit" formAction={suspendBusiness}>Suspend</button>
            )}
          </div>
          {b.status === "pending_verification" && (
            <p className="hint" style={{ marginTop: 12 }}>Approval needs approved ID, registration and insurance documents first.</p>
          )}
        </form>
      )}
    </Shell>
  );
}