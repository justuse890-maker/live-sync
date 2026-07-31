import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

/**
 * Custom Supabase storage adapter that uses @capacitor/preferences
 * (Android SharedPreferences / iOS NSUserDefaults) on native devices.
 * 
 * SharedPreferences are guaranteed to survive APK updates and WebView cache wipes on Android.
 * On web browser environments, it gracefully falls back to localStorage.
 */
export const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
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
      if (Capacitor.isNativePlatform()) {
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
