/**
 * notifications.ts — device notifications for bills, EMIs, renewals and
 * note reminders. Everything is scheduled LOCALLY on the phone (Capacitor
 * Local Notifications). No push server, no tokens, nothing leaves the device.
 *
 * Why notifications did not work before:
 *  1. Android 13+ needs the POST_NOTIFICATIONS runtime permission — it was never requested.
 *  2. The foreground listener lived inside initPushNotifications(), which was never called
 *     (and would have crashed without Firebase), so in-app alerts never showed.
 *  3. Only subscriptions / staff / household items were scheduled — EMIs, notes,
 *     cards and insurance were ignored, and IDs were random so updates duplicated.
 */
import { isNative } from "./native";
import { buildObligations, notifIdFor, Obligation } from "./obligations";
import type { Note } from "./notes";
import { formatReminder, isBill } from "./notes";
import { localUpsert } from "./localDb";
import { playTone, vibrate } from "./feedback";
import { showBanner } from "../components/InAppBanner";

type StoreLike = Parameters<typeof buildObligations>[0] & { notificationSound: string };

const CHANNEL_PREFIX = "ls_reminders_";
const MAX_SCHEDULED = 60; // Android/iOS cap pending local notifications (~64)

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export async function getNotificationPermission(): Promise<PermissionState> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.checkPermissions();
      return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "prompt";
    } catch { return "unsupported"; }
  }
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission === "default" ? "prompt" : (Notification.permission as PermissionState);
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.requestPermissions();
      // Android 12+: exact alarms make reminders fire on the minute.
      try {
        const ex = await (LocalNotifications as any).checkExactNotificationSetting?.();
        if (ex && ex.exact_alarm && ex.exact_alarm !== "granted") {
          await (LocalNotifications as any).changeExactNotificationSetting?.();
        }
      } catch { /* older Android — not needed */ }
      return p.display === "granted" ? "granted" : "denied";
    } catch { return "unsupported"; }
  }
  if (typeof Notification === "undefined") return "unsupported";
  const r = await Notification.requestPermission();
  return r === "default" ? "prompt" : (r as PermissionState);
}

/** Times we alert for an obligation: day-before 9 AM for payments, plus the due moment. */
function alertTimesFor(o: Obligation, now: Date): Array<{ at: Date; title: string; body: string; key: string }> {
  const amt = o.amount ? `₹${Math.round(o.amount).toLocaleString("en-IN")}` : "";
  const out: Array<{ at: Date; title: string; body: string; key: string }> = [];
  const isPayment = o.source !== "note" && o.source !== "household";

  if (isPayment) {
    const dayBefore = new Date(o.dueAt);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(9, 0, 0, 0);
    if (dayBefore > now) {
      out.push({ at: dayBefore, key: `${o.id}:pre`, title: `Due tomorrow · ${o.title}`, body: amt ? `${amt} is due tomorrow. Tap to review.` : "Due tomorrow. Tap to review." });
    }
  }
  // At the due moment (notes keep the exact time the user picked; payments at 9 AM)
  const due = new Date(o.dueAt);
  if (isPayment && o.source !== "bill") due.setHours(9, 0, 0, 0);
  if (due > now) {
    out.push({
      at: due,
      key: `${o.id}:due`,
      title: o.source === "note" ? `⏰ ${o.title}` : `Due today · ${o.title}`,
      body: o.source === "note" ? "Reminder from your notes" : amt ? `Pay ${amt} today.` : "Due today.",
    });
  }
  return out;
}

let lastSignature = "";

