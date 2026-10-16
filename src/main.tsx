import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { initStatusBar } from "./app/lib/native.ts";
import { ensureNewsChannel } from "./app/lib/newsService.ts";
import { runStartupDataPreservation } from "./app/lib/recovery.ts";

// ─── Data preservation: Universal scan and recovery before first render ──────
runStartupDataPreservation().catch((e) => console.warn("[main] startup preservation failed:", e));

// ─── Native: fix status bar overlay before first render ──────────────────────
initStatusBar();

// ─── Native: ensure notification channels exist (Android 8+) ─────────────────
ensureNewsChannel();

// ─── Adaptive height: measure real visible area and expose as CSS var ─────────
// This is the single source of truth for app height on Android/iOS Capacitor.
// window.innerHeight is the most reliable in Capacitor WebViews because:
//   - It reflects the exact window the OS handed to the WebView
//   - visualViewport.height shrinks when the soft keyboard is shown (we want that)
//   - 100dvh can over-count on Android 15+ edge-to-edge before insets settle
function setAppHeight() {
  // Android's innerHeight already excludes native system bars when the status
  // bar does not overlay the WebView. Only use visualViewport while the soft
  // keyboard is actually open; at rest it can create a false blank top area.
  const viewport = window.visualViewport;
  const keyboardOpen = !!viewport && window.innerHeight - viewport.height > 120;
  const h = keyboardOpen ? viewport!.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}

// Run immediately on parse
setAppHeight();

// Re-run on all relevant resize events
window.addEventListener("resize", setAppHeight);
window.visualViewport?.addEventListener("resize", setAppHeight);

// Re-run after Capacitor native plugins settle (status bar, etc.)
// 300ms covers the typical delay between WebView load and native bar adjustments
setTimeout(setAppHeight, 300);
setTimeout(setAppHeight, 800); // extra pass for slow devices

createRoot(document.getElementById("root")!).render(<App />);
