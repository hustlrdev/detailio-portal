"use client";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { prepareUpload, savePhoto } from "@/app/setup/photos/actions";

type Kind = "logo" | "cover" | "gallery" | "service";
const BUCKET = "business-public";
const MAX_INPUT_MB = 25;

let browserClient: ReturnType<typeof createClient> | null = null;
function client() {
  if (!browserClient) {
    browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}

async function toJpeg(file: File, maxSide: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
}

export function PhotoUploader({ kind, serviceId, buttonLabel, multiple }: { kind: Kind; serviceId?: string; buttonLabel: string; multiple?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function uploadOne(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) return "That file isn’t an image.";
    if (file.size > MAX_INPUT_MB * 1024 * 1024) return `That photo is over ${MAX_INPUT_MB} MB.`;
    let blob: Blob;
    try { blob = await toJpeg(file, kind === "cover" ? 2000 : 1600); }
    catch { return "We couldn’t read that photo. Try a JPG or PNG."; }
    const prep = await prepareUpload(kind, serviceId);
    if ("error" in prep) return prep.error;
    const { error } = await client().storage.from(BUCKET).uploadToSignedUrl(prep.path, prep.token, blob, { contentType: "image/jpeg" });
    if (error) return "The upload didn’t go through. Check your connection and try again.";
    const saved = await savePhoto(kind, prep.path, serviceId);
    if ("error" in saved) return saved.error;
    return null;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true); setErr(""); setMsg("");
    let done = 0;
    for (const f of files) {
      const problem = await uploadOne(f);
      if (problem) { setErr(problem); break; }
      done++;
    }
    setBusy(false);
    if (done > 0) { setMsg(done === 1 ? "Photo uploaded." : `${done} photos uploaded.`); router.refresh(); }
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" multiple={multiple} onChange={onPick} hidden />
      <button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : buttonLabel}
      </button>
      <p role="status" aria-live="polite" className="list-meta" style={{ marginTop: 6 }}>{msg}</p>
      {err ? <p role="alert" className="flash flash-err" style={{ marginTop: 6 }}>{err}</p> : null}
    </div>
  );
}