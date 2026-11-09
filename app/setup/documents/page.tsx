import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { StepNav } from "@/components/StepNav";
import { requireBusiness } from "@/lib/auth";
import { getChecklist } from "@/lib/checklist";
import { Uploader } from "./Uploader";

export const metadata: Metadata = { title: "Documents" };
const label: Record<string, string> = { owner_id: "Photo ID", business_registration: "Business registration", insurance: "Public liability insurance", other: "Other" };
const badge: Record<string, string> = { pending: "badge badge-wait", approved: "badge badge-ok", rejected: "badge badge-no" };

export default async function DocumentsStep() {
  const { supabase, isAdmin, business } = await requireBusiness();
  const { documents } = await getChecklist(supabase, business);
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Documents</h1>
      <StepNav current="/setup/documents" />
      <p className="page-sub">We check these before your business goes live. Only you and the DETAILIO team can see them.</p>
      <ul className="list">
        {documents.length === 0 && <li className="empty">No documents uploaded yet.</li>}
        {documents.map((d) => (
          <li key={d.id}>
            <div className="list-main"><strong>{label[d.kind]}</strong>
              <div className="list-meta">{d.expires_on ? `Expires ${d.expires_on}` : "Uploaded"}</div></div>
            <span className={badge[d.status]}>{d.status === "pending" ? "In review" : d.status === "approved" ? "Approved" : "Needs replacing"}</span>
          </li>
        ))}
      </ul>
      <h2 className="sec-title">Upload a document</h2>
      <Uploader businessId={business.id} />
    </Shell>
  );
}
