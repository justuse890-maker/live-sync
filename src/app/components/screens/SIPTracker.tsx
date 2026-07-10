import { useState } from "react";
import { Plus, Calendar, TrendingUp, Trash2, PiggyBank } from "lucide-react";
import { useStore, Sip } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card } from "../screens/Dashboard";

export function SIPTracker({ onBack }: { onBack: () => void }) {
  const { sips, addSip, removeSip, goals } = useStore();
  const [open, setOpen] = useState(false);
  
  // Form State
  const [fundName, setFundName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly">("monthly");
  const [startDate, setStartDate] = useState("");
  const [deductionDate, setDeductionDate] = useState("");
  const [goalId, setGoalId] = useState("");
  const [notes, setNotes] = useState("");

  const totalSip = sips.reduce((acc, s) => acc + s.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundName || !amount || !startDate || !deductionDate) return;
    await addSip({
      fundName,
      amount: parseFloat(amount),
      frequency,
      startDate,
      deductionDate: parseInt(deductionDate),
      goalId: goalId || undefined,
      notes: notes || undefined,
    });
    // Reset Form
    setFundName("");
    setAmount("");
    setStartDate("");
    setDeductionDate("");
    setGoalId("");
    setNotes("");
    setOpen(false);
  };

  return (
    <>
      <Header
        title="SIP Tracker"
        subtitle="Manage Systematic Investments"
        showBack
        onBack={onBack}
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full size-10">
                <Plus className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">Add New SIP</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Mutual Fund Name</label>
                  <Input placeholder="e.g. Parag Parikh Flexi Cap Fund" value={fundName} onChange={(e) => setFundName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Monthly Amount</label>
                    <Input type="number" placeholder="₹ Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Frequency</label>
                    <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Start Date</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Deduction Day</label>
                    <Input type="number" min="1" max="31" placeholder="e.g. 5" value={deductionDate} onChange={(e) => setDeductionDate(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Link to Goal (Optional)</label>
                  <Select value={goalId} onValueChange={setGoalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {goals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Notes</label>
                  <Input placeholder="Folio number, platform, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" className="w-full mt-2">Add SIP</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Overview Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5 shadow-lg shadow-primary/20">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                <PiggyBank className="size-5" />
              </div>
              <div>
                <div className="text-white/70 text-xs">Total Monthly Outflow</div>
                <div className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                  {inr(totalSip)}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 gap-4">
              <div>
                <div className="text-white/60 text-[10px] uppercase">Active SIPs</div>
                <div className="font-display font-semibold text-base">{sips.length}</div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Wealth Target</div>
                <div className="font-display font-semibold text-base">{inr(totalSip * 120)} <span className="text-[10px] text-white/70">(10Yr Est)</span></div>
              </div>
            </div>
          </div>

          {/* Projection Insight */}
          <Card className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-start gap-3">
            <TrendingUp className="size-5 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-primary">SIP Power:</span> Continuing your current monthly SIP of <span className="font-semibold text-primary">{inr(totalSip)}</span> at an expected 12% annual return can grow to approximately <span className="font-semibold text-primary">{inr(totalSip * 230)}</span> in 10 years.
            </div>
          </Card>

          {/* List of SIPs */}
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold">Active Contributions</div>
            {sips.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <Calendar className="size-8 mx-auto text-muted-foreground/60 mb-2" />
                <div className="text-sm font-semibold">No SIPs added yet</div>
                <div className="text-xs text-muted-foreground mt-1">Tap + above to start tracking your investments</div>
              </div>
            ) : (
              sips.map((s) => {
                const linkedGoal = goals.find((g) => g.id === s.goalId);
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground truncate">{s.fundName}</h4>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-medium capitalize">{s.frequency}</span>
                          <span>Deduction: {s.deductionDate}th of month</span>
                        </div>
                        {linkedGoal && (
                          <div className="mt-2 inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            🎯 Link: {linkedGoal.name}
                          </div>
                        )}
                        {s.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">"{s.notes}"</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-foreground">{inr(s.amount)}</div>
                        <button onClick={() => removeSip(s.id)} className="text-rose-500 hover:text-rose-700 mt-2 p-1">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </Screen>
    </>
  );
}
