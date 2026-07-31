import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { initStatusBar } from "./app/lib/native.ts";
import { ensureNewsChannel } from "./app/lib/newsService.ts";

// ─── Native: fix status bar overlay before first render ──────────────────────
initStatusBar();

// ─── Native: ensure notification channels exist (Android 8+) ─────────────────
ensureNewsChannel();

// ─── Adaptive height: keep --app-height in sync with the visible viewport ────
// Fallback for browsers/WebViews that don't yet support 100dvh.
// The CSS var is consumed in globals.css on .app-shell.
function setAppHeight() {
  const h = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}
window.addEventListener("resize", setAppHeight);
window.visualViewport?.addEventListener("resize", setAppHeight);
setAppHeight(); // run once on load

createRoot(document.getElementById("root")!).render(<App />);