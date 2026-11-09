import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the SERVICE ROLE key. It bypasses row-level security, so it is only ever
 * used in server code (API routes, server actions). Never import this in a client component.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function admin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
