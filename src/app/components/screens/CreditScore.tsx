import { useState } from "react";
import { Plus, Award, AlertTriangle, ArrowUpRight, BarChart2, ShieldCheck } from "lucide-react";
import { useStore } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../screens/Dashboard";
import { getMonthKey, getCurrentMonthKey } from "../../lib/dateUtils";
import { Area, AreaChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";

export function CreditScore({ onBack }: { onBack: () => void }) {
  const { creditScore, addCreditScore, transactions, creditCards } = useStore();
  const [open, setOpen] = useState(false);

  // Form State
  const [score, setScore] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState("CIBIL");

  const currentLog = creditScore[0] || { score: 750, date: "N/A" };
  const scoreVal = currentLog.score;

  const getScoreRating = (val: number) => {
    if (val >= 800) return { label: "Excellent", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" };
    if (val >= 750) return { label: "Good", color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200" };
    if (val >= 700) return { label: "Fair", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" };
    return { label: "Poor", color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-200" };
  };

  const rating = getScoreRating(scoreVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score || !date) return;
    await addCreditScore({
      score: parseInt(score),
      date,
      provider,
    });
    setScore("");
    setOpen(false);
  };

  // Chart data
  const chartData = [...creditScore].reverse().map((c) => ({
    date: new Date(c.date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    score: c.score,
  }));

  // Utilisation = this month's spend on your credit cards ÷ the limits you entered.
  const monthKey = getCurrentMonthKey();
  const creditTxs = transactions.filter((t) => t.type === "expense" && getMonthKey(t.date) === monthKey &&
    (t.creditCardId || (t.payments || []).some((p) => p.mode === "credit")));
  const totalLimit = creditCards.filter((c) => (c.cardType ?? "credit") === "credit").reduce((a, c) => a + (c.creditLimit || 0), 0);
  const creditUsed = creditTxs.reduce((acc, t) => {
    const split = (t.payments || []).find((p) => p.mode === "credit");
    return acc + (split ? split.amount : Math.abs(t.amount));
  }, 0);
  const utilizationPct: number | null = totalLimit > 0 ? Math.min(100, Math.round((creditUsed / totalLimit) * 100)) : null;

  return (
    <>
      <Header
        title="Credit Score"
        subtitle="Track CIBIL &amp; Credit Health"
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
                <DialogTitle className="font-display">Log Credit Score</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Credit Score (300 - 900)</label>
                  <Input type="number" min="300" max="900" placeholder="e.g. 780" value={score} onChange={(e) => setScore(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Provider / Bureau</label>
                    <Input placeholder="CIBIL, Experian, etc." value={provider} onChange={(e) => setProvider(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold">Log Date</label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-2">Log Score</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Main Score Card */}
          <div className="rounded-2xl bg-card border border-border/60 p-6 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-[10px] text-muted-foreground font-bold">
              <Award className="size-3 text-amber-500" />
              {currentLog.provider || "CIBIL"}
            </div>
            
            <div className="size-28 mx-auto rounded-full border-4 border-muted flex flex-col items-center justify-center bg-muted/10">
              <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Score</div>
              <div className="font-display font-extrabold text-3xl text-foreground mt-0.5">{scoreVal}</div>
              <div className={`text-[10px] font-bold ${rating.color} mt-0.5`}>{rating.label}</div>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              Last updated on: <span className="font-semibold text-foreground">{currentLog.date}</span>
            </div>
          </div>

          {/* Historical Trend Chart */}
          {creditScore.length > 1 && (
            <Card className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                <BarChart2 className="size-4" /> Score History
              </div>
              <div className="h-28">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="score-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#64748B" }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={2.5} fill="url(#score-grad)" dot={{ r: 3, stroke: "#4F46E5", strokeWidth: 1.5, fill: "white" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Credit Factors / Utilization */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border/60">
              <div className="text-[10px] text-muted-foreground uppercase">Card Utilization</div>
              <div className="font-display font-extrabold text-base mt-1">{utilizationPct !== null ? `${utilizationPct}%` : "—"}</div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full ${(utilizationPct ?? 0) > 30 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${utilizationPct ?? 0}%` }} />
              </div>
              <div className="text-[9px] text-muted-foreground mt-1.5 font-medium">{utilizationPct !== null ? "This month · keep below 30%" : "Add card limits in Card Desk"}</div>
            </div>
            
            <div className="bg-card rounded-2xl p-4 border border-border/60">
              <div className="text-[10px] text-muted-foreground uppercase">Latest score</div>
              <div className="font-display font-extrabold text-base mt-1">{creditScore[0]?.score ?? "—"}</div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-semibold mt-2.5">
                <ShieldCheck className="size-3.5" /> {creditScore[0] ? `Logged ${new Date(creditScore[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Log your score from your bureau report"}
              </div>
            </div>
          </div>

          {/* AI Tips for Credit Building */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1 font-semibold">Advisor Recommendations</div>
            <div className="space-y-2">
              <div className="bg-card rounded-2xl p-4 border border-border/60 flex items-start gap-3">
                <div className="size-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="size-4" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-semibold text-foreground">Score Impact Assessment</div>
                  <p className="text-muted-foreground mt-0.5">{utilizationPct !== null
                    ? <>Your card utilisation this month is <span className="font-semibold">{utilizationPct}%</span> ({inr(creditUsed)} of {inr(totalLimit)}). Lenders generally prefer it under 30%.</>
                    : <>Add your card limits in Card Desk to see utilisation — one of the biggest factors in a credit score.</>}</p>
                </div>
              </div>

              {creditTxs.length > 3 && (
                <div className="bg-card rounded-2xl p-4 border border-border/60 flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="text-xs leading-relaxed">
                    <div className="font-semibold text-foreground">Card Limit Alert</div>
                    <p className="text-muted-foreground mt-0.5">Frequent small swipe transactions increase credit bureau queries. Shift day-to-day payments to UPI/Cash.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}
