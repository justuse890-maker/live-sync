/**
 * shareOut.ts — send text out of LiveSync through the phone's own Share sheet (WhatsApp, email, Drive…),
 * falling back to the clipboard where there is none. The user picks the destination every time.
 */
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareText(title: string, text: string): Promise<ShareResult> {
  try {
    const can = Capacitor.isNativePlatform() ? true : (await Share.canShare()).value;
    if (can) {
      await Share.share({ title, text, dialogTitle: title });
      return "shared";
    }
  } catch (e: any) {
    // The user closing the sheet is not a failure.
    if (/cancel|abort|dismiss/i.test(String(e?.message ?? e))) return "cancelled";
  }
  try { await navigator.clipboard.writeText(text); return "copied"; }
  catch { return "failed"; }
}
