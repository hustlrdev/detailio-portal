"use server";
import { redirect } from "next/navigation";
import { getSession, requireBusiness } from "@/lib/auth";
import { slugify } from "@/lib/format";

function go(path: string, key: "saved" | "error", msg = "1"): never {
  redirect(`${path}?${key}=${encodeURIComponent(msg)}`);
}
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, fallback: number) => {
  const n = Number(text(fd, k));
  return Number.isFinite(n) ? n : fallback;
};
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/;

export async function createBusiness(fd: FormData) {
  const { supabase, user, business } = await getSession();
  if (business) redirect("/setup/business");
  const name = text(fd, "name");
  if (name.length < 2) go("/setup", "error", "Enter your business name.");
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("businesses").insert({ name, slug, created_by: user.id });
  if (error) go("/setup", "error", "We couldn't create your business. Try again.");
  redirect("/setup/business");
}

export async function saveBusiness(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const mode = text(fd, "service_mode");
  const bookingMode = text(fd, "booking_mode");
  const policy = text(fd, "cancellation_policy");
  if (!["studio", "mobile", "both"].includes(mode)) go("/setup/business", "error", "Choose how you work.");
  if (!["instant", "approval"].includes(bookingMode)) go("/setup/business", "error", "Choose a booking mode.");
  if (!["flexible", "standard", "strict"].includes(policy)) go("/setup/business", "error", "Choose a cancellation policy.");
  const name = text(fd, "name");
  if (name.length < 2) go("/setup/business", "error", "Enter your business name.");
  const maxJobs = text(fd, "max_jobs_per_day");

  const { error } = await supabase.from("businesses").update({
    name,
    description: text(fd, "description") || null,
    service_mode: mode,
    booking_mode: bookingMode,
    approval_window_hours: Math.min(48, Math.max(1, num(fd, "approval_window_hours", 24))),
    lead_time_hours: Math.max(0, num(fd, "lead_time_hours", 24)),
    buffer_minutes: Math.max(0, num(fd, "buffer_minutes", 15)),
    travel_buffer_minutes: Math.max(0, num(fd, "travel_buffer_minutes", 0)),
    max_jobs_per_day: maxJobs ? Math.max(1, Number(maxJobs)) : null,
    cancellation_policy: policy,
  }).eq("id", business.id);
  if (error) go("/setup/business", "error", "We couldn't save that. Check the fields and try again.");

  const { error: cErr } = await supabase.from("business_contacts").update({
    phone: text(fd, "phone") || null,
    email: text(fd, "email") || null,
    website: text(fd, "website") || null,
  }).eq("business_id", business.id);
  if (cErr) go("/setup/business", "error", "We couldn't save your contact details.");
  go("/setup/business", "saved");
}

export async function saveLocation(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const pc = text(fd, "postcode").toUpperCase().replace(/\s+/g, "");
  const pretty = pc.length > 3 ? `${pc.slice(0, -3)} ${pc.slice(-3)}` : pc;
  if (!POSTCODE.test(pretty)) go("/setup/location", "error", "Enter a full UK postcode, like LS1 4AP.");

  let lat: number, lng: number;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("not found");
    const j = await res.json();
    lat = j.result.latitude; lng = j.result.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") throw new Error("no coordinates");
  } catch {
    go("/setup/location", "error", "We couldn't find that postcode. Check it and try again.");
  }
  const geo = `SRID=4326;POINT(${lng!} ${lat!})`;
  const mode: string = business.service_mode;

  const row = {
    business_id: business.id, name: "Main", postcode: pretty,
    address_line1: text(fd, "address_line1") || null, town: text(fd, "town") || null,
    geo, is_studio: mode !== "mobile", is_public: mode !== "mobile", active: true,
  };
  const { data: existing } = await supabase.from("business_locations").select("id").eq("business_id", business.id).order("created_at").limit(1);
  const res = existing && existing[0]
    ? await supabase.from("business_locations").update(row).eq("id", existing[0].id)
    : await supabase.from("business_locations").insert(row);
  if (res.error) go("/setup/location", "error", "We couldn't save your address. Try again.");

  await supabase.from("service_areas").delete().eq("business_id", business.id).eq("kind", "radius");
  if (mode !== "studio") {
    const miles = Math.min(100, Math.max(1, num(fd, "radius_miles", 10)));
    const { error } = await supabase.from("service_areas").insert({
      business_id: business.id, kind: "radius", center: geo, radius_m: Math.round(miles * 1609.34),
    });
    if (error) go("/setup/location", "error", "We couldn't save your service area. Try again.");
  }
  go("/setup/location", "saved");
}

export async function addService(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const name = text(fd, "name");
  const price = Math.round(num(fd, "price", NaN) * 100);
  const minutes = Math.round(num(fd, "duration_minutes", NaN));
  if (name.length < 2) go("/setup/services", "error", "Enter a service name.");
  if (!Number.isFinite(price) || price < 0) go("/setup/services", "error", "Enter a price in pounds.");
  if (!Number.isFinite(minutes) || minutes < 15) go("/setup/services", "error", "Enter a duration of at least 15 minutes.");
  const { error } = await supabase.from("services").insert({
    business_id: business.id, name, description: text(fd, "description") || null,
    category_id: text(fd, "category_id") || null, base_price_pence: price, duration_minutes: minutes,
  });
  if (error) go("/setup/services", "error", "We couldn't add that service. Try again.");
  go("/setup/services", "saved");
}

export async function toggleService(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const { error } = await supabase.from("services").update({ active: text(fd, "active") === "true" })
    .eq("id", text(fd, "id")).eq("business_id", business.id);
  if (error) go("/setup/services", "error", "We couldn't update that service.");
  go("/setup/services", "saved");
}

export async function saveHours(fd: FormData) {
  const { supabase, business } = await requireBusiness();
  const rows: { business_id: string; weekday: number; start_time: string; end_time: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (fd.get(`open_${d}`) !== "on") continue;
    const start = text(fd, `start_${d}`), end = text(fd, `end_${d}`);
    if (!start || !end || end <= start) go("/setup/hours", "error", "Each open day needs a closing time after its opening time.");
    rows.push({ business_id: business.id, weekday: d, start_time: start, end_time: end });
  }
  if (rows.length === 0) go("/setup/hours", "error", "Choose at least one open day.");
  const del = await supabase.from("availability_rules").delete().eq("business_id", business.id);
  if (del.error) go("/setup/hours", "error", "We couldn't save your hours. Try again.");
  const ins = await supabase.from("availability_rules").insert(rows);
  if (ins.error) go("/setup/hours", "error", "We couldn't save your hours. Try again.");
  go("/setup/hours", "saved");
}

export async function submitForReview() {
  const { supabase, business } = await requireBusiness();
  const { error } = await supabase.rpc("submit_business_for_review", { p_business_id: business.id });
  if (error) go("/setup/review", "error", error.message);
  redirect("/dashboard?saved=1");
}
