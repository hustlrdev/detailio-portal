"use server";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";

type Kind = "logo" | "cover" | "gallery" | "service";
const BUCKET = "business-public";
const MAX_GALLERY = 12;
const FAIL = "We couldn't upload that photo. Try again.";

/* eslint-disable @typescript-eslint/no-explicit-any */
function pathOk(kind: Kind, path: string, businessId: string, serviceId?: string) {
  if (path.includes("..") || !path.endsWith(".jpg")) return false;
  if (kind === "logo") return path.startsWith(`${businessId}/logo-`) && !path.slice(businessId.length + 1).includes("/");
  if (kind === "cover") return path.startsWith(`${businessId}/cover-`) && !path.slice(businessId.length + 1).includes("/");
  if (kind === "gallery") return path.startsWith(`${businessId}/gallery/`) && path.split("/").length === 3;
  return Boolean(serviceId) && path.startsWith(`${businessId}/services/${serviceId}-`) && path.split("/").length === 3;
}

async function removeFile(supabase: any, path: string | null | undefined) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export async function prepareUpload(kind: Kind, serviceId?: string): Promise<{ path: string; token: string } | { error: string }> {
  const { supabase, business } = await requireBusiness();
  if (!["logo", "cover", "gallery", "service"].includes(kind)) return { error: FAIL };

  if (kind === "service") {
    const { data } = await supabase.from("services").select("id").eq("id", serviceId ?? "").eq("business_id", business.id).maybeSingle();
    if (!data) return { error: "We couldn't find that service." };
  }
  if (kind === "gallery" && (business.gallery_paths ?? []).length >= MAX_GALLERY) {
    return { error: `You can have up to ${MAX_GALLERY} gallery photos. Remove one first.` };
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const file =
    kind === "gallery" ? `gallery/${stamp}.jpg`
    : kind === "service" ? `services/${serviceId}-${stamp}.jpg`
    : `${kind}-${stamp}.jpg`;
  const path = `${business.id}/${file}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: FAIL };
  return { path, token: data.token };
}

export async function savePhoto(kind: Kind, path: string, serviceId?: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, business } = await requireBusiness();
  if (!pathOk(kind, path, business.id, serviceId)) return { error: FAIL };

  if (kind === "logo" || kind === "cover") {
    const col = kind === "logo" ? "logo_path" : "cover_path";
    const old = business[col] as string | null;
    const { error } = await supabase.from("businesses").update({ [col]: path }).eq("id", business.id);
    if (error) return { error: FAIL };
    await removeFile(supabase, old);
  } else if (kind === "gallery") {
    const next = [...(business.gallery_paths ?? []), path].slice(0, MAX_GALLERY);
    const { error } = await supabase.from("businesses").update({ gallery_paths: next }).eq("id", business.id);
    if (error) return { error: FAIL };
  } else {
    const { data: svc } = await supabase.from("services").select("image_path").eq("id", serviceId!).eq("business_id", business.id).maybeSingle();
    const { error } = await supabase.from("services").update({ image_path: path }).eq("id", serviceId!).eq("business_id", business.id);
    if (error) return { error: FAIL };
    await removeFile(supabase, svc?.image_path);
  }
  revalidatePath("/setup/photos");
  revalidatePath("/setup");
  return { ok: true };
}

export async function removeGalleryPhoto(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const path = String(fd.get("path") ?? "");
  const current: string[] = business.gallery_paths ?? [];
  if (!current.includes(path)) return;
  const { error } = await supabase.from("businesses").update({ gallery_paths: current.filter((p) => p !== path) }).eq("id", business.id);
  if (!error) await removeFile(supabase, path);
  revalidatePath("/setup/photos");
}

export async function removeServicePhoto(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const id = String(fd.get("id") ?? "");
  const { data: svc } = await supabase.from("services").select("image_path").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!svc) return;
  const { error } = await supabase.from("services").update({ image_path: null }).eq("id", id).eq("business_id", business.id);
  if (!error) await removeFile(supabase, svc.image_path);
  revalidatePath("/setup/photos");
}