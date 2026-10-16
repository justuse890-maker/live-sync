/**
 * sparrow.ts — the brain behind the mascot. It answers everyday money questions from the user's own
 * records, on the device, with no AI and no network: "what happened last month?", "how much on food?",
 * "can I afford 8,000?".
 *
 * Every figure in an answer is computed here from the ledger, so the mascot can never invent a number.
 * Questions it cannot answer return null; the caller may then pass them to the user's own AI key, if any.
 *
 * `txs` must be the counted ledger (own-account transfers already excluded).
 */
import { classifyFlow } from "./intelligence";

export type Mood = "idle" | "thinking" | "happy" | "concerned";
export type Reply = { text: string; mood: Mood };

type Row = { type: string; amount: number; date: string; category?: string; title?: string; merchant?: string; loanId?: string; isTransfer?: boolean };

const rupees = (n: number) => "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export const monthLabel = (key: string) => { const [y, m] = key.split("-").map(Number); return `${MONTH_NAMES[m - 1][0].toUpperCase()}${MONTH_NAMES[m - 1].slice(1)} ${y}`; };

// ── facts for one month ─────────────────────────────────────────────────────
export type MonthFacts = {
  key: string;
  income: number;
  expense: number;
  /** Part of the expense that went into savings and investments. */
  invested: number;
  emis: number;
  net: number;
  categories: Array<{ name: string; amount: number }>;
  biggest: { title: string; amount: number; date: string } | null;
  entries: number;
};

