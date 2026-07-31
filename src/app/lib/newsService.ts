/**
 * newsService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side financial news aggregator.
 *
 * Legal basis:
 *   • PIB India  – official Govt. of India RSS (public domain)
 *   • UN News    – official intergovernmental RSS (public domain)
 *   • The Guardian – Open Platform free tier (attribution required; non-commercial
 *                    free tier — verify current terms at open-platform.theguardian.com
 *                    before production use)
 *
 * Only headlines + ≤200-char snippets are shown; full article text is NEVER
 * stored or displayed. Each card links to the canonical publisher URL.
 *
 * Architecture:
 *   App  →  fetchNewsFeed()
 *              ├─ @capacitor/network check (online/offline)
 *              ├─ rss2json.com public bridge (CORS-safe, no key for RSS)
 *              ├─ Guardian content API (free key: open-platform.theguardian.com)
 *              ├─ Normalise → Article[]
 *              └─ 10-min localStorage cache
 */

import { isNative } from './native';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NewsTier = 'government' | 'licensed' | 'aggregator';

export type NewsCategory =
  | 'economy'
  | 'markets'
  | 'tax'
  | 'banking'
  | 'global'
  | 'schemes'
  | 'all';

export interface Article {
  id: string;
  title: string;
  /** Max 200 chars; never the full body */
  snippet: string;
  link: string;
  publishedAt: string;
  sourceName: string;
  sourceId: string;
  tier: NewsTier;
  tierLabel: string;
  category: NewsCategory;
  thumbnail?: string;
}

// ─── Source registry ─────────────────────────────────────────────────────────

interface SourceDef {
  id: string;
  name: string;
  tier: NewsTier;
  tierLabel: string;
  type: 'rss' | 'guardian';
  url: string;
  categories: NewsCategory[];
  region: 'india' | 'global';
}

const SOURCE_REGISTRY: SourceDef[] = [
  {
    id: 'pib-economy',
    name: 'Press Information Bureau',
    tier: 'government',
    tierLabel: 'Official government source',
    type: 'rss',
    url: 'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1',
    categories: ['economy', 'schemes', 'banking'],
    region: 'india',
  },
  {
    id: 'rbi',
    name: 'RBI – Reserve Bank of India',
    tier: 'government',
    tierLabel: 'Official government source',
    type: 'rss',
    url: 'https://www.rbi.org.in/pressreleases_rss.xml',
    categories: ['banking', 'economy'],
    region: 'india',
  },
  {
    id: 'sebi',
    name: 'SEBI – Securities Board of India',
    tier: 'government',
    tierLabel: 'Official government source',
    type: 'rss',
    url: 'https://www.sebi.gov.in/sebirss.xml',
    categories: ['markets', 'tax'],
    region: 'india',
  },
  {
    id: 'un-news',
    name: 'UN News',
    tier: 'government',
    tierLabel: 'Official intergovernmental source',
    type: 'rss',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    categories: ['global', 'economy'],
    region: 'global',
  },
  {
    id: 'guardian-economy',
    name: 'The Guardian',
    tier: 'licensed',
    tierLabel: 'Licensed news partner',
    type: 'guardian',
    // Replace TEST_KEY with a free key from open-platform.theguardian.com
    url: 'https://content.guardianapis.com/search?section=business|money|economics&order-by=newest&show-fields=trailText,thumbnail&api-key=test',
    categories: ['economy', 'markets', 'global'],
    region: 'global',
  },
];

// ─── Cache helpers ───────────────────────────────────────────────────────────

const CACHE_KEY = 'livesync_news_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachePayload {
  articles: Article[];
  fetchedAt: number;
}

function readCache(): Article[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload: CachePayload = JSON.parse(raw);
    if (Date.now() - payload.fetchedAt > CACHE_TTL_MS) return null;
    return payload.articles;
  } catch {
    return null;
  }
}

function writeCache(articles: Article[]) {
  try {
    const payload: CachePayload = { articles, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* storage full – ignore */ }
}

// ─── RSS fetch via rss2json bridge ───────────────────────────────────────────

async function fetchRss(source: SourceDef): Promise<Article[]> {
  const bridge = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}&count=20`;
  const res = await fetch(bridge, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok') {
    throw new Error(json.message || 'rss2json error');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.items as any[]).map((item, i) => ({
    id: `${source.id}::${item.guid || item.link || i}`,
    title: item.title?.trim() ?? 'Untitled',
    snippet: ((item.description ?? item.content ?? '') as string)
      .replace(/<[^>]+>/g, '')  // strip HTML tags
      .trim()
      .slice(0, 200),
    link: item.link ?? '',
    publishedAt: item.pubDate ?? new Date().toISOString(),
    sourceName: source.name,
    sourceId: source.id,
    tier: source.tier,
    tierLabel: source.tierLabel,
    category: source.categories[0],
    thumbnail: item.thumbnail || item.enclosure?.link || undefined,
  }));
}

// ─── Guardian fetch ───────────────────────────────────────────────────────────

async function fetchGuardian(source: SourceDef): Promise<Article[]> {
  const res = await fetch(source.url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Guardian fetch failed: ${res.status}`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = json?.response?.results ?? [];

  return results.map((item) => ({
    id: `guardian::${item.id}`,
    title: item.webTitle?.trim() ?? 'Untitled',
    snippet: (item.fields?.trailText ?? '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 200),
    link: item.webUrl ?? '',
    publishedAt: item.webPublicationDate ?? new Date().toISOString(),
    sourceName: source.name,
    sourceId: source.id,
    tier: source.tier,
    tierLabel: source.tierLabel,
    category: 'economy' as NewsCategory,
    thumbnail: item.fields?.thumbnail ?? undefined,
  }));
}

// ─── Category auto-tagger ─────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  economy: ['gdp', 'inflation', 'growth', 'recession', 'fiscal', 'budget', 'economy', 'economic', 'rupee', 'currency', 'trade'],
  markets: ['sensex', 'nifty', 'stock', 'equity', 'ipo', 'nse', 'bse', 'fund', 'mutual', 'share', 'market', 'rally'],
  tax: ['gst', 'income tax', 'tds', 'itr', 'tax', 'return', 'deduction', 'exemption', 'surcharge', 'cess'],
  banking: ['rbi', 'reserve bank', 'repo', 'interest rate', 'credit', 'loan', 'bank', 'nbfc', 'upi', 'payment'],
  global: ['fed', 'federal reserve', 'imf', 'world bank', 'global', 'international', 'usa', 'china', 'europe', 'dollar'],
  schemes: ['scheme', 'yojana', 'pradhan mantri', 'pm kisan', 'jan dhan', 'mudra', 'startup india', 'subsidy', 'welfare'],
  all: [],
};

