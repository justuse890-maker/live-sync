import { useState } from "react";
import { Plus, TrendingUp, PieChart as ChartIcon, Trash2, ArrowUpRight, BarChart2 } from "lucide-react";
import { useStore, Investment } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card } from "../screens/Dashboard";

const invTypes = {
  mutual_fund: "Mutual Fund",
  stocks: "Stocks / Equity",
  fixed_deposit: "Fixed Deposit",
  ppf: "PPF (Public Prov Fund)",
  nps: "NPS (Nat Pension Scheme)",
  elss: "ELSS (Tax Saving MF)",
  other: "Other Asset",
};

export function Investments({ onBack }: { onBack: () => void }) {
  const { investments, addInvestment, removeInvestment } = useStore();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<"mutual_fund" | "stocks" | "fixed_deposit" | "ppf" | "nps" | "elss" | "other">("mutual_fund");
  const [investedAmount, setInvestedAmount] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");

  const totalInvested = investments.reduce((acc, i) => acc + i.investedAmount, 0);
  const totalCurrent = investments.reduce((acc, i) => acc + i.currentValue, 0);
  const absoluteReturns = totalCurrent - totalInvested;
  const returnsPct = totalInvested > 0 ? (absoluteReturns / totalInvested) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name || !investedAmount || !currentValue || !purchaseDate) return;
    setSubmitting(true);
    try {
      await addInvestment({
        name: name.trim(),
        type,
        investedAmount: parseFloat(investedAmount),
        currentValue: parseFloat(currentValue),
        purchaseDate,
        notes: notes ? notes.trim() : undefined,
      });
      // Reset Form
      setName("");
      setType("mutual_fund");
      setInvestedAmount("");
      setCurrentValue("");
      setPurchaseDate("");
      setNotes("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header
        title="Investments"
        subtitle="Family Investment Portfolio"
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
                <DialogTitle className="font-display">Add Investment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Investment Name / Scheme</label>
                  <Input placeholder="e.g. Nippon India Small Cap Fund" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Asset Type</label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
                        <SelectItem value="stocks">Direct Equity (Stocks)</SelectItem>
                        <SelectItem value="fixed_deposit">Fixed Deposit (FD)</SelectItem>
                        <SelectItem value="ppf">PPF (Govt Scheme)</SelectItem>
                        <SelectItem value="nps">NPS (Retirement)</SelectItem>
                        <SelectItem value="elss">ELSS (Tax Saving)</SelectItem>
                        <SelectItem value="other">Other Asset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Purchase Date</label>
                    <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Invested Amount</label>
                    <Input type="number" placeholder="₹ Invested" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Current Market Value</label>
                    <Input type="number" placeholder="₹ Current" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Notes</label>
                  <Input placeholder="Folio #, account #, remarks" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" disabled={submitting} className="w-full mt-2">
                  {submitting ? "Adding to Portfolio..." : "Add to Portfolio"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Portfolio Summary Card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary to-blue-800 text-white p-5 shadow-lg shadow-primary/20">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-white/70 text-xs">Total Portfolio Value</div>
                <div className="font-display mt-0.5" style={{ fontSize: 32, fontWeight: 800 }}>
                  {inr(totalCurrent)}
                </div>
              </div>
              <div className={`flex flex-col items-end gap-0.5`}>
                <div className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/15 ${absoluteReturns >= 0 ? "text-emerald-300" : "text-rose-300"}`} style={{ fontWeight: 600 }}>
                  {absoluteReturns >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowUpRight className="size-3.5 rotate-180" />}
                  {absoluteReturns >= 0 ? "+" : ""}{returnsPct.toFixed(1)}%
                </div>
                <div className="text-[9px] text-white/50 tracking-wide">Absolute return</div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 gap-4">
              <div>
                <div className="text-white/60 text-[10px] uppercase">Invested Capital</div>
                <div className="font-display font-semibold text-base">{inr(totalInvested)}</div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Total Returns</div>
                <div className="font-display font-semibold text-base">
                  {absoluteReturns >= 0 ? "+" : ""}{inr(absoluteReturns)}
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Breakdown Teaser */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border/60 flex items-center gap-2.5">
              <ChartIcon className="size-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Equity Weight</div>
                <div className="font-display font-bold text-sm">
                  {((investments.filter(x => ["mutual_fund", "stocks", "elss"].includes(x.type)).reduce((acc, i) => acc + i.currentValue, 0) / (totalCurrent || 1)) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border/60 flex items-center gap-2.5">
              <BarChart2 className="size-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Debt / Fixed</div>
                <div className="font-display font-bold text-sm">
                  {((investments.filter(x => ["fixed_deposit", "ppf", "nps"].includes(x.type)).reduce((acc, i) => acc + i.currentValue, 0) / (totalCurrent || 1)) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          {/* Holdings List */}
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold">Your Holdings</div>
            {investments.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <TrendingUp className="size-8 mx-auto text-muted-foreground/60 mb-2" />
                <div className="text-sm font-semibold">No investments tracked</div>
                <div className="text-xs text-muted-foreground mt-1">Tap + above to build your family wealth portfolio</div>
              </div>
            ) : (
              investments.map((inv) => {
                const returns = inv.currentValue - inv.investedAmount;
                const profitPct = (returns / inv.investedAmount) * 100;
                return (
                  <Card key={inv.id} className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground truncate">{inv.name}</h4>
                        <div className="flex items-center gap-2.5 mt-1 text-xs text-muted-foreground">
                          <span className="font-medium bg-muted px-2 py-0.5 rounded text-[10px]">{invTypes[inv.type]}</span>
                          <span>Cost: {inr(inv.investedAmount)}</span>
                        </div>
                        {inv.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 truncate">"{inv.notes}"</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-foreground">{inr(inv.currentValue)}</div>
                        <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 mt-0.5 ${returns >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {returns >= 0 ? "+" : ""}{profitPct.toFixed(1)}%
                        </div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">Absolute return</div>
                        <button onClick={() => removeInvestment(inv.id)} className="text-rose-500 hover:text-rose-700 mt-2 p-1">
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
