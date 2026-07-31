/**
 * FinancialNews.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Financial News Hub screen.
 *
 * Features:
 *  • Category tab bar (Economy · Markets · Tax · Banking · Global · Schemes)
 *  • Article cards with trust-tier badges, snippet, timestamp, external link
 *  • Daily digest notification toggle + time picker
 *  • Offline banner with cached article fallback
 *  • Pull-to-refresh button
 *  • Expert-curated source labels (legally neutral phrasing per copyright rules)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Newspaper, RefreshCw, ExternalLink, Bell, BellOff,
  WifiOff, ChevronRight, ShieldCheck, BadgeCheck, Info,
  TrendingUp, Landmark, BarChart3, Globe, BookOpen, Coins, Clock,
  Settings2,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import {
  fetchNewsFeed,
  scheduleNewsDailyNotif,
  cancelNewsDailyNotif,
  getSavedNotifTime,
  getSavedNotifEnabled,
  ensureNewsChannel,
  type Article,
  type NewsCategory,
} from "../../lib/newsService";

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES: { id: NewsCategory; label: string; Icon: any; color: string }[] = [
  { id: "all",      label: "All",      Icon: Newspaper,  color: "#1E40AF" },
  { id: "economy",  label: "Economy",  Icon: TrendingUp,  color: "#10B981" },
  { id: "markets",  label: "Markets",  Icon: BarChart3,   color: "#8B5CF6" },
  { id: "tax",      label: "Tax",      Icon: Coins,       color: "#F59E0B" },
  { id: "banking",  label: "Banking",  Icon: Landmark,    color: "#0EA5E9" },
  { id: "global",   label: "Global",   Icon: Globe,       color: "#64748B" },
  { id: "schemes",  label: "Schemes",  Icon: BookOpen,    color: "#EC4899" },
];

// ─── Tier badge config ────────────────────────────────────────────────────────

function TierBadge({ tier, label }: { tier: string; label: string }) {
  if (tier === "government") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
        style={{ background: "#DCFCE7", color: "#166534", fontWeight: 700 }}>
        <ShieldCheck className="size-3" />
        {label}
      </span>
    );
  }
  if (tier === "licensed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
        style={{ background: "#DBEAFE", color: "#1E40AF", fontWeight: 700 }}>
        <BadgeCheck className="size-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
      style={{ background: "#F1F5F9", color: "#64748B", fontWeight: 600 }}>
      <Info className="size-3" />
      {label}
    </span>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const openLink = () => {
    if (article.link) window.open(article.link, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="bg-card border border-border/60 rounded-2xl overflow-hidden transition-all hover:shadow-md active:scale-[0.99]"
      style={{ cursor: "pointer" }}
      onClick={openLink}
    >
      {article.thumbnail && (
        <div className="relative w-full overflow-hidden" style={{ height: 140 }}>
          <img
            src={article.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)"
          }} />
        </div>
      )}

      <div className="p-4">
        {/* Source + time row */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <TierBadge tier={article.tier} label={article.tierLabel} />
          <span className="text-[11px] text-muted-foreground font-medium">{article.sourceName}</span>
          <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5 shrink-0">
            <Clock className="size-3" />
            {relativeTime(article.publishedAt)}
          </span>
        </div>

        {/* Title */}
        <h3 className="leading-snug mb-1.5 line-clamp-3"
          style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          {article.title}
        </h3>

        {/* Snippet */}
        {article.snippet && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {article.snippet}
          </p>
        )}

        {/* Read more */}
        <div className="flex items-center gap-1" style={{ color: "#1E40AF", fontSize: 12, fontWeight: 600 }}>
          <ExternalLink className="size-3.5" />
          Read on {article.sourceName}
        </div>
      </div>
    </div>
  );
}

// ─── Notification settings panel ──────────────────────────────────────────────