function tagCategory(title: string, defaultCat: NewsCategory): NewsCategory {
  const lower = title.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [NewsCategory, string[]][]) {
    if (cat === 'all') continue;
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return defaultCat;
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export interface NewsFeedResult {
  articles: Article[];
  fromCache: boolean;
  offline: boolean;
  errors: string[];
}

export async function fetchNewsFeed(): Promise<NewsFeedResult> {
  // Check connectivity
  let online = true;
  try {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    online = status.connected;
  } catch { /* browser env – assume online */ }

  if (!online) {
    const cached = readCache();
    return {
      articles: cached ?? [],
      fromCache: true,
      offline: true,
      errors: [],
    };
  }

  // Try cache first (fast path)
  const cached = readCache();
  if (cached) {
    return { articles: cached, fromCache: true, offline: false, errors: [] };
  }

  // Fetch all sources concurrently; failures don't block others
  const results = await Promise.allSettled(
    SOURCE_REGISTRY.map((s) => (s.type === 'guardian' ? fetchGuardian(s) : fetchRss(s)))
  );

  const articles: Article[] = [];
  const errors: string[] = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      articles.push(...r.value);
    } else {
      errors.push(`${SOURCE_REGISTRY[i].name}: ${r.reason?.message ?? 'unknown error'}`);
    }
  });

  // Re-tag categories using keyword matching on titles
  const tagged = articles.map((a) => ({ ...a, category: tagCategory(a.title, a.category) }));

  // Sort newest-first
  tagged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  writeCache(tagged);
  return { articles: tagged, fromCache: false, offline: false, errors };
}

// ─── Notification scheduling ─────────────────────────────────────────────────

const NOTIF_ID = 42001; // stable ID for the daily news digest notification
const NOTIF_TIME_KEY = 'livesync_news_notif_time'; // "HH:MM"
const NOTIF_ENABLED_KEY = 'livesync_news_notif_enabled';

export function getSavedNotifTime(): string {
  return localStorage.getItem(NOTIF_TIME_KEY) ?? '08:00';
}

export function getSavedNotifEnabled(): boolean {
  return localStorage.getItem(NOTIF_ENABLED_KEY) === 'true';
}

/** Schedule (or re-schedule) the daily news digest notification at the given "HH:MM" time. */
export async function scheduleNewsDailyNotif(time: string): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Cancel any existing schedule first so we don't stack duplicates
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });

    const [hStr, mStr] = time.split(':');
    const hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);

    // Fire at next occurrence of that time today (or tomorrow if already past)
    const now = new Date();
    const fireAt = new Date();
    fireAt.setHours(hour, minute, 0, 0);
    if (fireAt <= now) fireAt.setDate(fireAt.getDate() + 1);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_ID,
          title: '📰 Your Financial Daily Digest',
          body: 'Tap to read today\'s top economy, markets & policy news curated for you.',
          channelId: 'news',
          schedule: {
            at: fireAt,
            repeats: true,
            every: 'day',
          },
          extra: { type: 'news_digest' },
        },
      ],
    });

    localStorage.setItem(NOTIF_TIME_KEY, time);
    localStorage.setItem(NOTIF_ENABLED_KEY, 'true');
  } catch (err) {
    console.warn('News notification schedule failed:', err);
  }
}

/** Cancel the daily news digest notification. */
export async function cancelNewsDailyNotif(): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
    localStorage.setItem(NOTIF_ENABLED_KEY, 'false');
  } catch (err) {
    console.warn('News notification cancel failed:', err);
  }
}

/** Ensure the 'news' notification channel exists (call once at app start or from native.ts). */
export async function ensureNewsChannel(): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id: 'news',
      name: 'Financial News Digest',
      description: 'Daily financial news digest notification',
      importance: 3,
      sound: 'beep.wav',
      vibration: false,
    });
  } catch { /* channel may already exist */ }
}
