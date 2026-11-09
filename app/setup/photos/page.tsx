/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { StepNav } from "@/components/StepNav";
import { PhotoUploader } from "@/components/PhotoUploader";
import { requireBusiness } from "@/lib/auth";
import { removeGalleryPhoto, removeServicePhoto } from "./actions";

export const metadata: Metadata = { title: "Photos" };

const url = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/business-public/${path}` : null;

const frame = { background: "#e9e7e0", borderRadius: 12, overflow: "hidden" as const };

export default async function PhotosStep() {
  const { supabase, isAdmin, business } = await requireBusiness();
  const { data: services } = await supabase.from("services").select("id,name,image_path,active").eq("business_id", business.id).order("created_at");
  const gallery: string[] = business.gallery_paths ?? [];

  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Photos</h1>
      <StepNav current="/setup/photos" />
      <p className="page-sub">Good photos help customers choose you. Use bright, uncluttered shots of your own work. JPG or PNG, any size: we’ll resize them. This step is optional, and you can add photos at any time.</p>

      <h2 className="sec-title">Logo</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ ...frame, width: 96, height: 96 }}>
          {business.logo_path ? <img src={url(business.logo_path)!} alt="Your logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        <PhotoUploader kind="logo" buttonLabel={business.logo_path ? "Replace logo" : "Upload logo"} />
      </div>

      <h2 className="sec-title">Cover photo</h2>
      <div style={{ ...frame, width: "100%", maxWidth: 520, aspectRatio: "16 / 7", marginBottom: 12 }}>
        {business.cover_path ? <img src={url(business.cover_path)!} alt="Your cover photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      <PhotoUploader kind="cover" buttonLabel={business.cover_path ? "Replace cover photo" : "Upload cover photo"} />

      <h2 className="sec-title">Your work</h2>
      <p className="list-meta" style={{ marginBottom: 12 }}>Up to 12 photos of finished jobs. Select several at once.</p>
      {gallery.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
          {gallery.map((p) => (
            <div key={p}>
              <div style={{ ...frame, aspectRatio: "1 / 1" }}>
                <img src={url(p)!} alt="Job photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <form action={removeGalleryPhoto} style={{ marginTop: 6 }}>
                <input type="hidden" name="path" value={p} />
                <button className="btn btn-outline btn-small" type="submit">Remove</button>
              </form>
            </div>
          ))}
        </div>
      )}
      <PhotoUploader kind="gallery" multiple buttonLabel="Add photos" />

      <h2 className="sec-title">Service photos</h2>
      <ul className="list">
        {(services ?? []).length === 0 && <li className="empty">Add a service first, then you can give it a photo.</li>}
        {(services ?? []).map((s) => (
          <li key={s.id} style={{ alignItems: "flex-start", gap: 14 }}>
            <div style={{ ...frame, width: 72, height: 72, flexShrink: 0 }}>
              {s.image_path ? <img src={url(s.image_path)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </div>
            <div className="list-main">
              <strong>{s.name}</strong> {!s.active && <span className="badge badge-idle">Hidden</span>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <PhotoUploader kind="service" serviceId={s.id} buttonLabel={s.image_path ? "Replace photo" : "Add photo"} />
                {s.image_path && (
                  <form action={removeServicePhoto}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn btn-outline btn-small" type="submit">Remove</button>
                  </form>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}