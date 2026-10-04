import { useState } from "react";
import { Header, Screen } from "../Shell";
import { BellRing, FileText, IndianRupee, Plus, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { inr } from "../types";
import { useStore } from "../../store";

export function Society({ onBack }: { onBack: () => void }) {
  const { societyNotices, addSocietyNotice, updateSocietyNotice, removeSocietyNotice } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"notice" | "bill">("notice");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");

  const pendingBills = societyNotices.filter(n => n.type === "bill" && !n.paid);
  const unreadNotices = societyNotices.filter(n => n.type === "notice");

  const addNotice = async () => {
    if (!title) return;
    setSaving(true);
    try {
      await addSocietyNotice({
        title, type, details,
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        amount: type === "bill" ? Number(amount) : undefined,
        paid: false,
      });
      setShowForm(false);
      setTitle(""); setDetails(""); setAmount(""); setType("notice");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (notice: typeof societyNotices[0]) => {
    await updateSocietyNotice({ ...notice, paid: true });
  };

  return (
    <>
      <Header title="Society & Notices" subtitle="Stay updated with community" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-5 pb-20">
          <section className="rounded-3xl p-5 text-amber-900 shadow-lg" style={{ background: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)" }}>
            <div className="flex items-center gap-3 mb-4">
              <BellRing className="size-6" />
              <h2 className="font-display text-xl font-bold">Community Board</h2>
            </div>
            <p className="text-sm font-semibold opacity-90">
              {unreadNotices.length} Notice{unreadNotices.length !== 1 ? "s" : ""} · {pendingBills.length} Pending Bill{pendingBills.length !== 1 ? "s" : ""}
            </p>
          </section>

          {!showForm ? (
            <div className="space-y-3">
              {societyNotices.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <BellRing className="size-10 mx-auto mb-3 opacity-30" />
                  <p>No notices yet.</p>
                  <p className="text-xs mt-1">Add society notices or bills manually.</p>
                </div>
              )}
              {societyNotices.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
                  <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${item.type === "bill" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                    {item.type === "bill" ? <IndianRupee className="size-5" /> : <FileText className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-sm truncate pr-2">{item.title}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{item.date}</span>
                    </div>
                    {item.details && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{item.details}</p>}

                    {item.type === "bill" && item.amount && (
                      <div className="mt-3 flex items-center justify-between bg-muted/40 p-2.5 rounded-xl">
                        <span className="font-bold">{inr(item.amount)}</span>
                        {item.paid ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Paid</span>
                        ) : (
                          <button onClick={() => markPaid(item)} className="text-xs font-bold text-white bg-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-colors">Mark Paid</button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => removeSocietyNotice(item.id)}
                      className="mt-2 text-xs text-muted-foreground hover:text-rose-500 flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={() => setShowForm(true)} className="w-full py-4 mt-2 border-2 border-dashed border-primary/30 rounded-2xl text-sm font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors">
                <Plus className="size-4" /> Add Notice / Bill Manually
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold">Add Entry</h3>

              <div className="flex bg-muted/50 p-1 rounded-xl">
                <button onClick={() => setType("notice")} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${type === "notice" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>Notice</button>
                <button onClick={() => setType("bill")} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${type === "bill" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>Bill</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="e.g. Maintenance Bill" />
                </div>

                {type === "bill" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Amount (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="4500" />
                  </div>
                )}

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Details</label>
                  <textarea value={details} onChange={e => setDetails(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20 min-h-[80px]" placeholder="Add details here..." />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-border rounded-xl text-sm font-bold">Cancel</button>
                <button
                  onClick={addNotice}
                  disabled={saving || !title}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save Entry
                </button>
              </div>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
