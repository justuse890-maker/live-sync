import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Check, BellRing, X, Receipt } from "lucide-react";
import confetti from "canvas-confetti";
import { onFeedback, FeedbackEvent } from "../lib/feedback";
import { inr } from "./types";

const STYLE: Record<FeedbackEvent["kind"], { bg: string; ring: string; icon: typeof Check; amountColor: string; sign: string }> = {
  income: { bg: "#10B981", ring: "#A7F3D0", icon: ArrowDownLeft, amountColor: "#047857", sign: "+" },
  expense: { bg: "#F43F5E", ring: "#FECDD3", icon: ArrowUpRight, amountColor: "#BE123C", sign: "−" },
  saving: { bg: "#6366F1", ring: "#C7D2FE", icon: PiggyBank, amountColor: "#4338CA", sign: "+" },
  "bill-paid": { bg: "#0EA5E9", ring: "#BAE6FD", icon: Receipt, amountColor: "#0369A1", sign: "" },
  reminder: { bg: "#F59E0B", ring: "#FDE68A", icon: BellRing, amountColor: "#B45309", sign: "" },
  success: { bg: "#334155", ring: "#CBD5E1", icon: Check, amountColor: "#334155", sign: "" },
  error: { bg: "#DC2626", ring: "#FECACA", icon: X, amountColor: "#B91C1C", sign: "" },
};

/** Counts up from 0 → value in ~600ms for a satisfying "money moved" moment. */
function useCountUp(value: number | undefined, key: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!value) { setV(0); return; }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(value); return; }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, key]);
  return v;
}

/**
 * Global animated confirmation card. Mounted once in the app shell; every
 * add-income / add-expense / save / bill-paid action shows it with a tone.
 */
export function FeedbackLayer() {
  const [ev, setEv] = useState<FeedbackEvent | null>(null);
  const [n, setN] = useState(0);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onFeedback((e) => {
    setEv(e);
    setN((x) => x + 1);
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), e.kind === "success" ? 1600 : 2400);
    if (e.kind === "saving" || e.kind === "bill-paid" || (e.kind === "income" && (e.amount ?? 0) > 0)) {
      try {
        const big = e.kind === "saving" || e.kind === "bill-paid";
        confetti({
          particleCount: big ? 90 : 40,
          spread: big ? 80 : 55,
          startVelocity: big ? 38 : 28,
          origin: { y: 0.82 },
          colors: e.kind === "income" ? ["#10B981", "#34D399", "#FBBF24"] : ["#6366F1", "#22D3EE", "#F59E0B", "#10B981"],
          disableForReducedMotion: true,
          scalar: 0.9,
          zIndex: 300,
        });
      } catch {}
    }
  }), []);

  const count = useCountUp(ev?.amount, n);
  if (!ev) return null;
  const st = STYLE[ev.kind];
  const Icon = st.icon;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-[250] flex justify-center px-6" aria-live="polite">
      <div
        key={n}
        onClick={() => setShow(false)}
        className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/70 overflow-hidden"
        style={{
          transform: show ? "translateY(0) scale(1)" : "translateY(24px) scale(0.96)",
          opacity: show ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(.2,.9,.25,1.15), opacity 0.25s ease",
        }}
      >
        <div className="flex items-center gap-3 p-3.5">
          <div className="relative size-11 rounded-full flex items-center justify-center shrink-0 ls-pop" style={{ background: st.bg, color: st.ring }}>
            <span className="absolute inset-0 rounded-full ls-ring" style={{ color: st.ring }} />
            {ev.kind === "success" ? (
              <svg viewBox="0 0 24 24" className="size-5 ls-check relative" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              <Icon className="size-5 text-white relative" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{ev.title}</div>
            {ev.subtitle && <div className="text-xs text-slate-500 truncate">{ev.subtitle}</div>}
          </div>
          {ev.amount ? (
            <div className="text-base font-black tabular-nums" style={{ color: st.amountColor }}>
              {st.sign}{inr(count)}
            </div>
          ) : null}
        </div>
        <div className="h-1 bg-slate-100">
          <div key={`bar-${n}`} className="h-full ls-shrink" style={{ background: st.bg, animationDuration: ev.kind === "success" ? "1.6s" : "2.4s" }} />
        </div>
      </div>
    </div>
  );
}
