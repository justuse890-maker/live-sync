/* Supabase project credentials — read from environment variables.
 * The anon key is intentionally public in Supabase's security model.
 * Security is enforced server-side via Row-Level Security (RLS) policies.
 * Never put the service_role key here or in .env — keep it server-only.
 */

export const projectId: string =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "pnfdefqxkpnglbyzeqid";

export const publicAnonKey: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZmRlZnF4a3BuZ2xieXplcWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTE5OTIsImV4cCI6MjA5NjI4Nzk5Mn0.czCMGNhHxwOuecf2ZUlRFG-vWqCG8DTrRtsN4GnHrNc";