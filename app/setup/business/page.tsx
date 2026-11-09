import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { StepNav } from "@/components/StepNav";
import { requireBusiness } from "@/lib/auth";
import { saveBusiness } from "../actions";

export const metadata: Metadata = { title: "Business details" };

export default async function BusinessStep({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, isAdmin, business } = await requireBusiness();
  const { data: contact } = await supabase.from("business_contacts").select("phone,email,website").eq("business_id", business.id).maybeSingle();
  return (
    <Shell isAdmin={isAdmin}>
      <h1 className="page-title">Business details</h1>
      <StepNav current="/setup/business" />
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveBusiness} className="form-wide">
        <label className="field"><span className="field-label">Business name</span><input name="name" defaultValue={business.name} required maxLength={80} /></label>
        <label className="field"><span className="field-label">Description</span><textarea name="description" defaultValue={business.description ?? ""} maxLength={1500} /></label>
        <p className="hint">Customers read this on your storefront. Say what you specialise in.</p>
        <div className="grid-2">
          <label className="field"><span className="field-label">How do you work?</span>
            <select name="service_mode" defaultValue={business.service_mode}>
              <option value="studio">From a studio</option><option value="mobile">Mobile, I come to customers</option><option value="both">Both</option>
            </select></label>
          <label className="field"><span className="field-label">Booking mode</span>
            <select name="booking_mode" defaultValue={business.booking_mode}>
              <option value="instant">Instant, bookings confirm automatically</option><option value="approval">Approval, I accept each request</option>
            </select></label>
          <label className="field"><span className="field-label">Hours to respond to requests</span>
            <input name="approval_window_hours" type="number" min={1} max={48} defaultValue={business.approval_window_hours} /></label>
          <label className="field"><span className="field-label">Minimum notice (hours)</span>
            <input name="lead_time_hours" type="number" min={0} defaultValue={business.lead_time_hours} /></label>
          <label className="field"><span className="field-label">Gap between jobs (minutes)</span>
            <input name="buffer_minutes" type="number" min={0} defaultValue={business.buffer_minutes} /></label>
          <label className="field"><span className="field-label">Extra travel time, mobile (minutes)</span>
            <input name="travel_buffer_minutes" type="number" min={0} defaultValue={business.travel_buffer_minutes} /></label>
          <label className="field"><span className="field-label">Most jobs per day (optional)</span>
            <input name="max_jobs_per_day" type="number" min={1} defaultValue={business.max_jobs_per_day ?? ""} /></label>
          <label className="field"><span className="field-label">Cancellation policy</span>
            <select name="cancellation_policy" defaultValue={business.cancellation_policy}>
              <option value="flexible">Flexible, free until 24 hours before</option>
              <option value="standard">Standard, free until 48 hours before</option>
              <option value="strict">Strict, free until 72 hours before</option>
            </select></label>
        </div>
        <p className="hint">Customers who cancel inside the free window get a partial refund, and none very close to the appointment.</p>
        <div className="grid-2">
          <label className="field"><span className="field-label">Phone</span><input name="phone" type="tel" defaultValue={contact?.phone ?? ""} autoComplete="tel" /></label>
          <label className="field"><span className="field-label">Business email</span><input name="email" type="email" defaultValue={contact?.email ?? ""} /></label>
        </div>
        <label className="field"><span className="field-label">Website (optional)</span><input name="website" type="url" defaultValue={contact?.website ?? ""} /></label>
        <p className="hint">Customers only see your phone and email after they have booked with you.</p>
        <button className="btn btn-gold" type="submit">Save</button>
      </form>
    </Shell>
  );
}
