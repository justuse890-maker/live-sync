import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  ShieldCheck,
  X,
  Building2,
  Trash2,
  Loader2,
  Info,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  Sparkles,
  Bell,
  Scale,
  ShieldAlert,
  Edit3,
  Upload,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr, ScreenId } from "../types";
import { api } from "../../lib/api";
import { useStore } from "../../store";
import { getAccountSummary } from "../../lib/intelligence";

type Account = {
  id: string;
  bank: string;
  accountType: "Savings" | "Salary" | "Current" | "Credit Card";
  maskedNumber: string;
  consentExpiry?: string;
  aggregator?: string;
  scope?: string[];
  status: "active" | "manual" | "coming_soon" | "revoked";
  lastSyncedAt?: string;
  txCount?: number;
  balance?: number;
  notes?: string;
};

const POPULAR_BANKS = [
  { code: "HDFC", name: "HDFC Bank", color: "#004C8F" },
  { code: "ICICI", name: "ICICI Bank", color: "#F58220" },
  { code: "SBI", name: "State Bank of India", color: "#280071" },
  { code: "AXIS", name: "Axis Bank", color: "#97144D" },
  { code: "KOTAK", name: "Kotak Mahindra Bank", color: "#ED1C24" },
  { code: "PNB", name: "Punjab National Bank", color: "#A20A2A" },
  { code: "YES", name: "Yes Bank", color: "#00539B" },
  { code: "IDFC", name: "IDFC FIRST Bank", color: "#9D1D27" },
  { code: "OTHER", name: "Other Bank / Cooperative", color: "#475569" },
];

const BANK_COLORS: Record<string, string> = {};
for (const b of POPULAR_BANKS) BANK_COLORS[b.name] = b.color;

