import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Sparkles,
  Loader2,
  Calendar,
  Infinity as InfinityIcon,
  Crown,
  XCircle,
  RefreshCw,
  Shield,
  Zap,
  Star,
  CheckCircle2,
  Lock,
  Flame,
  FileSpreadsheet,
  Brain,
  Layers,
  HelpCircle,
  ChevronDown,
  Building2,
  Scale,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { useEntitlements } from "../../lib/useEntitlements";
import { api } from "../../lib/api";

type BillingCycle = "monthly" | "annual";

const PLAN_FEATURES = {
  free: [
    "Unlimited manual transactions & cash tracking",
    "On-device AES-256 local encrypted storage",
    "Basic monthly & category cash flow reports",
    "Tracked bank accounts (Manual balance manager)",
    "Standard budget & goal progress bars",
    "Zero ads & zero user data selling",
  ],
  pro: [
    "Everything in Free Plan, plus:",
    "AI Financial Coach (Private, anonymized queries)",
    "FIRE Retirement & Independence Engine",
    "Wealth Leakage & Lifestyle Inflation Detectors",
    "Encrypted Document Vault (SSL storage)",
    "Statement CSV & bank statement import tool",
    "Full multi-year & weekly comparative analytics",
    "Cross-device encrypted backup & sync",
  ],
  lifetime: [
    "Everything in Pro Plan forever with zero recurring fees",
    "Lifetime VIP Founders badge on your profile",
    "All future Pro feature updates unlocked at no cost",
    "Priority support directly from engineering team",
    "Unlimited document vault storage allocation",
    "Early access to automated RBI Account Aggregator sync",
  ],
};

