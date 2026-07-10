import { useState } from "react";
import { Plus, Shield, ShieldAlert, Heart, Car, Home, Calendar, Trash2 } from "lucide-react";
import { useStore, InsurancePolicy } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card } from "../screens/Dashboard";

const policyIcons = {
  health: Heart,
  life: Shield,
  vehicle: Car,
  home: Home,
  other: Shield,
};

const policyNames = {
  health: "Health Insurance",
  life: "Life Insurance",
  vehicle: "Vehicle Insurance",
  home: "Home Insurance",
  other: "General Insurance",
};

export function Insurance({ onBack }: { onBack: () => void }) {
  const { insurance, addInsurance, removeInsurance } = useStore();
  const [open, setOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<"life" | "health" | "vehicle" | "home" | "other">("health");
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [insurer, setInsurer] = useState("");
  const [membersCovered, setMembersCovered] = useState("");
  const [notes, setNotes] = useState("");

  const totalPremium = insurance.reduce((acc, i) => acc + i.premiumAmount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !coverageAmount || !premiumAmount || !dueDate || !insurer) return;
    await addInsurance({
      name,
      type,
      policyNumber: policyNumber || undefined,
      coverageAmount: parseFloat(coverageAmount),
      premiumAmount: parseFloat(premiumAmount),
      dueDate,
      insurer,
      membersCovered: membersCovered ? membersCovered.split(",").map(m => m.trim()) : ["Self"],
      notes: notes || undefined,
    });
    // Reset Form
    setName("");
    setType("health");
    setPolicyNumber("");
    setCoverageAmount("");
    setPremiumAmount("");
    setDueDate("");
    setInsurer("");
    setMembersCovered("");
    setNotes("");
    setOpen(false);
  };

  return (
    <>
      <Header
        title="Insurance Policy"
        subtitle="Manage Coverage &amp; Premiums"
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
                <DialogTitle className="font-display">Add Insurance Policy</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground font-semibold">Policy Name / Plan</label>
                    <Input placeholder="e.g. Optima Secure Health" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Policy Type</label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="health">Health Insurance</SelectItem>
                        <SelectItem value="life">Life Insurance</SelectItem>
                        <SelectItem value="vehicle">Vehicle / Auto</SelectItem>
                        <SelectItem value="home">Home / Property</SelectItem>
                        <SelectItem value="other">Other / General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Insurer / Company</label>
                    <Input placeholder="e.g. HDFC Ergo" value={insurer} onChange={(e) => setInsurer(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Coverage (Sum Insured)</label>
                    <Input type="number" placeholder="₹ Amount" value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Premium Amount</label>
                    <Input type="number" placeholder="₹ Premium" value={premiumAmount} onChange={(e) => setPremiumAmount(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Policy Number (Opt)</label>
                    <Input placeholder="Policy #" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Next Premium Due</label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Members Covered (Comma separated)</label>
                  <Input placeholder="Aarav, Priya, Kabir" value={membersCovered} onChange={(e) => setMembersCovered(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Notes</label>
                  <Input placeholder="Additional notes or links" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" className="w-full mt-2">Add Policy</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Overview Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 shadow-lg shadow-emerald-600/25">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="size-5" />
              </div>
              <div>
                <div className="text-white/70 text-xs">Annual Premium Commitments</div>
                <div className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                  {inr(totalPremium)}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 gap-4">
              <div>
                <div className="text-white/60 text-[10px] uppercase">Active Policies</div>
                <div className="font-display font-semibold text-base">{insurance.length}</div>
              </div>
              <div>
                <div className="text-white/60 text-[10px] uppercase">Avg Coverage</div>
                <div className="font-display font-semibold text-base">
                  {inr(insurance.length > 0 ? insurance.reduce((acc, i) => acc + i.coverageAmount, 0) / insurance.length : 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Policy Gap Check */}
          {insurance.filter((i) => i.type === "life").length === 0 && (
            <Card className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="size-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">Coverage Gap:</span> We noticed you don't have a <span className="font-semibold">Life Insurance (Term Plan)</span> added. For a standard Indian family, we recommend term coverage at least 10x your annual income.
              </div>
            </Card>
          )}

          {/* List of Policies */}
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold">Active Coverage</div>
            {insurance.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <Shield className="size-8 mx-auto text-muted-foreground/60 mb-2" />
                <div className="text-sm font-semibold">No policies added yet</div>
                <div className="text-xs text-muted-foreground mt-1">Tap + above to start tracking your family coverage</div>
              </div>
            ) : (
              insurance.map((i) => {
                const IconComponent = policyIcons[i.type] || Shield;
                return (
                  <Card key={i.id} className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1 flex gap-3">
                        <div className="size-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                          <IconComponent className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display text-sm font-semibold text-foreground truncate">{i.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{i.insurer} · {policyNames[i.type]}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                              Cover: {inr(i.coverageAmount)}
                            </span>
                            <span className="text-[10px] bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded">
                              Due: {i.dueDate}
                            </span>
                          </div>
                          {i.membersCovered.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                              Covered: {i.membersCovered.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-foreground">{inr(i.premiumAmount)}</div>
                        <button onClick={() => removeInsurance(i.id)} className="text-rose-500 hover:text-rose-700 mt-2 p-1">
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
