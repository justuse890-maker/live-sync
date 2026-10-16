import { normKey } from "./lib/safeText";
import { createContext, ReactNode, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { clearAiConfig } from "./lib/aiClient";
import type { BucketKind } from "./lib/salarySplit";
import type { TaxTag } from "./lib/taxTags";
import { countable, buildTransferLegs, applyTransferPair, clearTransfer, suggestTransferPairs, TransferSuggestion } from "./lib/transfers";
import { api, OfflineError } from "./lib/api";
import { saveToCache, loadFromCache, clearCache, loadCachedUserId, loadAuthSession } from "./lib/localCache";
import { autoRecoverIfEmpty, savePermanentBackupSnapshot } from "./lib/recovery";
import { getCurrentMonthKey } from "./lib/dateUtils";
import { sanitizeBucket } from "./lib/fieldCrypto";
import { enqueueOp, loadQueue, dequeueOp, clearQueue } from "./lib/offlineQueue";
import { encryptFields } from "./lib/fieldCrypto";
import { Note, markBillPaid, rollForwardIfDue, isBill } from "./lib/notes";
import { feedback } from "./lib/feedback";
import { notify } from "./lib/notify";
import { alreadyRecorded, applyInstallment, buildInstallmentTx, dueInstallments } from "./lib/loanEngine";
import { localReplace, eraseAllUserData } from "./lib/localDb";
import { todayISO } from "./lib/dateUtils";

/**
 * All writes are local (IndexedDB on this device), so they never depend on
 * connectivity. Kept as a named constant so the intent is explicit.
 */
const WRITE_LOCALLY = true;

// ── Offline queue drain ────────────────────────────────────────────────────
// Called when connectivity returns to replay any queued writes against Supabase.
export async function drainOfflineQueue(
  onIdSwap?: (collection: string, localId: string, serverId: string) => void
) {
  // Ops queued by older (cloud-sync) builds are replayed into the device DB.
  const ops = await loadQueue();
  if (ops.length === 0) return;
  console.log(`[OfflineQueue] Draining ${ops.length} queued ops…`);
  for (const op of ops) {
    try {
      if (op.method === "create" && op.payload) {
        const created = await api.create<any>(op.collection, op.payload);
        if (op.localId && onIdSwap) onIdSwap(op.collection, op.localId, created.id);
      } else if (op.method === "remove" && op.itemId) {
        await api.remove(op.collection, op.itemId);
      }
      await dequeueOp(op.id);
    } catch (e) {
      console.warn("[OfflineQueue] Replay failed for op", op.id, e);
      // Keep the op in the queue — will retry next time
    }
  }
}

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
  loanId?: string; // ID of the linked StructuredLoan (e.g. for EMI or loan payments)
  loanPaymentType?: "emi" | "pre_emi" | "prepayment";
  /** Recorded automatically on the due date by an auto-debit mandate (not typed in by the user). */
  autoDebited?: boolean;
  /** How the entry was captured. Absent on older rows. */
  source?: "manual" | "voice" | "scan" | "import" | "paste";
  notes?: string;
  createdAt?: string;
  /** Own-account transfer leg — excluded from income/expense everywhere (see lib/transfers.ts). */
  isTransfer?: boolean;
  transferId?: string;
  transferRole?: "out" | "in";
  categoryBeforeTransfer?: string;
  /** User's own tax label for year-end totals (see lib/taxTags.ts). */
  taxTag?: TaxTag;
  /** Business or personal money (business persona only). Absent = personal. */
  scope?: "personal" | "business";
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
  | "bnpl" // Pay-later / buy-now-pay-later: a debt with a due date, never a plain expense
  | "other";

export type BuilderMilestone = {
  stage: string; // e.g. "Slab", "Possession"
  amount: number;
  dueDate: string;
  paid: boolean;
};

export type EmiRevision = {
  id: string;
  effectiveDate: string; // e.g. "2025-04" or ISO date
  emiAmount: number;
  interestRatePA?: number;
  reason?: string; // e.g. "RBI Repo rate hike", "Tenure adjustment", "Prepayment adjustment"
  createdAt?: string;
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
  emiHistory?: EmiRevision[];
  autoDebitBankAccountId?: string;
  /** Record each instalment automatically on its due date (mirrors the bank's e-mandate). */
  autoDebit?: boolean;
  /** "pre_emi": interest-only on the amount disbursed so far. Absent/"emi": regular EMI. */
  phase?: "pre_emi" | "emi";
  /** Amount the bank has released so far (basis of Pre-EMI interest). */
  disbursedAmount?: number;
  /** Date from which the full EMI is expected to start (possession / full disbursement). */
  fullEmiStartDate?: string;
  /** Total Pre-EMI interest paid so far (tax-relevant, not part of principal repayment). */
  preEmiPaidTotal?: number;
  /** Preferred day of month for the instalment (keeps the 31st from drifting after short months). */
  emiDay?: number;
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
  /** Total due on the latest statement, as printed on it. Only used while statementDueFor matches the upcoming due month. */
  statementDue?: number;
  /** Minimum amount due on the latest statement. */
  minDue?: number;
  /** "YYYY-MM" of the due date the two amounts above belong to, so an old statement is never quoted for a new month. */
  statementDueFor?: string;
  /** "YYYY-MM" of the due date the user marked as paid: its reminders and "still to pay" entry are hidden. */
  statementPaidFor?: string;
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
  /** Where the goal's money is kept (chosen in the "Where should you save this?" advisor). */
  savingsPlan?: { vehicleId: string; provider: string; accountId?: string; ratePA: number; ratesAsOf: string };
  targetDate?: string;
  iconOrColor: string;
  /** What this bucket is for (Need / Want / Goal / Gold / Chit) — shapes how it is presented and split. */
  kind?: BucketKind;
  /** Share (%) of each salary that should land in this bucket. */
  allocPct?: number;
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
  /** Unspent money carries into next month (see lib/budgetRollover.ts). */
  rollover?: boolean;
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

const DEFAULT_CATEGORIES = ["Food", "Travel", "Shopping", "Grocery", "Medical", "Rent", "Entertainment", "Tuition", "EMI", "Maid Salary", "Festival", "Other"];

export type HouseholdStaff = {
  id: string;
  name: string;
  role: string;
  salary: number;
  schedule: string;
  time: string;
};

export type SocietyNotice = {
  id: string;
  title: string;
  type: "notice" | "bill";
  date: string;
  details: string;
  amount?: number;
  paid?: boolean;
};

export type HouseholdReminder = {
  id: string;
  title: string;
  type: "maintenance" | "health" | "vehicle" | "other";
  dueDate: string;
  repeat: string;
  done: boolean;
};

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
export const txKey = (t: Tx) => `${t.date}|${t.amount}|${normKey(t.title)}|${t.category}|${t.type}|${t.transferId || ""}`;
export const goalKey = (g: Goal) => `${(g.name || "").trim().toLowerCase()}|${g.target}|${g.deadline}`;
export const bucketKey = (bk: Bucket) => `${(bk.name || "").trim().toLowerCase()}|${bk.targetAmount}`;
export const bucketContribKey = (bc: BucketContribution) => `${bc.bucketId}|${bc.amount}|${bc.date}`;
export const budgetKey = (b: Budget) => `${(b.category || "").trim().toLowerCase()}|${b.month || ""}`;
export const subscriptionKey = (s: Subscription) => `${(s.name || "").trim().toLowerCase()}|${s.cost}|${s.renewal}`;
export const assetKey = (a: Asset) => `${(a.name || "").trim().toLowerCase()}|${a.kind || ""}|${a.value}`;
export const liabilityKey = (l: Liability) => `${(l.name || "").trim().toLowerCase()}|${l.kind || ""}|${l.outstanding}`;
export const householdStaffKey = (s: HouseholdStaff) => `${(s.name || "").trim().toLowerCase()}|${s.role}`;
export const societyNoticeKey = (n: SocietyNotice) => `${normKey(n.title)}|${n.date}|${n.type}`;
export const householdReminderKey = (r: HouseholdReminder) => `${normKey(r.title)}|${r.dueDate}`;

type StoreCtx = {
  ready: boolean;
  /** Ledger used by every income / expense / budget / report calculation — own-account transfers excluded. */
  transactions: Tx[];
  /** Full ledger including transfer legs (activity list, account balances). */
  allTransactions: Tx[];
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
  householdStaff: HouseholdStaff[];
  societyNotices: SocietyNotice[];
  householdReminders: HouseholdReminder[];
  notes: Note[];
  upsertNote: (n: Partial<Note> & { id?: string }) => Promise<Note>;
  removeNote: (id: string) => Promise<void>;
  /** Mark a bill note as paid: logs the expense and rolls to the next due date. */
  payBill: (id: string, opts?: { amount?: number; logExpense?: boolean }) => Promise<void>;
  notificationSound: string;
  setNotificationSound: (s: string) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  deleteAllData: () => Promise<void>;
  upsertAsset: (a: Asset | Omit<Asset, "id">) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  upsertLiability: (l: Liability | Omit<Liability, "id">) => Promise<void>;
  removeLiability: (id: string) => Promise<void>;
  upsertLifeEvent: (e: LifeEvent | Omit<LifeEvent, "id">) => Promise<void>;
  removeLifeEvent: (id: string) => Promise<void>;
  addTransaction: (t: Omit<Tx, "id">, opts?: { silent?: boolean }) => Promise<void>;
  /** Record money moved between the user's own accounts (two legs, never counted as income/expense). */
  addTransfer: (input: { amount: number; date: string; fromAccountId?: string; toAccountId?: string; fromLabel?: string; toLabel?: string }) => Promise<void>;
  /** Turn two existing rows into one transfer. */
  linkTransfer: (outId: string, inId: string) => Promise<void>;
  /** Turn a transfer back into ordinary income/expense rows. */
  unlinkTransfer: (transferId: string) => Promise<void>;
  /** Possible own-account transfers in the ledger, for the user to confirm. */
  transferSuggestions: TransferSuggestion[];
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
  addHouseholdStaff: (s: Omit<HouseholdStaff, "id">) => Promise<void>;
  removeHouseholdStaff: (id: string) => Promise<void>;
  addSocietyNotice: (n: Omit<SocietyNotice, "id">) => Promise<void>;
  updateSocietyNotice: (n: SocietyNotice) => Promise<void>;
  removeSocietyNotice: (id: string) => Promise<void>;
  addHouseholdReminder: (r: Omit<HouseholdReminder, "id">) => Promise<void>;
  updateHouseholdReminder: (r: HouseholdReminder) => Promise<void>;
  removeHouseholdReminder: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allTransactions, setTransactions] = useState<Tx[]>([]);
  const transactions = useMemo(() => countable(allTransactions), [allTransactions]);
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
  const [householdStaff, setHouseholdStaff] = useState<HouseholdStaff[]>([]);
  const [societyNotices, setSocietyNotices] = useState<SocietyNotice[]>([]);
  const [householdReminders, setHouseholdReminders] = useState<HouseholdReminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notificationSound, setNotificationSoundState] = useState<string>("chime"); // our own original chime; "default" means the phone's system sound

  const refresh = useCallback(async () => {
    // ── Phase 0: Universal auto-recovery check ──
    try {
      await autoRecoverIfEmpty();
    } catch (e) {
      console.warn("Auto-recovery pre-check error (non-fatal):", e);
    }

    // ── Phase 1: Load from local cache (instant, offline-first) ──
    let cachedTx: Tx[] | null = null;
    let cachedLoans: Loan[] | null = null;
    let cachedCats: { id: string; name: string }[] | null = null;
    let cachedAssets: Asset[] | null = null;
    let cachedLiab: Liability[] | null = null;
    let cachedEvents: LifeEvent[] | null = null;
    let cachedSips: Sip[] | null = null;
    let cachedIns: InsurancePolicy[] | null = null;
    let cachedInv: Investment[] | null = null;
    let cachedGold: GoldHolding[] | null = null;
    let cachedProp: Property[] | null = null;
    let cachedCs: CreditScoreLog[] | null = null;
    let cachedFraud: FraudAlert[] | null = null;
    let cachedGoals: Goal[] | null = null;
    let cachedBudgets: Budget[] | null = null;
    let cachedSubs: Subscription[] | null = null;
    let cachedBuckets: Bucket[] | null = null;
    let cachedBucketContribs: BucketContribution[] | null = null;
    let cachedStructuredLoans: StructuredLoan[] | null = null;
    let cachedCreditCards: CreditCard[] | null = null;
    let cachedHouseholdStaff: HouseholdStaff[] | null = null;
    let cachedSocietyNotices: SocietyNotice[] | null = null;
    let cachedHouseholdReminders: HouseholdReminder[] | null = null;
    let cachedSound: string | null = null;
    let cachedNotes: Note[] | null = null;

    try {
      [
        cachedTx, cachedLoans, cachedCats, cachedAssets, cachedLiab, cachedEvents,
        cachedSips, cachedIns, cachedInv, cachedGold, cachedProp, cachedCs, cachedFraud,
        cachedGoals, cachedBudgets, cachedSubs, cachedBuckets, cachedBucketContribs,
        cachedStructuredLoans, cachedCreditCards,
        cachedHouseholdStaff, cachedSocietyNotices, cachedHouseholdReminders,
        cachedSound, cachedNotes
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
        loadFromCache<HouseholdStaff>("householdStaff"),
        loadFromCache<SocietyNotice>("societyNotices"),
        loadFromCache<HouseholdReminder>("householdReminders"),
        loadFromCache<string>("notificationSound").then(r => r?.[0] ?? null),
        loadFromCache<Note>("notes"),
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
      if (cachedBuckets) {
        const userId = await api.getCurrentUserId();
        const sanitized = await Promise.all(cachedBuckets.map((b) => sanitizeBucket(b, userId)));
        setBuckets(dedupeList(sanitized, bucketKey));
      }
      if (cachedBucketContribs) setBucketContributions(dedupeList(cachedBucketContribs, bucketContribKey).sort((a, b) => (a.date < b.date ? 1 : -1)));
      if (cachedBudgets) setBudgets(dedupeList(cachedBudgets, budgetKey));
      if (cachedSubs) setSubscriptions(dedupeList(cachedSubs, subscriptionKey));
      if (cachedHouseholdStaff) setHouseholdStaff(dedupeList(cachedHouseholdStaff, householdStaffKey));
      if (cachedSocietyNotices) setSocietyNotices(dedupeList(cachedSocietyNotices, societyNoticeKey));
      if (cachedHouseholdReminders) setHouseholdReminders(dedupeList(cachedHouseholdReminders, householdReminderKey));
      if (cachedSound) {
        // One-time move for people who never picked a sound: from the phone's stock tone to our own chime.
        let migrated = false;
        try { migrated = localStorage.getItem("ls_sound_v2") === "1"; localStorage.setItem("ls_sound_v2", "1"); } catch { /* storage unavailable */ }
        setNotificationSoundState(cachedSound === "default" && !migrated ? "chime" : cachedSound);
      }
      if (cachedNotes) {
        // Keep-style: repeating (non-bill) reminders that already fired roll to their next time.
        const rolled = cachedNotes.map((n) => rollForwardIfDue(n) ?? n);
        setNotes(dedupeList(rolled));
      }
      if (cachedCats && cachedCats.length > 0) {
        const custom = cachedCats.map((c) => c.name).filter(Boolean);
        setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...custom])));
      }
      // Mark ready early if we had cached data
      const hadCache = cachedTx || cachedGoals || cachedLoans || cachedNotes;
      if (hadCache) setReady(true);
    } catch (e) {
      console.warn("Local cache load failed (non-fatal):", e);
    }

    // ── Phase 2: Read the device database (+ one-time legacy import, see api.ts) ──
    try {
      const [
        txRemote, loansRemote, catsRemote, assetsRemote, liabRemote, eventsRemote,
        sipsRemote, insRemote, invRemote, goldRemote, propRemote, csRemote, fraudRemote,
        goalsRemote, budgetsRemote, subsRemote, bucketsRemote, bucketContribsRemote,
        structuredLoansRemote, creditCardsRemote,
        householdStaffRemote, societyNoticesRemote, householdRemindersRemote,
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
        api.list<HouseholdStaff>("householdStaff"),
        api.list<SocietyNotice>("societyNotices"),
        api.list<HouseholdReminder>("reminders"),
      ]);

      // Safe merge helper: NEVER let an empty remote list delete populated local data
      const mergeSafe = <T,>(remote: T[], cached: T[] | null | undefined, keyFn: (item: T) => string): T[] => {
        const hasRemote = Array.isArray(remote) && remote.length > 0;
        const hasCached = Array.isArray(cached) && cached.length > 0;
        if (hasRemote && hasCached) {
          return dedupeList([...cached, ...remote], keyFn);
        }
        if (hasRemote) return dedupeList(remote, keyFn);
        if (hasCached) return dedupeList(cached, keyFn);
        return [];
      };

      const cleanAssets = mergeSafe(assetsRemote, cachedAssets, assetKey);
      const cleanLiab = mergeSafe(liabRemote, cachedLiab, liabilityKey);
      const cleanEvents = mergeSafe(eventsRemote, cachedEvents, (x) => (x as any).id || JSON.stringify(x));
      const cleanSips = mergeSafe(sipsRemote, cachedSips, sipKey);
      const cleanIns = mergeSafe(insRemote, cachedIns, insuranceKey);
      const cleanInv = mergeSafe(invRemote, cachedInv, investmentKey);
      const cleanGold = mergeSafe(goldRemote, cachedGold, goldKey);
      const cleanProp = mergeSafe(propRemote, cachedProp, propertyKey);
      const cleanCs = mergeSafe(csRemote, cachedCs, (x) => x.id || x.date).sort((a, b) => b.date.localeCompare(a.date));
      const cleanFraud = mergeSafe(fraudRemote, cachedFraud, (x) => (x as any).id || JSON.stringify(x));
      const cleanTx = mergeSafe(txRemote, cachedTx, txKey).sort((a, b) => (a.date < b.date ? 1 : -1));
      const cleanLoans = mergeSafe(loansRemote, cachedLoans, loanKey);
      const cleanStructuredLoans = mergeSafe(structuredLoansRemote, cachedStructuredLoans, structuredLoanKey);
      const cleanCreditCards = mergeSafe(creditCardsRemote, cachedCreditCards, creditCardKey);
      const cleanGoals = mergeSafe(goalsRemote, cachedGoals, goalKey);
      const userId = await api.getCurrentUserId();
      const sanitizedBuckets = await Promise.all(bucketsRemote.map((b) => sanitizeBucket(b, userId)));
      const cleanBuckets = mergeSafe(sanitizedBuckets, cachedBuckets, bucketKey);
      const cleanBucketContribs = mergeSafe(bucketContribsRemote, cachedBucketContribs, bucketContribKey).sort((a, b) => (a.date < b.date ? 1 : -1));
      const cleanBudgets = mergeSafe(budgetsRemote, cachedBudgets, budgetKey);
      const cleanSubs = mergeSafe(subsRemote, cachedSubs, subscriptionKey);

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

      const cleanHouseholdStaff = mergeSafe(householdStaffRemote, cachedHouseholdStaff, householdStaffKey);
      const cleanSocietyNotices = mergeSafe(societyNoticesRemote, cachedSocietyNotices, societyNoticeKey);
      const cleanHouseholdReminders = mergeSafe(householdRemindersRemote, cachedHouseholdReminders, householdReminderKey);
      setHouseholdStaff(cleanHouseholdStaff);
      setSocietyNotices(cleanSocietyNotices);
      setHouseholdReminders(cleanHouseholdReminders);

      if (catsRemote.length === 0 && (!cachedCats || cachedCats.length === 0)) {
        setCategories(DEFAULT_CATEGORIES);
      } else {
        const mergedCats = mergeSafe(catsRemote, cachedCats, (c) => c.name || (c as any).id);
        const custom = mergedCats.map((c) => c.name).filter(Boolean);
        const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...custom]));
        setCategories(merged);
      }

      // ── Persist cleaned data to local cache ONLY if non-empty (never overwrite with []) ──
      if (cleanTx.length > 0) saveToCache("transactions", cleanTx);
      if (cleanLoans.length > 0) saveToCache("loans", cleanLoans);
      if (catsRemote.length > 0) saveToCache("categories", catsRemote);
      if (cleanAssets.length > 0) saveToCache("assets", cleanAssets);
      if (cleanLiab.length > 0) saveToCache("liabilities", cleanLiab);
      if (cleanEvents.length > 0) saveToCache("lifeEvents", cleanEvents);
      if (cleanSips.length > 0) saveToCache("sips", cleanSips);
      if (cleanIns.length > 0) saveToCache("insurance", cleanIns);
      if (cleanInv.length > 0) saveToCache("investments", cleanInv);
      if (cleanGold.length > 0) saveToCache("gold", cleanGold);
      if (cleanProp.length > 0) saveToCache("properties", cleanProp);
      if (cleanCs.length > 0) saveToCache("creditScore", cleanCs);
      if (cleanFraud.length > 0) saveToCache("fraudAlerts", cleanFraud);
      if (cleanGoals.length > 0) saveToCache("goals", cleanGoals);
      if (cleanBudgets.length > 0) saveToCache("budgets", cleanBudgets);
      if (cleanSubs.length > 0) saveToCache("subscriptions", cleanSubs);
      if (cleanBuckets.length > 0) saveToCache("buckets", cleanBuckets);
      if (cleanBucketContribs.length > 0) saveToCache("bucketContributions", cleanBucketContribs);
      if (cleanStructuredLoans.length > 0) saveToCache("structuredLoans", cleanStructuredLoans);
      if (cleanCreditCards.length > 0) saveToCache("creditCards", cleanCreditCards);
      if (cleanHouseholdStaff.length > 0) saveToCache("householdStaff", cleanHouseholdStaff);
      if (cleanSocietyNotices.length > 0) saveToCache("societyNotices", cleanSocietyNotices);
      if (cleanHouseholdReminders.length > 0) saveToCache("householdReminders", cleanHouseholdReminders);

      // Keep permanent safety snapshot fresh
      void savePermanentBackupSnapshot();
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
  useEffect(() => { if (ready && allTransactions.length > 0) saveToCache("transactions", allTransactions); }, [ready, allTransactions]);
  useEffect(() => { if (ready && loans.length > 0) saveToCache("loans", loans); }, [ready, loans]);
  useEffect(() => { if (ready && structuredLoans.length > 0) saveToCache("structuredLoans", structuredLoans); }, [ready, structuredLoans]);
  useEffect(() => { if (ready && creditCards.length > 0) saveToCache("creditCards", creditCards); }, [ready, creditCards]);
  useEffect(() => { if (ready && assets.length > 0) saveToCache("assets", assets); }, [ready, assets]);
  useEffect(() => { if (ready && liabilities.length > 0) saveToCache("liabilities", liabilities); }, [ready, liabilities]);
  useEffect(() => { if (ready && lifeEvents.length > 0) saveToCache("lifeEvents", lifeEvents); }, [ready, lifeEvents]);
  useEffect(() => { if (ready && sips.length > 0) saveToCache("sips", sips); }, [ready, sips]);
  useEffect(() => { if (ready && insurance.length > 0) saveToCache("insurance", insurance); }, [ready, insurance]);
  useEffect(() => { if (ready && investments.length > 0) saveToCache("investments", investments); }, [ready, investments]);
  useEffect(() => { if (ready && gold.length > 0) saveToCache("gold", gold); }, [ready, gold]);
  useEffect(() => { if (ready && properties.length > 0) saveToCache("properties", properties); }, [ready, properties]);
  useEffect(() => { if (ready && creditScore.length > 0) saveToCache("creditScore", creditScore); }, [ready, creditScore]);
  useEffect(() => { if (ready && fraudAlerts.length > 0) saveToCache("fraudAlerts", fraudAlerts); }, [ready, fraudAlerts]);
  useEffect(() => { if (ready && goals.length > 0) saveToCache("goals", goals); }, [ready, goals]);
  useEffect(() => { if (ready && budgets.length > 0) saveToCache("budgets", budgets); }, [ready, budgets]);
  useEffect(() => { if (ready && subscriptions.length > 0) saveToCache("subscriptions", subscriptions); }, [ready, subscriptions]);
  useEffect(() => { if (ready && buckets.length > 0) saveToCache("buckets", buckets); }, [ready, buckets]);
  useEffect(() => { if (ready && bucketContributions.length > 0) saveToCache("bucketContributions", bucketContributions); }, [ready, bucketContributions]);
  useEffect(() => { if (ready && householdStaff.length > 0) saveToCache("householdStaff", householdStaff); }, [ready, householdStaff]);
  useEffect(() => { if (ready && societyNotices.length > 0) saveToCache("societyNotices", societyNotices); }, [ready, societyNotices]);
  useEffect(() => { if (ready && householdReminders.length > 0) saveToCache("householdReminders", householdReminders); }, [ready, householdReminders]);
  useEffect(() => { if (ready) saveToCache("notificationSound", [notificationSound]); }, [ready, notificationSound]);
  useEffect(() => { if (ready && notes.length > 0) localReplace("notes", notes); }, [ready, notes]);
  useEffect(() => {
    if (ready) {
      const catObjects = categories.filter((c) => !DEFAULT_CATEGORIES.includes(c)).map((c) => ({ id: c, name: c }));
      if (catObjects.length > 0) saveToCache("categories", catObjects);
    }
  }, [ready, categories]);


  // Clear all in-memory state when user signs out — prevents data bleed between sessions
  useEffect(() => {
    const sub = api.onAuth((signedIn) => {
      if (!signedIn) {
        // Safe check: Only clear in-memory state if there is truly no cached offline session
        loadAuthSession().then((cached) => {
          if (!cached) {
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
            setHouseholdStaff([]);
            setSocietyNotices([]);
            setHouseholdReminders([]);
            setNotes([]);
            setReady(false);
            clearQueue();
          }
        }).catch(() => {});
      }
    });
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  // ── Optimistic offline-first helper ──────────────────────────────────────────
  // Pattern:
  //   1. Generate localId
  //   2. Update React state immediately (instant UI)
  //   3. If online  → call API in background, swap localId → serverId on success
  //   4. If offline → enqueue op; drain runs on reconnect

  const addTransaction = useCallback(async (t: Omit<Tx, "id">, opts?: { silent?: boolean }) => {
    const localId = crypto.randomUUID();
    const optimistic: Tx = { ...t, id: localId, createdAt: new Date().toISOString() };

    if (!opts?.silent) feedback({
      kind: t.type === "income" ? "income" : "expense",
      title: t.type === "income" ? "Income added" : "Expense recorded",
      amount: Math.abs(Number(t.amount) || 0),
      subtitle: t.title || t.category,
    });

    // 1. Deduplicate check
    const targetKey = txKey(t as Tx);
    setTransactions((prev) => {
      if (prev.find((x) => txKey(x) === targetKey)) return prev;
      return dedupeList([optimistic, ...prev], txKey);
    });

    // 2. Background sync
    if (WRITE_LOCALLY) {
      try {
        // Same id on device as in memory — no id swap needed.
        const created = await api.create<Tx>("transactions", { ...t, id: localId, createdAt: optimistic.createdAt });
        setTransactions((prev) =>
          dedupeList(prev.map((x) => x.id === localId ? created : x), txKey)
        );
      } catch (e) {
        console.error("addTransaction sync failed:", e);
        // Optimistic item stays in UI; will retry on reload/reconnect
      }
    } else {
      // Queue for later
      const userId = await loadCachedUserId();
      const payload = userId ? await encryptFields("transactions", t as any, userId).catch(() => t) : t;
      await enqueueOp({ collection: "transactions", method: "create", payload: payload as any, localId });
    }
  }, []);

  const updateTransaction = useCallback(async (t: Tx) => {
    // Optimistic update immediately
    setTransactions((prev) => dedupeList(prev.map((x) => x.id === t.id ? t : x), txKey));
    if (WRITE_LOCALLY) {
      try {
        const updated = await api.create<Tx>("transactions", t);
        setTransactions((prev) => dedupeList(prev.map((x) => x.id === t.id ? updated : x), txKey));
        return { ok: true };
      } catch (e: any) {
        console.error("updateTransaction failed:", e);
        return { ok: false, error: e.message || "Update failed" };
      }
    } else {
      const userId = await loadCachedUserId();
      const payload = userId ? await encryptFields("transactions", t as any, userId).catch(() => t) : t;
      await enqueueOp({ collection: "transactions", method: "create", payload: payload as any, localId: t.id });
      return { ok: true };
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    // Optimistic remove immediately
    setTransactions((prev) => prev.filter((x) => x.id !== id));
    if (WRITE_LOCALLY) {
      try {
        await api.remove("transactions", id);
        notify.info("Transaction deleted");
        return { ok: true };
      } catch (e: any) {
        console.error("deleteTransaction failed:", e);
        notify.error("Could not delete transaction");
        return { ok: false, error: e.message || "Delete failed" };
      }
    } else {
      await enqueueOp({ collection: "transactions", method: "remove", itemId: id });
      return { ok: true };
    }
  }, []);


  const allTxRef = useRef<Tx[]>([]);
  allTxRef.current = allTransactions;

  const addTransfer = useCallback<StoreCtx["addTransfer"]>(async (input) => {
    if (!(Math.abs(input.amount) > 0)) return;
    if (input.fromAccountId && input.fromAccountId === input.toAccountId) {
      notify.error("Choose two different accounts");
      return;
    }
    const legs = buildTransferLegs({ ...input, transferId: crypto.randomUUID() });
    await addTransaction(legs.out as Omit<Tx, "id">, { silent: true });
    await addTransaction(legs.in as Omit<Tx, "id">, { silent: true });
    notify.info("Transfer recorded — not counted as income or expense");
  }, [addTransaction]);

  const linkTransfer = useCallback<StoreCtx["linkTransfer"]>(async (outId, inId) => {
    const o = allTxRef.current.find((x) => x.id === outId);
    const i = allTxRef.current.find((x) => x.id === inId);
    if (!o || !i) return;
    const [to, ti] = applyTransferPair(o, i, crypto.randomUUID());
    await updateTransaction(to);
    await updateTransaction(ti);
  }, [updateTransaction]);

  const unlinkTransfer = useCallback<StoreCtx["unlinkTransfer"]>(async (transferId) => {
    const legs = allTxRef.current.filter((x) => x.transferId === transferId);
    for (const leg of legs) await updateTransaction(clearTransfer(leg));
  }, [updateTransaction]);

  const transferSuggestions = useMemo(() => suggestTransferPairs(allTransactions as any), [allTransactions]);

  const addLoan = useCallback(async (l: Omit<Loan, "id">) => {
    const localId = crypto.randomUUID();
    const optimistic: Loan = { ...l, id: localId };
    setLoans((prev) => {
      if (prev.find((x) => loanKey(x) === loanKey(l as Loan))) return prev;
      return dedupeList([optimistic, ...prev], loanKey);
    });
    if (WRITE_LOCALLY) {
      try {
        const created = await api.create<Loan>("loans", l);
        setLoans((prev) => dedupeList(prev.map((x) => x.id === localId ? created : x), loanKey));
      } catch (e) { console.error("addLoan sync failed:", e); }
    } else {
      const userId = await loadCachedUserId();
      const payload = userId ? await encryptFields("loans", l as any, userId).catch(() => l) : l;
      await enqueueOp({ collection: "loans", method: "create", payload: payload as any, localId });
    }
  }, []);

  const settleLoan = useCallback(async (id: string) => {
    setLoans((prev) => prev.map((l) => l.id === id ? { ...l, settled: true } : l));
    if (WRITE_LOCALLY) {
      const current = await new Promise<Loan | undefined>((res) => {
        setLoans((prev) => { res(prev.find((l) => l.id === id)); return prev; });
      });
      if (current) {
        try {
          const updated = await api.create<Loan>("loans", { ...current, settled: true });
          setLoans((prev) => prev.map((l) => l.id === id ? updated : l));
        } catch (e) { console.error("settleLoan sync failed:", e); }
      }
    } else {
      await enqueueOp({ collection: "loans", method: "create",
        payload: { id, settled: true } as any, localId: id });
    }
  }, []);

  const removeLoan = useCallback(async (id: string) => {
    setLoans((prev) => prev.filter((l) => l.id !== id));
    if (WRITE_LOCALLY) {
      try { await api.remove("loans", id); } catch (e) { console.error("removeLoan sync failed:", e); }
    } else {
      await enqueueOp({ collection: "loans", method: "remove", itemId: id });
    }
  }, []);


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

  const addGoal = useCallback(async (g: Omit<Goal, "id">) => {
    const localId = crypto.randomUUID();
    const optimistic: Goal = { ...g, id: localId };
    setGoals((prev) => {
      if (prev.find((x) => goalKey(x) === goalKey(g as Goal))) return prev;
      return dedupeList([...prev, optimistic], goalKey);
    });
    if (WRITE_LOCALLY) {
      try {
        const created = await api.create<Goal>("goals", g);
        setGoals((prev) => dedupeList(prev.map((x) => x.id === localId ? created : x), goalKey));
      } catch (e) { console.error("addGoal sync failed:", e); }
    } else {
      const userId = await loadCachedUserId();
      const payload = userId ? await encryptFields("goals", g as any, userId).catch(() => g) : g;
      await enqueueOp({ collection: "goals", method: "create", payload: payload as any, localId });
    }
  }, []);

  const updateGoal = useCallback(async (g: Goal) => {
    setGoals((prev) => dedupeList(prev.map((x) => x.id === g.id ? g : x), goalKey));
    if (WRITE_LOCALLY) {
      try {
        const updated = await api.create<Goal>("goals", g);
        setGoals((prev) => dedupeList(prev.map((x) => x.id === g.id ? updated : x), goalKey));
      } catch (e) { console.error("updateGoal sync failed:", e); }
    } else {
      const userId = await loadCachedUserId();
      const payload = userId ? await encryptFields("goals", g as any, userId).catch(() => g) : g;
      await enqueueOp({ collection: "goals", method: "create", payload: payload as any, localId: g.id });
    }
  }, []);

  const removeGoal = useCallback(async (id: string) => {
    setGoals((prev) => prev.filter((x) => x.id !== id));
    if (WRITE_LOCALLY) {
      try { await api.remove("goals", id); } catch (e) { console.error("removeGoal sync failed:", e); }
    } else {
      await enqueueOp({ collection: "goals", method: "remove", itemId: id });
    }
  }, []);


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

  const addBucketContribution = useCallback(async (bucketId: string, amount: number, note?: string, sourceAccountId?: string) => {
    const userId = await api.getCurrentUserId();
    const targetBucket = await new Promise<Bucket | undefined>((res) => {
      // Read current bucket from state without triggering re-render
      setBuckets((prev) => { res(prev.find((b) => b.id === bucketId)); return prev; });
    });
    if (!targetBucket) return;
    const cleanBucket = await sanitizeBucket(targetBucket, userId);
    const currentSaved = Number(cleanBucket.savedAmount) || 0;
    const newSavedAmount = currentSaved + amount;
    const targetNum = Number(cleanBucket.targetAmount) || 0;
    const newStatus = targetNum > 0 && newSavedAmount >= targetNum ? "completed" : "active";
    const updatedBucket: Bucket = {
      ...cleanBucket, savedAmount: newSavedAmount, status: newStatus,
      targetAmount: targetNum, updatedAt: new Date().toISOString(),
    };
    const now = new Date().toISOString();
    const localContribId = crypto.randomUUID();
    const newContrib: BucketContribution = {
      id: localContribId, bucketId, amount,
      note: note || "", sourceAccountId: sourceAccountId || undefined,
      date: now, createdAt: now,
    };

    feedback({
      kind: "saving",
      title: newStatus === "completed" ? `🎉 ${cleanBucket.name} goal reached!` : `Saved to ${cleanBucket.name}`,
      amount,
      subtitle: targetNum > 0 ? `${Math.min(100, Math.round((newSavedAmount / targetNum) * 100))}% of goal` : undefined,
    });

    // Optimistic state update — instant
    setBuckets((prev) => dedupeList(prev.map((x) => x.id === bucketId ? updatedBucket : x), bucketKey));
    setBucketContributions((prev) =>
      dedupeList([newContrib, ...prev], bucketContribKey).sort((a, b) => (a.date < b.date ? 1 : -1))
    );

    if (WRITE_LOCALLY) {
      try {
        const [createdContrib, savedBucket] = await Promise.all([
          api.create<BucketContribution>("bucketContributions", newContrib),
          api.create<Bucket>("buckets", updatedBucket),
        ]);
        setBucketContributions((prev) =>
          dedupeList(prev.map((x) => x.id === localContribId ? createdContrib : x), bucketContribKey)
        );
        setBuckets((prev) => dedupeList(prev.map((x) => x.id === bucketId ? savedBucket : x), bucketKey));
      } catch (e) {
        console.error("addBucketContribution sync failed:", e);
      }
    } else {
      await enqueueOp({ collection: "bucketContributions", method: "create",
        payload: newContrib as any, localId: localContribId });
      await enqueueOp({ collection: "buckets", method: "create",
        payload: updatedBucket as any, localId: bucketId });
    }
  }, []);


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

  const addHouseholdStaff = async (s: Omit<HouseholdStaff, "id">) => {
    try {
      const created = await api.create<HouseholdStaff>("householdStaff", s);
      setHouseholdStaff((prev) => dedupeList([...prev, created], householdStaffKey));
    } catch (e) { console.error("Add household staff failed:", e); }
  };

  const removeHouseholdStaff = async (id: string) => {
    try {
      await api.remove("householdStaff", id);
      setHouseholdStaff((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { console.error("Remove household staff failed:", e); }
  };

  const addSocietyNotice = async (n: Omit<SocietyNotice, "id">) => {
    try {
      const created = await api.create<SocietyNotice>("societyNotices", n);
      setSocietyNotices((prev) => dedupeList([created, ...prev], societyNoticeKey));
    } catch (e) { console.error("Add society notice failed:", e); }
  };

  const updateSocietyNotice = async (n: SocietyNotice) => {
    try {
      const updated = await api.create<SocietyNotice>("societyNotices", n);
      setSocietyNotices((prev) => dedupeList(prev.map((x) => x.id === n.id ? updated : x), societyNoticeKey));
    } catch (e) { console.error("Update society notice failed:", e); }
  };

  const removeSocietyNotice = async (id: string) => {
    try {
      await api.remove("societyNotices", id);
      setSocietyNotices((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { console.error("Remove society notice failed:", e); }
  };

  const addHouseholdReminder = async (r: Omit<HouseholdReminder, "id">) => {
    try {
      const created = await api.create<HouseholdReminder>("reminders", r);
      setHouseholdReminders((prev) => dedupeList([...prev, created], householdReminderKey));
    } catch (e) { console.error("Add household reminder failed:", e); }
  };

  const updateHouseholdReminder = async (r: HouseholdReminder) => {
    try {
      const updated = await api.create<HouseholdReminder>("reminders", r);
      setHouseholdReminders((prev) => dedupeList(prev.map((x) => x.id === r.id ? updated : x), householdReminderKey));
    } catch (e) { console.error("Update household reminder failed:", e); }
  };

  const removeHouseholdReminder = async (id: string) => {
    try {
      await api.remove("reminders", id);
      setHouseholdReminders((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { console.error("Remove household reminder failed:", e); }
  };

  const setNotificationSound = (s: string) => {
    setNotificationSoundState(s);
  };

  const deleteAllData = async () => {
    try {
      setReady(false);
      await eraseAllUserData();
      clearAiConfig(); // the user's own AI key lives only on this device — erase it with everything else
      // Reset in-memory state to match the now-empty device database.
      setTransactions([]); setGoals([]); setBudgets([]); setSubscriptions([]); setLoans([]);
      setStructuredLoans([]); setCreditCards([]); setAssets([]); setLiabilities([]); setLifeEvents([]);
      setCategories(DEFAULT_CATEGORIES); setSips([]); setInsurance([]); setInvestments([]); setGold([]);
      setProperties([]); setCreditScore([]); setFraudAlerts([]); setHouseholdStaff([]); setSocietyNotices([]);
      setHouseholdReminders([]); setBuckets([]); setBucketContributions([]); setNotes([]);
    } catch (e) {
      console.error("Delete all data failed:", e);
    } finally {
      setReady(true);
    }
  };

  // ── Loan auto-debit ────────────────────────────────────────────────────
  // Mirrors the bank's e-mandate: every instalment that has fallen due is recorded as an expense on the
  // linked account and the loan moves on (Pre-EMI stays Pre-EMI; a real EMI reduces principal). Runs on
  // launch and whenever loans change, and back-fills months the app was closed. Safe to re-run: a due
  // date already in the ledger is never recorded twice.
  const autoDebitLatest = useRef({ transactions, structuredLoans, addTransaction, updateStructuredLoan });
  autoDebitLatest.current = { transactions, structuredLoans, addTransaction, updateStructuredLoan };
  const autoDebitBusy = useRef(false);
  const loanDueSignature = structuredLoans.map((l) => `${l.id}:${l.nextEmiDueDate}:${l.autoDebit ? 1 : 0}:${l.closed ? 1 : 0}`).join("|");
  useEffect(() => {
    if (!ready || autoDebitBusy.current) return;
    const today = todayISO();
    const pending = autoDebitLatest.current.structuredLoans.filter((l) => dueInstallments(l, today).length > 0);
    if (pending.length === 0) return;
    autoDebitBusy.current = true;
    (async () => {
      const posted: string[] = [];
      let total = 0;
      try {
        for (const loan0 of pending) {
          let loan = loan0;
          for (const due of dueInstallments(loan0, today)) {
            const { transactions: ledger, addTransaction: add } = autoDebitLatest.current;
            if (!alreadyRecorded(ledger, loan.id, due.dueDate)) {
              await add(buildInstallmentTx(loan, due, { auto: true }), { silent: true });
              total += due.amount;
              posted.push(`${loan.lenderName} ${due.kind === "pre_emi" ? "Pre-EMI" : "EMI"}`);
              // keep the manually tracked bank balance in step with the debit
              if (loan.autoDebitBankAccountId) {
                try {
                  const accounts = await api.list<any>("accounts");
                  const acc = accounts.find((a) => a.id === loan.autoDebitBankAccountId);
                  if (acc && typeof acc.balance === "number") await api.create("accounts", { ...acc, balance: acc.balance - due.amount });
                } catch (e) { console.warn("[auto-debit] balance update skipped", e); }
              }
            }
            loan = applyInstallment(loan, due.kind);
          }
          await autoDebitLatest.current.updateStructuredLoan(loan);
        }
        if (posted.length) {
          notify.info(
            posted.length === 1 ? `Auto-debit recorded: ${posted[0]}` : `${posted.length} loan debits recorded`,
            `₹${Math.round(total).toLocaleString("en-IN")} added to your expenses.`,
          );
        }
      } catch (e) {
        console.error("[auto-debit] failed, will retry on next launch:", e);
      } finally {
        autoDebitBusy.current = false;
      }
    })();
  }, [ready, loanDueSignature]);

  // ── Notes & bill reminders ─────────────────────────────────────────────
  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;
  const upsertNote = useCallback(async (n: Partial<Note> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = n.id || crypto.randomUUID();
    const existing = notesRef.current.find((x) => x.id === id);
    const saved = {
      title: "", body: "", color: "default", pinned: false, archived: false, labels: [],
      createdAt: now, ...(existing || {}), ...n, id, updatedAt: now,
    } as Note;
    notesRef.current = existing ? notesRef.current.map((x) => (x.id === id ? saved : x)) : [saved, ...notesRef.current];
    setNotes((prev) => (prev.some((x) => x.id === id) ? prev.map((x) => (x.id === id ? saved : x)) : [saved, ...prev]));
    return saved;
  }, []);

  const removeNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const payBill = useCallback(async (id: string, opts?: { amount?: number; logExpense?: boolean }) => {
    const target = notesRef.current.find((x) => x.id === id);
    if (!target) return;
    const amount = opts?.amount ?? target.amount ?? 0;
    setNotes((prev) => prev.map((x) => (x.id === id ? markBillPaid({ ...x, amount: amount || x.amount }) : x)));
    if (opts?.logExpense !== false && amount > 0 && isBill(target)) {
      // Logged silently; the bill-paid feedback below is the one the user sees.
      const t: Omit<Tx, "id"> = {
        title: target.title || "Bill payment",
        category: target.category || "Other",
        amount: -amount,
        type: "expense",
        date: todayISO(),
        notes: "Paid from Notes & Reminders",
      };
      const created = await api.create<Tx>("transactions", t);
      setTransactions((prev) => dedupeList([created, ...prev], txKey));
    }
    feedback({ kind: "bill-paid", title: `${target.title || "Bill"} paid`, amount: amount || undefined, subtitle: target.reminder?.repeat && target.reminder.repeat !== "none" ? "Next reminder scheduled" : "Moved to archive" });
  }, []);

  return (
    <Ctx.Provider value={{
      ready, transactions, allTransactions, buckets, bucketContributions, goals, budgets, subscriptions, loans, structuredLoans, creditCards,
      assets, liabilities, lifeEvents, categories,
      sips, insurance, investments, gold, properties, creditScore, fraudAlerts,
      householdStaff, societyNotices, householdReminders,
      notes, upsertNote, removeNote, payBill,
      notificationSound, setNotificationSound,
      selectedMonth, setSelectedMonth, deleteAllData,
      addTransaction, addTransfer, linkTransfer, unlinkTransfer, transferSuggestions, updateTransaction, deleteTransaction, addLoan, settleLoan, removeLoan,
      addStructuredLoan, updateStructuredLoan, removeStructuredLoan,
      addCreditCard, updateCreditCard, removeCreditCard,
      addCategory, removeCategory,
      upsertAsset, removeAsset, upsertLiability, removeLiability, upsertLifeEvent, removeLifeEvent,
      addSip, removeSip, addInsurance, removeInsurance, addInvestment, updateInvestment, removeInvestment,
      addGold, removeGold, addProperty, updateProperty, removeProperty, addCreditScore, addFraudAlert, resolveFraudAlert,
      addGoal, updateGoal, removeGoal, addBucket, updateBucket, archiveBucket, removeBucket, addBucketContribution, addBudget, updateBudget, removeBudget, addSubscription, removeSubscription,
      addHouseholdStaff, removeHouseholdStaff,
      addSocietyNotice, updateSocietyNotice, removeSocietyNotice,
      addHouseholdReminder, updateHouseholdReminder, removeHouseholdReminder,
      refresh
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
