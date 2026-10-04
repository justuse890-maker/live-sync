/**
 * autoTranslate.ts — whole-app Hindi / Marathi translation, fully on-device.
 *
 * Why this exists: only 6 of ~90 screens used the t("key") system, so choosing
 * हिन्दी or मराठी changed a handful of labels and left the rest of the app in
 * English. Rewriting 2,600+ hard-coded strings by hand across every screen
 * would take weeks and break on every new screen.
 *
 * How it works:
 *  • A build-time extraction collected every user-visible English string and
 *    sentence pattern from the source (scripts/i18n-extract.cjs). Each one has a
 *    human-written Hindi and Marathi translation in locales/auto/{hi,mr}.json.
 *  • At runtime a MutationObserver watches the app's DOM. Whenever React renders
 *    or updates text, the English text node / placeholder / title / aria-label
 *    is swapped for its translation before the browser paints.
 *  • Patterns such as "Money in {0}" or "Due in {0} days" are matched with
 *    placeholders, and the captured parts are translated too.
 *  • The original English is remembered, so switching back to English restores
 *    it instantly — no reload.
 *
 * Nothing is sent anywhere: no translation API, no network, no cost, no licence
 * risk. Anything inside [translate="no"] (user-typed notes, merchant names) is
 * never touched. Financial terms (EMI, SIP, UPI, GST, PAN…) stay as-is by design.
 */

export type AutoLang = "en" | "hi" | "mr";

type DictFile = { exact: Record<string, string>; templates: [string, string][] };
type Compiled = { re: RegExp; out: string; weight: number; strict: boolean };

let lang: AutoLang = "en";
let exact: Record<string, string> = {};
let templates: Compiled[] = [];
let cache = new Map<string, string | null>();
let observer: MutationObserver | null = null;

const ORIG = new WeakMap<Node, string>();   // English text we replaced
const MINE = new WeakMap<Node, string>();   // value we wrote (to ignore our own mutations)
const ATTR_ORIG = new WeakMap<Element, Record<string, string>>();
const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const MONTH_YEAR = new RegExp(`^(${MONTHS})\\s+(\\d{4})$`);
const DAY_MONTH = new RegExp(`^(\\d{1,2})\\s+(${MONTHS})(,?\\s+\\d{4})?$`);
const DAY_MONTH_TIME = new RegExp(`^(\\d{1,2})\\s+(${MONTHS}),\\s+(\\d{1,2}:\\d{2}\\s?(?:am|pm))$`, "i");
const WEEKDAY_DAY_MONTH = new RegExp(`^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\\s+(\\d{1,2})\\s+(${MONTHS})$`);

/** Short patterns whose placeholder is a person's name or free text by design. */
const OPEN_PATTERNS = new Set(["Hi {0}"]);

