import { useMemo, useState } from "react";
import { Flame, Mountain, Coffee, Crown } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { fire, monthlyFlow, netWorth } from "../../lib/intelligence";

export function FIRE({ onBack }: { onBack: () => void }) {
  const { transactions, assets, liabilities } = useStore();
  const flow = useMemo(() => monthlyFlow(transactions, 0), [transactions]);
  const { netWorth: nw } = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);

  const [monthlyExpense, setMonthlyExpense] = useState(flow.expense || 60000);
  const [invested, setInvested] = useState(Math.max(0, nw));
  const [age, setAge] = useState(28);
  const [rate, setRate] = useState(11);

  const r = useMemo(() => fire(monthlyExpense, invested, age, rate), [monthlyExpense, invested, age, rate]);

  return (
    <>
      <Header title="FIRE Engine" subtitle="Financial Independence" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2">
              <Flame className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Your FIRE number</div>
            </div>
            <div className="font-display mt-1" style={{ fontSize: 30, fontWeight: 700 }}>{inr(Math.round(r.fireNumber))}</div>
            <div className="text-xs text-white/80 mt-1">25× annual expenses at 4% safe withdrawal rate</div>

            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/80">Progress</span>
                <span style={{ fontWeight: 700 }}>{r.progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${r.progress}%` }} />
              </div>
              {r.projectedAge != null && (
                <div className="text-xs text-white/85 mt-2">At {rate}% returns, you reach FIRE at age <span style={{ fontWeight: 700 }}>{r.projectedAge}</span></div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>Inputs</div>
            <Num label="Monthly expense (₹)" value={monthlyExpense} onChange={setMonthlyExpense} />
            <Num label="Invested so far (₹)" value={invested} onChange={setInvested} />
            <Num label="Current age" value={age} onChange={setAge} />
            <Num label="Expected return % p.a." value={rate} onChange={setRate} decimal />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card icon={<Coffee className="size-4" />} title="Lean FIRE" value={inr(Math.round(r.leanFire))} sub="Frugal lifestyle (70%)" tint="#0EA5E9" />
            <Card icon={<Mountain className="size-4" />} title="Coast FIRE" value={inr(Math.round(r.coast))} sub="Stop investing, coast to 60" tint="#10B981" />
            <Card icon={<Flame className="size-4" />} title="FIRE" value={inr(Math.round(r.fireNumber))} sub="Current lifestyle" tint="#1E40AF" />
            <Card icon={<Crown className="size-4" />} title="Fat FIRE" value={inr(Math.round(r.fatFire))} sub="Premium lifestyle (1.5×)" tint="#8B5CF6" />
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            Projections assume returns compound on current invested capital with no further contributions. To see contribution-based paths, set up SIPs and let LiveSync re-project monthly.
          </div>
        </div>
      </Screen>
    </>
  );
}

function Card({ icon, title, value, sub, tint }: { icon: React.ReactNode; title: string; value: string; sub: string; tint: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/60">
      <div className="size-8 rounded-lg flex items-center justify-center mb-2" style={{ background: tint + "15", color: tint }}>{icon}</div>
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="font-display mt-0.5" style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function Num({ label, value, onChange, decimal }: { label: string; value: number; onChange: (n: number) => void; decimal?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>{label}</div>
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const v = e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
          onChange(v === "" ? 0 : Number(v));
        }}
        className="w-full bg-muted/60 rounded-xl px-3.5 py-2 text-sm"
      />
    </div>
  );
}
