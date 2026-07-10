import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./lib/api";
import { Asset, Liability, LifeEvent } from "./lib/intelligence";

export type PaymentMode = "cash" | "upi" | "credit" | "debit" | "other";
export type PaymentSplit = { mode: PaymentMode; amount: number };

export type Tx = {
  id: string;
  title: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  icon?: string;
  merchant?: string;
  payments?: PaymentSplit[];
  notes?: string;
  createdAt?: string;
};

export const TX_EDIT_WINDOW_MS = 5 * 60 * 1000;
export const canEditTx = (t: Tx) => !!t.createdAt && Date.now() - new Date(t.createdAt).getTime() < TX_EDIT_WINDOW_MS;
export const txEditRemaining = (t: Tx) => {
  if (!t.createdAt) return 0;
  return Math.max(0, TX_EDIT_WINDOW_MS - (Date.now() - new Date(t.createdAt).getTime()));
};

export type Loan = {
  id: string;
  direction: "borrowed" | "lent";
  person: string;
  amount: number;
  mode: PaymentMode;
  takenOn: string;
  repayBy: string;
  notes?: string;
  settled?: boolean;
};

export type Sip = {
  id: string;
  fundName: string;
  amount: number;
  frequency: "monthly" | "quarterly";
  startDate: string;
  deductionDate: number;
  category?: string;
  notes?: string;
  goalId?: string;
};

export type InsurancePolicy = {
  id: string;
  name: string;
  policyNumber?: string;
  type: "life" | "health" | "vehicle" | "home" | "other";
  coverageAmount: number;
  premiumAmount: number;
  dueDate: string;
  expiryDate?: string;
  insurer: string;
  membersCovered: string[];
  notes?: string;
};

export type Investment = {
  id: string;
  name: string;
  type: "mutual_fund" | "stocks" | "fixed_deposit" | "ppf" | "nps" | "elss" | "other";
  investedAmount: number;
  currentValue: number;
  purchaseDate: string;
  notes?: string;
};

export type GoldHolding = {
  id: string;
  name: string;
  type: "physical" | "digital" | "sgb" | "etf";
  weightGrams: number;
  purityKarats?: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string;
};

export type Property = {
  id: string;
  name: string;
  type: "residential" | "commercial" | "land" | "other";
  purchasePrice: number;
  currentValuation: number;
  purchaseDate: string;
  rentalIncome?: number;
  propertyTaxDueDate?: string;
  loanId?: string;
  notes?: string;
};

export type CreditScoreLog = {
  id: string;
  score: number;
  date: string;
  provider?: string;
};

export type FraudAlert = {
  id: string;
  title: string;
  body: string;
  severity: "low" | "medium" | "high";
  date: string;
  status: "pending" | "resolved" | "ignored";
  txId?: string;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  icon: string;
  color: string;
  month?: string;
};

export type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
  color: string;
  month?: string;
};

export type Subscription = {
  id: string;
  name: string;
  cost: number;
  renewal: string;
  category: string;
  status: string;
  trend?: string;
  priceChange?: number;
  icon: string;
  period?: string;
};

const DEFAULT_CATEGORIES = ["Food", "Travel", "Shopping", "Grocery", "Medical", "Rent", "Entertainment", "Other"];