export function monthFacts(txs: Row[], key: string): MonthFacts {
  let income = 0, expense = 0, invested = 0, emis = 0, entries = 0;
  const cats = new Map<string, number>();
  let biggest: MonthFacts["biggest"] = null;
  for (const t of txs) {
    if (t.isTransfer || String(t.date).slice(0, 7) !== key) continue;
    const a = Math.abs(Number(t.amount) || 0);
    if (a === 0) continue;
    entries++;
    if (t.type === "income") { income += a; continue; }
    if (t.type !== "expense") continue;
    expense += a;
    const bucket = classifyFlow(t as any);
    if (bucket === "savings") invested += a;
    if (bucket === "emis") emis += a;
    const name = (t.category || "Other").trim() || "Other";
    cats.set(name, (cats.get(name) || 0) + a);
    if (bucket !== "savings" && (!biggest || a > biggest.amount)) biggest = { title: t.merchant || t.title || name, amount: a, date: String(t.date).slice(0, 10) };
  }
  const categories = [...cats.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  return { key, income, expense, invested, emis, net: income - expense, categories, biggest, entries };
}

const prevKey = (key: string) => { const [y, m] = key.split("-").map(Number); return keyOf(new Date(y, m - 2, 1)); };

// ── the monthly recap ───────────────────────────────────────────────────────
export function recap(txs: Row[], key: string): Reply {
  const cur = monthFacts(txs, key);
  const label = monthLabel(key);
  if (cur.entries === 0) return { text: `I don't have anything recorded for ${label} yet. Add a few entries and ask me again.`, mood: "idle" };

  const prev = monthFacts(txs, prevKey(key));
  const lines: string[] = [];
  lines.push(`Here's ${label}:`);
  lines.push(`• ${rupees(cur.income)} came in and ${rupees(cur.expense)} went out.`);
  if (cur.income > 0) {
    lines.push(cur.net >= 0
      ? `• You kept ${rupees(cur.net)} — that's ${Math.round((cur.net / cur.income) * 100)}% of what came in.`
      : `• You spent ${rupees(-cur.net)} more than you earned.`);
  }
  if (cur.invested > 0) lines.push(`• ${rupees(cur.invested)} of the spending went into savings and investments.`);
  if (cur.emis > 0) lines.push(`• EMIs and repayments took ${rupees(cur.emis)}${cur.income > 0 ? ` (${Math.round((cur.emis / cur.income) * 100)}% of income)` : ""}.`);
  const top = cur.categories.slice(0, 3);
  if (top.length) lines.push(`• Most went to ${top.map((c) => `${c.name} (${rupees(c.amount)})`).join(", ")}.`);
  if (cur.biggest) lines.push(`• Biggest single spend: ${cur.biggest.title}, ${rupees(cur.biggest.amount)}.`);

  if (prev.entries > 0 && prev.expense > 0) {
    const diff = cur.expense - prev.expense;
    const pct = Math.round((Math.abs(diff) / prev.expense) * 100);
    if (pct >= 5) lines.push(`• Spending was ${diff > 0 ? "up" : "down"} ${pct}% on ${monthLabel(prev.key)} (${rupees(prev.expense)}).`);
    else lines.push(`• Spending was about the same as ${monthLabel(prev.key)}.`);
    // the category that moved the most
    let mover: { name: string; diff: number } | null = null;
    for (const c of cur.categories) {
      const before = prev.categories.find((p) => p.name === c.name)?.amount ?? 0;
      const d = c.amount - before;
      if (!mover || Math.abs(d) > Math.abs(mover.diff)) mover = { name: c.name, diff: d };
    }
    if (mover && Math.abs(mover.diff) >= 500 && Math.abs(mover.diff) >= prev.expense * 0.03) lines.push(`• ${mover.name} changed the most: ${mover.diff > 0 ? "up" : "down"} ${rupees(mover.diff)}.`);
  }
  return { text: lines.join("\n"), mood: cur.income > 0 && cur.net < 0 ? "concerned" : "happy" };
}

/**
 * One line for the Home greeting in the first week of a month: how last month went.
 * Returns null when last month has nothing recorded or it is past the first week.
 */
export function monthlyGreeting(txs: Row[], now = new Date()): { key: string; text: string; mood: Mood } | null {
  if (now.getDate() > 7) return null;
  const key = keyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const f = monthFacts(txs, key);
  if (f.entries === 0) return null;
  const name = monthLabel(key).split(" ")[0];
  if (f.income === 0) return { key, text: `${name} is done: you spent ${rupees(f.expense)}. Tap to see where it went.`, mood: "idle" };
  return f.net >= 0
    ? { key, text: `${name} is done: you kept ${rupees(f.net)} of ${rupees(f.income)} (${Math.round((f.net / f.income) * 100)}%). Tap for the full recap.`, mood: "happy" }
    : { key, text: `${name} is done: you spent ${rupees(-f.net)} more than came in. Tap and I'll show you where.`, mood: "concerned" };
}

// ── understanding the question ──────────────────────────────────────────────
/** Which month the question is about. Defaults to the current month. */
export function resolveMonth(q: string, now = new Date()): string {
  const s = q.toLowerCase();
  if (/\b(last|previous|prev|past)\s+month\b|pichh?l[ae]\s+mahin|pichh?l[ae]\s+month|gaye\s+mahin/.test(s)) return keyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  for (let i = 0; i < 12; i++) {
    const full = MONTH_NAMES[i], short = full.slice(0, 3);
    if (new RegExp(`\\b(${full}|${short})\\b`).test(s)) {
      // the most recent such month that is not in the future
      const y = i <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1;
      return `${y}-${pad(i + 1)}`;
    }
  }
  return keyOf(now);
}

/** "8,000", "8k", "1.5 lakh", "₹ 2 lac" → rupees. */
export function parseAmount(q: string): number | null {
  const m = q.toLowerCase().replace(/,/g, "").match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|hazaar|hazar|lakh|lac|l\b|crore|cr\b)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = !m[2] ? 1 : /^(k|thousand|hazaar|hazar)$/.test(m[2]) ? 1_000 : /^(lakh|lac|l)$/.test(m[2]) ? 100_000 : 10_000_000;
  const v = n * mult;
  return v > 0 ? v : null;
}

