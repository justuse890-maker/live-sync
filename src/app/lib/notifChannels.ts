/**
 * notifChannels.ts — the five Android notification channels, from "must see now" down to "optional tips".
 *
 * Android fixes a channel's importance and sound when it is first created; the app cannot change them afterwards, and
 * the user's own channel settings then win. So every id carries a version (_v2). To change a default later, ship _v3
 * and leave the old channels alone. LEGACY_CHANNEL_IDS lists ids that already exist on installed phones and must never
 * be reused for a different purpose.
 *
 * Only urgent and bills honour the user's chosen reminder sound, via a per-sound channel id.
 */
export type Tier = "urgent" | "bills" | "money" | "digest" | "tips";

export type ChannelDef = { tier: Tier; id: string; name: string; description: string; importance: 1 | 2 | 3 | 4 | 5; soundable: boolean };

export const CHANNELS: ChannelDef[] = [
  { tier: "urgent", id: "ls_urgent_v2", name: "Due today & overdue", description: "Payments due today, overdue items and security alerts", importance: 5, soundable: true },
  { tier: "bills", id: "ls_bills_v2", name: "Bills & EMI heads-up", description: "Reminders a day or more before a bill, EMI or card payment", importance: 4, soundable: true },
  { tier: "money", id: "ls_money_v2", name: "Money in & budgets", description: "Income received, budget and goal thresholds", importance: 3, soundable: false },
  { tier: "digest", id: "ls_digest_v2", name: "Weekly summary", description: "A short weekly recap, delivered quietly", importance: 2, soundable: false },
  { tier: "tips", id: "ls_tips_v2", name: "Tips & insights", description: "Optional savings tips and news", importance: 1, soundable: false },
];

/** Channels created by earlier versions of the app (see native.ts, notifications.ts, newsService.ts). */
export const LEGACY_CHANNEL_IDS = ["bills", "goals", "fraud", "insights", "news", "ls_reminders_default", "ls_reminders_beep", "ls_reminders_bell", "ls_reminders_chime", "ls_reminders_electronic"];

export type AlertKind = "overdue" | "due-today" | "heads-up" | "budget" | "weekly" | "tip" | "money-in";

/** Notes and plain reminders are things the user asked to be reminded of, never "urgent payments". */
export function tierForAlert({ kind, source }: { kind: AlertKind; source: string }): Tier {
  if (kind === "overdue") return "urgent";
  if (kind === "due-today") return source === "note" || source === "household" ? "bills" : "urgent";
  if (kind === "heads-up") return "bills";
  if (kind === "budget" || kind === "money-in") return "money";
  if (kind === "weekly") return "digest";
  return "tips";
}

const soundKey = (sound?: string) => (sound && sound !== "default" ? sound : "");

export function channelIdFor(tier: Tier, sound?: string): string {
  const def = CHANNELS.find((c) => c.tier === tier) as ChannelDef;
  const s = soundKey(sound);
  return def.soundable && s ? `${def.id}_${s}` : def.id;
}

export function channelDefFor(tier: Tier, sound?: string): ChannelDef & { id: string } {
  const def = CHANNELS.find((c) => c.tier === tier) as ChannelDef;
  return { ...def, id: channelIdFor(tier, sound) };
}
