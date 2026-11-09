import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { getSession } from "@/lib/auth";
import { getChecklist } from "@/lib/checklist";
import { statusLabel } from "@/lib/format";
import { createBusiness } from "./actions";

export const metadata: Metadata = { title: "Set up your business" };

export default async function Setup({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await getSession();

  if (!business) {
    return (
      <Shell isAdmin={isAdmin}>
        <h1 className="page-title">Set up your business</h1>
        <p className="page-sub">Tell us the name customers will see. You can change everything else later.</p>
        <Flash saved={sp.saved} error={sp.error} />
        <form action={createBusiness} className="form-wide">
          <label className="field"><span className="field-label">Business name</span><input name="name" required maxLength={80} autoComplete="organization" /></label>
          <button className="btn btn-gold" type="submit">Continue</button>
        </form>
      </Shell>
    );
  }

  const { items, ready } = await getChecklist(supabase, business);
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Set up {business.name}</h1>
      <p className="page-sub">Finish each step, then send your business for review. Status: <strong>{statusLabel[business.status]}</strong>.</p>
      <Flash saved={sp.saved} error={sp.error} />
      <ul className="check-list">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href}>{i.label}</Link>
            <span className={i.done ? "badge badge-ok" : "badge badge-idle"}>{i.done ? "Done" : "To do"}</span>
          </li>
        ))}
      </ul>
      <Link href="/setup/review" className={ready ? "btn btn-gold" : "btn btn-outline"}>Review and submit</Link>
    </Shell>
  );
}
