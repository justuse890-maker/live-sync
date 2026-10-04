import { useState } from "react";
import { Header, Screen } from "../Shell";
import { UsersRound, Plus, CalendarDays, Clock, Trash2, Loader2 } from "lucide-react";
import { inr } from "../types";
import { useStore } from "../../store";

export function Staff({ onBack }: { onBack: () => void }) {
  const { householdStaff, addHouseholdStaff, removeHouseholdStaff } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New staff form state
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [schedule, setSchedule] = useState("");
  const [time, setTime] = useState("");

  const addStaff = async () => {
    if (!name || !role) return;
    setSaving(true);
    try {
      await addHouseholdStaff({ name, role, salary: Number(salary) || 0, schedule, time });
      setShowForm(false);
      setName(""); setRole(""); setSalary(""); setSchedule(""); setTime("");
    } finally {
      setSaving(false);
    }
  };

  const totalPayout = householdStaff.reduce((acc, s) => acc + s.salary, 0);

  return (
    <>
      <Header title="Household Staff" subtitle="Manage schedules & salaries" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-5 pb-20">
          <section className="rounded-3xl p-5 text-white shadow-lg" style={{ background: "linear-gradient(135deg, #047857 0%, #064E3B 100%)" }}>
            <div className="flex items-center gap-3 mb-4">
              <UsersRound className="size-6" />
              <h2 className="font-display text-xl font-bold">Home Team</h2>
            </div>
            <p className="text-sm text-emerald-100 opacity-90">
              {householdStaff.length} member{householdStaff.length !== 1 ? "s" : ""} · Total monthly payout: {inr(totalPayout)}
            </p>
          </section>

          {!showForm ? (
            <div className="space-y-3">
              {householdStaff.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <UsersRound className="size-10 mx-auto mb-3 opacity-30" />
                  <p>No staff added yet.</p>
                  <p className="text-xs mt-1">Add your maid, cook, driver…</p>
                </div>
              )}
              {householdStaff.map((staff) => (
                <div key={staff.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-base">{staff.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{staff.role}</p>
                    </div>
                    <span className="font-bold text-sm bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">{inr(staff.salary)}/mo</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded-xl">
                    {staff.schedule && <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {staff.schedule}</div>}
                    {staff.time && <div className="flex items-center gap-1.5"><Clock className="size-3.5" /> {staff.time}</div>}
                  </div>
                  <button
                    onClick={() => removeHouseholdStaff(staff.id)}
                    className="text-rose-500 text-xs font-bold flex items-center justify-center gap-1 mt-1 hover:bg-rose-50 p-2 rounded-lg self-end"
                  >
                    <Trash2 className="size-3" /> Remove
                  </button>
                </div>
              ))}

              <button
                onClick={() => setShowForm(true)}
                className="w-full py-4 mt-2 border-2 border-dashed border-primary/30 rounded-2xl text-sm font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="size-4" /> Add Staff Member
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold">Add New Staff</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="e.g. Raju" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Role</label>
                  <input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="e.g. Driver" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Monthly Salary (₹)</label>
                  <input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="5000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Days</label>
                    <input value={schedule} onChange={e => setSchedule(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="Mon - Fri" />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Time</label>
                    <input value={time} onChange={e => setTime(e.target.value)} className="w-full bg-muted/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="10:00 AM" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-border rounded-xl text-sm font-bold">Cancel</button>
                <button
                  onClick={addStaff}
                  disabled={saving || !name || !role}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save Staff
                </button>
              </div>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
