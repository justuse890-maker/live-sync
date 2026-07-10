import dict from "./merchantDictionary.json";

export type RawRow = { sourceIndex: number; raw: string; date: string; amount: number; type: "income" | "expense"; sourceCategory?: string };
export type Cluster = {
  id: string;
  canonical: string;
  category: string;
  count: number;
  total: number;
  variants: string[];
  rowIndexes: number[];
  source: "dictionary" | "cluster" | "ai" | "manual";
};

const DICT: Record<string, { canonical: string; category: string }> = dict as any;

const NOISE_PREFIXES = ["UPI/", "UPI-", "POS ", "POS/", "NEFT/", "NEFT-", "IMPS/", "IMPS-", "RTGS/", "ACH/", "ACH-", "ECS/", "ATM/", "ATM-", "BIL/", "BIL-", "TRF/", "MMT/"];
const NOISE_SUFFIXES_WORDS = ["PVT LTD", "PRIVATE LIMITED", "PRIVATE LTD", "LIMITED", "LTD", "LLP", "INDIA", "PVT", "INC", "CORP"];
const LOCATIONS = ["MUMBAI", "DELHI", "BANGALORE", "BENGALURU", "BLR", "BLOR", "CHENNAI", "MAA", "KOLKATA", "HYDERABAD", "HYD", "PUNE", "AHMEDABAD", "AHM", "JAIPUR", "LUCKNOW", "NOIDA", "GURGAON", "GURUGRAM", "INDIA"];

export function stripNoise(s: string): string {
  let out = (s || "").toUpperCase().trim();
  for (const p of NOISE_PREFIXES) if (out.startsWith(p)) out = out.slice(p.length).trim();
  // Drop trailing numeric IDs / refs (e.g. " 1234567890")
  out = out.replace(/\b\d{6,}\b/g, " ").replace(/\s+/g, " ").trim();
  // Drop transaction-ref noise like /XXXXX or *1234
  out = out.replace(/[\/*][A-Z0-9]{4,}/g, " ").replace(/\s+/g, " ").trim();
  // Tokenize and drop location/legal-suffix tokens
  const tokens = out.split(/[\s,_-]+/).filter(Boolean);
  const cleaned = tokens.filter((t) => !LOCATIONS.includes(t));
  let joined = cleaned.join(" ");
  for (const suf of NOISE_SUFFIXES_WORDS) {
    const idx = joined.indexOf(" " + suf);
    if (idx > 0) joined = joined.slice(0, idx).trim();
    if (joined === suf) joined = "";
  }
  return joined.trim();
}

export function lookupDictionary(stripped: string): { canonical: string; category: string } | null {
  if (!stripped) return null;
  if (DICT[stripped]) return DICT[stripped];
  // Try prefix tokens — e.g. "FLIPKART ABC" → match FLIPKART
  for (const key of Object.keys(DICT)) {
    if (stripped === key) return DICT[key];
    if (stripped.startsWith(key + " ") || stripped.endsWith(" " + key) || stripped.includes(" " + key + " ")) return DICT[key];
  }
  return null;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());
}

/**
 * Cluster raw rows into merchants. Pipeline:
 *  1. strip noise
 *  2. dictionary lookup → exact bucket
 *  3. fuzzy cluster remaining by Levenshtein ≤ threshold
 *  4. anything left → its own single-row cluster
 */
export function clusterRows(rows: RawRow[]): Cluster[] {
  const byKey = new Map<string, Cluster>();
  const leftovers: { row: RawRow; stripped: string }[] = [];
  let cid = 0;

  for (const r of rows) {
    const stripped = stripNoise(r.raw);
    const dictHit = lookupDictionary(stripped);
    if (dictHit) {
      const key = `dict:${dictHit.canonical}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count++;
        existing.total += Math.abs(r.amount);
        if (!existing.variants.includes(r.raw)) existing.variants.push(r.raw);
        existing.rowIndexes.push(r.sourceIndex);
      } else {
        byKey.set(key, {
          id: `c${cid++}`,
          canonical: dictHit.canonical,
          category: dictHit.category,
          count: 1,
          total: Math.abs(r.amount),
          variants: [r.raw],
          rowIndexes: [r.sourceIndex],
          source: "dictionary",
        });
      }
    } else {
      leftovers.push({ row: r, stripped: stripped || r.raw.toUpperCase() });
    }
  }

  // Fuzzy cluster the leftovers
  const used = new Set<number>();
  for (let i = 0; i < leftovers.length; i++) {
    if (used.has(i)) continue;
    const seed = leftovers[i];
    used.add(i);
    const cluster: Cluster = {
      id: `c${cid++}`,
      canonical: titleCase(seed.stripped),
      category: seed.row.sourceCategory || "Uncategorised",
      count: 1,
      total: Math.abs(seed.row.amount),
      variants: [seed.row.raw],
      rowIndexes: [seed.row.sourceIndex],
      source: "cluster",
    };
    const threshold = Math.max(2, Math.floor(seed.stripped.length * 0.2));
    for (let j = i + 1; j < leftovers.length; j++) {
      if (used.has(j)) continue;
      const cand = leftovers[j];
      const d = levenshtein(seed.stripped, cand.stripped);
      if (d <= threshold) {
        used.add(j);
        cluster.count++;
        cluster.total += Math.abs(cand.row.amount);
        if (!cluster.variants.includes(cand.row.raw)) cluster.variants.push(cand.row.raw);
        cluster.rowIndexes.push(cand.row.sourceIndex);
      }
    }
    byKey.set(`cluster:${cluster.canonical}`, cluster);
  }

  return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
}

export function ambiguousClusters(clusters: Cluster[]): Cluster[] {
  return clusters.filter((c) => c.source !== "dictionary" && c.category === "Uncategorised");
}
