/**
 * shareTarget.ts — receives text the user shares INTO LiveSync from another app (Android "Share" sheet).
 *
 * This is how bank alerts get in without LiveSync ever reading the SMS inbox: the user long-presses a message,
 * taps Share → LiveSync, and only that text arrives. It is parked here until the review screen collects it.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

type ShareTargetPlugin = {
  getPending(): Promise<{ text?: string | null }>;
  addListener(event: "shareReceived", cb: () => void): Promise<{ remove: () => Promise<void> }>;
};

const Native = registerPlugin<ShareTargetPlugin>("ShareTarget");

let parked: string | null = null;
export const setSharedText = (t: string) => { parked = t; };
export const takeSharedText = (): string | null => { const t = parked; parked = null; return t; };

/** Pull any text waiting on the native side into the parked slot. Returns true if there was some. */
export async function collectShare(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { text } = await Native.getPending();
    if (text && text.trim()) { setSharedText(text); return true; }
  } catch { /* plugin not present in this build */ }
  return false;
}

/** Call `onText` whenever something is shared into the app — at launch and while it is already open. */
export function listenForShares(onText: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let off: (() => Promise<void>) | undefined;
  let stopped = false;
  collectShare().then((got) => { if (got && !stopped) onText(); });
  Native.addListener("shareReceived", async () => { if (await collectShare()) onText(); })
    .then((h) => { if (stopped) h.remove(); else off = h.remove; })
    .catch(() => {});
  return () => { stopped = true; void off?.(); };
}
