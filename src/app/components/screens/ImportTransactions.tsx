import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Upload, Sparkles, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, Plus, ShieldCheck } from "lucide-react";
import { Screen } from "../Shell";
import { PremiumLock } from "../PremiumLock";
import { useStore, Tx } from "../../store";
import { useEntitlements } from "../../lib/useEntitlements";
import { useCountry } from "../../lib/useCountry";
import { fmt } from "../../lib/taxPacks";
import { clusterRows, RawRow, Cluster } from "../../lib/merchantNormalize";
import { supabase } from "../../lib/api";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";

type Step = "upload" | "map" | "review" | "confirm";

type Mapping = { date: string; description: string; amount: string; type?: string; category?: string; debit?: string; credit?: string };

const AI_NORMALIZE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a3fe149f/ai/normalize-merchants`;

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\r") { /* skip */ }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else { field += ch; }
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim().length));
}

function guessMapping(headers: string[]): Mapping {
  const lc = headers.map((h) => h.toLowerCase().trim());
  const find = (...needles: string[]) => {
    for (const n of needles) {
      const idx = lc.findIndex((h) => h === n || h.includes(n));
      if (idx >= 0) return headers[idx];
    }
    return "";
  };
  return {
    date: find("date", "posting date", "txn date", "transaction date"),
    description: find("description", "narration", "merchant", "particulars", "details"),
    amount: find("amount", "value"),
    type: find("type", "drcr", "dr/cr"),
    category: find("category"),
    debit: find("debit", "withdrawal"),
    credit: find("credit", "deposit"),
  };
}

function parseAmount(raw: string): number {
  const cleaned = (raw || "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

function normaliseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Try ISO
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function comparisonText(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
}

function comparisonKey(date: string, amount: number, type: "income" | "expense", description: string) {
  return `${date}|${Math.round(amount * 100)}|${type}|${comparisonText(description)}`;
}

export function ImportTransactions({ onBack, onUpgrade }: { onBack: () => void; onUpgrade: () => void }) {
  return (
    <Screen>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="size-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="size-4" /></button>
        <div>
          <h1 className="text-lg font-semibold">Import transactions</h1>
          <p className="text-xs text-muted-foreground">From CSV — bank, wallet, or another app.</p>
        </div>
      </div>
      <PremiumLock
        feature="import"
        title="Import is a Pro feature"
        description="Import your full history from CSV with smart merchant dedupe and AI categorisation. Included in your 7-day trial."
        onUpgrade={onUpgrade}
      >
        <Importer />
      </PremiumLock>
    </Screen>
  );
}

function Importer() {
  const { addTransaction, categories, addCategory, transactions } = useStore();
  const { entitlements } = useEntitlements();
  const { country } = useCountry();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date: "", description: "", amount: "" });
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committedCount, setCommittedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File) => {
    const text = await f.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) { alert("CSV looks empty or has no header row."); return; }
    const [h, ...body] = parsed;
    setHeaders(h.map((s) => s.trim()));
    setRows(body);
    setMapping(guessMapping(h.map((s) => s.trim())));
    setStep("map");
  };

  const rawRows: RawRow[] = useMemo(() => {
    if (!mapping.description) return [];
    const idx = (col?: string) => (col ? headers.indexOf(col) : -1);
    const di = idx(mapping.date);
    const desc = idx(mapping.description);
    const ai = idx(mapping.amount);
    const ti = idx(mapping.type);
    const ci = idx(mapping.category);
    const dr = idx(mapping.debit);
    const cr = idx(mapping.credit);
    return rows.map((r, i) => {
      let amount = 0;
      let type: "income" | "expense" = "expense";
      if (ai >= 0) {
        amount = parseAmount(r[ai] || "0");
        if (ti >= 0) {
          const t = (r[ti] || "").toLowerCase();
          type = t.startsWith("cr") || t.includes("income") || t.includes("credit") ? "income" : "expense";
        } else {
          type = amount >= 0 ? "income" : "expense";
        }
      } else if (dr >= 0 || cr >= 0) {
        const debit = dr >= 0 ? parseAmount(r[dr] || "0") : 0;
        const credit = cr >= 0 ? parseAmount(r[cr] || "0") : 0;
        if (credit > 0) { amount = credit; type = "income"; }
        else { amount = debit; type = "expense"; }
      }
      return {
        sourceIndex: i,
        raw: r[desc] || "",
        date: normaliseDate(r[di] || ""),
        amount: Math.abs(amount),
        type,
        sourceCategory: ci >= 0 ? r[ci] : undefined,
      };
    }).filter((r) => r.raw && r.amount > 0);
  }, [rows, headers, mapping]);

  const duplicateInfo = useMemo(() => {
    const existingKeys = new Set(transactions.map((tx) => comparisonKey(tx.date, Math.abs(tx.amount), tx.type, tx.merchant || tx.title)));
    const seenInFile = new Set<string>();
    const duplicateIndexes = new Set<number>();
    let existing = 0;
    let inFile = 0;
    for (const row of rawRows) {
      const key = comparisonKey(row.date, row.amount, row.type, row.raw);
      if (existingKeys.has(key)) { duplicateIndexes.add(row.sourceIndex); existing++; }
      else if (seenInFile.has(key)) { duplicateIndexes.add(row.sourceIndex); inFile++; }
      seenInFile.add(key);
    }
    return { duplicateIndexes, existing, inFile };
  }, [rawRows, transactions]);

  const selectedRows = useMemo(
    () => includeDuplicates ? rawRows : rawRows.filter((row) => !duplicateInfo.duplicateIndexes.has(row.sourceIndex)),
    [includeDuplicates, rawRows, duplicateInfo],
  );

  const startReview = async () => {
    const c = clusterRows(rawRows);
    setClusters(c);
    setStep("review");
    // Auto-trigger AI for ambiguous if allowed
    const ambiguous = c.filter((cl) => cl.category === "Uncategorised");
    if (ambiguous.length === 0) return;
    if (!entitlements.import) return; // PremiumLock should have blocked, defensive
    void runAi(c);
  };

  const runAi = async (current: Cluster[]) => {
    const ambiguous = current.filter((cl) => cl.category === "Uncategorised");
    if (ambiguous.length === 0) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token ?? publicAnonKey;
      const res = await fetch(AI_NORMALIZE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ merchants: ambiguous.map((a) => a.canonical) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `AI ${res.status}`);
      const map = new Map<string, { canonical: string; category: string }>();
      for (const it of body.items || []) map.set((it.input || "").toUpperCase(), { canonical: it.canonical, category: it.category });
      setClusters((prev) => prev.map((cl) => {
        const hit = map.get(cl.canonical.toUpperCase());
        if (!hit) return cl;
        return { ...cl, canonical: hit.canonical || cl.canonical, category: hit.category || cl.category, source: "ai" as const };
      }));
    } catch (e: any) {
      console.error("AI normalize failed:", e);
      setAiError(e.message || "AI categorisation failed — pick categories manually below.");
    } finally {
      setAiBusy(false);
    }
  };

  const updateCluster = (id: string, patch: Partial<Cluster>) => {
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const commit = async () => {
    setCommitting(true);
    setCommittedCount(0);
    setSkippedCount(0);
    try {
      // Build flat list of tx writes from rows + cluster assignments
      const clusterByRow = new Map<number, Cluster>();
      for (const cl of clusters) for (const ri of cl.rowIndexes) clusterByRow.set(ri, cl);
      const newCats = new Set<string>();
      for (const cl of clusters) {
        if (cl.category && cl.category !== "Uncategorised" && !categories.includes(cl.category)) newCats.add(cl.category);
      }
      for (const c of newCats) await addCategory(c);

      setSkippedCount(rawRows.length - selectedRows.length);
      for (const r of selectedRows) {
        const cl = clusterByRow.get(r.sourceIndex);
        const tx: Omit<Tx, "id"> = {
          title: cl?.canonical || r.raw.slice(0, 40),
          merchant: cl?.canonical,
          category: cl?.category || "Other",
          amount: r.amount,
          type: r.type,
          date: r.date,
          createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // backdated → past edit window
        };
        await addTransaction(tx);
        setCommittedCount((n) => n + 1);
      }
      setStep("confirm");
    } catch (e) {
      console.error("Import commit failed:", e);
      alert("Some rows failed to import. Check the console.");
    } finally {
      setCommitting(false);
    }
  };

  const totalIncome = selectedRows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalExpense = selectedRows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <Stepper current={step} />

      {step === "upload" && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center space-y-3">
          <Upload className="size-8 mx-auto text-muted-foreground" />
          <div className="text-sm font-medium">Upload a CSV</div>
          <div className="text-xs text-muted-foreground">Any CSV with a date, description and amount. Your file is previewed before anything is saved.</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 inline-flex items-center gap-2">
            <Upload className="size-4" /> Choose CSV file
          </button>
          <div className="pt-1 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-600" /> LiveSync never asks for a bank password, PIN or OTP.</div>
        </div>
      )}

      {step === "map" && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Map your columns</div>
          <div className="text-xs text-muted-foreground">Detected {rows.length} rows. Tell us which column is which.</div>
          <Field label="Date column" value={mapping.date} options={headers} onChange={(v) => setMapping({ ...mapping, date: v })} />
          <Field label="Description / merchant" value={mapping.description} options={headers} onChange={(v) => setMapping({ ...mapping, description: v })} />
          <Field label="Amount column (or leave blank to use debit/credit)" value={mapping.amount} options={["", ...headers]} onChange={(v) => setMapping({ ...mapping, amount: v })} />
          {!mapping.amount && (
            <>
              <Field label="Debit column" value={mapping.debit || ""} options={["", ...headers]} onChange={(v) => setMapping({ ...mapping, debit: v })} />
              <Field label="Credit column" value={mapping.credit || ""} options={["", ...headers]} onChange={(v) => setMapping({ ...mapping, credit: v })} />
            </>
          )}
          <Field label="Type column (optional)" value={mapping.type || ""} options={["", ...headers]} onChange={(v) => setMapping({ ...mapping, type: v })} />
          <Field label="Category column (optional)" value={mapping.category || ""} options={["", ...headers]} onChange={(v) => setMapping({ ...mapping, category: v })} />

          {rawRows.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="text-xs text-muted-foreground mb-2">Source preview · {rawRows.length} usable rows · nothing saved yet</div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {rawRows.slice(0, 5).map((r, i) => (
                  <div key={i} className="text-xs flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{r.date} · {r.raw}</span>
                    <span className={r.type === "income" ? "text-emerald-500" : "text-rose-500"}>{r.type === "income" ? "+" : "-"}{fmt(r.amount, country)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startReview}
            disabled={!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit) || rawRows.length === 0}
            className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            Review {rawRows.length} rows <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{clusters.length} merchants found</div>
                <div className="text-xs text-muted-foreground">From {rawRows.length} usable rows. Merchant names are grouped only for review.</div>
              </div>
              <button
                onClick={() => runAi(clusters)}
                disabled={aiBusy}
                className="h-9 px-3 rounded-lg bg-amber-500/15 text-amber-500 text-xs font-medium hover:bg-amber-500/25 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Re-run AI
              </button>
            </div>
            {aiError && (
              <div className="mt-2 text-xs text-amber-500 flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" /> {aiError}
              </div>
            )}
          </div>

          {duplicateInfo.duplicateIndexes.size > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              <div className="font-semibold">{duplicateInfo.duplicateIndexes.size} possible duplicate{duplicateInfo.duplicateIndexes.size === 1 ? "" : "s"} found</div>
              <p className="mt-1 text-amber-800">Matched by date, amount, direction and description: {duplicateInfo.existing} already in LiveSync, {duplicateInfo.inFile} repeated in this file.</p>
              <label className="mt-3 flex items-center gap-2 cursor-pointer font-medium"><input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} /> Import them anyway</label>
            </div>
          )}

          <div className="space-y-2">
            {clusters.map((cl) => (
              <ClusterRow key={cl.id} cluster={cl} categories={categories} onChange={(p) => updateCluster(cl.id, p)} onAddCategory={addCategory} country={country} />
            ))}
          </div>

          <button
            onClick={commit}
            disabled={committing || selectedRows.length === 0}
            className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {committing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Import {selectedRows.length} transactions
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
          <div className="size-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto"><Check className="size-6" /></div>
          <div className="text-base font-semibold">Imported {committedCount} transactions</div>
          <div className="text-sm text-muted-foreground">
            +{fmt(totalIncome, country)} income · -{fmt(totalExpense, country)} expense
          </div>
          {skippedCount > 0 && <div className="text-xs text-muted-foreground">Skipped {skippedCount} possible duplicate{skippedCount === 1 ? "" : "s"}. You can import them manually if needed.</div>}
        </div>
      )}

      {committing && (
        <div className="text-xs text-center text-muted-foreground">Saving {committedCount} / {selectedRows.length}…</div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Step[] = ["upload", "map", "review", "confirm"];
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className={`h-1 flex-1 rounded-full ${steps.indexOf(current) >= i ? "bg-indigo-600" : "bg-muted"}`} />
      ))}
    </div>
  );
}

function Field({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm">
        {options.map((o) => <option key={o || "__"} value={o}>{o || "— none —"}</option>)}
      </select>
    </label>
  );
}

function ClusterRow({ cluster, categories, onChange, onAddCategory, country }: { cluster: Cluster; categories: string[]; onChange: (p: Partial<Cluster>) => void; onAddCategory: (n: string) => Promise<void>; country: any }) {
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [adding, setAdding] = useState(false);

  const submitCat = async () => {
    if (!newCat.trim()) return;
    setAdding(true);
    await onAddCategory(newCat.trim());
    onChange({ category: newCat.trim() });
    setNewCat("");
    setAdding(false);
  };

  const badgeColor = {
    dictionary: "bg-emerald-500/15 text-emerald-500",
    ai: "bg-amber-500/15 text-amber-500",
    cluster: "bg-slate-500/15 text-slate-400",
    manual: "bg-indigo-500/15 text-indigo-400",
  }[cluster.source];

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={cluster.canonical}
          onChange={(e) => onChange({ canonical: e.target.value, source: "manual" })}
          className="flex-1 text-sm font-medium bg-transparent border-b border-transparent focus:border-indigo-500 outline-none"
        />
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeColor}`}>{cluster.source}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <select
          value={categories.includes(cluster.category) ? cluster.category : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== "__custom__") onChange({ category: v, source: "manual" });
          }}
          className="flex-1 h-8 rounded-lg border border-border bg-background px-2"
        >
          {!categories.includes(cluster.category) && <option value={cluster.category}>{cluster.category}</option>}
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__custom__">+ Create new…</option>
        </select>
        <span className="text-muted-foreground tabular-nums">{cluster.count} txn · {fmt(cluster.total, country)}</span>
        <button onClick={() => setOpen((o) => !o)} className="size-7 rounded-md hover:bg-muted flex items-center justify-center">
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>
      {open && (
        <div className="mt-2 border-t border-border pt-2 space-y-2">
          <div className="text-[11px] text-muted-foreground">Raw variants:</div>
          <div className="space-y-0.5">
            {cluster.variants.map((v, i) => (
              <div key={i} className="text-[11px] text-muted-foreground font-mono truncate">{v}</div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" className="flex-1 h-8 rounded-lg border border-border bg-background px-2 text-xs" />
            <button onClick={submitCat} disabled={!newCat.trim() || adding} className="h-8 px-2 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1">
              <Plus className="size-3" /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
