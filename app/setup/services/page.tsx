import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { StepNav } from "@/components/StepNav";
import { requireBusiness } from "@/lib/auth";
import { money } from "@/lib/format";
import { addService, toggleService } from "../actions";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesStep({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await requireBusiness();
  const [{ data: services }, { data: cats }] = await Promise.all([
    supabase.from("services").select("id,name,description,base_price_pence,duration_minutes,active").eq("business_id", business.id).order("created_at"),
    supabase.from("service_categories").select("id,name").order("sort"),
  ]);
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Services</h1>
      <StepNav current="/setup/services" />
      <Flash saved={sp.saved} error={sp.error} />
      <ul className="list">
        {(services ?? []).length === 0 && <li className="empty">No services yet. Add your first one below.</li>}
        {(services ?? []).map((s) => (
          <li key={s.id}>
            <div className="list-main">
              <strong>{s.name}</strong> {!s.active && <span className="badge badge-idle">Hidden</span>}
              <div className="list-meta">{money(s.base_price_pence)} · {s.duration_minutes} min{s.description ? ` · ${s.description}` : ""}</div>
            </div>
            <form action={toggleService}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={String(!s.active)} />
              <button className="btn btn-outline btn-small" type="submit">{s.active ? "Hide" : "Show"}</button>
            </form>
          </li>
        ))}
      </ul>
      <h2 className="sec-title">Add a service</h2>
      <form action={addService} className="form-wide">
        <div className="grid-2">
          <label className="field"><span className="field-label">Service name</span><input name="name" required maxLength={80} placeholder="Full valet" /></label>
          <label className="field"><span className="field-label">Category</span>
            <select name="category_id" defaultValue=""><option value="">Choose one</option>{(cats ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></label>
          <label className="field"><span className="field-label">Price (£)</span><input name="price" type="number" step="0.01" min={0} required /></label>
          <label className="field"><span className="field-label">Duration (minutes)</span><input name="duration_minutes" type="number" min={15} step={15} required /></label>
        </div>
        <label className="field"><span className="field-label">Description</span><textarea name="description" maxLength={500} /></label>
        <button className="btn btn-gold" type="submit">Add service</button>
      </form>
    </Shell>
  );
}
