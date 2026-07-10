import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Gift, Globe, User } from "lucide-react";
import { adminApi, Offer, Plan } from "../../lib/adminApi";

export function Offers() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [discount, setDiscount] = useState(20);
  const [planId, setPlanId] = useState("");
  const [expiry, setExpiry] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const [o, p] = await Promise.all([adminApi.offers(), adminApi.plans()]);
      setOffers(o); setPlans(p);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await adminApi.createOffer({ scope: "global", title, description: desc, discountPct: discount, planId: planId || undefined, expiresAt: expiry || undefined });
      setTitle(""); setDesc(""); setPlanId(""); setExpiry("");
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function remove(o: Offer) {
    if (!confirm("Delete this offer?")) return;
    try {
      if (o.scope === "global") await adminApi.deleteGlobalOffer(o.id);
      else if (o.userId) await adminApi.deleteUserOffer(o.userId);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  if (err) return <div className="text-rose-400 text-sm">Failed to load offers: {err}</div>;
  if (!offers) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="size-4 animate-spin" /> Loading offers…</div>;

  const global = offers.filter((o) => o.scope === "global");
  const personalised = offers.filter((o) => o.scope === "user");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Offers</h1>
        <p className="text-sm text-slate-400">Create global promotions or per-user personalised offers (from the Users tab).</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Plus className="size-4" /> New global offer</div>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Offer title" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="% off" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option value="">Any plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={create} disabled={creating || !title.trim()} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2">
            <Gift className="size-4" /> Create global offer
          </button>
        </div>
      </div>

      <OfferList title="Global offers" icon={<Globe className="size-4 text-emerald-400" />} items={global} onRemove={remove} />
      <OfferList title="Personalised offers" icon={<User className="size-4 text-amber-400" />} items={personalised} onRemove={remove} />
    </div>
  );
}

function OfferList({ title, icon, items, onRemove }: { title: string; icon: React.ReactNode; items: Offer[]; onRemove: (o: Offer) => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">{icon} {title} <span className="text-slate-500 font-normal">· {items.length}</span></div>
      {items.length === 0 ? (
        <div className="text-xs text-slate-500">None.</div>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <div key={o.id + (o.userId || "")} className="bg-slate-800/60 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-100">{o.title}</div>
                {o.description && <div className="text-xs text-slate-400 mt-0.5">{o.description}</div>}
                <div className="text-[11px] text-slate-500 mt-1">
                  {o.userId ? `user: ${o.userId.slice(0, 8)}…` : "all users"}
                  {o.discountPct ? ` · ${o.discountPct}% off` : ""}
                  {o.planId ? ` · plan ${o.planId}` : ""}
                  {o.expiresAt ? ` · expires ${new Date(o.expiresAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              <button onClick={() => onRemove(o)} className="text-rose-300 hover:text-rose-200"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
