/**
 * reminderPrefs.ts — the user's reminder settings, kept on the device.
 * Defaults: reminders ON, ask after each expense ON, heads-up 1 day before at 9:00 AM.
 */
import { DEFAULT_TIMING } from "./reminderPlan";

const K = { enabled: "ls_rem_enabled", ask: "ls_rem_ask", lead: "ls_rem_lead", time: "ls_rem_time" } as const;
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable — defaults apply */ } };

export const reminderPrefs = {
  /** Master switch: when off, no bill alerts are scheduled on the phone. */
  get enabled() { return get(K.enabled) !== "off"; },
  setEnabled(on: boolean) { set(K.enabled, on ? "on" : "off"); window.dispatchEvent(new Event("ls-reminder-prefs")); },
  /** Offer "make this a reminder?" after saving an expense. */
  get askAfterExpense() { return get(K.ask) !== "off"; },
  setAskAfterExpense(on: boolean) { set(K.ask, on ? "on" : "off"); window.dispatchEvent(new Event("ls-reminder-prefs")); },
  get leadDays(): number { const n = Number(get(K.lead)); return Number.isInteger(n) && n >= 0 && n <= 30 && get(K.lead) !== null ? n : DEFAULT_TIMING.leadDays; },
  setLeadDays(n: number) { set(K.lead, String(n)); },
  get time(): string { const t = get(K.time) ?? ""; return /^\d{1,2}:\d{2}$/.test(t) ? t : DEFAULT_TIMING.time; },
  setTime(t: string) { if (/^\d{1,2}:\d{2}$/.test(t)) set(K.time, t); },
};
