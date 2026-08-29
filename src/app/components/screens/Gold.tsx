import { useState } from "react";
import { Plus, Coins, Trash2, ArrowUpRight, Scale } from "lucide-react";
import { useStore, GoldHolding } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card } from "../screens/Dashboard";

// Mock live gold rate (in INR per gram)
const LIVE_RATE_24K = 7250;
const LIVE_RATE_22K = 6650;

export function Gold({ onBack }: { onBack: () => void }) {
  const { gold, addGold, removeGold } = useStore();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<"physical" | "digital" | "sgb" | "etf">("physical");
  const [weightGrams, setWeightGrams] = useState("");
  const [purityKarats, setPurityKarats] = useState<"22" | "24">("22");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");

  // Calculations
  const totalWeight = gold.reduce((acc, g) => acc + g.weightGrams, 0);
  const totalCapital = gold.reduce((acc, g) => acc + g.purchasePrice, 0);

  // Calculate current value dynamically based on weight & gold type
  const calculateCurrentValue = (g: GoldHolding) => {
    if (g.type === "sgb" || g.type === "etf") {
      // Typically SGB/ETFs follow 24K rate
      return g.weightGrams * LIVE_RATE_24K;
    }
    const rate = g.purityKarats === 24 ? LIVE_RATE_24K : LIVE_RATE_22K;
    return g.weightGrams * rate;
  };

  const totalValue = gold.reduce((acc, g) => acc + calculateCurrentValue(g), 0);
  const totalReturns = totalValue - totalCapital;
  const returnsPct = totalCapital > 0 ? (totalReturns / totalCapital) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name || !weightGrams || !purchasePrice || !purchaseDate) return;
    setSubmitting(true);
    try {
      await addGold({
        name: name.trim(),
        type,
        weightGrams: parseFloat(weightGrams),
        purityKarats: type === "physical" ? parseInt(purityKarats) as 22 | 24 : 24,
        purchasePrice: parseFloat(purchasePrice),
        purchaseDate,
        notes: notes ? notes.trim() : undefined,
      });
      // Reset Form
      setName("");
      setType("physical");
      setWeightGrams("");
      setPurityKarats("22");
      setPurchasePrice("");
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
        title="Gold Tracker"
        subtitle="Manage Gold &amp; Precious Metals"
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
                <DialogTitle className="font-display">Add Gold Holding</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Description / Label</label>
                  <Input placeholder="e.g. Gold Necklace, SGB 2023 Series IV" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Gold Type</label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Physical Gold (Ornaments)</SelectItem>
                        <SelectItem value="digital">Digital Gold</SelectItem>
                        <SelectItem value="sgb">Sovereign Gold Bonds</SelectItem>
                        <SelectItem value="etf">Gold ETFs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Weight (in Grams)</label>
                    <Input type="number" step="0.01" placeholder="e.g. 10" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {type === "physical" ? (
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold">Purity (Karats)</label>
                      <Select value={purityKarats} onValueChange={(v: any) => setPurityKarats(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22">22 Karat (Jewelry)</SelectItem>
                          <SelectItem value="24">24 Karat (Pure)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold">Purity (Fixed)</label>
                      <Input value="24 Karat" disabled />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Purchase Price (Total)</label>
                    <Input type="number" placeholder="₹ Total Paid" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground font-semibold">Purchase Date</label>
                    <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Notes</label>
                  <Input placeholder="Locker location, certificate ID, remarks" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" disabled={submitting} className="w-full mt-2">
                  {submitting ? "Adding Gold..." : "Add Gold Holding"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Gold Rate Banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-amber-600" />
              <span className="font-semibold text-amber-800">Est. Gold Rate:</span>
            </div>
            <div className="text-right text-amber-900 font-semibold flex items-center gap-3">
              <span>24K: {inr(LIVE_RATE_24K)}/g</span>
              <span>22K: {inr(LIVE_RATE_22K)}/g</span>
            </div>
          </div>

          {/* Overview Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-white p-5 shadow-lg shadow-amber-500/20">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-white/70 text-xs">Current Gold Value</div>
                <div className="font-display mt-0.5" style={{ fontSize: 32, fontWeight: 800 }}>
                  {inr(totalValue)}
                </div>
              </div>
              <div className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/15 ${totalReturns >= 0 ? "text-emerald-300" : "text-rose-300"}`} style={{ fontWeight: 600 }}>
                <ArrowUpRight className="size-3.5" />
                {returnsPct.toFixed(1)}%
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-3 gap-3">
              <div>
                <div className="text-white/60 text-[10px] uppercase">Total Weight</div>
                <div className="font-display font-semibold text-base">{totalWeight.toFixed(1)}g</div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Invested Cost</div>
                <div className="font-display font-semibold text-sm truncate">{inr(totalCapital)}</div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Returns</div>
                <div className="font-display font-semibold text-sm truncate">
                  {totalReturns >= 0 ? "+" : ""}{inr(totalReturns)}
                </div>
              </div>
            </div>
          </div>

          {/* Gold Holdings List */}
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold">Asset Inventory</div>
            {gold.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <Scale className="size-8 mx-auto text-muted-foreground/60 mb-2" />
                <div className="text-sm font-semibold">No gold assets added yet</div>
                <div className="text-xs text-muted-foreground mt-1">Tap + above to start tracking physical or digital gold holdings</div>
              </div>
            ) : (
              gold.map((g) => {
                const currentVal = calculateCurrentValue(g);
                const returns = currentVal - g.purchasePrice;
                return (
                  <Card key={g.id} className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground truncate">{g.name}</h4>
                        <div className="flex items-center gap-2.5 mt-1 text-xs text-muted-foreground">
                          <span className="font-medium bg-muted px-2 py-0.5 rounded text-[10px] capitalize">{g.type}</span>
                          <span>{g.weightGrams}g</span>
                          {g.type === "physical" && <span>{g.purityKarats}K</span>}
                        </div>
                        {g.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 truncate">"{g.notes}"</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-foreground">{inr(currentVal)}</div>
                        <div className={`text-[10px] font-semibold mt-0.5 ${returns >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {returns >= 0 ? "+" : ""}{inr(returns)}
                        </div>
                        <button onClick={() => removeGold(g.id)} className="text-rose-500 hover:text-rose-700 mt-2 p-1">
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
