import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./lib/api";
import { transactions as seedTx, goals as seedGoals, budgets as seedBudgets, subscriptions as seedSubs } from "./data";
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

const DEFAULT_CATEGORIES = ["Food", "Travel", "Shopping", "Grocery", "Medical", "Rent", "Entertainment", "Other"];

type StoreCtx = {
  ready: boolean;
  transactions: Tx[];
  goals: typeof seedGoals;
  budgets: typeof seedBudgets;
  subscriptions: typeof seedSubs;
  loans: Loan[];
  assets: Asset[];
  liabilities: Liability[];
  lifeEvents: LifeEvent[];
  categories: string[];
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
  refresh: () => Promise<void>;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [goals] = useState(seedGoals);
  const [budgets] = useState(seedBudgets);
  const [subscriptions] = useState(seedSubs);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const refresh = useCallback(async () => {
    try {
      const [txRemote, loansRemote, catsRemote, assetsRemote, liabRemote, eventsRemote] = await Promise.all([
        api.list<Tx>("transactions"),
        api.list<Loan>("loans"),
        api.list<{ id: string; name: string }>("categories"),
        api.list<Asset>("assets"),
        api.list<Liability>("liabilities"),
        api.list<LifeEvent>("lifeEvents"),
      ]);
      setAssets(assetsRemote);
      setLiabilities(liabRemote);
      setLifeEvents(eventsRemote);

      let tx = txRemote;
      if (tx.length === 0) {
        for (const t of seedTx) await api.create<Tx>("transactions", t as Tx);
        tx = await api.list<Tx>("transactions");
      }
      setTransactions(tx.sort((a, b) => (a.date < b.date ? 1 : -1)));
      setLoans(loansRemote);

      if (catsRemote.length === 0) {
        setCategories(DEFAULT_CATEGORIES);
      } else {
        const custom = catsRemote.map((c) => c.name).filter(Boolean);
        const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...custom]));
        setCategories(merged);
      }
    } catch (e) {
      console.error("Initial store load failed, falling back to local seed:", e);
      setTransactions(seedTx as Tx[]);
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

  return (
    <Ctx.Provider value={{ ready, transactions, goals, budgets, subscriptions, loans, assets, liabilities, lifeEvents, categories, addTransaction, updateTransaction, deleteTransaction, addLoan, settleLoan, removeLoan, addCategory, removeCategory, upsertAsset, removeAsset, upsertLiability, removeLiability, upsertLifeEvent, removeLifeEvent, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}
