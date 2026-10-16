/**
 * txSource.ts — how a ledger row got into the app, as a small label.
 *
 * Typed-in rows and rows saved before this field existed show no badge: we only label what we actually know.
 * Every hint is about capture, not storage; where data lives is stated once, in the Data & privacy screen.
 */
export type TxSource = "manual" | "voice" | "scan" | "import" | "paste";

export function sourceBadge(t: { source?: string; autoDebited?: boolean }): { label: string; hint: string } | null {
  if (t.autoDebited) return { label: "Auto-recorded", hint: "Added automatically on the due date of an EMI or bill you set up. Not typed in." };
  switch (t.source) {
    case "voice": return { label: "Voice", hint: "Spoken by you and turned into an entry. You checked it before saving." };
    case "scan": return { label: "Scanned", hint: "Read from a photo of a bill or receipt on this phone. You checked it before saving." };
    case "import": return { label: "Imported", hint: "Added from a statement or file you imported. Categories were suggested and you confirmed them." };
    case "paste": return { label: "From bank message", hint: "Added from a bank alert you pasted or shared. The app does not read your messages by itself." };
    default: return null;
  }
}
