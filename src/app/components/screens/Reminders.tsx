import { useState, useEffect } from "react";
import { Header, Screen } from "../Shell";
import { Clock, Plus, Wrench, ShieldAlert, HeartPulse, CheckCircle2, CalendarDays, Trash2, Loader2 } from "lucide-react";
import { useStore, HouseholdReminder } from "../../store";

const getIconForType = (type: string) => {
  switch (type) {
    case "maintenance": return <Wrench className="size-5 text-sky-600" />;
    case "health": return <HeartPulse className="size-5 text-rose-600" />;
    case "vehicle": return <ShieldAlert className="size-5 text-amber-600" />;
    default: return <Clock className="size-5 text-slate-600" />;
  }
};

const getBgForType = (type: string) => {
  switch (type) {
    case "maintenance": return "bg-sky-100";
    case "health": return "bg-rose-100";
    case "vehicle": return "bg-amber-100";
    default: return "bg-slate-100";
  }
};

export function Reminders({ onBack }: { onBack: () => void }) {
  const { householdReminders, addHouseholdReminder, updateHouseholdReminder, removeHouseholdReminder } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"maintenance" | "health" | "vehicle" | "other">("maintenance");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState("");

  // Request browser notification permission and schedule alerts for upcoming reminders
  useEffect(() => {
    if (!householdReminders.length) return;
    if (typeof Notification === "undefined") return;

    const scheduleReminders = async () => {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return;

        const today = new Date();
        const soon = householdReminders.filter((r) => {
          if (r.done) return false;
          try {
            const d = new Date(r.dueDate);
            if (isNaN(d.getTime())) return false;
            const days = (d.getTime() - today.getTime()) / 86400000;
            return days >= 0 && days <= 7;
          } catch {
            return false;
          }
        });

        const seenKey = "livesync-reminder-notified";
        const seen: string[] = JSON.parse(sessionStorage.getItem(seenKey) || "[]");
        for (const r of soon) {
          if (seen.includes(r.id)) continue;
          new Notification(`Reminder: ${r.title}`, {
            body: `Due: ${r.dueDate}${r.repeat ? ` · ${r.repeat}` : ""}`,
            icon: "/favicon.ico",
          });
          seen.push(r.id);
        }
        sessionStorage.setItem(seenKey, JSON.stringify(seen));
      } catch (e) {
        console.warn("Reminder notification failed:", e);
      }
    };

    scheduleReminders();
  }, [householdReminders]);

  const addReminder = async () => {
    if (!title) return;
    setSaving(true);
    try {
      await addHouseholdReminder({ title, type, dueDate, repeat, done: false });
      setShowForm(false);
      setTitle(""); setDueDate(""); setRepeat(""); setType("maintenance");
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (r: HouseholdReminder) => {
    await updateHouseholdReminder({ ...r, done: !r.done });
  };

  const pending = householdReminders.filter(r => !r.done).length;

  return (
    <>
      <Header title="Auto Reminders" subtitle="Never miss a service again" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-5 pb-20">
          <section className="rounded-3xl p-5 text-indigo-900 shadow-lg" style={{ background: "linear-gradient(135deg, #E0E7FF 0%, #A5B4FC 100%)" }}>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="size-6" />
              <h2 className="font-display text-xl font-bold">Upcoming Reminders</h2>
            </div>
            <p className="text-sm font-semibold opacity-90">{pending} Task{pending !== 1 ? "s" : ""} Pending</p>
          </section>

          {!showForm ? (
            <div className="space-y-3">
              {householdReminders.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Clock className="size-10 mx-auto mb-3 opacity-30" />
                  <p>No reminders yet.</p>
                  <p className="text-xs mt-1">Add AC service, car service, health checkups…</p>
                </div>
              )}
              {householdReminders.map((item) => (
                <div key={item.id} className={`bg-card border border-border rounded-2xl p-4 flex gap-4 transition-opacity ${item.done ? "opacity-60" : ""}`}>
                  <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${getBgForType(item.type)}`}>
                    {getIconForType(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-sm truncate pr-2 ${item.done ? "line-through" : ""}`}>{item.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      {item.dueDate && (
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                          <CalendarDays className="size-3" /> {item.dueDate}
                        </span>
                      )}
                      {item.repeat && <span className="text-xs text-muted-foreground">{item.repeat}</span>}
                    </div>
                    <button
                      onClick={() => removeHouseholdReminder(item.id)}
                      className="mt-2 text-xs text-muted-foreground hover:text-rose-500 flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                  </div>
                  <button onClick={() => toggleDone(item)} className="self-center">
                    <CheckCircle2 className={`size-6 transition-colors ${item.done ? "text-emerald-500" : "text-border"}`} />
                  </button>
                </div>
              ))}

              <button onClick={() => setShowForm(true)} className="w-full py-4 mt-2 border-2 border-dashed border-primary/30 rounded-2xl text-sm font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors">
                <Plus className="size-4" /> Create Reminder
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold">New Reminder</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="e.g. AC Service" />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Type</label>
                  <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20">
                    <option value="maintenance">Maintenance</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="health">Health</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Repeat</label>
                    <input value={repeat} onChange={e => setRepeat(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="e.g. Every 6 months" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-border rounded-xl text-sm font-bold">Cancel</button>
                <button
                  onClick={addReminder}
                  disabled={saving || !title}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save Reminder
                </button>
              </div>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
