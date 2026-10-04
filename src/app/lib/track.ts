/**
 * Feature analytics are disabled: LiveSync does not send usage or financial
 * events to any server. Kept as a no-op so existing call sites compile.
 */
export async function trackFeature(_feature: string, _meta?: Record<string, any>) {
  return;
}
