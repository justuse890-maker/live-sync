import {
  BellRing, CalendarDays, ChevronRight, CircleDollarSign,
  Home, IndianRupee, MessageCircle, Plus, Sparkles, UsersRound, Wrench, Clock3,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { ScreenId, inr } from "../types";
import { useStore } from "../../store";

export function Household({ onBack, go }: { onBack: () => void; go: (id: ScreenId) => void }) {
  const { householdStaff, societyNotices, householdReminders, transactions, ready } = useStore();

  // Real data computations
  const pendingReminders = householdReminders.filter(r => !r.done);
  const pendingBills = societyNotices.filter(n => n.type === "bill" && !n.paid);
  const unreadNotices = societyNotices.filter(n => n.type === "notice");
  const pendingBillTotal = pendingBills.reduce((acc, b) => acc + (b.amount || 0), 0);

  // Count attention items
  const attentionCount = pendingReminders.length + pendingBills.length;

  // Latest month household spend (Maid Salary + Tuition + Festival from transactions)
  const householdCategories = new Set(["Maid Salary", "Tuition", "EMI", "Grocery", "Festival", "Rent"]);
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyHouseholdSpend = transactions
    .filter(t => t.type === "expense" && t.date?.startsWith(thisMonthKey) && householdCategories.has(t.category))
    .reduce((acc, t) => acc + t.amount, 0);

  // Next upcoming non-done reminder
  const upcomingReminder = pendingReminders[0];
  // Latest society notice
  const latestNotice = societyNotices[0];
  // Latest pending bill
  const latestBill = pendingBills[0];

  return (
    <>
      <Header title="Home" subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-5">
          {/* Hero card */}
          <section className="rounded-3xl p-5 text-white shadow-lg shadow-indigo-900/10" style={{ background: "linear-gradient(135deg, #172554 0%, #3730A3 58%, #6D28D9 100%)" }}>
            <div className="flex items-start gap-3">
              <div className="size-11 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center"><Home className="size-5" /></div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.13em] text-white/65 font-semibold">Your household, in sync</p>
                <h2 className="font-display text-[22px] leading-tight font-extrabold mt-1">
                  {ready
                    ? attentionCount > 0
                      ? `${attentionCount} thing${attentionCount !== 1 ? "s" : ""} need your attention`
                      : "Everything is on track"
                    : "Loading…"
                  }
                </h2>
              </div>
              <Sparkles className="size-5 text-amber-200" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <HeroMetric value={String(householdStaff.length)} label="Staff" />
              <HeroMetric value={pendingBillTotal > 0 ? `₹${(pendingBillTotal / 1000).toFixed(1)}k` : "₹0"} label="Due soon" />
              <HeroMetric value={String(unreadNotices.length + pendingBills.length)} label="Notices" />
            </div>
          </section>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => go("staff")} className="rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/40 transition-colors">
              <div className="size-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center mb-3"><UsersRound className="size-4" /></div>
              <p className="text-sm font-bold">Home team</p>
              <p className="text-xs text-muted-foreground mt-1">{householdStaff.length > 0 ? `${householdStaff.length} member${householdStaff.length !== 1 ? "s" : ""}` : "Maid, cook & family"}</p>
            </button>
            <button onClick={() => go("calendar")} className="rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/40 transition-colors">
              <div className="size-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center mb-3"><CalendarDays className="size-4" /></div>
              <p className="text-sm font-bold">Family calendar</p>
              <p className="text-xs text-muted-foreground mt-1">Classes, checkups & events</p>
            </button>
          </div>

          {/* Reminders */}
          <section>
            <SectionTitle icon={Wrench}>Upcoming reminders</SectionTitle>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {pendingReminders.length === 0 ? (
                <div className="px-4 py-4 text-xs text-muted-foreground text-center">All caught up! No pending reminders.</div>
              ) : (
                pendingReminders.slice(0, 3).map((r) => (
                  <button key={r.id} onClick={() => go("reminders")} className="w-full px-4 py-3.5 flex items-center gap-3 text-left border-b last:border-0 border-border/60 hover:bg-muted/40">
                    <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: "#6D28D916", color: "#6D28D9" }}>
                      <Wrench className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.dueDate ? `Due: ${r.dueDate}` : "No date set"}{r.repeat ? ` · ${r.repeat}` : ""}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
              <button onClick={() => go("reminders")} className="w-full py-3 text-xs font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-1">
                <Plus className="size-3.5" /> {pendingReminders.length > 3 ? `View all ${pendingReminders.length} reminders` : "Add reminder"}
              </button>
            </div>
          </section>

          {/* Society & bills */}
          <section>
            <SectionTitle icon={BellRing}>Society & bills</SectionTitle>
            {latestNotice ? (
              <button onClick={() => go("society")} className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100">
                <div className="flex gap-3">
                  <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0"><BellRing className="size-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-bold truncate">{latestNotice.title}</p>
                      <span className="size-2 mt-1.5 rounded-full bg-amber-500 shrink-0" />
                    </div>
                    {latestNotice.details && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{latestNotice.details}</p>}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground mt-1 shrink-0" />
                </div>
              </button>
            ) : (
              <button onClick={() => go("society")} className="w-full text-left rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
                <div className="flex gap-3 items-center">
                  <div className="size-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><BellRing className="size-4" /></div>
                  <p className="text-sm text-muted-foreground">No notices yet — tap to add one</p>
                </div>
              </button>
            )}
            {latestBill && (
              <button onClick={() => go("society")} className="w-full mt-2 rounded-2xl bg-card border border-border px-4 py-3.5 flex items-center gap-3 text-left hover:border-primary/40">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><IndianRupee className="size-4" /></div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{latestBill.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{inr(latestBill.amount || 0)} due · {latestBill.date}</p>
                </div>
                <span className="text-xs font-bold text-rose-600">Pay</span>
              </button>
            )}
          </section>

          {/* Household spend */}
          <section className="pb-2">
            <SectionTitle icon={CircleDollarSign}>Household spend</SectionTitle>
            <button onClick={() => go("budgets")} className="w-full rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{inr(monthlyHouseholdSpend)} this month</p>
                  <p className="text-xs text-muted-foreground mt-1">Groceries, staff, tuition & more</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </button>
          </section>

          <button onClick={() => go("staff")} className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground pb-2">
            <MessageCircle className="size-3.5" /> View home team schedules
          </button>
        </div>
      </Screen>
    </>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 px-1 mb-2"><Icon className="size-3.5 text-muted-foreground" /><h3 className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-bold">{children}</h3></div>;
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl bg-white/10 p-2.5"><p className="text-base font-extrabold leading-none">{value}</p><p className="text-[10px] uppercase tracking-wide text-white/70 mt-1">{label}</p></div>;
}
