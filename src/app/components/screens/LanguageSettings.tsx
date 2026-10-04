import { useState } from "react";
import { Check, Search, Globe, Sparkles, Clock, Info, Heart } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useTranslation, SUPPORTED_LANGUAGES, COMING_SOON_LANGUAGES, LangCode, ComingSoonLang } from "../../lib/i18n";

export function LanguageSettings({ onBack }: { onBack: () => void }) {
  const { t, lang, setLang } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedUpcoming, setSelectedUpcoming] = useState<ComingSoonLang | null>(null);

  const filteredAvailable = SUPPORTED_LANGUAGES.filter(l =>
    !search ||
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.native.toLowerCase().includes(search.toLowerCase())
  );

  const filteredComingSoon = COMING_SOON_LANGUAGES.filter(l =>
    !search ||
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.native.toLowerCase().includes(search.toLowerCase()) ||
    l.region.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (code: LangCode) => {
    setLang(code);
    setSelectedUpcoming(null);
  };

  return (
    <>
      <Header title={t("language.title")} subtitle={t("language.subtitle")} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-8 space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("language.searchPlaceholder")}
              className="w-full bg-card border border-border/60 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Interactive feedback toast for coming soon language */}
          {selectedUpcoming && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="size-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-900">
                  {selectedUpcoming.native} ({selectedUpcoming.label}) — {t("language.comingSoonBadge")}
                </div>
                <div className="text-xs text-amber-800/80 mt-0.5 leading-relaxed">
                  {t("language.inDevelopment").replace("{{lang}}", selectedUpcoming.label)}
                </div>
              </div>
              <button
                onClick={() => setSelectedUpcoming(null)}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Available Languages */}
          {filteredAvailable.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold px-1">
                {t("language.available")} ({filteredAvailable.length})
              </div>
              <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                {filteredAvailable.map((l) => {
                  const isActive = l.code === lang;
                  return (
                    <button
                      key={l.code}
                      onClick={() => handleSelect(l.code)}
                      className={`w-full flex items-center gap-4 p-4 border-b border-border/60 last:border-0 transition ${
                        isActive
                          ? "bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      {/* Language icon */}
                      <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <Globe className="size-5" />
                      </div>

                      {/* Language info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{l.native}</span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                              {t("language.current")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <span translate="no">{l.label} · {l.script}</span>
                        </div>
                      </div>

                      {/* Check mark */}
                      {isActive && (
                        <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <Check className="size-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Many more Indian Languages Coming Soon Banner ────────── */}
          <div className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-emerald-500/10 border border-amber-500/25 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-start gap-3 relative z-10">
              <div className="size-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 text-xl font-bold">
                🇮🇳
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{t("language.comingSoonTitle")}</span>
                  <Sparkles className="size-3.5 text-amber-600" />
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {t("language.comingSoonDesc")}
                </p>
              </div>
            </div>
          </div>

          {/* Coming Soon Indian Languages List */}
          {filteredComingSoon.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  {t("language.comingSoonSection")} ({filteredComingSoon.length} Indian Languages)
                </div>
                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="size-3" /> In Translation
                </span>
              </div>

              <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm divide-y divide-border/60">
                {filteredComingSoon.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedUpcoming(l)}
                    className="w-full flex items-center gap-3.5 p-3.5 hover:bg-muted/40 transition active:scale-[0.99] text-left group"
                  >
                    <div className="size-9 rounded-xl bg-muted/70 text-slate-600 flex items-center justify-center shrink-0 font-bold text-sm group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {l.native.slice(0, 1)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{l.native}</span>
                        <span className="text-xs text-muted-foreground font-medium"><span translate="no">({l.label})</span></span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {l.region} · {l.script}
                      </div>
                    </div>

                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 group-hover:border-amber-300 group-hover:bg-amber-50 group-hover:text-amber-700 transition">
                      {t("language.comingSoonBadge")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="bg-slate-50 border border-border/60 rounded-xl p-3 text-center text-xs text-muted-foreground leading-relaxed flex items-center justify-center gap-2">
            <Info className="size-4 text-slate-400 shrink-0" />
            <span>Financial standards (SIP, EMI, UPI, FD, ITR, GST) remain in universal terms across all Indian languages.</span>
          </div>
        </div>
      </Screen>
    </>
  );
}