export function ConnectedAccounts({ onBack, go }: { onBack: () => void; go?: (id: ScreenId) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(() => {
    return localStorage.getItem("livesync_aa_waitlist") === "true";
  });
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const { transactions } = useStore();

  const load = async () => {
    try {
      const items = await api.list<Account>("accounts");
      setAccounts(items);
    } catch (e) {
      console.error("Loading accounts failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deleteAccount = async (id: string, name: string) => {
    if (confirm(`Permanently remove "${name}" from your tracked accounts?`)) {
      try {
        await api.remove("accounts", id);
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      } catch (e) {
        console.error("Delete account failed:", e);
        alert("Failed to delete account. Please try again.");
      }
    }
  };

  const wipeAllMockAccounts = async () => {
    if (confirm("Remove all test / mock accounts from this list?")) {
      try {
        for (const a of accounts) {
          await api.remove("accounts", a.id);
        }
        setAccounts([]);
      } catch (e) {
        console.error("Wipe failed:", e);
      }
    }
  };

  const handleJoinWaitlist = () => {
    const nextState = !waitlistJoined;
    setWaitlistJoined(nextState);
    localStorage.setItem("livesync_aa_waitlist", String(nextState));
  };

  // ── Aggregate balance & per-account summaries ──
  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
    [accounts],
  );

  const accountStats = useMemo(() => {
    const stats: Record<string, ReturnType<typeof getAccountSummary>> = {};
    for (const a of accounts) {
      stats[a.id] = getAccountSummary(transactions, a.id);
    }
    return stats;
  }, [accounts, transactions]);

  // Total linked transactions count
  const totalLinkedTx = useMemo(
    () => transactions.filter((t) => t.accountId && accounts.some((a) => a.id === t.accountId)).length,
    [transactions, accounts],
  );

  return (
    <>
      <Header title="Account Hub" subtitle="All Your Accounts · One View" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-20">

          {/* ── Aggregate Balance Summary ── */}
          {accounts.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-primary via-indigo-700 to-primary text-white p-5 shadow-lg space-y-3">
              <div className="flex items-center gap-2 text-white/80">
                <Wallet className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Total Tracked Balance</span>
              </div>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 700 }}>
                {inr(totalBalance)}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-xl bg-white/10 backdrop-blur-sm py-2 text-center">
                  <div className="text-base" style={{ fontWeight: 700 }}>{accounts.length}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>Accounts</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm py-2 text-center">
                  <div className="text-base" style={{ fontWeight: 700 }}>{totalLinkedTx}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>Linked Tx</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm py-2 text-center">
                  <div className="text-base" style={{ fontWeight: 700 }}>
                    {accounts.filter((a) => a.accountType === "Credit Card").length}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>Cards</div>
                </div>
              </div>
            </div>
          )}

          {/* Top Compliance & Privacy Banner */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Manual account tracking</div>
                <div className="text-[10px] text-slate-300">Non-custodial · No bank-password collection</div>
              </div>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              LiveSync tracks the accounts and transactions you add. We do not ask for bank passwords or OTPs. Account data is synchronised to your cloud account; see Privacy & Data for details about storage and AI processing.
            </p>
          </div>

          {/* Automated Direct Sync: Coming Soon (Under RBI AA Regulatory Integration) */}
          <div className="bg-card rounded-2xl p-4 border border-border/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Automated Direct Bank Sync</div>
                  <div className="text-[11px] text-muted-foreground">RBI Account Aggregator (AA) Gateway</div>
                </div>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                Coming Soon
              </span>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-border/50">
              Direct automated bank linking via <strong>RBI Account Aggregator framework (Finvu, Setu, OneMoney)</strong> requires active NBFC-AA TSP compliance certification. We are completing the regulatory sandbox integration to bring read-only, consent-based bank synchronization safely.
            </div>

            <button
              onClick={handleJoinWaitlist}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                waitlistJoined
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-primary text-primary-foreground hover:bg-primary/95"
              }`}
            >
              {waitlistJoined ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>You're on the AA Early Access List</span>
                </>
              ) : (
                <>
                  <Bell className="size-3.5" />
                  <span>Notify Me When Live AA Sync Launches</span>
                </>
              )}
            </button>
          </div>

          {/* Manual Tracked Bank Accounts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Tracked Bank Accounts</div>
                <div className="text-xs text-muted-foreground">Manual & on-device balance tracking</div>
              </div>
              {accounts.length > 0 && (
                <button
                  onClick={wipeAllMockAccounts}
                  className="text-[11px] text-rose-600 font-semibold hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Add Bank Account Button */}
            <button
              onClick={() => setManualModalOpen(true)}
              className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5 active:scale-[0.99]"
            >
              <Plus className="size-4" />
              <span className="text-sm font-bold">Add Tracked Bank Account</span>
            </button>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 bg-card rounded-2xl border border-border/60 p-4 space-y-1">
                <Building2 className="size-8 text-muted-foreground/40 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-700">No bank accounts tracked yet</div>
                <div className="text-[11px] text-muted-foreground">
                  Add your bank accounts above to track your balance and payment modes locally.
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {accounts.map((a) => {
                  const stats = accountStats[a.id];
                  const bankColor = BANK_COLORS[a.bank] || "#475569";
                  return (
                    <div key={a.id} className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-11 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                          style={{ background: bankColor }}
                        >
                          {a.bank.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-800 truncate">{a.bank}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded">
                              Tracked
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.accountType} {a.maskedNumber ? `· ${a.maskedNumber}` : ""}
                          </div>
                        </div>

                        <button
                          onClick={() => setEditingAccount(a)}
                          title="Edit Account"
                          className="size-8 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition"
                        >
                          <Edit3 className="size-4" />
                        </button>

                        <button
                          onClick={() => deleteAccount(a.id, a.bank)}
                          title="Remove Account"
                          className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {/* Balance and Spending Stats */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-border/40 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Tracked Balance</span>
                          <div className="font-extrabold text-slate-900 mt-0.5">
                            {a.balance != null ? inr(a.balance) : "₹0"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Linked Transactions</span>
                          <div className="font-bold text-slate-800 mt-0.5">
                            {stats?.txCount || 0} entries
                          </div>
                        </div>
                      </div>

                      {/* Per-account spending indicators */}
                      {stats && stats.txCount > 0 && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-lg p-2">
                            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                              <ArrowUpRight className="size-3" /> Income
                            </div>
                            <div className="font-bold text-emerald-800 mt-0.5">{inr(stats.income)}</div>
                          </div>
                          <div className="bg-rose-50/60 border border-rose-100/80 rounded-lg p-2">
                            <div className="flex items-center gap-1 text-[10px] text-rose-700 font-semibold">
                              <ArrowDownRight className="size-3" /> Spent
                            </div>
                            <div className="font-bold text-rose-800 mt-0.5">{inr(stats.expense)}</div>
                          </div>
                          <div className="bg-indigo-50/60 border border-indigo-100/80 rounded-lg p-2">
                            <div className="text-[10px] text-indigo-700 font-semibold">Top Cat.</div>
                            <div className="font-bold text-indigo-800 mt-0.5 truncate">{stats.topCategory}</div>
                          </div>
                        </div>
                      )}

                      {/* Import Statement CTA */}
                      {go && (
                        <button
                          onClick={() => go("import")}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition border border-primary/20"
                        >
                          <Upload className="size-3.5" />
                          Import Bank Statement
                          <ArrowRight className="size-3.5" />
                        </button>
                      )}

                      {a.notes && (
                        <div className="text-[11px] text-slate-500 italic bg-muted/30 px-2.5 py-1.5 rounded-lg">
                          {a.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legal Liability & Regulatory Disclaimers Card */}
          <div className="bg-card rounded-2xl p-4 border border-border/70 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-800">
              <Scale className="size-4 text-primary" />
              <div className="text-xs font-bold uppercase tracking-wider">Legal Terms & Liability Disclaimer</div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed border-t border-border/40 pt-2.5">
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">1. No Transactional Liability:</span>
                <span>LiveSync AI is an on-device personal financial tracking app. We do not process monetary fund transfers, hold custodial deposits, or levy banking transaction fees. We bear zero liability for any external banking charges, overdraft fees, or banking partner tariffs.</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">2. Zero Credential Access:</span>
                <span>We NEVER request, store, decrypt, or transmit user net banking passwords, MPINs, card CVVs, or OTPs.</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">3. On-Device Privacy:</span>
                <span>Your financial entries are encrypted locally on your device. We do not sell or monetize personal financial data to third-party brokers or advertisers.</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">4. Informational Purpose:</span>
                <span>All analytics, projections, and reports are for personal budgeting guidance only and do not constitute statutory audit or certified banking statements.</span>
              </div>
            </div>
          </div>
        </div>
      </Screen>

      {/* Add / Edit Manual Bank Account Modal */}
      {(manualModalOpen || editingAccount) && (
        <ManualAccountModal
          initialData={editingAccount}
          onClose={() => {
            setManualModalOpen(false);
            setEditingAccount(null);
          }}
          onSave={async (accountData) => {
            try {
              if (editingAccount) {
                const updated = await api.create<Account>("accounts", {
                  ...editingAccount,
                  ...accountData,
                });
                setAccounts((prev) => prev.map((x) => (x.id === editingAccount.id ? updated : x)));
              } else {
                const created = await api.create<Account>("accounts", {
                  ...accountData,
                  status: "manual",
                });
                setAccounts((prev) => [created, ...prev]);
              }
              setManualModalOpen(false);
              setEditingAccount(null);
            } catch (e) {
              console.error("Save account failed:", e);
              alert("Failed to save account. Please try again.");
            }
          }}
        />
      )}
    </>
  );
}

function ManualAccountModal({
  initialData,
  onClose,
  onSave,
}: {
  initialData?: Account | null;
  onClose: () => void;
  onSave: (data: Partial<Account>) => Promise<void>;
}) {
  const [bankName, setBankName] = useState(initialData?.bank || POPULAR_BANKS[0].name);
  const [accountType, setAccountType] = useState<Account["accountType"]>(initialData?.accountType || "Savings");
  const [last4, setLast4] = useState(initialData?.maskedNumber?.replace(/[^0-9]/g, "") || "");
  const [balance, setBalance] = useState(initialData?.balance != null ? String(initialData.balance) : "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || saving) return;

    setSaving(true);
    try {
      await onSave({
        bank: bankName.trim(),
        accountType,
        maskedNumber: last4 ? `•••• ${last4.slice(-4)}` : "••••",
        balance: balance ? Number(balance) : 0,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 animate-in fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center pb-3 border-b border-border/50 mb-4">
          <div className="font-bold text-base text-slate-900">
            {initialData ? "Edit Tracked Account" : "Add Tracked Bank Account"}
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center text-slate-500">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Select Bank</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm border border-border outline-none font-medium"
            >
              {POPULAR_BANKS.map((b) => (
                <option key={b.code} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["Savings", "Salary", "Current"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    accountType === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-slate-700 border-border"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Last 4 Digits of Account (Optional)</label>
            <input
              type="text"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 9647"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Current Balance (₹)</label>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Notes / Nickname (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Primary emergency savings"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-800 flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-emerald-600" />
            <span>Saved securely on-device. No banking passwords or credentials are ever requested.</span>
          </div>

          <button
            type="submit"
            disabled={saving || !bankName.trim()}
            className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/95 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {initialData ? "Update Account" : "Save Tracked Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
