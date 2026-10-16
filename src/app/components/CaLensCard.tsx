import { useMemo } from "react";
import { ChevronRight, Scale } from "lucide-react";
import { useStore } from "../store";
import { useMonthClose } from "../lib/useMonthClose";
import { usePersona } from "../lib/usePersona";
import { currentFY } from "../lib/fy";
import { getCurrentMonthKey, formatMonthName, shiftMonth } from "../lib/dateUtils";
import { tap } from "../lib/feedback";
import type { ScreenId } from "./types";

/** Home entry to the CA Lens. Nudges to close last month once; otherwise just opens the statements. */
export function CaLensCard({ go }: { go: (id: ScreenId) => void }) {
  const { transactions } = useStore();
  const { records, loaded } = useMonthClose();
  const { mode } = usePersona();
  const fy = currentFY();
  const last = shiftMonth(getCurrentMonthKey(), -1);
  const lastHasEntries = useMemo(() => transactions.some((t) => String(t.date).slice(0, 7) === last), [transactions, last]);
  const needsClose = loaded && lastHasEntries && !records[last] && mode === "books";
  if (transactions.length === 0) return null;

  return (
    <button onClick={() => { tap(); go("calens"); }} className="w-full text-left bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-3 active:scale-[0.99] ls-rise">
      <div className="size-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0"><Scale className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900">{needsClose ? `Close ${formatMonthName(last)}` : `Your ${fy.label} at a glance`}</div>
        <div className="text-xs text-slate-500 leading-snug">{needsClose ? "Two minutes to tidy the month and save its figures." : mode === "simple" ? "What came in, what went out, what to look at." : "Statements, health check and tax-ready totals."}</div>
      </div>
      <ChevronRight className="size-4 text-slate-400 shrink-0" />
    </button>
  );
}
