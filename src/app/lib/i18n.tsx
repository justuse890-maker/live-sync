/**
 * i18n.tsx — Lightweight internationalization system for LiveSync AI
 * 
 * Provides:
 * - LanguageProvider context wrapping the app
 * - useTranslation() hook returning t(key) and currentLang
 * - Language preference persisted in localStorage + Supabase settings
 * - Falls back to English for any missing translation key
 */

import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from "react";
import { en, TranslationKeys } from "./locales/en";
import { mr } from "./locales/mr";
import { setAutoLanguage } from "./autoTranslate";
import { hi } from "./locales/hi";

// ─── Supported Languages ──────────────────────────────────────────────────────

export type LangCode = "en" | "mr" | "hi";

export type LangMeta = {
  code: LangCode;
  label: string;        // English name
  native: string;       // Native script name
  script: string;       // Script name for font hints
};

export const SUPPORTED_LANGUAGES: LangMeta[] = [
  { code: "en", label: "English",  native: "English",  script: "Latin" },
  { code: "mr", label: "Marathi",  native: "मराठी",    script: "Devanagari" },
  { code: "hi", label: "Hindi",    native: "हिन्दी",   script: "Devanagari" },
];

export type ComingSoonLang = {
  id: string;
  label: string;        // English name
  native: string;       // Native script
  script: string;       // Script name
  region: string;       // State / Region
};

export const COMING_SOON_LANGUAGES: ComingSoonLang[] = [
  { id: "ta", label: "Tamil", native: "தமிழ்", script: "Tamil", region: "Tamil Nadu & Puducherry" },
  { id: "te", label: "Telugu", native: "తెలుగు", script: "Telugu", region: "Andhra Pradesh & Telangana" },
  { id: "kn", label: "Kannada", native: "ಕನ್ನಡ", script: "Kannada", region: "Karnataka" },
  { id: "bn", label: "Bengali", native: "বাংলা", script: "Bengali", region: "West Bengal & Tripura" },
  { id: "gu", label: "Gujarati", native: "ગુજરાતી", script: "Gujarati", region: "Gujarat" },
  { id: "ml", label: "Malayalam", native: "മലയാളം", script: "Malayalam", region: "Kerala" },
  { id: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", script: "Gurmukhi", region: "Punjab" },
  { id: "or", label: "Odia", native: "ଓଡ଼ିଆ", script: "Odia", region: "Odisha" },
];

// ─── Translation Registry ─────────────────────────────────────────────────────

const translations: Record<LangCode, TranslationKeys> = { en, mr, hi };

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "livesync-app-lang";

function getStoredLang(): LangCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) return stored as LangCode;
  } catch { /* SSR or restricted env */ }
  return "en";
}

function storeLang(code: LangCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch { /* ignore */ }
}

// ─── Translation Resolver ─────────────────────────────────────────────────────

/**
 * Resolves a dot-notation key like "dashboard.greeting" against a flat
 * translation object. Falls back to English if key is missing.
 */
function resolveKey(lang: LangCode, key: string, replacements?: Record<string, string | number>): string {
  // Try current language first, then English fallback
  let value = (translations[lang] as any)?.[key]
    ?? (translations.en as any)?.[key]
    ?? key;  // Last resort: show the key itself

  // Interpolation: replace {{name}} with provided values
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
  }

  return value;
}

// ─── React Context ────────────────────────────────────────────────────────────

type I18nContextType = {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  langMeta: LangMeta;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(getStoredLang);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    storeLang(code);
    // Set HTML lang attribute for accessibility
    document.documentElement.lang = code;
    // Set dir for RTL languages (Urdu future)
    document.documentElement.dir = code === "ur" as any ? "rtl" : "ltr";
  }, []);

  // Keep <html lang> and the whole-app translator (autoTranslate.ts) in sync.
  // Screens that use t("key") get their strings from locales/*.ts; every other
  // hard-coded English string is translated on-device by autoTranslate.
  useEffect(() => {
    document.documentElement.lang = lang;
    void setAutoLanguage(lang);
  }, [lang]);

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    return resolveKey(lang, key, replacements);
  }, [lang]);

  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0];

  return (
    <I18nContext.Provider value={{ lang, setLang, t, langMeta }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components outside provider (shouldn't happen in production)
    return {
      lang: "en" as LangCode,
      setLang: () => {},
      t: (key: string) => (en as any)[key] || key,
      langMeta: SUPPORTED_LANGUAGES[0],
    };
  }
  return ctx;
}

/**
 * Get current language without the hook (for non-component code)
 */
export function getCurrentLang(): LangCode {
  return getStoredLang();
}
