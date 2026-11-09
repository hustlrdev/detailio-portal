import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { StepNav } from "@/components/StepNav";
import { requireBusiness } from "@/lib/auth";
import { DAYS } from "@/lib/format";
import { saveHours } from "../actions";

export const metadata: Metadata = { title: "Opening hours" };
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function HoursStep({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await requireBusiness();
  const { data: rules } = await supabase.from("availability_rules").select("weekday,start_time,end_time").eq("business_id", business.id);
  const byDay = new Map<number, { start_time: string; end_time: string }>((rules ?? []).map((r) => [r.weekday, r]));
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Opening hours</h1>
      <StepNav current="/setup/hours" />
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveHours} className="form-wide">
        {ORDER.map((d) => {
          const r = byDay.get(d);
          return (
            <div className="hours-row" key={d}>
              <label className="check"><input type="checkbox" name={`open_${d}`} defaultChecked={Boolean(r) || (!rules?.length && d >= 1 && d <= 5)} /><span>{DAYS[d]}</span></label>
              <input type="time" name={`start_${d}`} defaultValue={r?.start_time?.slice(0, 5) ?? "09:00"} aria-label={`${DAYS[d]} opens`} />
              <input type="time" name={`end_${d}`} defaultValue={r?.end_time?.slice(0, 5) ?? "17:00"} aria-label={`${DAYS[d]} closes`} />
            </div>
          );
        })}
        <p className="hint" style={{ marginTop: 16 }}>Customers can book any time inside these hours, once your notice period and gaps between jobs are applied. Times are UK time.</p>
        <button className="btn btn-gold" type="submit">Save hours</button>
      </form>
    </Shell>
  );
}
