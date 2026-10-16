/* Supabase project credentials — read from environment variables.
 * The anon key is intentionally public in Supabase's security model.
 * Security is enforced server-side via Row-Level Security (RLS) policies.
 * Never put the service_role key here or in .env — keep it server-only.
 */

// Fallbacks are tolerated in dev only; a production build with missing config must fail
// loudly instead of silently talking to whichever project the fallback names.
const requireEnv = (name: string, value: string | undefined): string => {
  if (value) return value;
  if (import.meta.env.PROD) throw new Error(`Missing required build-time config: ${name}`);
  return "";
};

export const projectId: string = requireEnv("VITE_SUPABASE_PROJECT_ID", import.meta.env.VITE_SUPABASE_PROJECT_ID);

export const publicAnonKey: string = requireEnv("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);
