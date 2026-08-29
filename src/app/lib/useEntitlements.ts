import { createContext, createElement, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.subscription();
      setPlan(r.plan ? { id: r.plan.id, name: r.plan.name, priceMonthly: r.plan.priceMonthly, priceOneTime: r.plan.priceOneTime } : null);
      setSubscription(r.subscription || null);
      setEntitlements(r.entitlements || {});
      setAllFeatures(r.allFeatures || []);
      setInTrial(!!r.inTrial);
      setTrialEndsAt(r.subscription?.trialEndsAt ?? null);
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
  const isPro = isPaid || inTrial;

  return createElement(
    Ctx.Provider,
    { value: { plan, subscription, entitlements, allFeatures, inTrial, trialEndsAt, isPaid, isLifetime, isPro, loading, error, refresh, upgrade } },
    children
  );
}

export function useEntitlements(): SubscriptionInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return v;
}

export function useHasFeature(feature: string): boolean {
  const { entitlements, inTrial, subscription, isPaid, loading } = useEntitlements();
  // Never show an upgrade prompt before the account status has been checked.
  if (loading) return true;
  // A paid account has access to every Pro feature.
  if (isPaid || subscription?.planId === "pro" || subscription?.planId === "lifetime" || subscription?.lifetime) return true;
  if (entitlements[feature] === true) return true;
  if (entitlements[feature] === false) return false;
  return inTrial;
}
