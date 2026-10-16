/**
 * useAlerts — the in-app notification feed (bell + Notifications screen).
 * Combines three on-device sources:
 *   1. Upcoming / overdue payments and note reminders (obligations.ts)
 *   2. Smart alerts computed from your data (budget overspend, goals behind…)
 *   3. Reminders that already fired (on-device inbox)
 * Read state is stored on the device.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useStore } from "../store";
import { buildObligations, dueLabel, daysUntil } from "./obligations";
import { generateSmartNotifications } from "./notifEngine";
import { localList, localReplace } from "./localDb";
import { formatInr } from "./money";
import { applyAlertPrefs, loadPrefs, type AlertPrefs } from "./alertPrefs";

export type AlertItem = {
  id: string;
  title: string;
  body: string;
  kind: string;
  severity: "urgent" | "warning" | "info";
  at: string;
  read: boolean;
  screen?: string;
  noteId?: string;
};

const READ_KEY = "ls_read_alerts";
const readSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch { return new Set(); }
};

export function useAlerts() {
  const store = useStore();
  const [inbox, setInbox] = useState<Array<{ id: string; title: string; body?: string; kind: string; at: string; read: boolean }>>([]);
  const [readIds, setReadIds] = useState<Set<string>>(readSet);
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(loadPrefs);
  useEffect(() => {
    const h = () => setAlertPrefs(loadPrefs());
    window.addEventListener("ls-alert-prefs-changed", h);
    return () => window.removeEventListener("ls-alert-prefs-changed", h);
  }, []);

  const loadInbox = useCallback(async () => {
    try { setInbox(await localList("inbox")); } catch {}
  }, []);

  useEffect(() => {
    loadInbox();
    const h = () => loadInbox();
    window.addEventListener("ls-inbox-changed", h);
    return () => window.removeEventListener("ls-inbox-changed", h);
  }, [loadInbox]);

  const items = useMemo<AlertItem[]>(() => {
    const now = new Date();
    const out: AlertItem[] = [];

    for (const o of buildObligations(store, 7, 10, now)) {
      const d = daysUntil(o.dueAt, now);
      const amt = o.amount ? ` · ${formatInr(o.amount)}` : "";
      out.push({
        id: `ob:${o.id}:${o.dueAt.toISOString().slice(0, 10)}`,
        title: o.title,
        body: `${dueLabel(o.dueAt, now)}${amt}`,
        kind: o.source,
        severity: o.overdue || d <= 0 ? "urgent" : d <= 2 ? "warning" : "info",
        at: (o.overdue ? o.dueAt : now).toISOString(),
        read: false,
        screen: o.screen,
        noteId: o.noteId,
      });
    }

    for (const n of generateSmartNotifications({
      transactions: store.transactions,
      budgets: store.budgets,
      buckets: store.buckets,
      bucketContributions: store.bucketContributions,
      subscriptions: [], // covered by obligations above
      insurance: [],
      structuredLoans: [],
      creditCards: [],
    }, { now, prefs: alertPrefs })) {
      const screen = n.kind === "budget_alert" || n.kind === "budget_pace" ? "budgets" : n.kind === "bucket_behind" ? "buckets" : n.kind === "bill_rise" ? "subscriptions" : "reports";
      out.push({ id: n.id, title: n.title, body: n.body, kind: n.kind, severity: n.severity, at: new Date(n.at).toISOString(), read: false, screen });
    }

    for (const m of inbox) {
      out.push({ id: `inbox:${m.id}`, title: m.title, body: m.body || "", kind: m.kind, severity: "info", at: m.at, read: m.read, screen: "notes" });
    }

    const sorted = out
      .map((x) => ({ ...x, read: x.read || readIds.has(x.id) }))
      .sort((a, b) => {
        const sev = { urgent: 0, warning: 1, info: 2 };
        if (a.read !== b.read) return a.read ? 1 : -1;
        if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
        return b.at.localeCompare(a.at);
      });
    // The user's mutes / snoozes, and one summary line instead of a burst of more than five ordinary alerts.
    // Already-read items stay out of the batching so reading something never makes it vanish into a digest.
    const unread = sorted.filter((x) => !x.read);
    const read = sorted.filter((x) => x.read);
    return [...(applyAlertPrefs(unread, alertPrefs, now) as AlertItem[]), ...read];
  }, [alertPrefs, store.notes, store.structuredLoans, store.subscriptions, store.creditCards, store.insurance, store.householdReminders, store.societyNotices, store.loans, store.transactions, store.budgets, store.buckets, store.bucketContributions, inbox, readIds]);

  const markRead = useCallback((ids: string[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => next.add(i));
      try { localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-500))); } catch {}
      return next;
    });
    const inboxIds = ids.filter((i) => i.startsWith("inbox:")).map((i) => i.slice(6));
    if (inboxIds.length) {
      setInbox((prev) => {
        const next = prev.map((m) => (inboxIds.includes(m.id) ? { ...m, read: true } : m));
        void localReplace("inbox", next);
        return next;
      });
    }
  }, []);

  const clearInbox = useCallback(async () => {
    await localReplace("inbox", []);
    setInbox([]);
  }, []);

  return { items, unread: items.filter((i) => !i.read).length, markRead, clearInbox };
}