// Everyday words → the categories and wording people actually record.
const TOPICS: Array<{ label: string; rx: RegExp }> = [
  { label: "food", rx: /food|khana|khaana|dining|restaurant|swiggy|zomato|eat/ },
  { label: "groceries", rx: /grocer|kirana|ration|sabzi|vegetable|bigbasket|blinkit|zepto/ },
  { label: "rent", rx: /\brent\b|kiraya|kiraaya/ },
  { label: "fuel", rx: /fuel|petrol|diesel|cng/ },
  { label: "travel", rx: /travel|trip|cab|uber|ola|flight|train|yatra/ },
  { label: "shopping", rx: /shop|amazon|flipkart|myntra|kapde|clothes/ },
  { label: "bills", rx: /\bbills?\b|electric|bijli|recharge|wifi|broadband|utilit/ },
  { label: "medical", rx: /medic|doctor|dawa|dawai|hospital|pharmacy|health/ },
  { label: "entertainment", rx: /entertain|movie|netflix|ott|fun\b/ },
  { label: "subscriptions", rx: /subscription/ },
  { label: "education", rx: /school|tuition|fees|education|padhai/ },
];

function topicSpend(txs: Row[], key: string, topic: { label: string; rx: RegExp }) {
  let total = 0, count = 0;
  for (const t of txs) {
    if (t.isTransfer || t.type !== "expense" || String(t.date).slice(0, 7) !== key) continue;
    if (topic.rx.test(`${t.category || ""} ${t.title || ""} ${t.merchant || ""}`.toLowerCase())) { total += Math.abs(t.amount); count++; }
  }
  return { total, count };
}

export type AskContext = {
  txs: Row[];
  now?: Date;
  /** Bills and EMIs still due this month — used by "can I afford". */
  stillToPay?: number;
};

/**
 * Answers the question from the ledger, or returns null when it is not one of the things the sparrow
 * knows how to work out (the caller can then use the user's own AI, if connected).
 */
