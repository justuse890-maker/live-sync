import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./lib/api";
import { Asset, Liability, LifeEvent } from "./lib/intelligence";
import { saveToCache, loadFromCache, clearCache } from "./lib/localCache";
import { getCurrentMonthKey } from "./lib/dateUtils";

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
  creditCardId?: string; // ID of the credit card used (when payment mode is 'credit')
  accountId?: string; // ID of the linked bank account (from ConnectedAccounts)
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

export type StructuredLoanType =
  | "home_loan"
  | "car_loan"
  | "personal_loan"
  | "education_loan"
  | "property_registration"
  | "builder_demand"
  | "other";

export type BuilderMilestone = {
  stage: string; // e.g. "Slab", "Possession"
  amount: number;
  dueDate: string;
  paid: boolean;
};

export type StructuredLoan = {
  id: string;
  loanType: StructuredLoanType;
  lenderName: string; // Bank name or person for registration loan
  linkedPropertyId?: string; // ID from the properties collection
  principalAmount: number;
  outstandingPrincipal: number;
  interestRatePA: number; // Annual interest rate %
  tenureMonths: number;
  emiAmount: number;
  disbursementDate: string;
  nextEmiDueDate: string;
  emisPaid: number;
  totalEmis: number;
  isRegistrationLoan: boolean;
  builderMilestones?: BuilderMilestone[];
  notes?: string;
  closed?: boolean;
  createdAt?: string;
};

export type CreditCardType = "credit" | "debit" | "forex" | "rupay_upi" | "prepaid" | "corporate" | "fuel" | "transit" | "other";
export type CardNetwork = "visa" | "mastercard" | "rupay" | "amex" | "diners" | "discover" | "other";