type StoreCtx = {
  ready: boolean;
  transactions: Tx[];
  goals: Goal[];
  budgets: Budget[];
  subscriptions: Subscription[];
  loans: Loan[];
  assets: Asset[];
  liabilities: Liability[];
  lifeEvents: LifeEvent[];
  categories: string[];
  sips: Sip[];
  insurance: InsurancePolicy[];
  investments: Investment[];
  gold: GoldHolding[];
  properties: Property[];
  creditScore: CreditScoreLog[];
  fraudAlerts: FraudAlert[];
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  deleteAllData: () => Promise<void>;
  upsertAsset: (a: Asset | Omit<Asset, "id">) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  upsertLiability: (l: Liability | Omit<Liability, "id">) => Promise<void>;
  removeLiability: (id: string) => Promise<void>;
  upsertLifeEvent: (e: LifeEvent | Omit<LifeEvent, "id">) => Promise<void>;
  removeLifeEvent: (id: string) => Promise<void>;
  addTransaction: (t: Omit<Tx, "id">) => Promise<void>;
  updateTransaction: (t: Tx) => Promise<{ ok: boolean; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addLoan: (l: Omit<Loan, "id">) => Promise<void>;
  settleLoan: (id: string) => Promise<void>;
  removeLoan: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  removeCategory: (name: string) => Promise<void>;
  addSip: (s: Omit<Sip, "id">) => Promise<void>;
  removeSip: (id: string) => Promise<void>;
  addInsurance: (i: Omit<InsurancePolicy, "id">) => Promise<void>;
  removeInsurance: (id: string) => Promise<void>;
  addInvestment: (inv: Omit<Investment, "id">) => Promise<void>;
  updateInvestment: (inv: Investment) => Promise<void>;
  removeInvestment: (id: string) => Promise<void>;
  addGold: (g: Omit<GoldHolding, "id">) => Promise<void>;
  removeGold: (id: string) => Promise<void>;
  addProperty: (p: Omit<Property, "id">) => Promise<void>;
  updateProperty: (p: Property) => Promise<void>;
  removeProperty: (id: string) => Promise<void>;
  addCreditScore: (s: Omit<CreditScoreLog, "id">) => Promise<void>;
  addFraudAlert: (a: Omit<FraudAlert, "id">) => Promise<void>;
  resolveFraudAlert: (id: string, status: "resolved" | "ignored") => Promise<void>;
  addGoal: (g: Omit<Goal, "id">) => Promise<void>;
  updateGoal: (g: Goal) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  addBudget: (b: Omit<Budget, "id">) => Promise<void>;
  updateBudget: (b: Budget) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
  addSubscription: (s: Omit<Subscription, "id">) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7); // Default e.g. "2026-06" or "2026-07"
  });
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [sips, setSips] = useState<Sip[]>([]);
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [gold, setGold] = useState<GoldHolding[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [creditScore, setCreditScore] = useState<CreditScoreLog[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [
        txRemote, loansRemote, catsRemote, assetsRemote, liabRemote, eventsRemote,
        sipsRemote, insRemote, invRemote, goldRemote, propRemote, csRemote, fraudRemote,
        goalsRemote, budgetsRemote, subsRemote
      ] = await Promise.all([
        api.list<Tx>("transactions"),
        api.list<Loan>("loans"),
        api.list<{ id: string; name: string }>("categories"),
        api.list<Asset>("assets"),
        api.list<Liability>("liabilities"),
        api.list<LifeEvent>("lifeEvents"),
        api.list<Sip>("sips"),
        api.list<InsurancePolicy>("insurance"),
        api.list<Investment>("investments"),
        api.list<GoldHolding>("gold"),
        api.list<Property>("properties"),
        api.list<CreditScoreLog>("creditScore"),
        api.list<FraudAlert>("fraudAlerts"),
        api.list<Goal>("goals"),
        api.list<Budget>("budgets"),
        api.list<Subscription>("subscriptions"),
      ]);
      setAssets(assetsRemote);
      setLiabilities(liabRemote);
      setLifeEvents(eventsRemote);
      setSips(sipsRemote);
      setInsurance(insRemote);
      setInvestments(invRemote);
      setGold(goldRemote);
      setProperties(propRemote);
      setCreditScore(csRemote.sort((a, b) => b.date.localeCompare(a.date)));
      setFraudAlerts(fraudRemote);
      setTransactions(txRemote.sort((a, b) => (a.date < b.date ? 1 : -1)));
      setLoans(loansRemote);
      setGoals(goalsRemote);
      setBudgets(budgetsRemote);
      setSubscriptions(subsRemote);

      if (catsRemote.length === 0) {
        setCategories(DEFAULT_CATEGORIES);
      } else {
        const custom = catsRemote.map((c) => c.name).filter(Boolean);
        const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...custom]));
        setCategories(merged);
      }
    } catch (e) {
      console.error("Initial store load failed:", e);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Repayment reminder: surface a browser notification once per session for loans due within 2 days
  useEffect(() => {
    if (!ready || loans.length === 0) return;
    if (typeof Notification === "undefined") return;
    const showSoon = async () => {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return;
        const today = new Date();
        const soon = loans.filter((l) => {
          if (l.settled) return false;
          const d = new Date(l.repayBy);
          const days = (d.getTime() - today.getTime()) / 86400000;
          return days <= 2;
        });
        const seen = JSON.parse(sessionStorage.getItem("livesync-notified") || "[]");
        for (const l of soon) {
          if (seen.includes(l.id)) continue;
          new Notification(`Repayment due — ${l.person}`, {
            body: `${l.direction === "borrowed" ? "You owe" : "They owe you"} ₹${l.amount.toLocaleString("en-IN")} by ${l.repayBy}`,
          });
          seen.push(l.id);
        }
        sessionStorage.setItem("livesync-notified", JSON.stringify(seen));
      } catch (e) {
        console.warn("Notification permission/dispatch failed:", e);
      }
    };
    showSoon();
  }, [ready, loans]);

  const addTransaction = async (t: Omit<Tx, "id">) => {
    try {
      const created = await api.create<Tx>("transactions", t);
      setTransactions((prev) => [created, ...prev]);
    } catch (e) {
      console.error("Add transaction failed:", e);
    }
  };

  const updateTransaction = async (t: Tx) => {
    try {
      const updated = await api.create<Tx>("transactions", t);
      setTransactions((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      return { ok: true };
    } catch (e: any) {
      console.error("Update transaction failed:", e);
      return { ok: false, error: e.message || "Update failed" };
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await api.remove("transactions", id);
      setTransactions((prev) => prev.filter((x) => x.id !== id));
      return { ok: true };
    } catch (e: any) {
      console.error("Delete transaction failed:", e);
      return { ok: false, error: e.message || "Delete failed" };
    }
  };

  const addLoan = async (l: Omit<Loan, "id">) => {
    try {
      const created = await api.create<Loan>("loans", l);
      setLoans((prev) => [created, ...prev]);
    } catch (e) {
      console.error("Add loan failed:", e);
    }
  };

  const settleLoan = async (id: string) => {
    const current = loans.find((l) => l.id === id);
    if (!current) return;
    try {
      const updated = await api.create<Loan>("loans", { ...current, settled: true });
      setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (e) {
      console.error("Settle loan failed:", e);
    }
  };

  const removeLoan = async (id: string) => {
    try {
      await api.remove("loans", id);
      setLoans((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error("Remove loan failed:", e);
    }
  };

  const addCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    try {
      await api.create<{ name: string }>("categories", { name: trimmed });
      setCategories((prev) => [...prev, trimmed]);
    } catch (e) {
      console.error("Add category failed:", e);
    }
  };

  const removeCategory = async (name: string) => {
    if (DEFAULT_CATEGORIES.includes(name)) return;
    try {
      const remote = await api.list<{ id: string; name: string }>("categories");
      const target = remote.find((c) => c.name === name);
      if (target) await api.remove("categories", target.id);
      setCategories((prev) => prev.filter((c) => c !== name));
    } catch (e) {
      console.error("Remove category failed:", e);
    }
  };

  const upsertAsset = async (a: Asset | Omit<Asset, "id">) => {
    try {
      const saved = await api.create<Asset>("assets", { ...a, updatedAt: new Date().toISOString() });
      setAssets((prev) => {
        const exists = prev.find((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
      });
    } catch (e) { console.error("Upsert asset failed:", e); }
  };
  const removeAsset = async (id: string) => {
    try { await api.remove("assets", id); setAssets((p) => p.filter((x) => x.id !== id)); }
    catch (e) { console.error("Remove asset failed:", e); }
  };
  const upsertLiability = async (l: Liability | Omit<Liability, "id">) => {
    try {
      const saved = await api.create<Liability>("liabilities", { ...l, updatedAt: new Date().toISOString() });
      setLiabilities((prev) => {
        const exists = prev.find((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
      });
    } catch (e) { console.error("Upsert liability failed:", e); }
  };
  const removeLiability = async (id: string) => {
    try { await api.remove("liabilities", id); setLiabilities((p) => p.filter((x) => x.id !== id)); }
    catch (e) { console.error("Remove liability failed:", e); }
  };
  const upsertLifeEvent = async (e: LifeEvent | Omit<LifeEvent, "id">) => {
    try {
      const saved = await api.create<LifeEvent>("lifeEvents", e);
      setLifeEvents((prev) => {
        const exists = prev.find((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
      });
    } catch (err) { console.error("Upsert life event failed:", err); }
  };
  const removeLifeEvent = async (id: string) => {
    try { await api.remove("lifeEvents", id); setLifeEvents((p) => p.filter((x) => x.id !== id)); }
    catch (e) { console.error("Remove life event failed:", e); }
  };

  const addSip = async (s: Omit<Sip, "id">) => {
    try {
      const created = await api.create<Sip>("sips", s);
      setSips((prev) => [...prev, created]);
    } catch (e) {
      console.error("Add SIP failed:", e);
    }
  };
  const removeSip = async (id: string) => {
    try {
      await api.remove("sips", id);
      setSips((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Remove SIP failed:", e);
    }
  };

  const addInsurance = async (i: Omit<InsurancePolicy, "id">) => {
    try {
      const created = await api.create<InsurancePolicy>("insurance", i);
      setInsurance((prev) => [...prev, created]);
    } catch (e) {
      console.error("Add insurance failed:", e);
    }
  };
  const removeInsurance = async (id: string) => {
    try {
      await api.remove("insurance", id);
      setInsurance((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error("Remove insurance failed:", e);
    }
  };

  const addInvestment = async (inv: Omit<Investment, "id">) => {
    try {
      const created = await api.create<Investment>("investments", inv);
      setInvestments((prev) => [...prev, created]);
      await upsertAsset({
        category: "investment",
        name: inv.name,
        value: inv.currentValue,
        notes: `Portfolio: ${inv.type}`
      });
    } catch (e) {
      console.error("Add investment failed:", e);
    }
  };
  const updateInvestment = async (inv: Investment) => {
    try {
      const updated = await api.create<Investment>("investments", inv);
      setInvestments((prev) => prev.map((x) => x.id === inv.id ? updated : x));
      const matchingAsset = assets.find((a) => a.name === inv.name);
      if (matchingAsset) {
        await upsertAsset({
          ...matchingAsset,
          value: inv.currentValue
        });
      }
    } catch (e) {
      console.error("Update investment failed:", e);
    }
  };
  const removeInvestment = async (id: string) => {
    try {
      const target = investments.find((x) => x.id === id);
      await api.remove("investments", id);
      setInvestments((prev) => prev.filter((x) => x.id !== id));
      if (target) {
        const matchingAsset = assets.find((a) => a.name === target.name);
        if (matchingAsset) {
          await removeAsset(matchingAsset.id);
        }
      }
    } catch (e) {
      console.error("Remove investment failed:", e);
    }
  };

  const addGold = async (g: Omit<GoldHolding, "id">) => {
    try {
      const created = await api.create<GoldHolding>("gold", g);
      setGold((prev) => [...prev, created]);
      await upsertAsset({
        category: "gold",
        name: g.name,
        value: g.purchasePrice,
        notes: `${g.weightGrams}g ${g.type}`
      });
    } catch (e) {
      console.error("Add gold failed:", e);
    }
  };
  const removeGold = async (id: string) => {
    try {
      const target = gold.find((x) => x.id === id);
      await api.remove("gold", id);
      setGold((prev) => prev.filter((x) => x.id !== id));
      if (target) {
        const matchingAsset = assets.find((a) => a.name === target.name);
        if (matchingAsset) {
          await removeAsset(matchingAsset.id);
        }
      }
    } catch (e) {
      console.error("Remove gold failed:", e);
    }
  };

  const addProperty = async (p: Omit<Property, "id">) => {
    try {
      const created = await api.create<Property>("properties", p);
      setProperties((prev) => [...prev, created]);
      await upsertAsset({
        category: "property",
        name: p.name,
        value: p.currentValuation,
        notes: `${p.type} property`
      });
    } catch (e) {
      console.error("Add property failed:", e);
    }
  };
  const updateProperty = async (p: Property) => {
    try {
      const updated = await api.create<Property>("properties", p);
      setProperties((prev) => prev.map((x) => x.id === p.id ? updated : x));
      const matchingAsset = assets.find((a) => a.name === p.name);
      if (matchingAsset) {
        await upsertAsset({
          ...matchingAsset,
          value: p.currentValuation
        });
      }
    } catch (e) {
      console.error("Update property failed:", e);
    }
  };
  const removeProperty = async (id: string) => {
    try {
      const target = properties.find((x) => x.id === id);
      await api.remove("properties", id);
      setProperties((prev) => prev.filter((x) => x.id !== id));
      if (target) {
        const matchingAsset = assets.find((a) => a.name === target.name);
        if (matchingAsset) {
          await removeAsset(matchingAsset.id);
        }
      }
    } catch (e) {
      console.error("Remove property failed:", e);
    }
  };

  const addCreditScore = async (s: Omit<CreditScoreLog, "id">) => {
    try {
      const created = await api.create<CreditScoreLog>("creditScore", s);
      setCreditScore((prev) => [created, ...prev]);
    } catch (e) {
      console.error("Add credit score failed:", e);
    }
  };

  const addFraudAlert = async (a: Omit<FraudAlert, "id">) => {
    try {
      const created = await api.create<FraudAlert>("fraudAlerts", a);
      setFraudAlerts((prev) => [created, ...prev]);
    } catch (e) {
      console.error("Add fraud alert failed:", e);
    }
  };
  const resolveFraudAlert = async (id: string, status: "resolved" | "ignored") => {
    const current = fraudAlerts.find((x) => x.id === id);
    if (!current) return;
    try {
      const updated = await api.create<FraudAlert>("fraudAlerts", { ...current, status });
      setFraudAlerts((prev) => prev.map((x) => x.id === id ? updated : x));
    } catch (e) {
      console.error("Resolve fraud alert failed:", e);
    }
  };

  const addGoal = async (g: Omit<Goal, "id">) => {
    try {
      const created = await api.create<Goal>("goals", g);
      setGoals((prev) => [...prev, created]);
    } catch (e) {
      console.error("Add goal failed:", e);
    }
  };

  const updateGoal = async (g: Goal) => {
    try {
      const updated = await api.create<Goal>("goals", g);
      setGoals((prev) => prev.map((x) => x.id === g.id ? updated : x));
    } catch (e) {
      console.error("Update goal failed:", e);
    }
  };

  const removeGoal = async (id: string) => {
    try {
      await api.remove("goals", id);
      setGoals((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Remove goal failed:", e);
    }
  };

  const addBudget = async (b: Omit<Budget, "id">) => {
    try {
      const created = await api.create<Budget>("budgets", b);
      setBudgets((prev) => [...prev, created]);
    } catch (e) {
      console.error("Add budget failed:", e);
    }
  };

  const updateBudget = async (b: Budget) => {
    try {
      const updated = await api.create<Budget>("budgets", b);
      setBudgets((prev) => prev.map((x) => x.id === b.id ? updated : x));
    } catch (e) {
      console.error("Update budget failed:", e);
    }
  };

  const removeBudget = async (id: string) => {
    try {
      await api.remove("budgets", id);
      setBudgets((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Remove budget failed:", e);
    }
  };

  const addSubscription = async (s: Omit<Subscription, "id">) => {
    try {
      const created = await api.create<Subscription>("subscriptions", s);
      setSubscriptions((prev) => [...prev, created]);
    } catch (e) {
      console.error("Add subscription failed:", e);
    }
  };

  const removeSubscription = async (id: string) => {
    try {
      await api.remove("subscriptions", id);
      setSubscriptions((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Remove subscription failed:", e);
    }
  };

  const deleteAllData = async () => {
    try {
      setReady(false);
      const cols = ["transactions", "goals", "budgets", "subscriptions", "loans", "assets", "liabilities", "lifeEvents", "sips", "insurance", "investments", "gold", "properties", "creditScore", "fraudAlerts"];
      // Get all items in parallel and delete them
      await Promise.all(
        cols.flatMap(async (col) => {
          try {
            const items = await api.list<{ id: string }>(col);
            return items.map((item) => api.remove(col, item.id));
          } catch (e) {
            console.error(`Fetch/delete items failed for ${col}:`, e);
            return [];
          }
        }).reduce((acc, val) => acc.concat(val as any), [] as Promise<any>[])
      );
      // Re-trigger remote seeding
      await refresh();
    } catch (e) {
      console.error("Delete all data failed:", e);
    } finally {
      setReady(true);
    }
  };

  return (
    <Ctx.Provider value={{
      ready, transactions, goals, budgets, subscriptions, loans, assets, liabilities, lifeEvents, categories,
      sips, insurance, investments, gold, properties, creditScore, fraudAlerts, selectedMonth, setSelectedMonth, deleteAllData,
      addTransaction, updateTransaction, deleteTransaction, addLoan, settleLoan, removeLoan, addCategory, removeCategory,
      upsertAsset, removeAsset, upsertLiability, removeLiability, upsertLifeEvent, removeLifeEvent,
      addSip, removeSip, addInsurance, removeInsurance, addInvestment, updateInvestment, removeInvestment,
      addGold, removeGold, addProperty, updateProperty, removeProperty, addCreditScore, addFraudAlert, resolveFraudAlert,
      addGoal, updateGoal, removeGoal, addBudget, updateBudget, removeBudget, addSubscription, removeSubscription, refresh
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}
