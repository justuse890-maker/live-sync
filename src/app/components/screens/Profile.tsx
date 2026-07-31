import { useEffect, useState, useMemo } from "react";
import { ChevronRight, Shield, Bell, CreditCard, FileText, HelpCircle, LogOut, Activity, PiggyBank, Receipt, BarChart3, Wallet, Calculator, FolderLock, HandCoins, Tag, Droplets, Flame, Sparkles, TrendingUp, Calendar, Upload, MessageSquare, Users, Banknote, Coins, Home, Award, ShieldAlert, Newspaper, Scale, Phone, Cloud } from "lucide-react";
import { Header, Screen } from "../Shell";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { inr, ScreenId } from "../types";
import { api } from "../../lib/api";
import { useStore } from "../../store";
import { netWorth } from "../../lib/intelligence";

const wealth: { id: ScreenId; label: string; icon: any; tint: string }[] = [
  { id: "news",      label: "Financial News Hub",          icon: Newspaper,  tint: "#0EA5E9" },
  { id: "networth",  label: "Net Worth Command Center",     icon: Wallet,     tint: "#1E40AF" },
  { id: "timeline",  label: "Financial Timeline",           icon: Calendar,   tint: "#0EA5E9" },
  { id: "leakage",   label: "Wealth Leakage Detector",      icon: Droplets,   tint: "#EF4444" },
  { id: "inflation", label: "Lifestyle Inflation Monitor",  icon: TrendingUp, tint: "#F59E0B" },
  { id: "fire",      label: "FIRE Engine",                  icon: Flame,      tint: "#8B5CF6" },
  { id: "simulator", label: "Decision Simulator",           icon: Sparkles,   tint: "#10B981" },
  { id: "investments",label: "Investment Portfolio",        icon: TrendingUp, tint: "#10B981" },
  { id: "gold",      label: "Gold Tracker",                 icon: Coins,      tint: "#F59E0B" },
  { id: "property",  label: "Real Estate (Properties)",     icon: Home,       tint: "#8B5CF6" },
];

const more: { id: ScreenId; label: string; icon: any; tint: string }[] = [
  { id: "health", label: "Financial Health", icon: Activity, tint: "#1E40AF" },
  { id: "budgets", label: "Budgets", icon: PiggyBank, tint: "#10B981" },
  { id: "subscriptions", label: "Subscription Shield", icon: Receipt, tint: "#F59E0B" },
  { id: "emergency", label: "Emergency Survival", icon: Shield, tint: "#EF4444" },
  { id: "loans", label: "Loans & Borrowings", icon: HandCoins, tint: "#8B5CF6" },
  { id: "categories", label: "Expense Categories", icon: Tag, tint: "#0EA5E9" },
  { id: "reports", label: "Reports", icon: BarChart3, tint: "#64748B" },
  { id: "family", label: "Family Finance", icon: Users, tint: "#EC4899" },
  { id: "cash", label: "Cash Wallet", icon: Banknote, tint: "#10B981" },
  { id: "sip", label: "SIP Tracker", icon: PiggyBank, tint: "#10B981" },
  { id: "insurance", label: "Insurance Policies", icon: Shield, tint: "#1E40AF" },
  { id: "creditscore", label: "Credit Score Log", icon: Award, tint: "#64748B" },
  { id: "fraud", label: "AI Fraud Alerts", icon: ShieldAlert, tint: "#EF4444" },
];

const settings: { label: string; icon: any; id?: ScreenId }[] = [
  { label: "Notifications", icon: Bell, id: "notifications" },
  { label: "Connected Accounts", icon: Wallet, id: "accounts" },
  { label: "Document Vault", icon: FolderLock, id: "documents" },
  { label: "Tax Assistant", icon: Calculator, id: "tax" },
  { label: "Security & Privacy", icon: Shield, id: "security" },
  { label: "Subscription Plan", icon: CreditCard, id: "pricing" },
  { label: "Import transactions", icon: Upload, id: "import" },
  { label: "Privacy & Data", icon: FileText, id: "privacy" },
  { label: "Data Safety & Account", icon: Shield, id: "data-safety" },
  { label: "Cloud Backup", icon: Cloud, id: "cloud-backup" },
  { label: "Send feedback", icon: MessageSquare, id: "feedback" },
  { label: "Help & Support", icon: HelpCircle },
];

const legal: { label: string; icon: any; id: ScreenId }[] = [
  { label: "Privacy Policy", icon: Shield, id: "privacy-policy" },
  { label: "Terms & Conditions", icon: Scale, id: "terms" },
  { label: "Contact Us", icon: Phone, id: "contact" },
];

