import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, CalendarClock, Check, Copy, Info, Lock, Printer, Unlock } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr, ScreenId } from "../types";
import { useStore } from "../../store";
import { currentFY, shiftFY } from "../../lib/fy";
import { buildLens, statementsAsText, Lens } from "../../lib/caLens";
import { computeSnapshot } from "../../lib/snapshot";
import { currentInstallment } from "../../lib/loanEngine";
import { readEmiAlertPct } from "../EmiCommand";
import { usePersona } from "../../lib/usePersona";
import { filterScope, ScopeFilter } from "../../lib/persona";
import { useMonthClose } from "../../lib/useMonthClose";
import { buildChecklist, closedStreak, driftSince, makeCloseRecord, openItems } from "../../lib/monthClose";
import { incomeExpenditure } from "../../lib/statements";
import { TAX_TAGS, capFor } from "../../lib/taxTags";
import { Band, Ratio } from "../../lib/ratios";
import { getCurrentMonthKey, formatMonthName, shiftMonth } from "../../lib/dateUtils";
import { localISO } from "../../lib/intelligence";
import { notify } from "../../lib/notify";
import { api } from "../../lib/api";
import { buildCaPack, taxEntriesCsv } from "../../lib/caPack";
import { shareText } from "../../lib/shareOut";

type Tab = "overview" | "statements" | "tax" | "close";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "statements", label: "Statements" }, { id: "tax", label: "Tax-ready" }, { id: "close", label: "Close month" },
];