/** Numbers, amounts, percentages, dates — safe to carry into a translated pattern. */
const DATA_LIKE = /^\d{1,2}:\d{2}\s?(?:am|pm)$|^[-+−]?[₹$]?\s?[\d.,:/%\s]+(?:[KLM]|Cr|L|K|cr)?$|^[₹$]?\s?[\d.,]+\s?(?:Cr|L|K)?$/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(list: [string, string][]): Compiled[] {
  return list
    .map(([pattern, out]) => {
      const parts = pattern.split(/\{\d\}/);
      const src = "^" + parts.map(escapeRe).join("(.+?)") + "$";
      const literal = parts.join("").replace(/\s/g, "").length;
      // Short, generic patterns ("{0} of {1}") only apply when every captured
      // part is a number/amount or itself translatable — never to free text.
      return { re: new RegExp(src), out, weight: literal, strict: literal < 6 && !OPEN_PATTERNS.has(pattern) };
    })
    .filter((t) => t.weight >= 2)
    .sort((a, b) => b.weight - a.weight); // most specific first
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Translate one string; null when we have nothing better than the original. */
export function translate(input: string, depth = 0): string | null {
  if (lang === "en") return null;
  const key = norm(input);
  if (!key || !/[A-Za-z]/.test(key)) return null;
  if (cache.has(key)) return cache.get(key)!;
  let out: string | null = exact[key] ?? null;

  if (out == null) {
    // Trailing punctuation variants: "Spent:" / "Saved!" etc.
    const m = key.match(/^(.*?)([.:!?…]+)$/);
    if (m && exact[m[1]]) out = exact[m[1]] + m[2];
  }
  if (out == null) {
    let m: RegExpMatchArray | null;
    if ((m = key.match(MONTH_YEAR))) out = `${exact[m[1]] ?? m[1]} ${m[2]}`;
    else if ((m = key.match(DAY_MONTH))) out = `${m[1]} ${exact[m[2]] ?? m[2]}${m[3] ?? ""}`;
    else if ((m = key.match(DAY_MONTH_TIME))) out = `${m[1]} ${exact[m[2]] ?? m[2]}, ${m[3]}`;
    else if ((m = key.match(WEEKDAY_DAY_MONTH))) out = `${exact[m[1]] ?? m[1]}, ${m[2]} ${exact[m[3]] ?? m[3]}`;
  }
  if (out == null && depth < 2) {
    for (const t of templates) {
      const m = key.match(t.re);
      if (!m) continue;
      const parts = m.slice(1).map((p) => ({ raw: p, tr: translate(p, depth + 1) }));
      if (t.strict && parts.some((p) => p.tr == null && !DATA_LIKE.test(p.raw.trim()))) continue;
      out = t.out.replace(/\{(\d)\}/g, (_, i) => {
        const p = parts[Number(i)];
        return p ? p.tr ?? p.raw : "";
      });
      break;
    }
  }
  if (out == null && depth < 2 && key.includes(" · ")) {
    const parts = key.split(" · ");
    const tr = parts.map((p) => translate(p, depth + 1));
    if (tr.some((x) => x != null)) out = tr.map((x, i) => x ?? parts[i]).join(" · ");
  }
  cache.set(key, out);
  return out;
}

function skipped(el: Element | null): boolean {
  if (!el) return true;
  return !!el.closest('[translate="no"], .notranslate, script, style, textarea, code, pre, [contenteditable="true"]');
}

function processText(node: Text) {
  const cur = node.data;
  if (MINE.get(node) === cur) return;            // our own write
  if (!/[A-Za-z]/.test(cur)) return;
  ORIG.set(node, cur);
  if (lang === "en" || skipped(node.parentElement)) return;
  const tr = translate(cur);
  if (tr == null) return;
  const lead = cur.match(/^\s*/)![0];
  const trail = cur.match(/\s*$/)![0];
  const next = lead + tr + trail;
  if (next === cur) return;
  MINE.set(node, next);
  node.data = next;
}

function processAttrs(el: Element) {
  if (skipped(el) && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v == null) continue;
    let store = ATTR_ORIG.get(el);
    const mineKey = `__mine_${a}`;
    if (store && store[mineKey] === v) continue;   // our own write
    store = store ?? {};
    store[a] = v;
    ATTR_ORIG.set(el, store);
    if (lang === "en") continue;
    const tr = translate(v);
    if (tr != null && tr !== v) {
      store[mineKey] = tr;
      el.setAttribute(a, tr);
    }
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { processText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = tw.currentNode;
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) processText(n as Text);
    else processAttrs(n as Element);
    n = tw.nextNode();
  }
}

/** Put every node we changed back to its original English. */
function restoreEnglish(root: Node) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = tw.currentNode;
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const o = ORIG.get(n);
      if (o != null && MINE.get(n) === (n as Text).data) { (n as Text).data = o; }
      MINE.delete(n);
    } else {
      const store = ATTR_ORIG.get(n as Element);
      if (store) for (const a of ATTRS) {
        if (store[a] != null && store[`__mine_${a}`] === (n as Element).getAttribute(a)) {
          (n as Element).setAttribute(a, store[a]);
        }
        delete store[`__mine_${a}`];
      }
    }
    n = tw.nextNode();
  }
}

function startObserver() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((records) => {
    if (lang === "en") return;
    for (const r of records) {
      if (r.type === "characterData") processText(r.target as Text);
      else if (r.type === "attributes") processAttrs(r.target as Element);
      else r.addedNodes.forEach((n) => walk(n));
    }
  });
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: [...ATTRS],
  });
}

const loaders: Record<"hi" | "mr", () => Promise<{ default: DictFile }>> = {
  hi: () => import("./locales/auto/hi.json") as any,
  mr: () => import("./locales/auto/mr.json") as any,
};

/** Switch the whole app's language. Safe to call repeatedly. */
export async function setAutoLanguage(next: AutoLang) {
  if (next === lang && (next === "en" || Object.keys(exact).length)) return;
  if (next === "en") {
    lang = "en";
    cache = new Map();
    restoreEnglish(document.body);
    return;
  }
  const dict = (await loaders[next]()).default;
  // Restore English first so we translate from the original, not from the other language.
  if (lang !== "en") { const prev = lang; lang = "en"; restoreEnglish(document.body); lang = prev; }
  exact = dict.exact;
  templates = compile(dict.templates);
  cache = new Map();
  lang = next;
  startObserver();
  walk(document.body);
}

export const currentAutoLanguage = () => lang;
