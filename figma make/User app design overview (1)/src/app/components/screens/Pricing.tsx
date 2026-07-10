import { useMemo, useState } from "react";
import { ArrowLeft, Check, Sparkles, Loader2, Calendar, Infinity as InfinityIcon, Crown, XCircle, RefreshCw, Shield } from "lucide-react";
import { Screen } from "../Shell";
import { useEntitlements } from "../../lib/useEntitlements";
import { api } from "../../lib/api";

const FEATURE_LABELS: Record<string, { label: string; group: string }> = {
  networth: { label: "Net Worth Command Center", group: "Wealth intelligence" },
  timeline: { label: "Financial Timeline", group: "Wealth intelligence" },
  leakage: { label: "Wealth Leakage Detector", group: "Wealth intelligence" },
  inflation: { label: "Lifestyle Inflation Monitor", group: "Wealth intelligence" },
  fire: { label: "FIRE Engine", group: "Wealth intelligence" },
  simulator: { label: "Decision Simulator", group: "Wealth intelligence" },
  coach: { label: "AI Coach", group: "AI & automation" },
  import: { label: "Import transactions (CSV)", group: "AI & automation" },
  country: { label: "Region & tax pack switching", group: "AI & automation" },
  tax: { label: "Tax Assistant", group: "Tax & docs" },
  documents: { label: "Document Vault", group: "Tax & docs" },
  reports: { label: "Reports", group: "Tax & docs" },
  accounts: { label: "Connected Accounts", group: "Money management" },
  budgets: { label: "Budgets", group: "Money management" },
  subscriptions: { label: "Subscription Shield", group: "Money management" },
  loans: { label: "Loans & Borrowings", group: "Money management" },
  categories: { label: "Custom Categories", group: "Money management" },
  emergency: { label: "Emergency Survival", group: "Money management" },
  health: { label: "Financial Health Score", group: "Money management" },
};

