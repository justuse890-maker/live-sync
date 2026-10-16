import { useMemo } from "react";
import { Info, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { CountUp } from "./FlowFx";
import { inr } from "./types";
import type { Hero } from "../lib/homeHero";
import { safeToSpendBreakdown, type DueItem } from "../lib/safeToSpend";

/** "Show the math" for the Home figure: every rupee added or subtracted, and what is deliberately left out. */
export function SafeToSpendSheet({ open, onClose, hero, dueItems, isCurrentMonth, monthLabel }: {
  open: boolean;
  onClose: () => void;
  hero: Hero;
  dueItems: DueItem[];
  isCurrentMonth: boolean;
  monthLabel: string;
}) {
  const b = useMemo(() => safeToSpendBreakdown({ hero, dueItems, isCurrentMonth }), [hero, dueItems, isCurrentMonth]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle>How “safe to spend” is worked out</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">{monthLabel}</div>
          <div className="rounded-xl border divide-y">
            {b.lines.map((l, i) => (
              <div key={`${l.label}-${i}`} className="ls-row-in flex items-center justify-between gap-3 px-3 py-2" style={{ ["--i" as string]: i }}>
                <span className="flex items-center gap-2 min-w-0">
                  {l.kind === "plus" ? <Plus className="size-3.5 text-emerald-600 shrink-0" aria-label="plus" /> : <Minus className="size-3.5 text-rose-500 shrink-0" aria-label="minus" />}
                  <span className="truncate">{l.label}</span>
                  {l.overdue && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 rounded">Overdue</span>}
                </span>
                <b className="shrink-0">{inr(l.amount)}</b>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 bg-muted/40">
              <span className="font-bold">{b.short ? "Short by" : "Safe to spend"}</span>
              <b className={`text-base ${b.short ? "text-rose-700" : "text-emerald-700"}`}>
                <CountUp value={Math.abs(b.result)} format={(n) => inr(Math.round(n))} ms={600} />
              </b>
            </div>
          </div>
          {b.notes.map((n) => (
            <div key={n} className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded-xl p-2.5"><Info className="size-3.5 mt-0.5 shrink-0" /><span>{n}</span></div>
          ))}
          <p className="text-[11px] text-muted-foreground">Own-account transfers are never counted as spending or income. This is a planning figure from what you have recorded, not a bank balance.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
