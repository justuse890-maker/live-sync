import { createContext, createElement, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { isEligibleForPromo, promoDaysRemaining } from "./promoConfig";

export type Entitlements = Record<string, boolean>;
export type SubscriptionInfo = {
  plan: { id: string; name: string; priceMonthly: number; priceOneTime?: number } | null;
  subscription: { planId: string; since?: string; trialEndsAt?: string | null; renewsAt?: string | null; cancelAt?: string | null; lifetime?: boolean } | null;
  entitlements: Entitlements;
  allFeatures: string[];
  inTrial: boolean;
  trialEndsAt: string | null;
  isPaid: boolean;
  isLifetime: boolean;
  isPro: boolean;
  /** True when the 84-day launch promo is active for this user */
  isPromoUser: boolean;
  /** Days remaining in the 84-day promo (0 if not a promo user) */
  promoDaysLeft: number;
  /** ISO string of when this account was created (from Supabase JWT) */
  accountCreatedAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upgrade: (planId: "free" | "pro" | "lifetime") => Promise<void>;
};

const Ctx = createContext<SubscriptionInfo | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<SubscriptionInfo["plan"]>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo["subscription"]>(null);
  const [entitlements, setEntitlements] = useState<Entitlements>({});
  const [allFeatures, setAllFeatures] = useState<string[]>([]);
  const [inTrial, setInTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      // Load subscription info and account creation date in parallel
      const [r, session] = await Promise.all([
        api.subscription(),
        api.session(),
      ]);

      setPlan(r.plan ? { id: r.plan.id, name: r.plan.name, priceMonthly: r.plan.priceMonthly, priceOneTime: r.plan.priceOneTime } : null);
      setSubscription(r.subscription || null);
      setEntitlements(r.entitlements || {});
      setAllFeatures(r.allFeatures || []);
      setInTrial(!!r.inTrial);
      setTrialEndsAt(r.subscription?.trialEndsAt ?? null);

      // Extract account creation timestamp from Supabase session
      const created = (session?.user as any)?.created_at ?? null;
      setAccountCreatedAt(created);

      setError(null);
    } catch (e: any) {
      console.error("Entitlements load failed:", e);
      setError(e.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  const upgrade = useCallback(async (planId: "free" | "pro" | "lifetime") => {
    try {
      setLoading(true);
      await api.upgradeSubscription(planId);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const planId = subscription?.planId || "free";
  const isLifetime = !!subscription?.lifetime || planId === "lifetime";
  const isPaid = isLifetime || planId === "pro";

  // ── Promo logic ──────────────────────────────────────────────────────────
  // A new user who signed up during the active promo window gets full Pro
  // access for 84 days — no payment required, no code needed.
  const isPromoUser = isEligibleForPromo(accountCreatedAt);
  const promoDaysLeft = isPromoUser ? promoDaysRemaining(accountCreatedAt) : 0;

  // isPro = paid subscription OR in-trial OR promo window
  const isPro = isPaid || inTrial || isPromoUser;

  return createElement(
    Ctx.Provider,
    {
      value: {
        plan, subscription, entitlements, allFeatures, inTrial, trialEndsAt,
        isPaid, isLifetime, isPro, isPromoUser, promoDaysLeft, accountCreatedAt,
        loading, error, refresh, upgrade,
      }
    },
    children
  );
}

export function useEntitlements(): SubscriptionInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return v;
}

export function useHasFeature(feature: string): boolean {
  const { entitlements, inTrial, subscription, isPaid, isPro, loading } = useEntitlements();
  // Never show an upgrade prompt before the account status has been checked.
  if (loading) return true;
  // Promo / paid / trial users have access to every Pro feature.
  if (isPro || isPaid || subscription?.planId === "pro" || subscription?.planId === "lifetime" || subscription?.lifetime) return true;
  if (entitlements[feature] === true) return true;
  if (entitlements[feature] === false) return false;
  return inTrial;
}