export function Profile({ go }: { go: (id: ScreenId) => void }) {
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const { transactions, assets, liabilities } = useStore();

  useEffect(() => {
    (async () => {
      try {
        const session = await api.session();
        const name = session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "User";
        const email = session?.user?.email || "";
        setUserName(name);
        setUserEmail(email);
        const parts = name.split(" ");
        const initials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
        setUserInitials(initials);
      } catch { /* use defaults */ }
    })();
  }, []);

  const nw = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);

  const healthScore = useMemo(() => {
    const monthlyIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const monthlyExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    let score = 50;
    if (monthlyIncome > 0) {
      const savingsRate = (monthlyIncome - monthlyExpenses) / monthlyIncome;
      score += Math.min(20, savingsRate * 60);
    }
    if (nw.netWorth > 0) score += 10;
    return Math.min(100, Math.round(score));
  }, [transactions, nw]);

  const emergencyMonths = useMemo(() => {
    const monthlyExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    if (monthlyExpenses <= 0) return 0;
    const liquid = assets.filter(a => a.category === "savings" || a.category === "cash" || a.category === "investment").reduce((s, a) => s + a.value, 0);
    return Math.round((liquid / monthlyExpenses) * 10) / 10;
  }, [transactions, assets]);

  return (
    <>
      <Header title="Profile" />
      <Screen>
        <div className="px-5 pt-2 space-y-4">
          <div className="bg-card rounded-2xl p-5 border border-border/60 flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary text-primary-foreground" style={{ fontSize: 18 }}>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{userName}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Net worth" value={nw.netWorth > 0 ? inr(nw.netWorth) : "—"} />
            <StatCard label="Score" value={`${healthScore}`} />
            <StatCard label="Runway" value={emergencyMonths > 0 ? `${emergencyMonths}m` : "—"} />
          </div>

          {/* ITR Filing Autopilot Action */}
          <button
            onClick={() => go("itr-filing")}
            className="w-full flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-4 shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <FileText className="size-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-bold font-display tracking-wide text-[15px]">File ITR (Autopilot)</div>
                <div className="text-xs text-blue-100 font-medium mt-0.5">CA-level accuracy • Zero effort</div>
              </div>
            </div>
            <ChevronRight className="size-5 text-white/80" />
          </button>

          <Section title="Wealth intelligence">
            {wealth.map((m) => (
              <Row key={m.id} icon={<m.icon className="size-4" />} tint={m.tint} label={m.label} onClick={() => go(m.id)} />
            ))}
          </Section>

          <Section title="More tools">
            {more.map((m) => (
              <Row key={m.id} icon={<m.icon className="size-4" />} tint={m.tint} label={m.label} onClick={() => go(m.id)} />
            ))}
          </Section>

          <Section title="Settings">
            {settings.map((s) => (
              <Row key={s.label} icon={<s.icon className="size-4" />} tint="#64748B" label={s.label} onClick={s.id ? () => go(s.id!) : undefined} />
            ))}
          </Section>

          <Section title="Legal">
            {legal.map((l) => (
              <Row key={l.id} icon={<l.icon className="size-4" />} tint="#64748B" label={l.label} onClick={() => go(l.id)} />
            ))}
          </Section>

          {signOutConfirm ? (
            <div className="bg-card rounded-2xl border border-rose-200 p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-center">Sign out of LiveSync?</p>
              <p className="text-xs text-muted-foreground text-center">Your data stays safely in the cloud.</p>
              <div className="flex gap-2">
                <button onClick={() => setSignOutConfirm(false)} className="flex-1 bg-muted rounded-xl py-2.5 text-sm font-semibold">Cancel</button>
                <button onClick={() => api.signout()} className="flex-[2] bg-rose-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5">
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setSignOutConfirm(true)} className="w-full bg-card rounded-2xl p-4 border border-border/60 flex items-center gap-3 text-rose-600 active:scale-[0.98] transition-transform">
              <LogOut className="size-4" />
              <span className="text-sm" style={{ fontWeight: 600 }}>Sign out</span>
            </button>
          )}

          <div className="text-center text-xs text-muted-foreground py-2">LiveSync AI · v1.0.0</div>
        </div>
      </Screen>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon, tint, label, onClick }: { icon: React.ReactNode; tint: string; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0 hover:bg-muted/40 transition">
      <div className="size-9 rounded-lg flex items-center justify-center" style={{ background: tint + "15", color: tint }}>{icon}</div>
      <span className="flex-1 text-left text-sm" style={{ fontWeight: 500 }}>{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 border border-border/60 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display mt-1" style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
