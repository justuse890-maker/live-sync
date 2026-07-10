import { useMemo, useState } from "react";
import { Car, Briefcase, Banknote, CheckCircle2, AlertTriangle } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { simulate, netWorth, monthlyFlow, opportunityCost } from "../../lib/intelligence";

type Mode = "buy" | "quit" | "prepay";
const tabs: { id: Mode; label: string; icon: any }[] = [
  { id: "buy", label: "Big purchase", icon: Car },
  { id: "quit", label: "Quit job", icon: Briefcase },
  { id: "prepay", label: "Prepay loan", icon: Banknote },
];

export function Simulator({ onBack }: { onBack: () => void }) {
  const { transactions, assets, liabilities } = useStore();
  const flow = useMemo(() => monthlyFlow(transactions, 0), [transactions]);
  const nw = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);
  const [mode, setMode] = useState<Mode>("buy");

  return (
    <>
      <Header title="Decision Simulator" subtitle="What if…" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="flex gap-2">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setMode(t.id)} className={`flex-1 py-2.5 rounded-xl text-xs flex flex-col items-center gap-1 ${mode === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`} style={{ fontWeight: 600 }}>
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>

          {mode === "buy" && <BuySim income={flow.income} expense={flow.expense} fund={Math.max(0, nw.netWorth * 0.2)} />}
          {mode === "quit" && <QuitSim expense={flow.expense} liquid={Math.max(0, nw.totalAssets)} />}
          {mode === "prepay" && <PrepaySim liabilities={liabilities} />}
        </div>
      </Screen>
    </>
  );
}

function BuySim({ income, expense, fund }: { income: number; expense: number; fund: number }) {
  const [price, setPrice] = useState(1500000);
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(9.5);
  const r = useMemo(() => simulate({ kind: "buy", price, downPct: down, loanYears: years, loanRate: rate, monthlyExpense: expense || 60000, monthlyIncome: income || 100000, emergencyFund: fund }), [price, down, years, rate, income, expense, fund]) as ReturnType<typeof simulate> & { emi: number; totalInterest: number; newSavingsRate: number; runwayHit: number; safe: boolean };
  const oppCost = opportunityCost(price * down / 100, 10);

  return (
    <>
      <InputCard>
        <Num label="Price (₹)" value={price} onChange={setPrice} />
        <Num label="Down payment %" value={down} onChange={setDown} />
        <Num label="Loan tenure (years)" value={years} onChange={setYears} />
        <Num label="Loan rate % p.a." value={rate} onChange={setRate} decimal />
      </InputCard>
      <Verdict ok={r.safe} text={r.verdict} />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="EMI" value={inr(Math.round(r.emi))} />
        <Stat label="Total interest" value={inr(Math.round(r.totalInterest))} />
        <Stat label="New savings rate" value={`${r.newSavingsRate.toFixed(0)}%`} />
        <Stat label="Down-payment opp. cost (10 yr @ 12%)" value={inr(Math.round(oppCost))} />
      </div>
    </>
  );
}

function QuitSim({ expense, liquid }: { expense: number; liquid: number }) {
  const [exp, setExp] = useState(expense || 60000);
  const [liq, setLiq] = useState(liquid || 500000);
  const [side, setSide] = useState(0);
  const r = useMemo(() => simulate({ kind: "quit", monthlyExpense: exp, liquidAssets: liq, sideIncome: side }), [exp, liq, side]) as { monthsRunway: number; risk: string; verdict: string };
  return (
    <>
      <InputCard>
        <Num label="Monthly expense (₹)" value={exp} onChange={setExp} />
        <Num label="Liquid assets (₹)" value={liq} onChange={setLiq} />
        <Num label="Side income (₹/mo)" value={side} onChange={setSide} />
      </InputCard>
      <Verdict ok={r.risk === "low"} text={r.verdict} />
      <Stat label="Months of runway" value={isFinite(r.monthsRunway) ? `${r.monthsRunway.toFixed(1)} months` : "∞"} />
    </>
  );
}

function PrepaySim({ liabilities }: { liabilities: any[] }) {
  const first = liabilities[0];
  const [out, setOut] = useState(first?.outstanding || 1500000);
  const [rate, setRate] = useState(first?.interestRate || 8.5);
  const [yrs, setYrs] = useState(10);
  const [lump, setLump] = useState(300000);
  const [alt, setAlt] = useState(12);
  const r = useMemo(() => simulate({ kind: "prepay", outstanding: out, rate, remainingYears: yrs, lumpsum: lump, alternateReturn: alt }), [out, rate, yrs, lump, alt]) as { interestSaved: number; altGrowth: number; better: string; verdict: string };
  return (
    <>
      <InputCard>
        <Num label="Outstanding loan (₹)" value={out} onChange={setOut} />
        <Num label="Loan rate % p.a." value={rate} onChange={setRate} decimal />
        <Num label="Remaining years" value={yrs} onChange={setYrs} />
        <Num label="Lumpsum available (₹)" value={lump} onChange={setLump} />
        <Num label="Alternate investment return % p.a." value={alt} onChange={setAlt} decimal />
      </InputCard>
      <Verdict ok text={r.verdict} />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Interest saved if prepaid" value={inr(Math.round(r.interestSaved))} />
        <Stat label="Investment growth instead" value={inr(Math.round(r.altGrowth))} />
      </div>
    </>
  );
}

function InputCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/60">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display mt-1" style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Verdict({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`rounded-2xl p-4 ${ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
      <div className="flex items-center gap-2 text-sm" style={{ fontWeight: 700 }}>
        {ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        {text}
      </div>
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