export type CreditCard = {
  id: string;
  bankName: string;
  cardName: string; // e.g. "HDFC Regalia Gold", "Amazon Pay ICICI", "SBI Global Debit"
  cardType?: CreditCardType; // "credit" | "debit" | "forex" | "rupay_upi" | "prepaid" | "corporate" | "fuel" | "transit"
  network?: CardNetwork; // "visa" | "mastercard" | "rupay" | "amex" | "diners" | "discover" | "other"
  last4Digits: string;
  creditLimit?: number; // Total limit for Credit/Corporate, or daily limit for Debit/Forex
  statementDate?: number; // Day of month (1-31)
  dueDate?: number; // Preferred payment reminder day of month (1-31)
  expiryMonth?: string; // MM e.g. "08"
  expiryYear?: string; // YY e.g. "29"
  annualFee?: number;
  isLifetimeFree?: boolean;
  rewardType?: "cashback" | "points" | "miles" | "fuel" | "none";
  rewardRate?: number; // Percentage or points rate e.g. 1.5, 3.3
  color: string; // for display gradient
  notes?: string;
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

export type Bucket = {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  targetAmount: number;
  savedAmount: number;
  monthlySaveTarget?: number; // P3: how much to save per month
  targetDate?: string;
  iconOrColor: string;
  status: "active" | "completed" | "archived";
  createdAt?: string;
  updatedAt?: string;
};

export type BucketContribution = {
  id: string;
  bucketId: string;
  userId?: string;
  amount: number;
  sourceAccountId?: string;
  note?: string;
  date: string;
  linkedTransactionId?: string;
  createdAt: string;
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

/** Generic deduplication helper ensuring unique ID and functional uniqueness */
export function dedupeList<T extends { id?: string }>(
  items: T[],
  functionalKeyFn?: (item: T) => string
): T[] {
  if (!Array.isArray(items)) return [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (!item) continue;
    const id = item.id;
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    if (functionalKeyFn) {
      const key = functionalKeyFn(item);
      if (key) {
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }
    }
    result.push(item);
  }
  return result;
}

export const propertyKey = (p: Property) => `${(p.name || "").trim().toLowerCase()}|${p.type}|${p.purchasePrice}|${p.currentValuation}|${p.purchaseDate}`;
export const goldKey = (g: GoldHolding) => `${(g.name || "").trim().toLowerCase()}|${g.type}|${g.weightGrams}|${g.purchasePrice}`;
export const investmentKey = (i: Investment) => `${(i.name || "").trim().toLowerCase()}|${i.type}|${i.currentValue}|${i.investedAmount || 0}`;
export const sipKey = (s: Sip) => `${(s.fundName || "").trim().toLowerCase()}|${s.amount}|${s.startDate}`;
export const insuranceKey = (ins: InsurancePolicy) => `${(ins.name || "").trim().toLowerCase()}|${(ins.policyNumber || "").trim().toLowerCase()}|${ins.premiumAmount}`;
export const loanKey = (l: Loan) => `${(l.person || "").trim().toLowerCase()}|${l.amount}|${l.repayBy}|${l.direction}`;
export const structuredLoanKey = (sl: StructuredLoan) => `${(sl.lenderName || "").trim().toLowerCase()}|${sl.loanType}|${sl.principalAmount}|${sl.disbursementDate}`;
export const creditCardKey = (cc: CreditCard) => `${(cc.bankName || "").trim().toLowerCase()}|${(cc.cardName || "").trim().toLowerCase()}|${cc.last4Digits}|${cc.cardType || "credit"}`;
export const txKey = (t: Tx) => `${t.date}|${t.amount}|${(t.title || "").trim().toLowerCase()}|${t.category}|${t.type}`;
export const goalKey = (g: Goal) => `${(g.name || "").trim().toLowerCase()}|${g.target}|${g.deadline}`;
export const bucketKey = (bk: Bucket) => `${(bk.name || "").trim().toLowerCase()}|${bk.targetAmount}`;
export const bucketContribKey = (bc: BucketContribution) => `${bc.bucketId}|${bc.amount}|${bc.date}`;
export const budgetKey = (b: Budget) => `${(b.category || "").trim().toLowerCase()}|${b.month || ""}`;
export const subscriptionKey = (s: Subscription) => `${(s.name || "").trim().toLowerCase()}|${s.cost}|${s.renewal}`;
export const assetKey = (a: Asset) => `${(a.name || "").trim().toLowerCase()}|${a.kind || ""}|${a.value}`;
export const liabilityKey = (l: Liability) => `${(l.name || "").trim().toLowerCase()}|${l.kind || ""}|${l.amount}`;

type StoreCtx = {
  ready: boolean;
  transactions: Tx[];
  buckets: Bucket[];
  bucketContributions: BucketContribution[];
  goals: Goal[];
  budgets: Budget[];
  subscriptions: Subscription[];
  loans: Loan[];
  structuredLoans: StructuredLoan[];
  creditCards: CreditCard[];
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
  addStructuredLoan: (l: Omit<StructuredLoan, "id">) => Promise<void>;
  updateStructuredLoan: (l: StructuredLoan) => Promise<void>;
  removeStructuredLoan: (id: string) => Promise<void>;
  addCreditCard: (c: Omit<CreditCard, "id">) => Promise<void>;
  updateCreditCard: (c: CreditCard) => Promise<void>;
  removeCreditCard: (id: string) => Promise<void>;
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
  addBucket: (b: Omit<Bucket, "id" | "status" | "savedAmount">) => Promise<Bucket | undefined>;
  updateBucket: (b: Bucket) => Promise<void>;
  archiveBucket: (id: string) => Promise<void>;
  removeBucket: (id: string) => Promise<void>;
  addBucketContribution: (bucketId: string, amount: number, note?: string, sourceAccountId?: string) => Promise<void>;
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
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketContributions, setBucketContributions] = useState<BucketContribution[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthKey());
  const [loans, setLoans] = useState<Loan[]>([]);
  const [structuredLoans, setStructuredLoans] = useState<StructuredLoan[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
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
    // ── Phase 1: Load from local cache (instant, offline-first) ──
    try {
      const [
        cachedTx, cachedLoans, cachedCats, cachedAssets, cachedLiab, cachedEvents,
        cachedSips, cachedIns, cachedInv, cachedGold, cachedProp, cachedCs, cachedFraud,
        cachedGoals, cachedBudgets, cachedSubs, cachedBuckets, cachedBucketContribs,
        cachedStructuredLoans, cachedCreditCards,
      ] = await Promise.all([
        loadFromCache<Tx>("transactions"),
        loadFromCache<Loan>("loans"),
        loadFromCache<{ id: string; name: string }>("categories"),
        loadFromCache<Asset>("assets"),
        loadFromCache<Liability>("liabilities"),
        loadFromCache<LifeEvent>("lifeEvents"),
        loadFromCache<Sip>("sips"),
        loadFromCache<InsurancePolicy>("insurance"),
        loadFromCache<Investment>("investments"),
        loadFromCache<GoldHolding>("gold"),
        loadFromCache<Property>("properties"),
        loadFromCache<CreditScoreLog>("creditScore"),
        loadFromCache<FraudAlert>("fraudAlerts"),
        loadFromCache<Goal>("goals"),
        loadFromCache<Budget>("budgets"),
        loadFromCache<Subscription>("subscriptions"),
        loadFromCache<Bucket>("buckets"),
        loadFromCache<BucketContribution>("bucketContributions"),
        loadFromCache<StructuredLoan>("structuredLoans"),
        loadFromCache<CreditCard>("creditCards"),
      ]);

      // Apply cached data if available (instant rendering)
      if (cachedTx) setTransactions(dedupeList(cachedTx, txKey).sort((a, b) => (a.date < b.date ? 1 : -1)));
      if (cachedLoans) setLoans(dedupeList(cachedLoans, loanKey));
      if (cachedStructuredLoans) setStructuredLoans(dedupeList(cachedStructuredLoans, structuredLoanKey));
      if (cachedCreditCards) setCreditCards(dedupeList(cachedCreditCards, creditCardKey));
      if (cachedAssets) setAssets(dedupeList(cachedAssets, assetKey));
      if (cachedLiab) setLiabilities(dedupeList(cachedLiab, liabilityKey));
      if (cachedEvents) setLifeEvents(dedupeList(cachedEvents));
      if (cachedSips) setSips(dedupeList(cachedSips, sipKey));
      if (cachedIns) setInsurance(dedupeList(cachedIns, insuranceKey));
      if (cachedInv) setInvestments(dedupeList(cachedInv, investmentKey));
      if (cachedGold) setGold(dedupeList(cachedGold, goldKey));
      if (cachedProp) setProperties(dedupeList(cachedProp, propertyKey));
      if (cachedCs) setCreditScore(dedupeList(cachedCs).sort((a, b) => b.date.localeCompare(a.date)));
      if (cachedFraud) setFraudAlerts(dedupeList(cachedFraud));
      if (cachedGoals) setGoals(dedupeList(cachedGoals, goalKey));
      if (cachedBuckets) setBuckets(dedupeList(cachedBuckets, bucketKey));
      if (cachedBucketContribs) setBucketContributions(dedupeList(cachedBucketContribs, bucketContribKey).sort((a, b) => (a.date < b.date ? 1 : -1)));
      if (cachedBudgets) setBudgets(dedupeList(cachedBudgets, budgetKey));
      if (cachedSubs) setSubscriptions(dedupeList(cachedSubs, subscriptionKey));
      if (cachedCats && cachedCats.length > 0) {
        const custom = cachedCats.map((c) => c.name).filter(Boolean);
        setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...custom])));
      }
      // Mark ready early if we had cached data
      const hadCache = cachedTx || cachedGoals || cachedLoans;
      if (hadCache) setReady(true);
    } catch (e) {
      console.warn("Local cache load failed (non-fatal):", e);
    }

    // ── Phase 2: Sync from cloud (background) ──
    try {
      const [
        txRemote, loansRemote, catsRemote, assetsRemote, liabRemote, eventsRemote,
        sipsRemote, insRemote, invRemote, goldRemote, propRemote, csRemote, fraudRemote,
        goalsRemote, budgetsRemote, subsRemote, bucketsRemote, bucketContribsRemote,
        structuredLoansRemote, creditCardsRemote
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
        api.list<Bucket>("buckets"),
        api.list<BucketContribution>("bucketContributions"),
        api.list<StructuredLoan>("structuredLoans"),
        api.list<CreditCard>("creditCards"),
      ]);
      const cleanAssets = dedupeList(assetsRemote, assetKey);
      const cleanLiab = dedupeList(liabRemote, liabilityKey);
      const cleanEvents = dedupeList(eventsRemote);
      const cleanSips = dedupeList(sipsRemote, sipKey);
      const cleanIns = dedupeList(insRemote, insuranceKey);
      const cleanInv = dedupeList(invRemote, investmentKey);
      const cleanGold = dedupeList(goldRemote, goldKey);
      const cleanProp = dedupeList(propRemote, propertyKey);
      const cleanCs = dedupeList(csRemote).sort((a, b) => b.date.localeCompare(a.date));
      const cleanFraud = dedupeList(fraudRemote);
      const cleanTx = dedupeList(txRemote, txKey).sort((a, b) => (a.date < b.date ? 1 : -1));
      const cleanLoans = dedupeList(loansRemote, loanKey);
      const cleanStructuredLoans = dedupeList(structuredLoansRemote, structuredLoanKey);
      const cleanCreditCards = dedupeList(creditCardsRemote, creditCardKey);
      const cleanGoals = dedupeList(goalsRemote, goalKey);
      const cleanBuckets = dedupeList(bucketsRemote, bucketKey);
      const cleanBucketContribs = dedupeList(bucketContribsRemote, bucketContribKey).sort((a, b) => (a.date < b.date ? 1 : -1));
      const cleanBudgets = dedupeList(budgetsRemote, budgetKey);
      const cleanSubs = dedupeList(subsRemote, subscriptionKey);

      setAssets(cleanAssets);
      setLiabilities(cleanLiab);
      setLifeEvents(cleanEvents);
      setSips(cleanSips);
      setInsurance(cleanIns);
      setInvestments(cleanInv);
      setGold(cleanGold);
      setProperties(cleanProp);
      setCreditScore(cleanCs);
      setFraudAlerts(cleanFraud);
      setTransactions(cleanTx);
      setLoans(cleanLoans);
      setStructuredLoans(cleanStructuredLoans);
      setCreditCards(cleanCreditCards);
      setGoals(cleanGoals);
      setBuckets(cleanBuckets);
      setBucketContributions(cleanBucketContribs);
      setBudgets(cleanBudgets);
      setSubscriptions(cleanSubs);

      if (catsRemote.length === 0) {
        setCategories(DEFAULT_CATEGORIES);
      } else {
        const custom = catsRemote.map((c) => c.name).filter(Boolean);
        const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...custom]));
        setCategories(merged);
      }

      // ── Persist cleaned data to local cache ──
      saveToCache("transactions", cleanTx);
      saveToCache("loans", cleanLoans);
      saveToCache("categories", catsRemote);
      saveToCache("assets", cleanAssets);
      saveToCache("liabilities", cleanLiab);
      saveToCache("lifeEvents", cleanEvents);
      saveToCache("sips", cleanSips);
      saveToCache("insurance", cleanIns);
      saveToCache("investments", cleanInv);
      saveToCache("gold", cleanGold);
      saveToCache("properties", cleanProp);
      saveToCache("creditScore", cleanCs);
      saveToCache("fraudAlerts", cleanFraud);
      saveToCache("goals", cleanGoals);
      saveToCache("budgets", cleanBudgets);
      saveToCache("subscriptions", cleanSubs);
      saveToCache("buckets", cleanBuckets);
      saveToCache("bucketContributions", cleanBucketContribs);
      saveToCache("structuredLoans", cleanStructuredLoans);
      saveToCache("creditCards", cleanCreditCards);
    } catch (e) {
      console.error("Initial store load failed:", e);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Auto-persist every state array to local IndexedDB cache ──
  // This ensures data is never lost even if the app is closed before a cloud sync.
  // The `ready` guard prevents overwriting cache with empty initial state on first render.
  useEffect(() => { if (ready) saveToCache("transactions", transactions); }, [ready, transactions]);
  useEffect(() => { if (ready) saveToCache("loans", loans); }, [ready, loans]);
  useEffect(() => { if (ready) saveToCache("structuredLoans", structuredLoans); }, [ready, structuredLoans]);
  useEffect(() => { if (ready) saveToCache("creditCards", creditCards); }, [ready, creditCards]);
  useEffect(() => { if (ready) saveToCache("assets", assets); }, [ready, assets]);
  useEffect(() => { if (ready) saveToCache("liabilities", liabilities); }, [ready, liabilities]);
  useEffect(() => { if (ready) saveToCache("lifeEvents", lifeEvents); }, [ready, lifeEvents]);
  useEffect(() => { if (ready) saveToCache("sips", sips); }, [ready, sips]);
  useEffect(() => { if (ready) saveToCache("insurance", insurance); }, [ready, insurance]);
  useEffect(() => { if (ready) saveToCache("investments", investments); }, [ready, investments]);
  useEffect(() => { if (ready) saveToCache("gold", gold); }, [ready, gold]);
  useEffect(() => { if (ready) saveToCache("properties", properties); }, [ready, properties]);
  useEffect(() => { if (ready) saveToCache("creditScore", creditScore); }, [ready, creditScore]);
  useEffect(() => { if (ready) saveToCache("fraudAlerts", fraudAlerts); }, [ready, fraudAlerts]);
  useEffect(() => { if (ready) saveToCache("goals", goals); }, [ready, goals]);
  useEffect(() => { if (ready) saveToCache("budgets", budgets); }, [ready, budgets]);
  useEffect(() => { if (ready) saveToCache("subscriptions", subscriptions); }, [ready, subscriptions]);
  useEffect(() => { if (ready) saveToCache("buckets", buckets); }, [ready, buckets]);
  useEffect(() => { if (ready) saveToCache("bucketContributions", bucketContributions); }, [ready, bucketContributions]);
  useEffect(() => {
    if (ready) {
      const catObjects = categories.filter((c) => !DEFAULT_CATEGORIES.includes(c)).map((c) => ({ id: c, name: c }));
      saveToCache("categories", catObjects);
    }
  }, [ready, categories]);


  // Clear all in-memory state when user signs out — prevents data bleed between sessions
  useEffect(() => {
    const sub = api.onAuth((signedIn) => {
      if (!signedIn) {
        setTransactions([]);
        setGoals([]);
        setBudgets([]);
        setSubscriptions([]);
        setLoans([]);
        setStructuredLoans([]);
        setCreditCards([]);
        setAssets([]);
        setLiabilities([]);
        setLifeEvents([]);
        setCategories(DEFAULT_CATEGORIES);
        setSips([]);
        setInsurance([]);
        setInvestments([]);
        setGold([]);
        setProperties([]);
        setCreditScore([]);
        setFraudAlerts([]);
        setReady(false);
        // Clear local cache to prevent data leakage between sessions
        clearCache();
      }
    });
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

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
      const targetKey = txKey(t as Tx);
      const existing = transactions.find((x) => txKey(x) === targetKey);
      if (existing) {
        console.warn("Transaction already exists:", existing);
        return;
      }
      const created = await api.create<Tx>("transactions", t);
      setTransactions((prev) => dedupeList([created, ...prev], txKey));
    } catch (e) {
      console.error("Add transaction failed:", e);
    }
  };

  const updateTransaction = async (t: Tx) => {
    try {
      const updated = await api.create<Tx>("transactions", t);
      setTransactions((prev) => dedupeList(prev.map((x) => (x.id === t.id ? updated : x)), txKey));
      return { ok: true };
    } catch (e: any) {
      console.error("Update transaction failed:", e);
      return { ok: false, error: e.message || "Update failed" };
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const target = transactions.find((x) => x.id === id);
      await api.remove("transactions", id);
      setTransactions((prev) => prev.filter((x) => x.id !== id && (!target || txKey(x) !== txKey(target))));
      return { ok: true };
    } catch (e: any) {
      console.error("Delete transaction failed:", e);
      return { ok: false, error: e.message || "Delete failed" };
    }
  };

  const addLoan = async (l: Omit<Loan, "id">) => {
    try {
      const targetKey = loanKey(l as Loan);
      const existing = loans.find((x) => loanKey(x) === targetKey);
      if (existing) {
        console.warn("Loan already exists:", existing);
        return;
      }
      const created = await api.create<Loan>("loans", l);
      setLoans((prev) => dedupeList([created, ...prev], loanKey));
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
      const target = loans.find((x) => x.id === id);
      await api.remove("loans", id);
      setLoans((prev) => prev.filter((l) => l.id !== id && (!target || loanKey(l) !== loanKey(target))));
    } catch (e) {
      console.error("Remove loan failed:", e);
    }
  };

  const addStructuredLoan = async (l: Omit<StructuredLoan, "id">) => {
    try {
      const targetKey = structuredLoanKey(l as StructuredLoan);
      const existing = structuredLoans.find((x) => structuredLoanKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<StructuredLoan>("structuredLoans", l);
      setStructuredLoans((prev) => dedupeList([created, ...prev], structuredLoanKey));
    } catch (e) { console.error("Add structured loan failed:", e); }
  };

  const updateStructuredLoan = async (l: StructuredLoan) => {
    try {
      const updated = await api.create<StructuredLoan>("structuredLoans", l);
      setStructuredLoans((prev) => dedupeList(prev.map((x) => (x.id === l.id ? updated : x)), structuredLoanKey));
    } catch (e) { console.error("Update structured loan failed:", e); }
  };

  const removeStructuredLoan = async (id: string) => {
    try {
      const target = structuredLoans.find((x) => x.id === id);
      await api.remove("structuredLoans", id);
      setStructuredLoans((prev) => prev.filter((x) => x.id !== id && (!target || structuredLoanKey(x) !== structuredLoanKey(target))));
    } catch (e) { console.error("Remove structured loan failed:", e); }
  };

  const addCreditCard = async (c: Omit<CreditCard, "id">) => {
    try {
      const targetKey = creditCardKey(c as CreditCard);
      const existing = creditCards.find((x) => creditCardKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<CreditCard>("creditCards", c);
      setCreditCards((prev) => dedupeList([...prev, created], creditCardKey));
    } catch (e) { console.error("Add credit card failed:", e); }
  };

  const updateCreditCard = async (c: CreditCard) => {
    try {
      const updated = await api.create<CreditCard>("creditCards", c);
      setCreditCards((prev) => dedupeList(prev.map((x) => (x.id === c.id ? updated : x)), creditCardKey));
    } catch (e) { console.error("Update credit card failed:", e); }
  };

  const removeCreditCard = async (id: string) => {
    try {
      const target = creditCards.find((x) => x.id === id);
      await api.remove("creditCards", id);
      setCreditCards((prev) => prev.filter((x) => x.id !== id && (!target || creditCardKey(x) !== creditCardKey(target))));
    } catch (e) { console.error("Remove credit card failed:", e); }
  };

  const addCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    try {
      await api.create<{ name: string }>("categories", { name: trimmed });
      setCategories((prev) => Array.from(new Set([...prev, trimmed])));
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
        const exists = prev.find((x) => x.id === saved.id || (saved.name && x.name === saved.name));
        const updated = exists ? prev.map((x) => (x.id === saved.id || (saved.name && x.name === saved.name) ? saved : x)) : [saved, ...prev];
        return dedupeList(updated, assetKey);
      });
    } catch (e) { console.error("Upsert asset failed:", e); }
  };
  const removeAsset = async (id: string) => {
    try {
      const target = assets.find((x) => x.id === id);
      await api.remove("assets", id);
      setAssets((p) => p.filter((x) => x.id !== id && (!target || assetKey(x) !== assetKey(target))));
    }
    catch (e) { console.error("Remove asset failed:", e); }
  };
  const upsertLiability = async (l: Liability | Omit<Liability, "id">) => {
    try {
      const saved = await api.create<Liability>("liabilities", { ...l, updatedAt: new Date().toISOString() });
      setLiabilities((prev) => {
        const exists = prev.find((x) => x.id === saved.id || (saved.name && x.name === saved.name));
        const updated = exists ? prev.map((x) => (x.id === saved.id || (saved.name && x.name === saved.name) ? saved : x)) : [saved, ...prev];
        return dedupeList(updated, liabilityKey);
      });
    } catch (e) { console.error("Upsert liability failed:", e); }
  };
  const removeLiability = async (id: string) => {
    try {
      const target = liabilities.find((x) => x.id === id);
      await api.remove("liabilities", id);
      setLiabilities((p) => p.filter((x) => x.id !== id && (!target || liabilityKey(x) !== liabilityKey(target))));
    }
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
      const targetKey = sipKey(s as Sip);
      const existing = sips.find((x) => sipKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<Sip>("sips", s);
      setSips((prev) => dedupeList([...prev, created], sipKey));
    } catch (e) {
      console.error("Add SIP failed:", e);
    }
  };
  const removeSip = async (id: string) => {
    try {
      const target = sips.find((x) => x.id === id);
      await api.remove("sips", id);
      setSips((prev) => prev.filter((s) => s.id !== id && (!target || sipKey(s) !== sipKey(target))));
    } catch (e) {
      console.error("Remove SIP failed:", e);
    }
  };

  const addInsurance = async (i: Omit<InsurancePolicy, "id">) => {
    try {
      const targetKey = insuranceKey(i as InsurancePolicy);
      const existing = insurance.find((x) => insuranceKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<InsurancePolicy>("insurance", i);
      setInsurance((prev) => dedupeList([...prev, created], insuranceKey));
    } catch (e) {
      console.error("Add insurance failed:", e);
    }
  };
  const removeInsurance = async (id: string) => {
    try {
      const target = insurance.find((x) => x.id === id);
      await api.remove("insurance", id);
      setInsurance((prev) => prev.filter((i) => i.id !== id && (!target || insuranceKey(i) !== insuranceKey(target))));
    } catch (e) {
      console.error("Remove insurance failed:", e);
    }
  };

  const addInvestment = async (inv: Omit<Investment, "id">) => {
    try {
      const targetKey = investmentKey(inv as Investment);
      const existing = investments.find((x) => investmentKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<Investment>("investments", inv);
      setInvestments((prev) => dedupeList([...prev, created], investmentKey));
      await upsertAsset({
        kind: inv.type === "mutual_fund" || inv.type === "elss" ? "mf" :
              inv.type === "fixed_deposit" ? "fd" :
              inv.type === "stocks" ? "stocks" :
              inv.type === "ppf" ? "ppf" :
              inv.type === "nps" ? "nps" : "other",
        name: inv.name,
        value: inv.currentValue,
        notes: `Portfolio: ${inv.type}`
      } as any);
    } catch (e) {
      console.error("Add investment failed:", e);
    }
  };
  const updateInvestment = async (inv: Investment) => {
    try {
      const updated = await api.create<Investment>("investments", inv);
      setInvestments((prev) => dedupeList(prev.map((x) => x.id === inv.id ? updated : x), investmentKey));
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
      setInvestments((prev) => prev.filter((x) => x.id !== id && (!target || investmentKey(x) !== investmentKey(target))));
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
      const targetKey = goldKey(g as GoldHolding);
      const existing = gold.find((x) => goldKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<GoldHolding>("gold", g);
      setGold((prev) => dedupeList([...prev, created], goldKey));
      await upsertAsset({
        kind: "gold",
        name: g.name,
        value: g.purchasePrice,
        notes: `${g.weightGrams}g ${g.type}`
      } as any);
    } catch (e) {
      console.error("Add gold failed:", e);
    }
  };
  const removeGold = async (id: string) => {
    try {
      const target = gold.find((x) => x.id === id);
      await api.remove("gold", id);
      setGold((prev) => prev.filter((x) => x.id !== id && (!target || goldKey(x) !== goldKey(target))));
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
      const targetKey = propertyKey(p as Property);
      const existing = properties.find((x) => propertyKey(x) === targetKey);
      if (existing) {
        console.warn("Property already exists:", existing);
        return;
      }
      const created = await api.create<Property>("properties", p);
      setProperties((prev) => dedupeList([...prev, created], propertyKey));
      await upsertAsset({
        kind: "property",
        name: p.name,
        value: p.currentValuation,
        notes: `${p.type} property`
      } as any);
    } catch (e) {
      console.error("Add property failed:", e);
    }
  };
  const updateProperty = async (p: Property) => {
    try {
      const updated = await api.create<Property>("properties", p);
      setProperties((prev) => dedupeList(prev.map((x) => x.id === p.id ? updated : x), propertyKey));
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
      setProperties((prev) => prev.filter((x) => x.id !== id && (!target || propertyKey(x) !== propertyKey(target))));
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
      setCreditScore((prev) => dedupeList([created, ...prev]).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error("Add credit score failed:", e);
    }
  };

  const addFraudAlert = async (a: Omit<FraudAlert, "id">) => {
    try {
      const created = await api.create<FraudAlert>("fraudAlerts", a);
      setFraudAlerts((prev) => dedupeList([created, ...prev]));
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
      const targetKey = goalKey(g as Goal);
      const existing = goals.find((x) => goalKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<Goal>("goals", g);
      setGoals((prev) => dedupeList([...prev, created], goalKey));
    } catch (e) {
      console.error("Add goal failed:", e);
    }
  };

  const updateGoal = async (g: Goal) => {
    try {
      const updated = await api.create<Goal>("goals", g);
      setGoals((prev) => dedupeList(prev.map((x) => x.id === g.id ? updated : x), goalKey));
    } catch (e) {
      console.error("Update goal failed:", e);
    }
  };

  const removeGoal = async (id: string) => {
    try {
      const target = goals.find((x) => x.id === id);
      await api.remove("goals", id);
      setGoals((prev) => prev.filter((x) => x.id !== id && (!target || goalKey(x) !== goalKey(target))));
    } catch (e) {
      console.error("Remove goal failed:", e);
    }
  };

  const addBucket = async (b: Omit<Bucket, "id" | "status" | "savedAmount">): Promise<Bucket | undefined> => {
    try {
      const trimmedName = b.name.trim();
      const existing = buckets.find(
        (x) =>
          x.status === "active" &&
          x.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
          x.targetAmount === b.targetAmount &&
          (x.targetDate || "") === (b.targetDate || "")
      );
      if (existing) {
        console.warn("Bucket with identical properties already exists:", existing);
        return existing;
      }

      const payload = { ...b, name: trimmedName, status: "active", savedAmount: 0 };
      const created = await api.create<Bucket>("buckets", payload);
      setBuckets((prev) => dedupeList([...prev, created], bucketKey));
      return created;
    } catch (e) {
      console.error("Add bucket failed:", e);
      throw e;
    }
  };

  const updateBucket = async (b: Bucket) => {
    try {
      const updated = await api.create<Bucket>("buckets", b);
      setBuckets((prev) => dedupeList(prev.map((x) => x.id === b.id ? updated : x), bucketKey));
    } catch (e) {
      console.error("Update bucket failed:", e);
    }
  };

  const archiveBucket = async (id: string) => {
    try {
      const target = buckets.find((b) => b.id === id);
      if (!target) return;
      const updated = await api.create<Bucket>("buckets", { ...target, status: "archived" });
      setBuckets((prev) => dedupeList(prev.map((x) => x.id === id ? updated : x), bucketKey));
    } catch (e) {
      console.error("Archive bucket failed:", e);
    }
  };

  const removeBucket = async (id: string) => {
    try {
      const target = buckets.find((b) => b.id === id);
      await api.remove("buckets", id);
      setBuckets((prev) => prev.filter((x) => x.id !== id && (!target || bucketKey(x) !== bucketKey(target))));
      setBucketContributions((prev) => prev.filter((c) => c.bucketId !== id));
    } catch (e) {
      console.error("Remove bucket failed:", e);
    }
  };

  const addBucketContribution = async (bucketId: string, amount: number, note?: string, sourceAccountId?: string) => {
    try {
      const { data } = await api.session().then((s) => ({ data: { session: s } }));
      const token = data.session?.access_token ?? "publicAnonKey";
      const res = await fetch(`https://pnfdefqxkpnglbyzeqid.supabase.co/functions/v1/make-server-a3fe149f/buckets/${bucketId}/contributions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note, sourceAccountId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Contribution failed");
      
      const { item, bucket } = body;
      setBucketContributions((prev) => dedupeList([item, ...prev], bucketContribKey).sort((a, b) => (a.date < b.date ? 1 : -1)));
      setBuckets((prev) => dedupeList(prev.map((x) => x.id === bucketId ? bucket : x), bucketKey));
    } catch (e) {
      console.error("Add bucket contribution failed:", e);
      throw e;
    }
  };

  const addBudget = async (b: Omit<Budget, "id">) => {
    try {
      const targetKey = budgetKey(b as Budget);
      const existing = budgets.find((x) => budgetKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<Budget>("budgets", b);
      setBudgets((prev) => dedupeList([...prev, created], budgetKey));
    } catch (e) {
      console.error("Add budget failed:", e);
    }
  };

  const updateBudget = async (b: Budget) => {
    try {
      const updated = await api.create<Budget>("budgets", b);
      setBudgets((prev) => dedupeList(prev.map((x) => x.id === b.id ? updated : x), budgetKey));
    } catch (e) {
      console.error("Update budget failed:", e);
    }
  };

  const removeBudget = async (id: string) => {
    try {
      const target = budgets.find((x) => x.id === id);
      await api.remove("budgets", id);
      setBudgets((prev) => prev.filter((x) => x.id !== id && (!target || budgetKey(x) !== budgetKey(target))));
    } catch (e) {
      console.error("Remove budget failed:", e);
    }
  };

  const addSubscription = async (s: Omit<Subscription, "id">) => {
    try {
      const targetKey = subscriptionKey(s as Subscription);
      const existing = subscriptions.find((x) => subscriptionKey(x) === targetKey);
      if (existing) return;
      const created = await api.create<Subscription>("subscriptions", s);
      setSubscriptions((prev) => dedupeList([...prev, created], subscriptionKey));
    } catch (e) {
      console.error("Add subscription failed:", e);
    }
  };

  const removeSubscription = async (id: string) => {
    try {
      const target = subscriptions.find((x) => x.id === id);
      await api.remove("subscriptions", id);
      setSubscriptions((prev) => prev.filter((x) => x.id !== id && (!target || subscriptionKey(x) !== subscriptionKey(target))));
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
      ready, transactions, buckets, bucketContributions, goals, budgets, subscriptions, loans, structuredLoans, creditCards,
      assets, liabilities, lifeEvents, categories,
      sips, insurance, investments, gold, properties, creditScore, fraudAlerts, selectedMonth, setSelectedMonth, deleteAllData,
      addTransaction, updateTransaction, deleteTransaction, addLoan, settleLoan, removeLoan,
      addStructuredLoan, updateStructuredLoan, removeStructuredLoan,
      addCreditCard, updateCreditCard, removeCreditCard,
      addCategory, removeCategory,
      upsertAsset, removeAsset, upsertLiability, removeLiability, upsertLifeEvent, removeLifeEvent,
      addSip, removeSip, addInsurance, removeInsurance, addInvestment, updateInvestment, removeInvestment,
      addGold, removeGold, addProperty, updateProperty, removeProperty, addCreditScore, addFraudAlert, resolveFraudAlert,
      addGoal, updateGoal, removeGoal, addBucket, updateBucket, archiveBucket, removeBucket, addBucketContribution, addBudget, updateBudget, removeBudget, addSubscription, removeSubscription, refresh
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
