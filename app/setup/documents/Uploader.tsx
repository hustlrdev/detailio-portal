"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const KINDS = [
  { value: "owner_id", label: "Photo ID of the owner" },
  { value: "business_registration", label: "Business registration (Companies House or sole trader proof)" },
  { value: "insurance", label: "Public liability insurance certificate" },
  { value: "other", label: "Other document" },
];

export function Uploader({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("owner_id");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file") as File | null;
    const expires = String(f.get("expires_on") ?? "");
    if (!file || file.size === 0) return setError("Choose a file to upload.");
    if (file.size > 10 * 1024 * 1024) return setError("That file is over 10 MB. Choose a smaller one.");
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return setError("Upload a JPG, PNG or PDF.");
    if (kind === "insurance" && !expires) return setError("Enter the date your insurance expires.");

    setBusy(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
    const path = `${businessId}/${kind}-${Date.now()}-${safe}`;
    const up = await supabase.storage.from("verification-docs").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setError("The upload failed. Try again."); }
    const ins = await supabase.from("verification_documents").insert({
      business_id: businessId, kind, storage_path: path, expires_on: kind === "insurance" ? expires : null,
    });
    setBusy(false);
    if (ins.error) return setError("We couldn't record that document. Try again.");
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="form-wide" noValidate>
      <label className="field"><span className="field-label">Document type</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => (<option key={k.value} value={k.value}>{k.label}</option>))}</select></label>
      {kind === "insurance" && (
        <label className="field"><span className="field-label">Insurance expiry date</span><input type="date" name="expires_on" /></label>
      )}
      <label className="field"><span className="field-label">File (JPG, PNG or PDF, up to 10 MB)</span><input type="file" name="file" accept="image/jpeg,image/png,application/pdf" /></label>
      <p className="form-error" role="alert" aria-live="polite">{error}</p>
      <button className="btn btn-gold" type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload document"}</button>
    </form>
  );
}
