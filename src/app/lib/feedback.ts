/**
 * feedback.ts — sound + haptic + visual feedback for every money action.
 *
 * Sounds are synthesised with the Web Audio API (no audio files, works offline,
 * no network). Each action has its own short, recognisable tone:
 *   income  → bright rising "coin" arpeggio
 *   expense → soft two-note "tap" downwards
 *   saving  → sparkly chime (plus confetti in the UI layer)
 *   reminder→ gentle bell
 *   success → single soft pop (notes saved, settings changed…)
 *   error   → low buzz
 * Users can mute sounds/haptics in Notifications settings.
 */
import { hapticLight, hapticSuccess, hapticError } from "./native";

export type FeedbackKind = "income" | "expense" | "saving" | "reminder" | "success" | "error" | "bill-paid";

export type FeedbackEvent = {
  kind: FeedbackKind;
  title: string;
  amount?: number;
  subtitle?: string;
};

const SOUND_KEY = "ls_pref_sounds";
const HAPTIC_KEY = "ls_pref_haptics";

const readPref = (k: string) => {
  try { return localStorage.getItem(k) !== "off"; } catch { return true; }
};
export const prefs = {
  get sounds() { return readPref(SOUND_KEY); },
  get haptics() { return readPref(HAPTIC_KEY); },
  setSounds(on: boolean) { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch {} },
  setHaptics(on: boolean) { try { localStorage.setItem(HAPTIC_KEY, on ? "on" : "off"); } catch {} },
};

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx!.state === "suspended") void ctx!.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playTone(kind: FeedbackKind) {
  if (!prefs.sounds) return;
  switch (kind) {
    case "income":
      tone(880, 0, 0.12, "triangle"); tone(1175, 0.07, 0.12, "triangle"); tone(1568, 0.14, 0.22, "triangle", 0.2);
      break;
    case "expense":
      tone(660, 0, 0.09, "sine", 0.14); tone(494, 0.07, 0.14, "sine", 0.12);
      break;
    case "saving":
    case "bill-paid":
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.25, "sine", 0.12));
      break;
    case "reminder":
      tone(988, 0, 0.5, "sine", 0.16); tone(1319, 0.18, 0.6, "sine", 0.12);
      break;
    case "success":
      tone(740, 0, 0.1, "sine", 0.12); tone(988, 0.05, 0.12, "sine", 0.1);
      break;
    case "error":
      tone(196, 0, 0.18, "square", 0.06); tone(165, 0.12, 0.2, "square", 0.05);
      break;
  }
}

export function vibrate(kind: FeedbackKind) {
  if (!prefs.haptics) return;
  if (kind === "error") void hapticError();
  else if (kind === "expense" || kind === "success") void hapticLight();
  else void hapticSuccess();
  try { if (!(window as any).Capacitor?.isNativePlatform?.()) navigator.vibrate?.(kind === "error" ? [40, 40, 40] : 18); } catch {}
}

const bus = new EventTarget();

/** Fire tone + haptic + the animated confirmation card. */
export function feedback(ev: FeedbackEvent) {
  playTone(ev.kind);
  vibrate(ev.kind);
  bus.dispatchEvent(new CustomEvent("fb", { detail: ev }));
}

export function onFeedback(cb: (ev: FeedbackEvent) => void) {
  const h = (e: Event) => cb((e as CustomEvent<FeedbackEvent>).detail);
  bus.addEventListener("fb", h);
  return () => bus.removeEventListener("fb", h);
}

/** Light tap for any button press (used globally). */
export function tap() {
  if (prefs.haptics) void hapticLight();
}