function NotifPanel({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState(getSavedNotifEnabled);
  const [time, setTime] = useState(getSavedNotifTime);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = async () => {
    setSaving(true);
    if (enabled) {
      await cancelNewsDailyNotif();
      setEnabled(false);
    } else {
      await scheduleNewsDailyNotif(time);
      setEnabled(true);
    }
    setSaving(false);
  };

  const saveTime = async () => {
    if (!enabled) return;
    setSaving(true);
    await scheduleNewsDailyNotif(time);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-background p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto -mt-2 mb-1" />

        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl flex items-center justify-center"
            style={{ background: "#EEF2FF" }}>
            <Bell className="size-5" style={{ color: "#1E40AF" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Daily News Digest</div>
            <div className="text-xs text-muted-foreground">Get notified once a day with top financial news</div>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between bg-card border border-border/60 rounded-2xl px-4 py-3.5">
          <div>
            <div className="text-sm" style={{ fontWeight: 600 }}>Enable daily notification</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {enabled ? "You'll receive your digest every day" : "Notifications are off"}
            </div>
          </div>
          <button
            onClick={toggle}
            disabled={saving}
            className="relative rounded-full transition-colors"
            style={{
              width: 44, height: 24,
              background: enabled ? "#1E40AF" : "#CBD5E1",
            }}
          >
            <div className="absolute top-1 rounded-full bg-white transition-all"
              style={{ width: 16, height: 16, left: enabled ? 24 : 4 }} />
          </button>
        </div>

        {/* Time picker */}
        {enabled && (
          <div className="bg-card border border-border/60 rounded-2xl px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm" style={{ fontWeight: 600 }}>Notification time</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pick when to receive your digest</div>
              </div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                onBlur={saveTime}
                className="border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ fontWeight: 600, width: 110 }}
              />
            </div>
            {saved && (
              <div className="mt-2 text-xs text-emerald-600 font-medium">✓ Saved! Notification rescheduled.</div>
            )}
          </div>
        )}

        {/* Legal note */}
        <div className="text-[11px] text-muted-foreground leading-relaxed px-1">
          News articles display headline + short snippet only. Full content is always read on the publisher's site. Sources: PIB (Govt. of India), UN News, The Guardian Open Platform.
        </div>

        <button onClick={onClose} className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 text-sm"
          style={{ fontWeight: 700 }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Expert insight banner ────────────────────────────────────────────────────

const EXPERT_TIPS: Record<string, string> = {
  all: "Expert tip: Track RBI policy decisions — they ripple through your loan EMIs, FD rates, and equity markets within days.",
  economy: "Expert tip: India's GDP growth rate directly affects job markets and salary revisions. Track quarterly GDP prints.",
  markets: "Expert tip: Nifty PE ratio above 22 historically signals overvaluation. Watch valuations, not just price movements.",
  tax: "Expert tip: Any GST council meeting can change input tax credits, affecting your business and investment costs.",
  banking: "Expert tip: When RBI changes repo rate, expect your floating-rate loan EMI to change within 3 months.",
  global: "Expert tip: US Fed rate decisions affect dollar strength, which impacts Indian import costs and the rupee.",
  schemes: "Expert tip: Government schemes often come with a limited window. Act quickly — many have first-come, first-served quotas.",
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export function FinancialNews({ onBack }: { onBack: () => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [category, setCategory] = useState<NewsCategory>("all");
  const [showNotif, setShowNotif] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (force = false) => {
    if (force) {
      // Bust cache
      try { localStorage.removeItem("livesync_news_cache"); } catch { /* ignore */ }
    }
    try {
      const result = await fetchNewsFeed();
      setArticles(result.articles);
      setOffline(result.offline);
      setFromCache(result.fromCache);
      setErrors(result.errors);
    } catch (e) {
      console.warn("News load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    ensureNewsChannel();
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filtered = category === "all"
    ? articles
    : articles.filter((a) => a.category === category);

  const activeCat = CATEGORIES.find((c) => c.id === category)!;

  // Scroll active tab into view
  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-cat="${category}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [category]);

  return (
    <>
      {/* Notification settings bottom sheet */}
      {showNotif && <NotifPanel onClose={() => setShowNotif(false)} />}

      <Header
        title="Financial News"
        subtitle="Curated · Expert-tagged"
        showBack
        onBack={onBack}
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-muted transition"
              aria-label="Refresh news"
            >
              <RefreshCw className={`size-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowNotif(true)}
              className="p-2 rounded-full hover:bg-muted transition"
              aria-label="Notification settings"
            >
              {getSavedNotifEnabled()
                ? <Bell className="size-4 text-primary" />
                : <BellOff className="size-4 text-muted-foreground" />}
            </button>
          </div>
        }
      />

      <Screen>
        <div className="pb-4">

          {/* Offline banner */}
          {offline && (
            <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
              style={{ background: "#FEF3C7", color: "#92400E" }}>
              <WifiOff className="size-4 shrink-0" />
              <span style={{ fontWeight: 600 }}>You're offline.</span>
              <span className="text-xs ml-1">Showing cached articles.</span>
            </div>
          )}

          {/* Cache indicator */}
          {fromCache && !offline && (
            <div className="mx-5 mt-3 text-[11px] text-muted-foreground text-right flex items-center justify-end gap-1">
              <Clock className="size-3" /> Cached · tap <RefreshCw className="size-3 mx-0.5" /> to update
            </div>
          )}

          {/* Category tabs */}
          <div ref={tabsRef}
            className="flex gap-2 px-5 py-3 overflow-x-auto"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {CATEGORIES.map((cat) => {
              const active = cat.id === category;
              return (
                <button
                  key={cat.id}
                  data-cat={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full whitespace-nowrap transition-all text-xs shrink-0"
                  style={{
                    fontWeight: 700,
                    background: active ? cat.color : "var(--card)",
                    color: active ? "#fff" : "var(--muted-foreground)",
                    border: `1.5px solid ${active ? cat.color : "var(--border)"}`,
                    boxShadow: active ? `0 2px 8px ${cat.color}40` : "none",
                  }}
                >
                  <cat.Icon className="size-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Expert insight banner */}
          <div className="mx-5 mb-3 px-4 py-3 rounded-2xl flex items-start gap-3"
            style={{ background: `${activeCat.color}10`, border: `1.5px solid ${activeCat.color}25` }}>
            <activeCat.Icon className="size-4 mt-0.5 shrink-0" style={{ color: activeCat.color }} />
            <p className="text-xs leading-relaxed" style={{ color: activeCat.color, fontWeight: 500 }}>
              {EXPERT_TIPS[category]}
            </p>
          </div>

          {/* Notification CTA (if not enabled) */}
          {!getSavedNotifEnabled() && (
            <button
              onClick={() => setShowNotif(true)}
              className="mx-5 mb-4 w-[calc(100%-2.5rem)] flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 transition hover:bg-primary/10"
            >
              <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="size-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm text-primary" style={{ fontWeight: 700 }}>Set daily news digest</div>
                <div className="text-xs text-muted-foreground">Get notified at your chosen time every morning</div>
              </div>
              <ChevronRight className="size-4 text-primary/60 shrink-0" />
            </button>
          )}

          {/* Article list */}
          {loading ? (
            <div className="px-5 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border/60 rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-32 bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="size-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <Newspaper className="size-7 text-muted-foreground" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No articles found</div>
              <div className="text-xs text-muted-foreground mt-1 mb-4">
                {offline ? "You're offline. Connect to load fresh articles." : "No articles in this category right now."}
              </div>
              {!offline && (
                <button onClick={refresh}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm"
                  style={{ fontWeight: 600 }}>
                  <RefreshCw className="size-4" /> Refresh
                </button>
              )}
            </div>
          ) : (
            <div className="px-5 space-y-3">
              {/* Source legend */}
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="text-[11px] text-muted-foreground">Sources:</span>
                <TierBadge tier="government" label="Official govt. source" />
                <TierBadge tier="licensed" label="Licensed news partner" />
              </div>

              {filtered.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}

              {/* Error details (collapsed, dev-facing) */}
              {errors.length > 0 && (
                <details className="text-[10px] text-muted-foreground px-1">
                  <summary className="cursor-pointer" style={{ fontWeight: 600 }}>
                    {errors.length} source(s) failed to load
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </details>
              )}

              {/* Notification settings shortcut at bottom */}
              <button
                onClick={() => setShowNotif(true)}
                className="w-full flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-4 py-3.5 transition hover:bg-muted/40"
              >
                <Settings2 className="size-4 text-muted-foreground" />
                <span className="flex-1 text-left text-sm" style={{ fontWeight: 600 }}>Notification preferences</span>
                <span className="text-xs text-muted-foreground">
                  {getSavedNotifEnabled() ? `Daily at ${getSavedNotifTime()}` : "Off"}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              {/* Legal footer */}
              <div className="px-1 py-2 text-[10px] text-muted-foreground leading-relaxed">
                LiveSync AI shows headlines + short snippets only. Full articles are read on the publisher's website. Sources: PIB (Govt. of India, public domain), UN News (intergovernmental, public domain), The Guardian (Open Platform, free tier). Terms verified July 2026.
              </div>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