const BAND: Record<Band, { label: string; chip: string; bar: string }> = {
  good: { label: "On track", chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  watch: { label: "Watch", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  low: { label: "Needs work", chip: "bg-rose-100 text-rose-800", bar: "bg-rose-500" },
  unknown: { label: "Add data", chip: "bg-slate-100 text-slate-600", bar: "bg-slate-300" },
};

export function CALens({ onBack, go }: { onBack: () => void; go: (id: ScreenId) => void }) {
  const store = useStore();
  const { mode, persona, setMode } = usePersona();
  const [fy, setFy] = useState(currentFY());
  const [tab, setTab] = useState<Tab>("overview");
  const [senior, setSenior] = useState(false);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const today = localISO();
  const thisMonth = getCurrentMonthKey();

  const snap = useMemo(() => computeSnapshot(store as any, thisMonth), [
    store.transactions, store.assets, store.liabilities, store.investments, store.gold, store.properties,
    store.structuredLoans, store.loans, store.budgets, store.buckets, store.goals, store.sips, store.insurance, thisMonth,
  ]);

  const lens: Lens = useMemo(() => buildLens({
    fy, today,
    transactions: filterScope(store.transactions, persona === "business" ? scope : "all") as any,
    assetLines: snap.netWorth.assetLines,
    liabilityLines: snap.netWorth.liabLines,
    liquidAssets: snap.liquid.total,
    monthlyEmi: store.structuredLoans.filter((l) => !l.closed).reduce((s, l) => s + currentInstallment(l).amount, 0),
    lifeCover: store.insurance.filter((p) => p.type === "life").reduce((s, p) => s + (Number(p.coverageAmount) || 0), 0),
    persona, emiAlertPct: readEmiAlertPct(), seniorCitizen: senior,
  }), [fy, today, store.transactions, snap, store.structuredLoans, store.insurance, persona, senior, scope]);

  const simple = mode === "simple";

  return (
    <>
      <Header title="CA Lens" subtitle={fy.label} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-28 space-y-4" id="ca-lens">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button aria-label="Previous year" onClick={() => setFy(shiftFY(fy, -1))} className="size-8 rounded-lg hover:bg-card flex items-center justify-center"><ChevronLeft className="size-4" /></button>
              <span className="text-xs font-bold px-2 min-w-[74px] text-center">{fy.label}</span>
              <button aria-label="Next year" onClick={() => setFy(shiftFY(fy, 1))} disabled={fy.startYear >= currentFY().startYear} className="size-8 rounded-lg hover:bg-card flex items-center justify-center disabled:opacity-30"><ChevronRight className="size-4" /></button>
            </div>
            <div className="flex bg-muted rounded-xl p-1 text-xs font-bold" role="group" aria-label="View mode">
              {(["simple", "books"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg ${mode === m ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>{m === "simple" ? "Simple" : "Books"}</button>
              ))}
            </div>
          </div>

          {persona === "business" && !simple && (
            <div className="flex bg-muted rounded-xl p-1 text-xs font-bold" role="group" aria-label="Show">
              {([["all", "All"], ["personal", "Personal"], ["business", "Business"]] as const).map(([id, l]) => (
                <button key={id} onClick={() => setScope(id)} className={`flex-1 py-2 rounded-lg ${scope === id ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          )}

          {store.transferSuggestions.length > 0 && lens.hasData && (
            <button onClick={() => go("transactions")} className="w-full text-left flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 active:scale-[0.99]">
              <Info className="size-4 mt-px shrink-0 text-sky-700" />
              <span><b>{store.transferSuggestions.length} possible transfer{store.transferSuggestions.length > 1 ? "s" : ""} between your own accounts</b> {store.transferSuggestions.length > 1 ? "are" : "is"} still counted as income and spending. Confirm {store.transferSuggestions.length > 1 ? "them" : "it"} for exact statements.</span>
            </button>
          )}

          {!lens.hasData ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center space-y-2">
              <div className="text-sm font-bold text-slate-800">Nothing recorded in {fy.label} yet</div>
              <p className="text-xs text-muted-foreground leading-relaxed">Add your income and expenses and this page turns them into the statements and health check a CA would prepare.</p>
              <button onClick={() => go("transactions")} className="mt-1 inline-flex items-center gap-1.5 bg-[#1E3A8A] text-white text-xs font-bold px-4 py-2.5 rounded-xl">Add entries <ArrowRight className="size-3.5" /></button>
            </div>
          ) : simple ? (
            <SimpleView lens={lens} go={go} />
          ) : (
            <>
              <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto" role="tablist">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold ${tab === t.id ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>{t.label}</button>
                ))}
              </div>
              {tab === "overview" && <Overview lens={lens} go={go} />}
              {tab === "statements" && <Statements lens={lens} senior={senior} />}
              {tab === "tax" && <TaxReady lens={lens} senior={senior} setSenior={setSenior} />}
              {tab === "close" && <CloseMonth go={go} />}
            </>
          )}

          <p className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5"><Info className="size-3 mt-px shrink-0" />Prepared from the entries you recorded in LiveSync. Not audited, not a bank or tax-authority statement, and not financial or tax advice. Benchmarks are common rules of thumb.</p>
        </div>
      </Screen>
    </>
  );
}

// ───────────────────────── Simple ─────────────────────────
function SimpleView({ lens, go }: { lens: Lens; go: (id: ScreenId) => void }) {
  const { ie } = lens;
  const spent = ie.needs.total + ie.wants.total + ie.debtService.total;
  const kept = ie.income.total - spent;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Big label="Came in" value={ie.income.total} tone="emerald" />
        <Big label="Went out" value={spent} tone="rose" />
        <Big label={kept >= 0 ? "Kept" : "Short by"} value={Math.abs(kept)} tone={kept >= 0 ? "emerald" : "rose"} />
      </div>
      <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-2">
        <div className="text-sm font-bold text-slate-900">Where it went</div>
        {[["Essentials (rent, bills, groceries)", ie.needs.total], ["Fun & shopping", ie.wants.total], ["EMI & repayments", ie.debtService.total], ["Saved / invested", ie.savings.total]].map(([l, v]) => (
          <div key={l as string} className="flex justify-between text-sm"><span className="text-slate-600">{l}</span><b>{inr(v as number)}</b></div>
        ))}
      </div>
      {lens.ratioSummary.priorities.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-2.5">
          <div className="text-sm font-bold text-slate-900">Three things to look at</div>
          {lens.ratioSummary.priorities.map((r) => (
            <button key={r.key} onClick={() => go(r.action.screen as ScreenId)} className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/50 active:scale-[0.99]">
              <span className={`mt-0.5 size-2.5 rounded-full shrink-0 ${BAND[r.band].bar}`} />
              <span className="text-xs leading-snug"><b className="block text-slate-900">{r.label}: {r.display}</b><span className="text-slate-600">{r.meaning}</span></span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Want statements, tax totals and the full health check? Switch to <b>Books</b> at the top.</p>
    </div>
  );
}

const Big = ({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" }) => (
  <div className={`rounded-2xl p-3 ${tone === "emerald" ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
    <div className={`text-[11px] font-semibold ${tone === "emerald" ? "text-emerald-800" : "text-rose-800"}`}>{label}</div>
    <div className="text-base font-black text-slate-900 mt-0.5 break-words">{inr(value)}</div>
  </div>
);

// ───────────────────────── Overview ─────────────────────────
function Overview({ lens, go }: { lens: Lens; go: (id: ScreenId) => void }) {
  const { ie, ratioSummary: rs } = lens;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border/60 p-5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Surplus so far · {lens.fy.label}</div>
        <div className={`font-display text-3xl font-black mt-1 ${ie.surplus < 0 ? "text-rose-700" : "text-emerald-700"}`}>{ie.surplus < 0 ? "−" : ""}{inr(Math.abs(ie.surplus))}</div>
        <div className="text-xs text-slate-600 mt-1">{ie.surplusRatePct === null ? "No income recorded" : `${ie.surplusRatePct.toFixed(0)}% of ${inr(ie.income.total)} income kept after living costs and EMIs`}</div>
        <div className="mt-3 text-xs font-semibold text-slate-800">{rs.scored === 0 ? "Add more data to run the health check." : `${rs.good} of ${rs.scored} health checks on track`}</div>
      </div>

      {lens.deadlines.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock className="size-4 text-primary" /> Coming up</div>
          {lens.deadlines.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs gap-3">
              <div className="min-w-0"><div className="font-semibold text-slate-800 truncate">{d.title}</div><div className="text-muted-foreground">{d.detail}</div></div>
              <div className="text-right shrink-0"><div className="font-bold text-slate-900">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div><div className="text-muted-foreground">{d.daysLeft === 0 ? "today" : `${d.daysLeft} days`}</div></div>
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground">Usual due dates — they can be extended. Advance tax applies only if your tax for the year, after TDS, is ₹10,000 or more. Check the Income Tax portal.</div>
        </div>
      )}

      <div>
        <div className="text-sm font-bold text-slate-900 mb-2">Health check</div>
        <div className="grid grid-cols-1 gap-2.5">{lens.ratios.map((r) => <RatioCard key={r.key} r={r} go={go} />)}</div>
      </div>
    </div>
  );
}

function RatioCard({ r, go }: { r: Ratio; go: (id: ScreenId) => void }) {
  const b = BAND[r.band];
  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-xs font-semibold text-muted-foreground">{r.label}</div><div className="text-2xl font-black text-slate-900 leading-tight">{r.display}</div></div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.chip}`}>{b.label}</span>
      </div>
      <div className="text-xs text-slate-600 leading-snug">{r.meaning}</div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">Guideline: {r.benchmark}</span>
        <button onClick={() => go(r.action.screen as ScreenId)} className="text-[11px] font-bold text-primary flex items-center gap-1">{r.action.label}<ArrowRight className="size-3" /></button>
      </div>
    </div>
  );
}

// ───────────────────────── Statements ─────────────────────────
function Statements({ lens, senior }: { lens: Lens; senior: boolean }) {
  const [which, setWhich] = useState<"ie" | "cf" | "bs">("ie");
  const { transactions, structuredLoans } = useStore();
  const [busy, setBusy] = useState(false);

  const sharePack = async () => {
    setBusy(true);
    try {
      const docs = await api.list<{ name: string; category?: string }>("documents").catch(() => []);
      const text = buildCaPack({ lens, txs: transactions as any, loans: structuredLoans as any, docs, fmt: inr, senior });
      const r = await shareText(`CA Pack ${lens.fy.label}`, text);
      if (r === "copied") notify.info("CA Pack copied — paste it into a message or email");
      else if (r === "failed") notify.error("Couldn't share on this device");
    } finally { setBusy(false); }
  };
  const copyTaxCsv = async () => {
    try { await navigator.clipboard.writeText(taxEntriesCsv(transactions as any, { from: lens.fy.from, to: lens.fy.to })); notify.info("Tax entries copied as a spreadsheet-ready list"); }
    catch { notify.error("Couldn't copy on this device"); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(statementsAsText(lens, inr)); notify.info("Statements copied — paste into a message or note"); }
    catch { notify.error("Couldn't copy on this device"); }
  };
  return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } #ca-print, #ca-print * { visibility: visible !important; } #ca-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; } .no-print { display: none !important; } }`}</style>
      <div className="no-print flex gap-1 bg-muted rounded-xl p-1 text-xs font-bold">
        {([["ie", "Income & Exp."], ["cf", "Cash flow"], ["bs", "Assets & Liab."]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setWhich(id)} className={`flex-1 py-2 rounded-lg ${which === id ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>

      <div id="ca-print" className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
        <div className="text-[11px] text-muted-foreground">{lens.fy.label} · {lens.range.from} to {lens.range.to}</div>
        {which === "ie" && <IncomeExp lens={lens} />}
        {which === "cf" && <CashFlowView lens={lens} />}
        {which === "bs" && <BalanceView lens={lens} />}
        <div className="text-[10px] text-muted-foreground border-t pt-2">Prepared from the user’s own LiveSync records. Not audited.</div>
      </div>

      <div className="no-print rounded-2xl border border-teal-200 bg-card p-4 space-y-2.5">
        <div className="text-sm font-bold text-slate-900">CA Pack — for your own CA</div>
        <p className="text-xs text-slate-600 leading-relaxed">The three statements, health check, every tax-tagged entry, your loans and a checklist of papers a CA will ask for — one message you can send over WhatsApp or email.</p>
        <button onClick={sharePack} disabled={busy} className="w-full h-11 rounded-xl bg-teal-700 text-white text-sm font-bold disabled:opacity-50">{busy ? "Preparing…" : "Share with my CA"}</button>
        <button onClick={copyTaxCsv} className="w-full h-10 rounded-xl border text-xs font-bold">Copy tax entries (spreadsheet)</button>
        <div className="text-[10px] text-muted-foreground">You choose where it goes. Nothing leaves your phone until you pick an app.</div>
      </div>

      <div className="no-print flex gap-2">
        <button onClick={() => window.print()} className="flex-1 h-11 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center gap-1.5"><Printer className="size-4" /> Print / Save PDF</button>
        <button onClick={copy} className="flex-1 h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5"><Copy className="size-4" /> Copy as text</button>
      </div>
    </div>
  );
}

const Row = ({ label, value, bold, indent, tone }: { label: string; value: number; bold?: boolean; indent?: boolean; tone?: "neg" | "pos" }) => (
  <div className={`flex justify-between gap-3 text-sm ${bold ? "font-bold border-t pt-1.5 mt-1" : ""} ${indent ? "pl-3 text-slate-600" : ""}`}>
    <span className="min-w-0">{label}</span>
    <span className={`shrink-0 tabular-nums ${tone === "neg" || value < 0 ? "text-rose-700" : tone === "pos" ? "text-emerald-700" : ""}`}>{value < 0 ? "−" : ""}{inr(Math.abs(value))}</span>
  </div>
);
const Head = ({ children }: { children: string }) => <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-2">{children}</div>;

function GroupRows({ title, g }: { title: string; g: Lens["ie"]["income"] }) {
  if (g.total === 0) return null;
  return <><Head>{title}</Head>{g.lines.map((l) => <Row key={l.key + l.label} label={l.label} value={l.amount} indent />)}<Row label="Total" value={g.total} bold /></>;
}

function IncomeExp({ lens }: { lens: Lens }) {
  const { ie } = lens;
  return (
    <div className="space-y-0.5">
      <div className="font-bold text-slate-900">Statement of Income & Expenditure</div>
      <GroupRows title="Income" g={ie.income} />
      <GroupRows title="Essentials" g={ie.needs} />
      <GroupRows title="Lifestyle" g={ie.wants} />
      <GroupRows title="Loan & card repayments" g={ie.debtService} />
      <div className="pt-2"><Row label="Surplus (income − costs − repayments)" value={ie.surplus} bold tone={ie.surplus >= 0 ? "pos" : "neg"} /></div>
      <GroupRows title="Savings & investments deployed" g={ie.savings} />
      <div className="pt-2"><Row label="Cash retained" value={ie.cashRetained} bold /></div>
    </div>
  );
}

function CashFlowView({ lens }: { lens: Lens }) {
  const { cf, ie } = lens;
  return (
    <div className="space-y-0.5">
      <div className="font-bold text-slate-900">Cash-Flow Statement</div>
      <Head>Operating</Head>
      <Row label="Income received" value={ie.income.total} indent />
      <Row label="Living costs (essentials + lifestyle)" value={-(ie.needs.total + ie.wants.total)} indent />
      <Row label="Net operating cash" value={cf.operating} bold />
      <Head>Financing</Head>
      <Row label="Loan & card repayments" value={cf.financing} indent />
      <Head>Investing</Head>
      <Row label="Savings & investments" value={cf.investing} indent />
      <div className="pt-2"><Row label="Net change in cash" value={cf.net} bold /></div>
      <p className="text-[11px] text-muted-foreground pt-1">Worked out from your records, not from bank balances.</p>
    </div>
  );
}

function BalanceView({ lens }: { lens: Lens }) {
  const { bs } = lens;
  if (bs.totalAssets === 0 && bs.totalLiabilities === 0) return <p className="text-sm text-muted-foreground">Add your savings, investments, property and loans under Net worth to see this statement.</p>;
  return (
    <div className="space-y-0.5">
      <div className="font-bold text-slate-900">Statement of Assets & Liabilities</div>
      <div className="text-[11px] text-muted-foreground">As on {localISO()}</div>
      <Head>Assets</Head>
      {bs.assets.map((g) => <div key={g.key}><Row label={g.label} value={g.total} /> {g.lines.length > 1 && g.lines.map((l) => <Row key={l.label} label={l.label} value={l.value} indent />)}</div>)}
      <Row label="Total assets" value={bs.totalAssets} bold />
      <Head>Liabilities</Head>
      {bs.liabilities.map((g) => <div key={g.key}><Row label={g.label} value={g.total} /> {g.lines.length > 1 && g.lines.map((l) => <Row key={l.label} label={l.label} value={l.value} indent />)}</div>)}
      <Row label="Total liabilities" value={bs.totalLiabilities} bold />
      <div className="pt-2"><Row label="Net worth" value={bs.netWorth} bold tone={bs.netWorth >= 0 ? "pos" : "neg"} /></div>
    </div>
  );
}

// ───────────────────────── Tax-ready ─────────────────────────
function TaxReady({ lens, senior, setSenior }: { lens: Lens; senior: boolean; setSenior: (v: boolean) => void }) {
  const { updateTransaction, transactions } = useStore();
  const byId = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const tag = async (id: string, t: any) => { const tx = byId.get(id); if (tx) await updateTransaction({ ...tx, taxTag: t }); };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 leading-relaxed">
        <b>For the old tax regime.</b> Most of these deductions aren’t available in the new regime. Limits can change every Budget — confirm on the Income Tax portal or with your CA. This is a record of what you paid, not a return.
      </div>
      <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={senior} onChange={(e) => setSenior(e.target.checked)} /> I’m a senior citizen (60+)</label>

      {lens.tax.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries tagged in {lens.fy.label}. Tag an entry from its edit sheet, or use the suggestions below.</p>
      ) : (
        <div className="space-y-2.5">
          {lens.tax.map((t) => (
            <div key={t.tag} className="bg-card rounded-2xl border border-border/60 p-4 space-y-2">
              <div className="flex justify-between items-baseline"><div className="font-bold text-slate-900">Section {t.label}</div><div className="font-black">{inr(t.used)}</div></div>
              {t.cap !== null && (
                <>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${t.used > t.cap ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${t.pct}%` }} /></div>
                  <div className="text-[11px] text-muted-foreground">{t.used > t.cap ? `Above the usual ${inr(t.cap)} limit by ${inr(t.used - t.cap)}` : `${inr(t.remaining ?? 0)} of the usual ${inr(t.cap)} limit still unused`} · {t.count} entr{t.count === 1 ? "y" : "ies"}</div>
                </>
              )}
              {t.cap === null && <div className="text-[11px] text-muted-foreground">No flat limit · {t.count} entr{t.count === 1 ? "y" : "ies"}</div>}
            </div>
          ))}
        </div>
      )}

      {lens.taxSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-900">Worth tagging ({lens.taxSuggestions.length})</div>
          {lens.taxSuggestions.slice(0, 8).map(({ tx, tag: sug }) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 bg-card rounded-xl border border-border/60 p-3">
              <div className="min-w-0 text-xs"><div className="font-semibold text-slate-800 truncate">{tx.title}</div><div className="text-muted-foreground">{tx.date.slice(0, 10)} · {inr(Math.abs(tx.amount))}</div></div>
              <button onClick={() => tag(tx.id, sug)} className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary active:scale-95">Tag {TAX_TAGS.find((x) => x.id === sug)?.label}</button>
            </div>
          ))}
          {lens.taxSuggestions.length > 8 && <div className="text-[11px] text-muted-foreground">+{lens.taxSuggestions.length - 8} more</div>}
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-slate-700">What each section covers</summary>
        <div className="mt-2 space-y-1.5">{TAX_TAGS.map((t) => <div key={t.id}><b className="text-slate-800">{t.label}</b>{capFor(t.id, senior) ? ` · up to ${inr(capFor(t.id, senior) as number)}` : ""} — {t.hint}</div>)}</div>
      </details>
    </div>
  );
}

// ───────────────────────── Close month ─────────────────────────
function CloseMonth({ go }: { go: (id: ScreenId) => void }) {
  const store = useStore();
  const { records, close, reopen, loaded } = useMonthClose();
  const [month, setMonth] = useState(shiftMonth(getCurrentMonthKey(), -1));
  const [busy, setBusy] = useState(false);

  const range = { from: `${month}-01`, to: `${month}-31` };
  const ie = useMemo(() => incomeExpenditure(store.transactions as any, range), [store.transactions, month]);
  const overBudget = useMemo(() => computeSnapshot(store as any, month).budget.rows.filter((r) => r.spent > r.limit).length, [store.transactions, store.budgets, month]);
  const items = useMemo(() => buildChecklist({
    month, transactions: store.allTransactions as any,
    transferSuggestions: store.transferSuggestions, loans: store.structuredLoans as any, overBudgetCount: overBudget,
  }), [month, store.allTransactions, store.transferSuggestions, store.structuredLoans, overBudget]);

  const open = openItems(items);
  const rec = records[month];
  const figures = { income: ie.income.total, expense: ie.needs.total + ie.wants.total + ie.debtService.total + ie.savings.total, entries: ie.entryCount };
  const drift = rec ? driftSince(rec, figures) : null;
  const streak = closedStreak(Object.keys(records), getCurrentMonthKey());
  const isFuture = month > getCurrentMonthKey();

  const doClose = async () => { setBusy(true); try { await close(makeCloseRecord(month, figures)); notify.info(`${formatMonthName(month)} closed`); } finally { setBusy(false); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border/60 p-3">
        <button aria-label="Earlier month" onClick={() => setMonth(shiftMonth(month, -1))} className="size-9 rounded-xl bg-muted flex items-center justify-center"><ChevronLeft className="size-4" /></button>
        <div className="text-center"><div className="font-bold text-sm">{formatMonthName(month)}</div>{rec && <div className="text-[11px] text-emerald-700 font-semibold flex items-center justify-center gap-1"><Lock className="size-3" /> Closed</div>}</div>
        <button aria-label="Later month" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= getCurrentMonthKey()} className="size-9 rounded-xl bg-muted flex items-center justify-center disabled:opacity-30"><ChevronRight className="size-4" /></button>
      </div>

      {streak > 0 && <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{streak} month{streak > 1 ? "s" : ""} closed in a row. Nicely kept books.</div>}

      <div className="bg-card rounded-2xl border border-border/60 divide-y">
        {items.map((it) => (
          <div key={it.id} className="flex items-start gap-3 p-3.5">
            <span className={`mt-0.5 size-5 rounded-full flex items-center justify-center shrink-0 ${it.count === 0 ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-800"}`}>{it.count === 0 ? <Check className="size-3" /> : <span className="text-[10px] font-bold">{it.count}</span>}</span>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{it.label}</div><div className="text-xs text-muted-foreground">{it.detail}</div></div>
            {it.count > 0 && <button onClick={() => go(it.screen as ScreenId)} className="text-[11px] font-bold text-primary shrink-0 flex items-center gap-0.5">Fix <ArrowRight className="size-3" /></button>}
          </div>
        ))}
      </div>

      <div className="bg-muted/50 rounded-2xl p-3.5 text-xs grid grid-cols-3 gap-2">
        <div><div className="text-muted-foreground">Income</div><div className="font-bold text-sm">{inr(figures.income)}</div></div>
        <div><div className="text-muted-foreground">Out</div><div className="font-bold text-sm">{inr(figures.expense)}</div></div>
        <div><div className="text-muted-foreground">Entries</div><div className="font-bold text-sm">{figures.entries}</div></div>
      </div>

      {rec ? (
        <div className="space-y-2">
          {drift && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">Changed since you closed it: {drift.entries !== 0 && `${drift.entries > 0 ? "+" : ""}${drift.entries} entries`}{drift.income !== 0 && ` · income ${drift.income > 0 ? "+" : "−"}${inr(Math.abs(drift.income))}`}{drift.expense !== 0 && ` · out ${drift.expense > 0 ? "+" : "−"}${inr(Math.abs(drift.expense))}`}. Close again to save the new figures.</div>}
          <div className="flex gap-2">
            {drift && <button disabled={busy} onClick={doClose} className="flex-1 h-11 rounded-xl bg-[#1E3A8A] text-white text-sm font-bold">Close again</button>}
            <button disabled={busy} onClick={() => reopen(month)} className="flex-1 h-11 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5"><Unlock className="size-4" /> Reopen</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button disabled={busy || !loaded || isFuture || figures.entries === 0} onClick={doClose} className="w-full h-12 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40 active:scale-[0.98]">{open.length ? `Close ${formatMonthName(month)} anyway` : `Close ${formatMonthName(month)}`}</button>
          <p className="text-[11px] text-muted-foreground">{figures.entries === 0 ? "Nothing recorded this month yet." : open.length ? `${open.length} item${open.length > 1 ? "s" : ""} still open. You can close now and fix later; we'll tell you if the month changes.` : "Closing saves this month's figures. You can still edit entries; we'll flag any change."}</p>
        </div>
      )}
    </div>
  );
}
