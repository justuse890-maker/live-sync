import { useState } from "react";
import { Plus, Home, Trash2, Calendar, FileText, BadgePercent } from "lucide-react";
import { useStore, Property } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card } from "../screens/Dashboard";

const propTypes = {
  residential: "Residential (House/Flat)",
  commercial: "Commercial (Shop/Office)",
  land: "Land / Plot",
  other: "Other Property",
};

export function PropertyScreen({ onBack }: { onBack: () => void }) {
  const { properties, addProperty, removeProperty } = useStore();
  const [open, setOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<"residential" | "commercial" | "land" | "other">("residential");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValuation, setCurrentValuation] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [rentalIncome, setRentalIncome] = useState("");
  const [propertyTaxDueDate, setPropertyTaxDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const totalCapital = properties.reduce((acc, p) => acc + p.purchasePrice, 0);
  const totalValuation = properties.reduce((acc, p) => acc + p.currentValuation, 0);
  const totalRental = properties.reduce((acc, p) => acc + (p.rentalIncome || 0), 0);
  const appreciation = totalValuation - totalCapital;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !purchasePrice || !currentValuation || !purchaseDate) return;
    await addProperty({
      name,
      type,
      purchasePrice: parseFloat(purchasePrice),
      currentValuation: parseFloat(currentValuation),
      purchaseDate,
      rentalIncome: rentalIncome ? parseFloat(rentalIncome) : undefined,
      propertyTaxDueDate: propertyTaxDueDate || undefined,
      notes: notes || undefined,
    });
    // Reset Form
    setName("");
    setType("residential");
    setPurchasePrice("");
    setCurrentValuation("");
    setPurchaseDate("");
    setRentalIncome("");
    setPropertyTaxDueDate("");
    setNotes("");
    setOpen(false);
  };

  return (
    <>
      <Header
        title="Real Estate"
        subtitle="Manage Properties &amp; Rental Income"
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
                <DialogTitle className="font-display">Add Property</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Property Description</label>
                  <Input placeholder="e.g. 3BHK Flat, Sector 56 Gurgaon" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Property Type</label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="land">Land / Plot</SelectItem>
                        <SelectItem value="other">Other Property</SelectItem>
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
                    <label className="text-xs text-muted-foreground font-semibold">Purchase Cost</label>
                    <Input type="number" placeholder="₹ Price Paid" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Current Valuation</label>
                    <Input type="number" placeholder="₹ Est. Value" value={currentValuation} onChange={(e) => setCurrentValuation(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Monthly Rent (Optional)</label>
                    <Input type="number" placeholder="₹ Rental Income" value={rentalIncome} onChange={(e) => setRentalIncome(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Property Tax Due Date</label>
                    <Input type="date" value={propertyTaxDueDate} onChange={(e) => setPropertyTaxDueDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Notes</label>
                  <Input placeholder="Registration details, tenant info, locker docs" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" className="w-full mt-2">Add Property</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Overview Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-900 text-white p-5 shadow-lg shadow-indigo-700/20">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-white/70 text-xs">Total Property Valuation</div>
                <div className="font-display mt-0.5" style={{ fontSize: 32, fontWeight: 800 }}>
                  {inr(totalValuation)}
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-3 gap-3">
              <div>
                <div className="text-white/60 text-[10px] uppercase">Purchased</div>
                <div className="font-display font-semibold text-sm truncate">{inr(totalCapital)}</div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Appreciation</div>
                <div className="font-display font-semibold text-sm text-emerald-300 truncate">
                  +{inr(appreciation)}
                </div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Monthly Rent</div>
                <div className="font-display font-semibold text-sm truncate">{inr(totalRental)}</div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border/60 flex items-center gap-2.5">
              <BadgePercent className="size-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Rental Yield</div>
                <div className="font-display font-bold text-sm">
                  {totalValuation > 0 ? ((totalRental * 12 / totalValuation) * 100).toFixed(1) : "0.0"}%
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border/60 flex items-center gap-2.5">
              <Home className="size-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Total Assets</div>
                <div className="font-display font-bold text-sm">
                  {properties.length} Units
                </div>
              </div>
            </div>
          </div>

          {/* Properties List */}
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold">Property Inventory</div>
            {properties.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <Home className="size-8 mx-auto text-muted-foreground/60 mb-2" />
                <div className="text-sm font-semibold">No properties added yet</div>
                <div className="text-xs text-muted-foreground mt-1">Tap + above to start tracking your family real estate holdings</div>
              </div>
            ) : (
              properties.map((p) => {
                const growth = p.currentValuation - p.purchasePrice;
                return (
                  <Card key={p.id} className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground truncate">{p.name}</h4>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="font-medium bg-muted px-2 py-0.5 rounded text-[10px] capitalize">{propTypes[p.type]}</span>
                          <span>Cost: {inr(p.purchasePrice)}</span>
                        </div>
                        {p.rentalIncome && (
                          <div className="mt-2.5 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                            Rent: {inr(p.rentalIncome)}/month
                          </div>
                        )}
                        {p.propertyTaxDueDate && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                            <Calendar className="size-3 shrink-0" />
                            Tax Due: {p.propertyTaxDueDate}
                          </div>
                        )}
                        {p.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 truncate">"{p.notes}"</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-foreground">{inr(p.currentValuation)}</div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          +{inr(growth)}
                        </div>
                        <button onClick={() => removeProperty(p.id)} className="text-rose-500 hover:text-rose-700 mt-2 p-1">
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