export function answer(question: string, ctx: AskContext): Reply | null {
  const q = question.trim().toLowerCase();
  if (!q) return null;
  const now = ctx.now ?? new Date();
  const key = resolveMonth(q, now);
  const label = monthLabel(key);

  // "can I afford 8,000 …"
  if (/afford|khareed|kharid|le\s*sakt|buy\b/.test(q)) {
    const want = parseAmount(q.replace(/afford|khareed|kharid/g, ""));
    if (!want) return { text: "Tell me the amount — for example, “Can I afford 8,000 for a trip?”", mood: "idle" };
    const cur = monthFacts(ctx.txs, keyOf(now));
    if (cur.income === 0) return { text: `I can't tell yet — no income is recorded for ${monthLabel(cur.key)}. Add your salary or other income and ask again.`, mood: "idle" };
    const due = Math.max(0, ctx.stillToPay ?? 0);
    const free = cur.income - cur.expense - due;
    const after = free - want;
    const maths = `${rupees(cur.income)} in − ${rupees(cur.expense)} spent${due ? ` − ${rupees(due)} still to pay` : ""} = ${free < 0 ? "−" : ""}${rupees(free)} free.`;
    if (after >= 0) return { text: `Yes. ${maths}\nAfter ${rupees(want)} you'd still have ${rupees(after)} for the rest of ${monthLabel(cur.key)}.`, mood: "happy" };
    return { text: `Not comfortably this month. ${maths}\n${rupees(want)} would leave you ${rupees(-after)} short. This is a planning estimate from your records, not your bank balance.`, mood: "concerned" };
  }

  // "how much on food / petrol / rent"
  const topic = TOPICS.find((t) => t.rx.test(q));
  if (topic && /how much|kitna|kitne|spen[dt]|kharch|kharcha|on\b|total/.test(q)) {
    const s = topicSpend(ctx.txs, key, topic);
    if (s.count === 0) return { text: `Nothing recorded for ${topic.label} in ${label}.`, mood: "idle" };
    const prev = topicSpend(ctx.txs, prevKey(key), topic);
    const cmp = prev.total > 0 ? ` That's ${s.total > prev.total ? "up" : "down"} ${rupees(s.total - prev.total)} on ${monthLabel(prevKey(key))}.` : "";
    return { text: `You spent ${rupees(s.total)} on ${topic.label} in ${label}, across ${s.count} ${s.count === 1 ? "entry" : "entries"}.${cmp}`, mood: "idle" };
  }

  const f = monthFacts(ctx.txs, key);

  if (/biggest|largest|sabse\s+(bada|zyada)|highest/.test(q)) {
    if (!f.biggest) return { text: `No spending recorded in ${label}.`, mood: "idle" };
    return { text: `Your biggest spend in ${label} was ${f.biggest.title}: ${rupees(f.biggest.amount)} on ${f.biggest.date}.`, mood: "idle" };
  }

  if (/\b(sav(e|ed|ing|ings)|bacha|bachat|kept|left)\b/.test(q)) {
    if (f.entries === 0) return { text: `Nothing recorded for ${label} yet.`, mood: "idle" };
    if (f.income === 0) return { text: `No income is recorded for ${label}, so I can't work out what you kept. You spent ${rupees(f.expense)}.`, mood: "idle" };
    const extra = f.invested > 0 ? ` On top of that, ${rupees(f.invested)} went into savings and investments.` : "";
    return f.net >= 0
      ? { text: `In ${label} you kept ${rupees(f.net)} of ${rupees(f.income)} — ${Math.round((f.net / f.income) * 100)}%.${extra}`, mood: "happy" }
      : { text: `In ${label} you spent ${rupees(-f.net)} more than the ${rupees(f.income)} that came in.${extra}`, mood: "concerned" };
  }

  if (/\b(income|earn(ed)?|salary|kamai|kamaya|aaya|came in)\b/.test(q)) {
    return { text: f.income > 0 ? `${rupees(f.income)} came in during ${label}.` : `No income recorded for ${label}.`, mood: "idle" };
  }

  if (/\bemi|loan|karz|karza\b/.test(q)) {
    return { text: f.emis > 0 ? `EMIs and repayments took ${rupees(f.emis)} in ${label}${f.income > 0 ? ` — ${Math.round((f.emis / f.income) * 100)}% of income` : ""}.` : `No EMI or loan payment recorded in ${label}.`, mood: "idle" };
  }

  if (/where.*(money|paisa)|kahan\s+gaya|kaha\s+gaya|top\s+categor|categories|breakdown/.test(q)) {
    if (!f.categories.length) return { text: `No spending recorded in ${label}.`, mood: "idle" };
    const total = f.expense || 1;
    return { text: `Where ${label}'s money went:\n${f.categories.slice(0, 5).map((c) => `• ${c.name}: ${rupees(c.amount)} (${Math.round((c.amount / total) * 100)}%)`).join("\n")}`, mood: "idle" };
  }

  if (/how much.*(spen[dt])|kitna\s+kharch|total\s+(spend|spent|expense)|\bspent\b/.test(q)) {
    return { text: f.entries ? `You spent ${rupees(f.expense)} in ${label}.` : `Nothing recorded for ${label} yet.`, mood: "idle" };
  }

  // "what happened last month", "summary", "recap", "explain", "kya hua", or just a month
  if (/what happened|summary|summar|recap|explain|review|kya\s+hua|how (was|did)|tell me about|overview|report|month\b|mahin/.test(q) || MONTH_NAMES.some((m) => new RegExp(`\\b(${m}|${m.slice(0, 3)})\\b`).test(q))) {
    return recap(ctx.txs, key);
  }

  return null;
}

/** Starter questions shown under the mascot. */
export const SUGGESTIONS = [
  "What happened last month?",
  "Where did my money go this month?",
  "How much did I spend on food?",
  "Can I afford 8,000 for a trip?",
  "How much did I save last month?",
];
