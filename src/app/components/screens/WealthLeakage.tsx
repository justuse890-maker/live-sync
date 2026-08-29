import { useMemo, useState } from "react";
import {
  Droplets, Sparkles, ChevronDown, Repeat, UtensilsCrossed,
  Landmark, Car, PiggyBank, CreditCard, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { detectLeaks, opportunityCost, type Leak } from "../../lib/intelligence";
import { PremiumLock } from "../PremiumLock";

const catIcon: Record<Leak["category"], any> = {
  Subscriptions: Repeat,
  Dining: UtensilsCrossed,
  Banking: Landmark,
  Travel: Car,
  "Idle Cash": PiggyBank,
  Debt: CreditCard,
  "Micro Leaks": Sparkles,
  Frequency: Repeat,
  Recurring: Repeat,
};
const catTint: Record<Leak["category"], string> = {
  Subscriptions: "#F59E0B",
  Dining: "#EF4444",
  Banking: "#0EA5E9",
  Travel: "#8B5CF6",
  "Idle Cash": "#10B981",
  Debt: "#DC2626",
  "Micro Leaks": "#F97316",
  Frequency: "#8B5CF6",
  Recurring: "#0EA5E9",
};
const sevColor: Record<Leak["severity"], string> = {
  low: "#64748B", medium: "#F59E0B", high: "#DC2626",
};

export function WealthLeakage({ onBack, onUpgrade }: { onBack: () => void; onUpgrade?: () => void }) {
  const { transactions, subscriptions, assets, liabilities, addSubscription } = useStore();
  const { leaks, totalAnnual } = useMemo(
    () => detectLeaks(transactions, subscriptions, assets, liabilities),
    [transactions, subscriptions, assets, liabilities],
  );
  const tenYearCost = opportunityCost(totalAnnual, 10);
  const [showHow, setShowHow] = useState(false);

  // Group by category
  const grouped = leaks.reduce<Record<string, Leak[]>>((acc, l) => {
    (acc[l.category] ||= []).push(l);
    return acc;
  }, {});
  const categories = (Object.keys(grouped) as Leak["category"][]).sort(
    (a, b) =>
      grouped[b].reduce((s, l) => s + l.annual, 0) -
      grouped[a].reduce((s, l) => s + l.annual, 0),
  );

  return (
    <>
      <Header title="Wealth Leakage" subtitle="Where money quietly escapes" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-white p-5">
            <div className="flex items-center gap-2">
              <Droplets className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Annual leakage detected</div>
            </div>
            <div className="font-display mt-2" style={{ fontSize: 32, fontWeight: 700 }}>
              {inr(Math.round(totalAnnual))}
            </div>
            <div className="text-xs text-white/85 mt-2 flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Invested at 12% for 10 yrs → {inr(Math.round(tenYearCost))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Issues" value={leaks.length.toString()} />
              <Stat label="High" value={leaks.filter((l) => l.severity === "high").length.toString()} />
              <Stat label="Categories" value={Object.keys(grouped).length.toString()} />
            </div>
          </div>

          {/* How it works */}
          <button
            onClick={() => setShowHow((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-2xl"
          >
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <span className="text-sm" style={{ fontWeight: 600 }}>How detection works</span>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showHow ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {showHow && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
                  <Rule color="#F59E0B" title="Subscriptions">Marked stale/unused/duplicate, or no activity 30+ days. Billing cycle respected (yearly ≠ ×12).</Rule>
                  <Rule color="#EF4444" title="Dining">Swiggy / Zomato / dining over ₹6,000 in the current period — excess over ₹4,500 cap counted.</Rule>
                  <Rule color="#0EA5E9" title="Banking">ATM, GST, AMC, annual fees parsed from transaction titles.</Rule>
                  <Rule color="#8B5CF6" title="Travel">Uber / Ola / Rapido above ₹4,000/mo — excess over ₹2,500 counted.</Rule>
                  <Rule color="#10B981" title="Idle Cash">Cash/savings above 6× monthly expense earning &lt;4%. Opportunity cost = 4% delta vs liquid fund.</Rule>
                  <Rule color="#DC2626" title="Debt">Any liability above 14% interest — annual interest paid is the leak.</Rule>
                  <div className="pt-1 border-t border-border/60 mt-2">
                    Detection runs locally on your device. We don't share these patterns with third parties.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {leaks.length === 0 && (
            <div className="bg-card rounded-2xl p-6 border border-border/60 text-center">
              <Droplets className="size-6 mx-auto text-emerald-600 mb-2" />
              <div className="text-sm" style={{ fontWeight: 700 }}>No leaks detected</div>
              <div className="text-xs text-muted-foreground mt-1">
                Add transactions, assets, and liabilities for fuller detection.
              </div>
            </div>
          )}

          {/* The summary is free; detailed leak evidence and fixes are Pro. */}
          <PremiumLock feature="leakage" title="See every leak and fix" description="Your free summary is ready. Upgrade to Pro to see each leak, its evidence, and one-tap fixes." onUpgrade={onUpgrade}>
          {categories.map((cat) => {
            const list = grouped[cat];
            const Icon = catIcon[cat];
            const tint = catTint[cat];
            const subtotal = list.reduce((s, l) => s + l.annual, 0);
            return (
              <div key={cat}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: tint + "18", color: tint }}>
                      <Icon className="size-3.5" />
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>{cat}</span>
                  </div>
                  <span className="text-xs text-rose-600" style={{ fontWeight: 700 }}>
                    {inr(Math.round(subtotal))}/yr
                  </span>
                </div>
                <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
                  {list.map((l) => (
                    <div key={l.id} className="p-4 border-b border-border/60 last:border-0">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1.5 size-2 rounded-full shrink-0"
                          style={{ background: sevColor[l.severity] }}
                          aria-label={l.severity}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm truncate" style={{ fontWeight: 700 }}>{l.title}</div>
                            <div className="text-sm text-rose-600 shrink-0" style={{ fontWeight: 700 }}>{inr(Math.round(l.annual))}/yr</div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[10px] px-1.5 py-px rounded uppercase tracking-wider"
                              style={{ background: sevColor[l.severity] + "1A", color: sevColor[l.severity], fontWeight: 600 }}
                            >
                              {l.severity}
                            </span>
                            <span className="text-xs text-muted-foreground">10-yr cost: {inr(Math.round(opportunityCost(l.annual, 10)))}</span>
                          </div>
                          <div className="text-xs text-foreground/80 mt-2 leading-relaxed">{l.tip}</div>
                          {l.category === "Recurring" && (
                            <button
                              onClick={() => addSubscription({ name: l.title.replace(" appears to recur monthly", ""), cost: Math.round(l.annual / 12), renewal: "", category: "Detected", status: "active", icon: "repeat", period: "monthly" })}
                              className="mt-3 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary"
                              style={{ fontWeight: 700 }}
                            >
                              Track as subscription
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          </PremiumLock>
        </div>
      </Screen>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm py-1.5">
      <div className="text-base" style={{ fontWeight: 700 }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Rule({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-1 size-1.5 rounded-full shrink-0" style={{ background: color }} />
      <div>
        <span className="text-foreground" style={{ fontWeight: 600 }}>{title}.</span> {children}
      </div>
    </div>
  );
}