export function Pricing({ onBack }: { onBack: () => void }) {
  const { plan, subscription, entitlements, allFeatures, inTrial, trialEndsAt, refresh } = useEntitlements();
  const [busy, setBusy] = useState<null | "upgrade" | "renew" | "cancel">(null);

  const planId = subscription?.planId || "free";
  const isLifetime = !!subscription?.lifetime || planId === "lifetime";
  const isMonthlyPro = planId === "pro" && !isLifetime;
  const isFree = !isMonthlyPro && !isLifetime;
  const renewsAt = subscription?.renewsAt ? new Date(subscription.renewsAt) : null;
  const cancelAt = subscription?.cancelAt ? new Date(subscription.cancelAt) : null;
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;

  const grouped = useMemo(() => {
    const order = ["Wealth intelligence", "AI & automation", "Money management", "Tax & docs", "Other"];
    const groups: Record<string, { key: string; label: string; on: boolean }[]> = {};
    for (const key of allFeatures) {
      const meta = FEATURE_LABELS[key] || { label: key, group: "Other" };
      (groups[meta.group] ||= []).push({ key, label: meta.label, on: !!entitlements[key] });
    }
    return order.filter((g) => groups[g]?.length).map((g) => ({ group: g, items: groups[g] }));
  }, [allFeatures, entitlements]);

  const unlockedCount = Object.values(entitlements).filter(Boolean).length;
  const totalCount = allFeatures.length || Object.keys(entitlements).length;

  const upgrade = async () => {
    setBusy("upgrade");
    try {
      await new Promise((r) => setTimeout(r, 500));
      alert("Payment integration coming soon. Ask an operator to assign Pro from the admin panel.");
      await refresh();
    } finally { setBusy(null); }
  };

  const renew = async () => {
    if (!confirm("Renew Pro for another month?")) return;
    setBusy("renew");
    try { await api.renewSubscription(); await refresh(); }
    catch (e: any) { alert(`Renewal failed: ${e.message || e}`); }
    finally { setBusy(null); }
  };

  const cancel = async () => {
    if (!confirm("Cancel auto-renewal? You'll keep Pro access until the current period ends.")) return;
    setBusy("cancel");
    try { await api.cancelSubscription(); await refresh(); }
    catch (e: any) { alert(`Cancel failed: ${e.message || e}`); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="size-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="size-4" /></button>
        <div>
          <div className="text-base font-semibold">Subscription</div>
          <div className="text-xs text-muted-foreground">Manage your plan and feature access.</div>
        </div>
      </div>
      <Screen>
        <div className="px-5 space-y-4">
          {/* Current plan hero */}
          <div className={`rounded-2xl p-5 border ${isLifetime ? "bg-gradient-to-br from-amber-500/15 via-card to-card border-amber-500/30" : isMonthlyPro ? "bg-gradient-to-br from-indigo-500/15 via-card to-card border-indigo-500/30" : "bg-card border-border/60"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isLifetime ? <Crown className="size-4 text-amber-500" /> : isMonthlyPro ? <Sparkles className="size-4 text-indigo-500" /> : <Shield className="size-4 text-muted-foreground" />}
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>Current plan</span>
              </div>
              {isLifetime && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600" style={{ fontWeight: 600 }}>LIFETIME</span>}
              {isMonthlyPro && !cancelAt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600" style={{ fontWeight: 600 }}>ACTIVE</span>}
              {isMonthlyPro && cancelAt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600" style={{ fontWeight: 600 }}>CANCELS SOON</span>}
              {isFree && inTrial && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-600" style={{ fontWeight: 600 }}>TRIAL</span>}
            </div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>
              {isLifetime ? "Pro Lifetime" : isMonthlyPro ? "Pro" : "Free"}
            </div>
            {isMonthlyPro && (
              <div className="text-sm text-muted-foreground mt-1">₹{plan?.priceMonthly ?? 99}/month</div>
            )}
            {isLifetime && (
              <div className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
                <InfinityIcon className="size-3" /> No renewal — yours forever
              </div>
            )}

            {/* Status line */}
            <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-3">
              <Stat
                icon={<Check className="size-3.5" />}
                label="Features unlocked"
                value={`${unlockedCount}/${totalCount}`}
                tone="positive"
              />
              {isLifetime ? (
                <Stat icon={<InfinityIcon className="size-3.5" />} label="Renewal" value="Never" tone="positive" />
              ) : isMonthlyPro && cancelAt ? (
                <Stat icon={<XCircle className="size-3.5" />} label="Access ends" value={cancelAt.toLocaleDateString()} tone="warning" />
              ) : isMonthlyPro && renewsAt ? (
                <Stat icon={<Calendar className="size-3.5" />} label="Next payment" value={renewsAt.toLocaleDateString()} tone="neutral" />
              ) : isFree && trialEnd ? (
                <Stat icon={<Calendar className="size-3.5" />} label="Trial ends" value={trialEnd.toLocaleDateString()} tone="warning" />
              ) : (
                <Stat icon={<Calendar className="size-3.5" />} label="Since" value={subscription?.since ? new Date(subscription.since).toLocaleDateString() : "—"} tone="neutral" />
              )}
            </div>

            {/* CTAs */}
            <div className="mt-4 flex gap-2">
              {isLifetime ? (
                <div className="flex-1 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex items-center gap-2">
                  <Crown className="size-3.5 text-amber-500 shrink-0" />
                  You bought lifetime. Nothing to manage — enjoy.
                </div>
              ) : isMonthlyPro ? (
                <>
                  <button
                    onClick={renew}
                    disabled={busy !== null}
                    className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {busy === "renew" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Pay next month
                  </button>
                  <button
                    onClick={cancel}
                    disabled={busy !== null || !!cancelAt}
                    className="px-4 h-11 rounded-xl bg-muted text-foreground text-sm font-medium disabled:opacity-60 hover:bg-muted/80"
                  >
                    {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : cancelAt ? "Cancelled" : "Cancel"}
                  </button>
                </>
              ) : (
                <button
                  onClick={upgrade}
                  disabled={busy !== null}
                  className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {busy === "upgrade" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Upgrade to Pro
                </button>
              )}
            </div>
            {isMonthlyPro && cancelAt && (
              <div className="mt-2 text-xs text-amber-600">You'll keep Pro until {cancelAt.toLocaleDateString()}, then move to Free. Tap "Pay next month" to keep going.</div>
            )}
          </div>

          {/* Feature access — what you have */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>What you have access to</div>
            <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
              {grouped.map(({ group, items }) => (
                <div key={group} className="border-b border-border/60 last:border-0">
                  <div className="px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>{group}</div>
                  {items.map((f) => (
                    <div key={f.key} className="flex items-center justify-between px-4 py-2.5">
                      <span className={`text-sm ${f.on ? "" : "text-muted-foreground"}`} style={{ fontWeight: 500 }}>{f.label}</span>
                      {f.on ? (
                        <Check className="size-4 text-emerald-500" />
                      ) : (
                        <XCircle className="size-4 text-muted-foreground/50" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 px-1">
              Pro and Lifetime unlock everything. If a feature shows locked here, an admin may have specifically restricted it for your account — contact support.
            </div>
          </div>

          {/* Lifetime upsell — only for free/monthly users */}
          {!isLifetime && (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card p-5">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <Crown className="size-4" />
                <span className="text-xs uppercase tracking-wide" style={{ fontWeight: 600 }}>Pay once, own forever</span>
              </div>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>₹4,999 <span className="text-sm text-muted-foreground" style={{ fontWeight: 400 }}>one-time</span></div>
              <div className="text-xs text-muted-foreground mt-1">Pays for itself in ~50 months of Pro. No renewals, no surprises.</div>
              <button
                onClick={upgrade}
                disabled={busy !== null}
                className="mt-3 w-full h-10 rounded-xl bg-amber-500 text-white text-sm hover:bg-amber-600 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}
              >
                Get Lifetime
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
            Your data stays on your device first. AI features only send minimum payloads (e.g. merchant strings — never amounts) and only when you opt in.
          </div>
        </div>
      </Screen>
    </>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "positive" | "warning" | "neutral" }) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <div className="bg-card/40 rounded-lg">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">{icon}{label}</div>
      <div className={`mt-1 text-sm ${color}`} style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
