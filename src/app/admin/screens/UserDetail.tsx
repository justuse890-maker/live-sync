import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Gift, Save, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { adminApi, Plan } from "../lib/adminApi";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function UserDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // offer form
  const [oTitle, setOTitle] = useState("");
  const [oDesc, setODesc] = useState("");
  const [oDiscount, setODiscount] = useState<number>(20);
  const [oPlan, setOPlan] = useState<string>("");
  const [oExpiry, setOExpiry] = useState<string>("");

  async function load() {
    try {
      const [d, p] = await Promise.all([adminApi.user(id), adminApi.plans()]);
      setData(d);
      setPlans(p);
    } catch (e: any) { setErr(e.message); }
  }

  useEffect(() => { load(); }, [id]);

  async function assign(planId: string) {
    setBusy(true);
    try { await adminApi.assignPlan(id, planId); await load(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function createOffer() {
    if (!oTitle.trim()) return;
    setBusy(true);
    try {
      await adminApi.createOffer({
        scope: "user",
        userId: id,
        title: oTitle,
        description: oDesc,
        discountPct: oDiscount,
        planId: oPlan || undefined,
        expiresAt: oExpiry || undefined,
      });
      setOTitle(""); setODesc(""); setOPlan(""); setOExpiry("");
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function deleteOffer() {
    if (!confirm("Remove personalised offer for this user?")) return;
    setBusy(true);
    try { await adminApi.deleteUserOffer(id); await load(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  if (err) return <div className="text-rose-400 text-sm">Failed to load user: {err}</div>;
  if (!data) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="size-4 animate-spin" /> Loading user…</div>;

  const u = data.user;
  const offer = data.offer;
  const features: Record<string, number> = data.features || {};
  const featureList = Object.entries(features).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="size-4" /> Back to users
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-lg font-semibold text-slate-100">{u.name || u.email}</div>
        <div className="text-xs text-slate-500">{u.email} · joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Mini label="Plan" value={data.planId || "Free"} />
          <Mini label="Transactions" value={String(data.txCount ?? 0)} />
          <Mini label="Documents" value={String(data.docCount ?? 0)} />
          <Mini label="Goals" value={String(data.goalCount ?? 0)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-200 mb-3">Subscription plan</div>
          <div className="space-y-2">
            <PlanBtn current={!data.planId} label="Free" onClick={() => assign("")} busy={busy} />
            {plans.map((p) => (
              <PlanBtn key={p.id} current={data.planId === p.id} label={`${p.name} · ${inr(p.priceMonthly)}/mo`} onClick={() => assign(p.id)} busy={busy} />
            ))}
            {plans.length === 0 && <div className="text-xs text-slate-500">No plans defined yet. Create one in the Plans tab.</div>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Gift className="size-4 text-amber-400" /> Personalised offer</div>
          {offer ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
              <div className="text-sm font-medium text-amber-200">{offer.title}</div>
              {offer.description && <div className="text-xs text-amber-200/80 mt-0.5">{offer.description}</div>}
              <div className="text-[11px] text-amber-200/70 mt-1.5">
                {offer.discountPct ? `${offer.discountPct}% off` : ""}
                {offer.planId ? ` · plan ${offer.planId}` : ""}
                {offer.expiresAt ? ` · expires ${new Date(offer.expiresAt).toLocaleDateString()}` : ""}
              </div>
              <button onClick={deleteOffer} className="mt-2 text-xs text-rose-300 hover:text-rose-200 flex items-center gap-1"><Trash2 className="size-3" /> Remove offer</button>
            </div>
          ) : null}
          <div className="space-y-2">
            <input value={oTitle} onChange={(e) => setOTitle(e.target.value)} placeholder="Offer title (e.g. 50% off Pro for 3 months)" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <textarea value={oDesc} onChange={(e) => setODesc(e.target.value)} placeholder="Description (visible to user)" rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={oDiscount} onChange={(e) => setODiscount(Number(e.target.value))} placeholder="% off" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
              <select value={oPlan} onChange={(e) => setOPlan(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Any plan</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" value={oExpiry} onChange={(e) => setOExpiry(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={createOffer} disabled={busy || !oTitle.trim()} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2">
              <Save className="size-4" /> {offer ? "Replace offer" : "Create offer"}
            </button>
          </div>
        </div>
      </div>

      {data.onboarding ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
            <span>Customer intent (onboarding)</span>
            <span className="text-[11px] font-normal text-slate-500">
              {data.onboarding.completedAt ? `Completed ${new Date(data.onboarding.completedAt).toLocaleDateString()}` : "In progress"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Mini label="Age band" value={data.onboarding.ageBand || "—"} />
            <Mini label="Occupation" value={data.onboarding.occupation || "—"} />
            <Mini label="Monthly income" value={data.onboarding.monthlyIncomeBand || "—"} />
            <Mini label="Primary goal" value={data.onboarding.primaryGoal || "—"} />
          </div>
          {data.onboarding.whyApp && (
            <div className="mt-3 bg-slate-800/60 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Why they're using LiveSync</div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap">{data.onboarding.whyApp}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500">
          User hasn't completed onboarding yet.
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
          <span>Feature access</span>
          <span className="text-[11px] font-normal text-slate-500">Plan unlocks + per-user overrides</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(data.allFeatures || []).map((f: string) => {
            const overrides = data.featureOverrides || {};
            const explicit = Object.prototype.hasOwnProperty.call(overrides, f);
            const on = explicit ? overrides[f] : (data.subscription?.planId === "pro" || data?.subscription?.trialEndsAt && new Date(data.subscription.trialEndsAt).getTime() > Date.now());
            return (
              <button
                key={f}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try { await adminApi.toggleFeature(id, f, !on); await load(); }
                  catch (e: any) { alert(e.message); }
                  finally { setBusy(false); }
                }}
                className="flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 rounded-lg px-3 py-2 text-left transition"
              >
                <span className="text-sm text-slate-200 capitalize">{f}</span>
                {on ? <ToggleRight className="size-5 text-emerald-400" /> : <ToggleLeft className="size-5 text-slate-500" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-200 mb-3">Feature usage</div>
        {featureList.length === 0 ? (
          <div className="text-xs text-slate-500">No feature events tracked for this user yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {featureList.map(([f, c]) => (
              <div key={f} className="bg-slate-800/60 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-slate-300 truncate">{f}</span>
                <span className="text-sm font-semibold text-slate-100">{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <div className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function PlanBtn({ current, label, onClick, busy }: { current: boolean; label: string; onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy || current} className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${current ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-200" : "bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600"}`}>
      {current && "✓ "}{label}
    </button>
  );
}
