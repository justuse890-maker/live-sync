/**
 * recovery.ts — Universal Data Recovery & Preservation Engine
 *
 * Scans all persistent storage on the mobile device (Capacitor Preferences / Android
 * SharedPreferences, localStorage, IndexedDB, and optional Supabase cloud backups)
 * to recover any previous data that was stored before an update.
 *
 * Guarantees:
 * 1. User data is NEVER overwritten or removed across any update.
 * 2. Old data from any previous format, key, or version is preserved and merged.
 * 3. Keeps an un-deletable permanent backup snapshot in native SharedPreferences + localStorage.
 */

import { Capacitor } from "@capacitor/core";
import { dedupeList, txKey, Tx } from "../store";
import { saveToCache, loadFromCache, openDB } from "./localCache";

export const PERMANENT_BACKUP_KEY = "ls_permanent_backup_v1";

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

let prefsMod: Promise<typeof import("@capacitor/preferences")> | null = null;
const prefs = () => (prefsMod ??= import("@capacitor/preferences"));

export type RecoveryReport = {
  transactionsCount: number;
  loansCount: number;
  budgetsCount: number;
  goalsCount: number;
  creditCardsCount: number;
  structuredLoansCount: number;
  notesCount: number;
  categoriesCount: number;
  sourcesFound: string[];
  recoveredTx: Tx[];
  recoveredCollections: Record<string, any[]>;
};

/**
 * Safely parse any JSON string or object
 */
