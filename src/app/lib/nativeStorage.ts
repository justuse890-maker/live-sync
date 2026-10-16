import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

/**
 * Custom Supabase storage adapter that uses @capacitor/preferences
 * (Android SharedPreferences / iOS NSUserDefaults) on native devices.
 * 
 * SharedPreferences are guaranteed to survive APK updates and WebView cache wipes on Android.
 * On web browser environments, it gracefully falls back to localStorage.
 */
/**
 * Auth/session keys hold refresh tokens. SharedPreferences are included in Android
 * cloud backup / device transfer, so these keys live in WebView localStorage only
 * (not backed up) and any copy left in Preferences by older builds is purged.
 */
const isSecretKey = (key: string) => key.startsWith("livesync-auth") || key.startsWith("sb-");

export const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isSecretKey(key)) {
        if (Capacitor.isNativePlatform()) await Preferences.remove({ key }).catch(() => {});
        return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      }
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key });
        // Migration helper: If not found in Preferences, check localStorage and migrate
        if (value === null && typeof localStorage !== "undefined") {
          const localVal = localStorage.getItem(key);
          if (localVal !== null) {
            await Preferences.set({ key, value: localVal });
            return localVal;
          }
        }
        return value;
      }
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch (e) {
      console.warn("nativeStorage getItem error:", e);
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform() && !isSecretKey(key)) {
        await Preferences.set({ key, value });
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("nativeStorage setItem error:", e);
      if (typeof localStorage !== "undefined") {
        try { localStorage.setItem(key, value); } catch {}
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key });
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("nativeStorage removeItem error:", e);
      if (typeof localStorage !== "undefined") {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  },
};