export async function syncNotifications(store: StoreLike) {
  const now = new Date();
  const obligations = buildObligations(store, 45, 0, now);
  const plan = obligations.flatMap((o) => alertTimesFor(o, now).map((a) => ({ ...a, o })))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);

  // Skip the native round-trip when nothing changed.
  const signature = JSON.stringify([store.notificationSound, plan.map((p) => [p.key, p.at.getTime(), p.body])]);
  if (signature === lastSignature) return;
  lastSignature = signature;

  if (!isNative()) return; // web: the in-app ticker (startReminderTicker) handles alerts while open

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    const sound = store.notificationSound && store.notificationSound !== "default" ? `${store.notificationSound}.wav` : undefined;
    const channelId = `${CHANNEL_PREFIX}${store.notificationSound || "default"}`;
    try {
      await LocalNotifications.createChannel({
        id: channelId,
        name: "Bills & reminders",
        description: "EMIs, bills, renewals and note reminders",
        importance: 5,
        visibility: 1,
        sound,
        vibration: true,
        lights: true,
        lightColor: "#4F46E5",
      });
    } catch (e) { console.warn("createChannel failed", e); }

    // Replace everything we scheduled before (ids are stable hashes).
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (!plan.length) return;

    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: notifIdFor(p.key),
        title: p.title,
        body: p.body,
        channelId,
        sound,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: { screen: p.o.screen, noteId: p.o.noteId ?? null, key: p.key },
      })),
    });
  } catch (err) {
    console.warn("Failed to schedule local notifications:", err);
  }
}

/** Log a fired alert into the on-device inbox (bell). */
export async function logToInbox(title: string, body: string, kind = "reminder") {
  try {
    await localUpsert("inbox", { id: `${kind}:${title}:${new Date().toISOString().slice(0, 16)}`, title, body, kind, at: new Date().toISOString(), read: false });
    window.dispatchEvent(new Event("ls-inbox-changed"));
  } catch {}
}

let listenersReady = false;
/**
 * Register native listeners once: show an in-app banner + tone when a
 * reminder fires while the app is open, and deep-link when tapped.
 */
export async function initNotificationListeners(navigate: (path: string) => void) {
  if (listenersReady || !isNative()) return;
  listenersReady = true;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.addListener("localNotificationReceived", (n) => {
      playTone("reminder");
      vibrate("reminder");
      showBanner({ title: n.title ?? "LiveSync", body: n.body ?? "", tint: "#F59E0B" });
      void logToInbox(n.title ?? "Reminder", n.body ?? "");
    });
    await LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
      const extra = (a.notification.extra || {}) as { screen?: string; noteId?: string };
      void logToInbox(a.notification.title ?? "Reminder", a.notification.body ?? "");
      if (extra.screen) navigate(extra.noteId ? `/${extra.screen}?note=${extra.noteId}` : `/${extra.screen}`);
    });
  } catch (e) {
    console.warn("Notification listeners failed", e);
  }
}

/**
 * While the app is open (web and native), check every 20s for reminders whose
 * time has just arrived and alert in-app. On web this is the only channel; on
 * native it also covers reminders created < 1 min before they are due.
 */
const FIRED_KEY = "ls_fired_reminders";
function firedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || "[]")); } catch { return new Set(); }
}
function saveFired(s: Set<string>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-300))); } catch {}
}

export function startReminderTicker(getStore: () => StoreLike & { notes: Note[] }, onOpen: (o: Obligation) => void) {
  const check = () => {
    const now = new Date();
    const store = getStore();
    const fired = firedSet();
    const list = buildObligations(store, 0, 0.02, now); // due within the last ~30 min
    for (const o of list) {
      if (!o.overdue) continue;
      const key = `${o.id}@${o.dueAt.getTime()}`;
      if (fired.has(key)) continue;
      fired.add(key);
      const amt = o.amount ? ` · ₹${Math.round(o.amount).toLocaleString("en-IN")}` : "";
      const title = o.source === "note" ? `⏰ ${o.title}` : `Due now · ${o.title}`;
      const body = `${o.source === "note" ? "Reminder" : "Payment due"}${amt}`;
      playTone("reminder");
      vibrate("reminder");
      showBanner({ title, body, tint: "#F59E0B", onClick: () => onOpen(o) });
      void logToInbox(title, body);
      if (!isNative() && typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        try { new Notification(title, { body, tag: key }); } catch {}
      }
    }
    saveFired(fired);
  };
  check();
  const t = setInterval(check, 20_000);
  const onVis = () => document.visibilityState === "visible" && check();
  document.addEventListener("visibilitychange", onVis);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
}

export function describeNoteReminder(n: Note) {
  if (!n.reminder) return "";
  return `${formatReminder(n.reminder.at)}${isBill(n) ? ` · ₹${Math.round(n.amount || 0).toLocaleString("en-IN")}` : ""}`;
}