export function Pricing({ onBack }: { onBack: () => void }) {
  const { plan, subscription, entitlements, inTrial, trialEndsAt, refresh, upgrade } = useEntitlements();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [selectedTier, setSelectedTier] = useState<"free" | "pro" | "lifetime">("pro");
  const [busy, setBusy] = useState<null | "upgrade" | "renew" | "cancel">(null);
  const [sheet, setSheet] = useState<null | "upgrade" | "cancel" | "renew" | "upgraded">(null);

  const planId = subscription?.planId || "free";
  const isLifetime = !!subscription?.lifetime || planId === "lifetime";
  const isMonthlyPro = planId === "pro" && !isLifetime;
  const isFree = !isMonthlyPro && !isLifetime;
  const renewsAt = subscription?.renewsAt ? new Date(subscription.renewsAt) : null;
  const cancelAt = subscription?.cancelAt ? new Date(subscription.cancelAt) : null;
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;

  const requestUpgrade = (tier: "pro" | "lifetime") => {
    setSelectedTier(tier);
    setSheet("upgrade");
  };

  const confirmUpgrade = async () => {
    setBusy("upgrade");
    setSheet(null);
    try {
      await upgrade(selectedTier);
      setSheet("upgraded");
    } catch (e: any) {
      console.error("Upgrade failed:", e);
    } finally {
      setBusy(null);
    }
  };

  const handleDowngrade = async () => {
    setBusy("upgrade");
    try {
      await upgrade("free");
    } catch (e: any) {
      console.error("Downgrade failed:", e);
    } finally {
      setBusy(null);
    }
  };

  const renew = async () => {
    setBusy("renew");
    setSheet(null);
    try {
      await api.renewSubscription();
      await refresh();
    } catch (e: any) {
      console.error("Renewal failed:", e);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    setSheet(null);
    try {
      await api.cancelSubscription();
      await refresh();
    } catch (e: any) {
      console.error("Cancel failed:", e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Header title="Subscription Plans" subtitle="Pro vs Free vs Lifetime" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-6 pb-24">
          
          {/* Hero Header */}
          <div className="text-center space-y-2 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
              <Sparkles className="size-3.5" /> Simple, Transparent & Honest
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Invest in your financial freedom.
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Clear plans and privacy controls. Choose between monthly access or lifetime ownership.
            </p>
          </div>

          {/* Current Plan Status Card */}
          <div
            className={`rounded-2xl p-4 border shadow-sm ${
              isLifetime
                ? "bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-card border-amber-300"
                : isMonthlyPro
                ? "bg-gradient-to-br from-primary/10 via-indigo-50/50 to-card border-primary/30"
                : "bg-card border-border/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isLifetime ? (
                  <Crown className="size-4 text-amber-600" />
                ) : isMonthlyPro ? (
                  <Sparkles className="size-4 text-primary" />
                ) : (
                  <Shield className="size-4 text-muted-foreground" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Plan</span>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  isLifetime
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : isMonthlyPro
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {isLifetime ? "LIFETIME FOUNDER" : isMonthlyPro ? "PRO ACTIVE" : inTrial ? "PRO TRIAL" : "FREE TIER"}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-lg font-black text-slate-900">
                {isLifetime ? "LiveSync Lifetime Access" : isMonthlyPro ? "LiveSync Pro" : "LiveSync Free Starter"}
              </div>
              <div className="text-xs font-bold text-slate-600">
                {isLifetime ? "Never renews" : isMonthlyPro ? "₹99 / month" : "₹0 / forever"}
              </div>
            </div>

            {isMonthlyPro && (
              <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
                <button
                  onClick={() => setSheet("renew")}
                  disabled={busy !== null}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {busy === "renew" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Extend / Renew Pro
                </button>
                <button
                  onClick={() => setSheet("cancel")}
                  disabled={busy !== null || !!cancelAt}
                  className="px-3 py-2 rounded-xl bg-muted text-slate-700 text-xs font-semibold hover:bg-muted/80"
                >
                  {busy === "cancel" ? <Loader2 className="size-3.5 animate-spin" /> : cancelAt ? "Cancels Soon" : "Cancel"}
                </button>
              </div>
            )}
          </div>

          {/* Billing Cycle Switcher for Pro */}
          <div className="flex items-center justify-center">
            <div className="bg-muted/80 p-1 rounded-2xl flex items-center gap-1 border border-border/60">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  billingCycle === "monthly"
                    ? "bg-card text-slate-900 shadow-sm"
                    : "text-muted-foreground hover:text-slate-900"
                }`}
              >
                Monthly Plan
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-slate-900"
                }`}
              >
                <span>Annual Plan</span>
                <span className="text-[9px] bg-emerald-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                  SAVE 33%
                </span>
              </button>
            </div>
          </div>

          {/* 3 Interactive Plan Cards (Free vs Pro vs Lifetime) */}
          <div className="space-y-4">
            
            {/* 1. Free Starter Card */}
            <div className="bg-card rounded-3xl p-5 border border-border/80 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Starter</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">Free Forever</div>
                  <div className="text-xs text-muted-foreground">Basic on-device expense tracking</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">₹0</div>
                  <span className="text-[10px] text-muted-foreground font-semibold">No credit card needed</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/50 pt-3">
                {PLAN_FEATURES.free.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDowngrade}
                disabled={isFree || busy !== null}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition disabled:opacity-60"
              >
                {isFree ? "Current Tier Active" : busy === "upgrade" ? "Updating..." : "Downgrade to Free"}
              </button>
            </div>

            {/* 2. Pro Card (Most Popular) */}
            <div className="bg-gradient-to-b from-primary/5 via-card to-card rounded-3xl p-5 border-2 border-primary shadow-md space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles className="size-3" /> Most Popular
              </div>

              <div className="flex items-start justify-between pt-1">
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Pro Intelligence</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">LiveSync Pro</div>
                  <div className="text-xs text-muted-foreground">Advanced AI & wealth analytics</div>
                </div>
                <div className="text-right">
                  {billingCycle === "annual" ? (
                    <>
                      <div className="text-2xl font-black text-slate-900">₹799</div>
                      <span className="text-[10px] text-emerald-700 font-bold">₹66/mo (Billed annually)</span>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-black text-slate-900">₹99</div>
                      <span className="text-[10px] text-muted-foreground font-semibold">per month</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-border/50 pt-3">
                {PLAN_FEATURES.pro.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-800">
                    <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                    <span className={i === 0 ? "font-bold text-slate-900" : ""}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => requestUpgrade("pro")}
                disabled={isMonthlyPro || isLifetime}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/95 transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isMonthlyPro ? (
                  "Pro Plan Active"
                ) : isLifetime ? (
                  "Lifetime Owned"
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    <span>Get Pro ({billingCycle === "annual" ? "₹799/yr" : "₹99/mo"})</span>
                  </>
                )}
              </button>
            </div>

            {/* 3. Lifetime Founders Card (Best Value) */}
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-card rounded-3xl p-5 border-2 border-amber-400 shadow-md space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider flex items-center gap-1 shadow-sm">
                <Crown className="size-3 text-amber-200" /> Best Value · Pay Once
              </div>

              <div className="flex items-start justify-between pt-1">
                <div>
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Founders Edition</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">Lifetime Unlimited</div>
                  <div className="text-xs text-muted-foreground">Own it forever. Zero subscriptions.</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">₹2,999</div>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                    One-time payment
                  </span>
                </div>
              </div>

              <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-amber-900">
                💡 <strong>Why Lifetime wins:</strong> Other apps charge ₹200–₹1,000/mo forever (₹12,000+ in 3 years). With LiveSync Lifetime, you pay once and never get billed again.
              </div>

              <div className="space-y-2 border-t border-amber-200/60 pt-3">
                {PLAN_FEATURES.lifetime.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-800">
                    <Crown className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className={i === 0 ? "font-bold text-slate-900" : ""}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => requestUpgrade("lifetime")}
                disabled={isLifetime}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs hover:from-amber-600 hover:to-amber-700 transition shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLifetime ? (
                  "Lifetime Owned Forever"
                ) : (
                  <>
                    <Crown className="size-3.5" />
                    <span>Get Lifetime Access (₹2,999 Once)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Privacy commitment */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="size-5 text-emerald-400" />
              <div className="text-sm font-bold text-white">Our privacy commitment</div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              LiveSync is funded by subscriptions. We do not use financial records for advertising. AI features send the information described in their consent screens to their selected AI provider.
            </p>
          </div>
        </div>
      </Screen>

      {/* Upgrade Request Sheet */}
      {sheet === "upgrade" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSheet(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center gap-2 mb-2">
              {selectedTier === "lifetime" ? (
                <Crown className="size-5 text-amber-500" />
              ) : (
                <Sparkles className="size-5 text-primary" />
              )}
              <span className="text-base font-bold text-slate-900">
                Request {selectedTier === "lifetime" ? "Lifetime Founders" : "Pro"} Access
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Online payment gateways are running in regulatory sandbox mode. Your upgrade request will be activated immediately for your account with full access.
            </p>

            <div className="bg-slate-50 p-3 rounded-2xl border border-border/60 mb-4 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Selected Plan:</span>
                <span>{selectedTier === "lifetime" ? "Lifetime Unlimited" : billingCycle === "annual" ? "Pro Annual" : "Pro Monthly"}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pricing:</span>
                <span className="font-semibold text-slate-800">
                  {selectedTier === "lifetime" ? "₹2,999 one-time" : billingCycle === "annual" ? "₹799 / year" : "₹99 / month"}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSheet(null)}
                className="flex-1 bg-muted rounded-xl py-3 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpgrade}
                disabled={busy !== null}
                className="flex-[2] bg-primary text-primary-foreground rounded-xl py-3 text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm"
              >
                {busy === "upgrade" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                Confirm & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgraded Success Sheet */}
      {sheet === "upgraded" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSheet(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 text-center space-y-3"
          >
            <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="text-base font-bold text-slate-900">Plan Activated!</div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Your account has been upgraded with all premium financial intelligence features unlocked.
            </p>
            <button
              onClick={() => setSheet(null)}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-xs shadow-sm"
            >
              Start Using Pro Features
            </button>
          </div>
        </div>
      )}
    </>
  );
}
