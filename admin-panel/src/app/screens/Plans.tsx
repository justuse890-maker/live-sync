import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, X } from "lucide-react";
import { adminApi, Plan } from "../../lib/adminApi";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const FEATURE_CATALOG = [
  { key: "networth", label: "Net Worth Command Center" },
  { key: "timeline", label: "Financial Timeline" },
  { key: "leakage", label: "Wealth Leakage Detector" },
  { key: "inflation", label: "Lifestyle Inflation Monitor" },
  { key: "fire", label: "FIRE Engine" },
  { key: "simulator", label: "Decision Simulator" },
  { key: "coach", label: "AI Wealth Coach" },
  { key: "tax", label: "Tax Assistant" },
  { key: "documents", label: "Document Vault" },
  { key: "accounts", label: "Connected Accounts (AA)" },
];

export function Plans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [edit, setEdit] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { setPlans(await adminApi.plans()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit || !edit.name.trim()) return;
    try { await adminApi.upsertPlan(edit); setEdit(null); await load(); }
    catch (e: any) { alert(e.message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this plan? Users on this plan will be moved to Free.")) return;
    try { await adminApi.deletePlan(id); await load(); }
    catch (e: any) { alert(e.message); }
  }

  function newPlan() {
    setEdit({ id: "", name: "", priceMonthly: 0, priceYearly: 0, features: [], description: "" });
  }

  if (err) return <div className="text-rose-400 text-sm">Failed to load plans: {err}</div>;
  if (!plans) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="size-4 animate-spin" /> Loading plans…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Subscription plans</h1>
          <p className="text-sm text-slate-400">Define tiers with per-feature pricing. Users get assigned in the Users tab.</p>
        </div>
        <button onClick={newPlan} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2">
          <Plus className="size-4" /> New plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-slate-100">{p.name}</div>
                <div className="text-xs text-slate-500">{p.id}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-100">{inr(p.priceMonthly)}<span className="text-xs text-slate-500">/mo</span></div>
                {p.priceYearly ? <div className="text-[11px] text-slate-500">{inr(p.priceYearly)}/yr</div> : null}
              </div>
            </div>
            {p.description && <div className="text-xs text-slate-400 mt-2">{p.description}</div>}
            {p.features?.length ? (
              <div className="mt-3 space-y-1">
                {p.features.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{f.label}</span>
                    {f.price ? <span className="text-slate-400">+{inr(f.price)}</span> : <span className="text-emerald-400">included</span>}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEdit({ ...p })} className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg py-1.5">Edit</button>
              <button onClick={() => remove(p.id)} className="text-xs bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 rounded-lg px-2.5"><Trash2 className="size-3.5" /></button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-500 py-12">No plans yet. Click <strong>New plan</strong> to create one.</div>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-900">
              <div className="text-base font-semibold">{edit.id ? "Edit plan" : "New plan"}</div>
              <button onClick={() => setEdit(null)}><X className="size-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Name">
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Description">
                <textarea rows={2} value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly price (₹)">
                  <input type="number" value={edit.priceMonthly} onChange={(e) => setEdit({ ...edit, priceMonthly: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Yearly price (₹)">
                  <input type="number" value={edit.priceYearly || 0} onChange={(e) => setEdit({ ...edit, priceYearly: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Features included</div>
                <div className="space-y-1.5">
                  {FEATURE_CATALOG.map((f) => {
                    const included = edit.features.find((x) => x.key === f.key);
                    return (
                      <div key={f.key} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!included}
                          onChange={(e) => {
                            if (e.target.checked) setEdit({ ...edit, features: [...edit.features, { key: f.key, label: f.label }] });
                            else setEdit({ ...edit, features: edit.features.filter((x) => x.key !== f.key) });
                          }}
                        />
                        <span className="text-sm text-slate-200 flex-1">{f.label}</span>
                        {included && (
                          <input
                            type="number"
                            placeholder="+₹ add-on"
                            value={included.price ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Number(e.target.value);
                              setEdit({ ...edit, features: edit.features.map((x) => x.key === f.key ? { ...x, price: v } : x) });
                            }}
                            className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end gap-2 sticky bottom-0 bg-slate-900">
              <button onClick={() => setEdit(null)} className="px-3 py-2 text-sm text-slate-300 hover:text-slate-100">Cancel</button>
              <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <Save className="size-4" /> Save plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
