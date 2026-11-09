/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getChecklist(supabase: any, business: any) {
  const id = business.id;
  const [loc, svc, rules, docs] = await Promise.all([
    supabase.from("business_locations").select("id", { count: "exact", head: true }).eq("business_id", id).eq("active", true),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", id).eq("active", true),
    supabase.from("availability_rules").select("id", { count: "exact", head: true }).eq("business_id", id),
    supabase.from("verification_documents").select("id, kind, status, expires_on, created_at").eq("business_id", id).order("created_at", { ascending: false }),
  ]);
  const documents: any[] = docs.data ?? [];
  const has = (k: string) => documents.some((d) => d.kind === k);
  const items = [
    { label: "Business details", done: Boolean(business.description), href: "/setup/business", optional: false },
    { label: "Address and service area", done: (loc.count ?? 0) > 0, href: "/setup/location", optional: false },
    { label: "At least one service", done: (svc.count ?? 0) > 0, href: "/setup/services", optional: false },
    { label: "Opening hours", done: (rules.count ?? 0) > 0, href: "/setup/hours", optional: false },
    { label: "ID, registration and insurance uploaded", done: has("owner_id") && has("business_registration") && has("insurance"), href: "/setup/documents", optional: false },
    { label: "Photos (optional)", done: Boolean(business.logo_path && business.cover_path), href: "/setup/photos", optional: true },
  ];
  return { items, documents, ready: items.filter((i) => !i.optional).every((i) => i.done) };
}