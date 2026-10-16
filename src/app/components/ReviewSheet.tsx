import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tx, useStore } from "../store";
import { REVIEW_REASON_TEXT, needsReview } from "../lib/needsReview";
import { formatInr } from "../lib/money";
import { safeText } from "../lib/safeText";

const KEY = "ls_review_dismissed";
const readDismissed = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const writeDismissed = (v: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(-300))); } catch { /* storage unavailable: items reappear next launch */ } };

/** Shared by the Home card and the sheet so both show the same count. */
export function useReviewItems() {
  const { transactions } = useStore();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const items = useMemo(() => needsReview(transactions as Tx[], { dismissed: new Set(dismissed) }), [transactions, dismissed]);
  const dismiss = (id: string) => { const next = [...dismissed, id]; setDismissed(next); writeDismissed(next); };
  return { items, dismiss };
}

/** "Worth a second look": each row says why, and the user decides. Nothing changes unless they tap an action. */
export function ReviewSheet({ open, onClose, onEdit, items, dismiss }: {
  open: boolean;
  onClose: () => void;
  onEdit: (tx: Tx) => void;
  items: ReturnType<typeof useReviewItems>["items"];
  dismiss: (id: string) => void;
}) {
  const { categories, updateTransaction } = useStore();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="size-4" /> Worth a second look</DialogTitle></DialogHeader>
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
          {items.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">All clear. Nothing needs a second look.</p>}
          {items.slice(0, 12).map(({ tx, reasons }, i) => {
            const t = tx as Tx;
            return (
              <div key={t.id} className="ls-row-in rounded-xl border p-3 space-y-2" style={{ ["--i" as string]: i }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{safeText(t.merchant) || safeText(t.title) || "Untitled entry"}</div>
                    <div className="text-[11px] text-muted-foreground">{String(t.date).slice(0, 10)} · {t.category || "No category"}</div>
                  </div>
                  <b className="text-sm shrink-0">{formatInr(t.amount)}</b>
                </div>
                <div className="flex flex-wrap gap-1">
                  {reasons.map((r) => <span key={r} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">{REVIEW_REASON_TEXT[r]}</span>)}
                </div>
                <div className="flex items-center gap-2">
                  {reasons.includes("no_category") && t.type === "expense" && (
                    <select
                      aria-label="Choose a category"
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) void updateTransaction({ ...t, category: e.target.value }); }}
                      className="flex-1 min-w-0 h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    >
                      <option value="">Choose category…</option>
                      {categories.filter((c) => c !== "Income" && c !== "Other").map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  <button onClick={() => { onClose(); onEdit(t); }} className="h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1 active:scale-95"><Pencil className="size-3" /> Edit</button>
                  <button onClick={() => dismiss(t.id)} className="h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1 active:scale-95"><Check className="size-3" /> Looks fine</button>
                </div>
              </div>
            );
          })}
          {items.length > 12 && <p className="text-[11px] text-muted-foreground text-center">{items.length - 12} more after these.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