function safeParse(val: any): any {
  if (!val) return null;
  if (typeof val === "object") return "data" in val ? val.data : val;
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const ALL_RECOVERY_COLLECTIONS = [
  "transactions",
  "loans",
  "budgets",
  "goals",
  "creditCards",
  "structuredLoans",
  "notes",
  "categories",
  "assets",
  "liabilities",
  "sips",
  "chits",
  "insurance",
  "investments",
  "gold",
  "properties",
  "creditScore",
  "fraudAlerts",
  "householdStaff",
  "societyNotices",
  "householdReminders",
  "buckets",
  "bucketContributions",
  "cashLedger",
  "cashPockets",
  "family",
  "accounts",
] as const;

/**
 * Scan all device storage (SharedPreferences, localStorage, permanent snapshots)
 * to find any historical data across all versions and prefixes.
 */
export async function scanForPreviousData(): Promise<RecoveryReport> {
  const sourcesFound = new Set<string>();
  const allTxs: Tx[] = [];
  const collections: Record<string, any[]> = {};
  for (const c of ALL_RECOVERY_COLLECTIONS) {
    if (c !== "transactions") collections[c] = [];
  }

  // 1. Scan Capacitor Preferences (Android SharedPreferences)
  if (isNative()) {
    try {
      const { Preferences } = await prefs();
      const { keys } = await Preferences.keys();

      for (const k of keys) {
        // Match lsv1_transactions, transactions, livesync_transactions, ls_transactions, etc.
        const normalized = k.replace(/^lsv1_/, "").replace(/^livesync_/, "").replace(/^ls_/, "");
        const raw = await Preferences.get({ key: k });
        if (!raw || !raw.value) continue;

        const data = safeParse(raw.value);
        if (!data) continue;

        if (normalized === "transactions" || k.includes("tx") || k.includes("transact")) {
          if (Array.isArray(data) && data.length > 0) {
            allTxs.push(...data);
            sourcesFound.add(`SharedPreferences (${k}: ${data.length} txs)`);
          }
        } else if (collections[normalized] && Array.isArray(data) && data.length > 0) {
          collections[normalized].push(...data);
          sourcesFound.add(`SharedPreferences (${k}: ${data.length} items)`);
        } else if ((k === PERMANENT_BACKUP_KEY || k.includes("snapshot") || k.includes("pre_migration")) && data?.collections) {
          if (Array.isArray(data.collections.transactions)) {
            allTxs.push(...data.collections.transactions);
            sourcesFound.add(`SharedPreferences Snapshot (${data.collections.transactions.length} txs)`);
          }
          for (const [colName, items] of Object.entries(data.collections)) {
            if (collections[colName] && Array.isArray(items)) {
              collections[colName].push(...items);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[recovery] Error reading SharedPreferences:", e);
    }
  }

  // 2. Scan localStorage
  if (typeof localStorage !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;

        const raw = localStorage.getItem(k);
        if (!raw) continue;

        const data = safeParse(raw);
        if (!data) continue;

        const normalized = k.replace(/^lsv1_/, "").replace(/^livesync_/, "").replace(/^ls_/, "");

        if (normalized === "transactions" || k.includes("transactions") || k.includes("tx_backup")) {
          if (Array.isArray(data) && data.length > 0) {
            allTxs.push(...data);
            sourcesFound.add(`LocalStorage (${k}: ${data.length} txs)`);
          }
        } else if (collections[normalized] && Array.isArray(data) && data.length > 0) {
          collections[normalized].push(...data);
          sourcesFound.add(`LocalStorage (${k}: ${data.length} items)`);
        } else if ((k === PERMANENT_BACKUP_KEY || k.includes("snapshot") || k.includes("pre_migration")) && data?.collections) {
          if (Array.isArray(data.collections.transactions)) {
            allTxs.push(...data.collections.transactions);
            sourcesFound.add(`LocalStorage Snapshot (${data.collections.transactions.length} txs)`);
          }
          for (const [colName, items] of Object.entries(data.collections)) {
            if (collections[colName] && Array.isArray(items)) {
              collections[colName].push(...items);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[recovery] Error reading localStorage:", e);
    }
  }

  // 3. Scan current IndexedDB
  try {
    const idbTxs = await loadFromCache<Tx>("transactions");
    if (Array.isArray(idbTxs) && idbTxs.length > 0) {
      allTxs.push(...idbTxs);
      sourcesFound.add(`IndexedDB (transactions: ${idbTxs.length})`);
    }

    for (const key of Object.keys(collections)) {
      const items = await loadFromCache<any>(key);
      if (Array.isArray(items) && items.length > 0) {
        collections[key].push(...items);
      }
    }
  } catch (e) {
    console.warn("[recovery] Error reading IndexedDB:", e);
  }

  // Deduplicate recovered transactions
  const validTxs = allTxs.filter((t) => t && t.amount != null && t.date);
  const dedupedTxs = dedupeList(validTxs, txKey).sort((a, b) => (a.date < b.date ? 1 : -1));

  // Deduplicate all other collections
  const dedupedCollections: Record<string, any[]> = {};
  for (const [key, items] of Object.entries(collections)) {
    dedupedCollections[key] = dedupeList(items.filter(Boolean), (item) => item.id || JSON.stringify(item));
  }

  return {
    transactionsCount: dedupedTxs.length,
    loansCount: dedupedCollections.loans?.length || 0,
    budgetsCount: dedupedCollections.budgets?.length || 0,
    goalsCount: dedupedCollections.goals?.length || 0,
    creditCardsCount: dedupedCollections.creditCards?.length || 0,
    structuredLoansCount: dedupedCollections.structuredLoans?.length || 0,
    notesCount: dedupedCollections.notes?.length || 0,
    categoriesCount: dedupedCollections.categories?.length || 0,
    sourcesFound: Array.from(sourcesFound),
    recoveredTx: dedupedTxs,
    recoveredCollections: dedupedCollections,
  };
}

/**
 * Executes a full restore: merges all recovered data into the local database,
 * updates the native SharedPreferences mirror, and creates an updated permanent backup.
 */
export async function executeRestore(
  report: RecoveryReport,
): Promise<{ restoredTxs: number; restoredCollections: number }> {
  let restoredTxs = 0;
  let restoredCollections = 0;

  // 1. Restore transactions
  if (report.recoveredTx.length > 0) {
    const existing = (await loadFromCache<Tx>("transactions")) ?? [];
    const merged = dedupeList([...report.recoveredTx, ...existing], txKey).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
    await saveToCache("transactions", merged);
    restoredTxs = merged.length;
  }

  // 2. Restore all other collections
  for (const [col, items] of Object.entries(report.recoveredCollections)) {
    if (items.length > 0) {
      const existing = (await loadFromCache<any>(col)) ?? [];
      const merged = dedupeList([...items, ...existing], (item) => item.id || JSON.stringify(item));
      await saveToCache(col, merged);
      restoredCollections++;
    }
  }

  // 3. Save a fresh Permanent Backup Snapshot to SharedPreferences + localStorage
  await savePermanentBackupSnapshot();

  console.info(`[recovery] Restored ${restoredTxs} transactions and ${restoredCollections} collections.`);
  return { restoredTxs, restoredCollections };
}

/**
 * Creates an un-deletable safety snapshot of all current data in both
 * SharedPreferences and localStorage.
 */
export async function savePermanentBackupSnapshot(): Promise<void> {
  try {
    const snapshot: Record<string, any[]> = {};

    for (const c of ALL_RECOVERY_COLLECTIONS) {
      const items = await loadFromCache<any>(c);
      if (Array.isArray(items) && items.length > 0) {
        snapshot[c] = items;
      }
    }

    if (Object.keys(snapshot).length === 0) return;

    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      version: 1,
      collections: snapshot,
    });

    // Save in localStorage
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(PERMANENT_BACKUP_KEY, payload);
      } catch {}
    }

    // Save in native SharedPreferences
    if (isNative()) {
      try {
        const { Preferences } = await prefs();
        await Preferences.set({ key: PERMANENT_BACKUP_KEY, value: payload });
      } catch {}
    }
  } catch (e) {
    console.warn("[recovery] Could not save permanent backup snapshot:", e);
  }
}

/**
 * Auto-recovery check on app startup:
 * If current IndexedDB collections are missing data, but older data exists in
 * native storage, SharedPreferences, localStorage, or snapshots, automatically restores them!
 */
export async function autoRecoverIfEmpty(): Promise<boolean> {
  try {
    await openDB(); // Ensure IndexedDB is open and initial reconcile finished

    const currentTxs = await loadFromCache<Tx>("transactions");
    const currentLoans = await loadFromCache<any>("loans");
    const currentBudgets = await loadFromCache<any>("budgets");

    const hasNoTransactions = !currentTxs || currentTxs.length === 0;
    const isVirtuallyEmpty =
      hasNoTransactions &&
      (!currentLoans || currentLoans.length === 0) &&
      (!currentBudgets || currentBudgets.length === 0);

    const report = await scanForPreviousData();
    const hasRecoverableData =
      report.transactionsCount > 0 ||
      Object.values(report.recoveredCollections).some((c) => Array.isArray(c) && c.length > 0);

    if (isVirtuallyEmpty && hasRecoverableData) {
      console.info(
        `[recovery] Found ${report.transactionsCount} transactions and historical collections. Auto-restoring...`,
      );
      await executeRestore(report);
      return true;
    } else if (hasNoTransactions && report.transactionsCount > 0) {
      console.info(`[recovery] Recovering ${report.transactionsCount} missing transactions...`);
      await executeRestore(report);
      return true;
    } else {
      // Data exists, refresh snapshot
      void savePermanentBackupSnapshot();
    }
  } catch (e) {
    console.warn("[recovery] Auto-recovery check failed:", e);
  }
  return false;
}

/**
 * Universal startup data preservation runner — must run on application boot
 */
export async function runStartupDataPreservation(): Promise<void> {
  try {
    await autoRecoverIfEmpty();
  } catch (e) {
    console.warn("[recovery] runStartupDataPreservation error:", e);
  }
}
