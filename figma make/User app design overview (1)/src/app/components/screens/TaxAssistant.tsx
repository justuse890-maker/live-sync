import { useMemo, useState } from "react";
import { Calculator, Calendar, TrendingDown, Info, CheckCircle2, Globe } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useCountry } from "../../lib/useCountry";
import { computeTax as computeTaxPack, fmt } from "../../lib/taxPacks";

// India FY 2025-26 (AY 2026-27) — New regime default after Budget 2025
const newSlabs = [
  { from: 0, to: 400000, rate: 0 },
  { from: 400000, to: 800000, rate: 5 },
  { from: 800000, to: 1200000, rate: 10 },
  { from: 1200000, to: 1600000, rate: 15 },
  { from: 1600000, to: 2000000, rate: 20 },
  { from: 2000000, to: 2400000, rate: 25 },
  { from: 2400000, to: Infinity, rate: 30 },
];

const oldSlabs = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 5 },
  { from: 500000, to: 1000000, rate: 20 },
  { from: 1000000, to: Infinity, rate: 30 },
];

const NEW_STD_DED = 75000;
const OLD_STD_DED = 50000;
const NEW_REBATE_LIMIT = 1200000; // 87A under new regime FY25-26
const OLD_REBATE_LIMIT = 500000;
const CESS = 0.04;

function computeTax(taxable: number, slabs: typeof newSlabs) {
  let tax = 0;
  for (const s of slabs) {
    if (taxable > s.from) {
      const slice = Math.min(taxable, s.to) - s.from;
      tax += (slice * s.rate) / 100;
    }
  }
  return Math.max(0, tax);
}

const taxCalendar = [
  { date: "2026-06-15", label: "Advance tax — Q1 (15%)" },
  { date: "2026-07-31", label: "ITR filing — FY 2025-26 (non-audit)" },
  { date: "2026-09-15", label: "Advance tax — Q2 (45% cumulative)" },
  { date: "2026-12-15", label: "Advance tax — Q3 (75% cumulative)" },
  { date: "2027-03-15", label: "Advance tax — Q4 (100%)" },
  { date: "2027-03-31", label: "FY 2026-27 ends — invest for 80C/80D" },
];

export function TaxAssistant({ onBack }: { onBack: () => void }) {
  return <TaxAssistantInner onBack={onBack} />;
}

