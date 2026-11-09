import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { StepNav } from "@/components/StepNav";
import { requireBusiness } from "@/lib/auth";
import { saveLocation } from "../actions";

export const metadata: Metadata = { title: "Location" };

export default async function LocationStep({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await requireBusiness();
  const [{ data: locs }, { data: areas }] = await Promise.all([
    supabase.from("business_locations").select("postcode,address_line1,town").eq("business_id", business.id).order("created_at").limit(1),
    supabase.from("service_areas").select("radius_m").eq("business_id", business.id).eq("kind", "radius").limit(1),
  ]);
  const loc = locs?.[0];
  const miles = areas?.[0]?.radius_m ? Math.round(areas[0].radius_m / 1609.34) : 10;
  const mobile = business.service_mode !== "studio";
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Location</h1>
      <StepNav current="/setup/location" />
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveLocation} className="form-wide">
        <div className="grid-2">
          <label className="field"><span className="field-label">{mobile && business.service_mode === "mobile" ? "Home base postcode" : "Studio postcode"}</span>
            <input name="postcode" defaultValue={loc?.postcode ?? ""} required autoComplete="postal-code" placeholder="LS1 4AP" /></label>
          <label className="field"><span className="field-label">Town or city</span><input name="town" defaultValue={loc?.town ?? ""} /></label>
        </div>
        <label className="field"><span className="field-label">Address line</span><input name="address_line1" defaultValue={loc?.address_line1 ?? ""} autoComplete="address-line1" /></label>
        {business.service_mode === "mobile" && <p className="hint">Mobile only: your home base stays private. Customers only see the area you cover.</p>}
        {mobile && (
          <>
            <label className="field"><span className="field-label">How far will you travel? (miles)</span>
              <input name="radius_miles" type="number" min={1} max={100} defaultValue={miles} /></label>
            <p className="hint">Customers inside this distance from your postcode can find and book you.</p>
          </>
        )}
        <button className="btn btn-gold" type="submit">Save</button>
      </form>
    </Shell>
  );
}
