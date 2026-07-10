import { supabase } from "./api";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const base = `https://${projectId}.supabase.co/functions/v1/make-server-a3fe149f`;

export async function trackFeature(feature: string, meta?: Record<string, any>) {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token ?? publicAnonKey;
    await fetch(`${base}/track`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ feature, meta }),
      keepalive: true,
    });
  } catch (err) {
    console.warn(`trackFeature(${feature}) failed silently:`, err);
  }
}
