// Curated languages for Web Speech API. BCP-47 tags chosen for the variants
// Chrome/Safari/Edge actually ship recognition models for.

import { useEffect, useState } from "react";

export type VoiceLang = { code: string; label: string; native: string; group: "India" | "World" };

export const VOICE_LANGS: VoiceLang[] = [
  // ─── India (12) ────────────────────────────────────────────────────
  { code: "hi-IN", label: "Hindi",     native: "हिन्दी",   group: "India" },
  { code: "bn-IN", label: "Bengali",   native: "বাংলা",    group: "India" },
  { code: "ta-IN", label: "Tamil",     native: "தமிழ்",    group: "India" },
  { code: "te-IN", label: "Telugu",    native: "తెలుగు",   group: "India" },
  { code: "mr-IN", label: "Marathi",   native: "मराठी",    group: "India" },
  { code: "gu-IN", label: "Gujarati",  native: "ગુજરાતી",  group: "India" },
  { code: "kn-IN", label: "Kannada",   native: "ಕನ್ನಡ",    group: "India" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം",   group: "India" },
  { code: "pa-IN", label: "Punjabi",   native: "ਪੰਜਾਬੀ",   group: "India" },
  { code: "or-IN", label: "Odia",      native: "ଓଡ଼ିଆ",     group: "India" },
  { code: "as-IN", label: "Assamese",  native: "অসমীয়া",  group: "India" },
  { code: "ur-IN", label: "Urdu",      native: "اُردُو",    group: "India" },
  { code: "en-IN", label: "English (India)", native: "English", group: "India" },

  // ─── World (13) ────────────────────────────────────────────────────
  { code: "en-US", label: "English (US)", native: "English",     group: "World" },
  { code: "en-GB", label: "English (UK)", native: "English",     group: "World" },
  { code: "es-ES", label: "Spanish",      native: "Español",     group: "World" },
  { code: "fr-FR", label: "French",       native: "Français",    group: "World" },
  { code: "de-DE", label: "German",       native: "Deutsch",     group: "World" },
  { code: "pt-BR", label: "Portuguese",   native: "Português",   group: "World" },
  { code: "zh-CN", label: "Mandarin",     native: "中文",         group: "World" },
  { code: "ja-JP", label: "Japanese",     native: "日本語",       group: "World" },
  { code: "ko-KR", label: "Korean",       native: "한국어",       group: "World" },
  { code: "ar-SA", label: "Arabic",       native: "العربية",      group: "World" },
  { code: "ru-RU", label: "Russian",      native: "Русский",     group: "World" },
  { code: "id-ID", label: "Indonesian",   native: "Bahasa Indonesia", group: "World" },
  { code: "tr-TR", label: "Turkish",      native: "Türkçe",      group: "World" },
];

const STORAGE_KEY = "livesync-voice-lang";

export function defaultVoiceLang(): string {
  const stored = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
  if (stored && VOICE_LANGS.some((l) => l.code === stored)) return stored;
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  const match = VOICE_LANGS.find((l) => l.code.toLowerCase() === nav.toLowerCase())
    || VOICE_LANGS.find((l) => l.code.split("-")[0] === nav.split("-")[0]);
  return match?.code || "en-IN";
}

export function useVoiceLang(): [string, (code: string) => void] {
  const [code, setCode] = useState<string>(() => defaultVoiceLang());
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, code); } catch {} }, [code]);
  return [code, setCode];
}

export function findVoiceLang(code: string): VoiceLang | undefined {
  return VOICE_LANGS.find((l) => l.code === code);
}