function NonIndiaTax({ onBack }: { onBack: () => void }) {
  const { pack } = useCountry();
  const [income, setIncome] = useState(1200000);
  const tax = computeTaxPack(income, pack.code);
  return (
    <>
      <Header title="Tax Assistant" subtitle={`${pack.flag} ${pack.name}`} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2"><Globe className="size-5" /><div className="text-sm" style={{ fontWeight: 700 }}>{pack.name} tax pack</div></div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">{pack.notes}</p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="text-xs text-muted-foreground mb-2">Annual income</div>
            <input type="number" value={income} onChange={(e) => setIncome(Number(e.target.value) || 0)} className="w-full bg-muted/40 rounded-lg px-3 py-2 text-base" />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Estimated tax</div>
              <div className="text-xl font-semibold">{fmt(tax, pack.code)}</div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">After standard deduction of {fmt(pack.standardDeduction, pack.code)}</div>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2" style={{ fontWeight: 600 }}>Slabs</div>
            <div className="space-y-1.5">
              {pack.slabs.map((s, i) => {
                const prev = i === 0 ? 0 : (pack.slabs[i - 1].upTo ?? 0);
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{fmt(prev, pack.code)} – {s.upTo === null ? "above" : fmt(s.upTo, pack.code)}</span>
                    <span style={{ fontWeight: 600 }}>{(s.rate * 100).toFixed(s.rate < 0.1 ? 1 : 0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function TaxAssistantInner({ onBack }: { onBack: () => void }) {
  const { country } = useCountry();
  if (country !== "IN") return <NonIndiaTax onBack={onBack} />;
  return <TaxAssistantIndia onBack={onBack} />;
}

function TaxAssistantIndia({ onBack }: { onBack: () => void }) {
  const [gross, setGross] = useState(1200000);
  const [c80C, set80C] = useState(150000);
  const [c80D, set80D] = useState(25000);
  const [nps, setNps] = useState(50000);
  const [hra, setHra] = useState(0);
  const [homeLoan, setHomeLoan] = useState(0);

  const result = useMemo(() => {
    // New regime: only standard deduction + employer NPS (kept simple)
    const newTaxable = Math.max(0, gross - NEW_STD_DED);
    let newTax = computeTax(newTaxable, newSlabs);
    if (newTaxable <= NEW_REBATE_LIMIT) newTax = 0; // 87A
    newTax = newTax * (1 + CESS);

    // Old regime: all deductions
    const oldDeductions = OLD_STD_DED + Math.min(c80C, 150000) + Math.min(c80D, 100000) + Math.min(nps, 50000) + hra + Math.min(homeLoan, 200000);
    const oldTaxable = Math.max(0, gross - oldDeductions);
    let oldTax = computeTax(oldTaxable, oldSlabs);
    if (oldTaxable <= OLD_REBATE_LIMIT) oldTax = 0;
    oldTax = oldTax * (1 + CESS);

    return {
      newTaxable, newTax,
      oldTaxable, oldDeductions, oldTax,
      better: oldTax < newTax ? "old" : "new",
      savings: Math.abs(oldTax - newTax),
    };
  }, [gross, c80C, c80D, nps, hra, homeLoan]);

  return (
    <>
      <Header title="Tax Assistant" subtitle="FY 2025-26 · AY 2026-27" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2">
              <Calculator className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Regime comparison</div>
            </div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              Estimated under Budget 2025 slabs. Final liability depends on TDS, capital gains and surcharges. For filing, consult a CA or use the Income Tax e-filing portal.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>Your figures</div>
            <Num label="Gross annual income (salary)" value={gross} set={setGross} />
            <Num label="80C — ELSS / PPF / EPF / LIC (max 1.5L)" value={c80C} set={set80C} />
            <Num label="80D — Health insurance (self+parents, max 1L)" value={c80D} set={set80D} />
            <Num label="80CCD(1B) — NPS additional (max 50K)" value={nps} set={setNps} />
            <Num label="HRA exemption claimed" value={hra} set={setHra} />
            <Num label="Section 24 — Home loan interest (max 2L)" value={homeLoan} set={setHomeLoan} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <RegimeCard title="New regime" subtitle="Default · simpler" taxable={result.newTaxable} tax={result.newTax} highlight={result.better === "new"} />
            <RegimeCard title="Old regime" subtitle="With deductions" taxable={result.oldTaxable} tax={result.oldTax} highlight={result.better === "old"} />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-emerald-800" style={{ fontWeight: 700 }}>
              <TrendingDown className="size-4" />
              <span className="text-sm">{result.better === "old" ? "Old regime" : "New regime"} saves you {inr(result.savings)}</span>
            </div>
            <div className="text-xs text-emerald-700/80 mt-1">Based on the inputs above. Re-check after any salary or investment change.</div>
          </div>

          <Section title="New regime slabs (FY 2025-26)">
            {newSlabs.map((s) => (
              <SlabRow key={s.from} from={s.from} to={s.to} rate={s.rate} />
            ))}
            <div className="text-xs text-muted-foreground p-3 border-t border-border/60">+ 4% Health & Education Cess. Rebate u/s 87A makes income up to ₹12L tax-free.</div>
          </Section>

          <Section title="Tax calendar">
            {taxCalendar.map((c) => (
              <div key={c.date} className="flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="size-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm" style={{ fontWeight: 600 }}>{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.date}</div>
                </div>
              </div>
            ))}
          </Section>

          <div className="bg-card rounded-2xl p-4 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-2 text-foreground mb-2" style={{ fontWeight: 700 }}>
              <Info className="size-3.5 text-primary" /> Source & disclaimer
            </div>
            Slabs reflect Union Budget 2025 amendments to the Income Tax Act, 1961. We compute estimates only — LiveSync does not file returns or transmit your numbers to the Income Tax Department. Always reconcile against Form 26AS / AIS before filing.
          </div>
        </div>
      </Screen>
    </>
  );
}

function Num({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>{label}</div>
      <input
        inputMode="numeric"
        value={value === 0 ? "" : value}
        onChange={(e) => set(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
        placeholder="0"
        className="w-full bg-muted/60 rounded-xl px-3.5 py-2 text-sm"
      />
    </div>
  );
}

function RegimeCard({ title, subtitle, taxable, tax, highlight }: { title: string; subtitle: string; taxable: number; tax: number; highlight: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${highlight ? "border-primary bg-primary/5" : "border-border/60 bg-card"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm" style={{ fontWeight: 700 }}>{title}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{subtitle}</div>
        </div>
        {highlight && <CheckCircle2 className="size-4 text-primary" />}
      </div>
      <div className="mt-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxable</div>
        <div className="text-sm" style={{ fontWeight: 600 }}>{inr(taxable)}</div>
      </div>
      <div className="mt-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tax (incl. cess)</div>
        <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{inr(Math.round(tax))}</div>
      </div>
    </div>
  );
}

function SlabRow({ from, to, rate }: { from: number; to: number; rate: number }) {
  const range = to === Infinity ? `Above ${inr(from)}` : `${inr(from)} — ${inr(to)}`;
  return (
    <div className="flex justify-between text-sm p-3.5 border-b border-border/60 last:border-0">
      <span>{range}</span>
      <span style={{ fontWeight: 700 }}>{rate}%</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">{children}</div>
    </div>
  );
}
