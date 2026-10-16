import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/** True when the OS asks for less motion. Everything in this file falls back to the final state. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try { mq = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { return; }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Counts from the previous value to `value` so a changed figure visibly "moves" instead of jumping. */
export function CountUp({ value, format = (n) => String(Math.round(n)), ms = 650, className }: {
  value: number; format?: (n: number) => string; ms?: number; className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current, b = value;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = a + (b - a) * eased;
      from.current = cur;
      setShown(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduced]);

  return <span className={className}>{format(shown)}</span>;
}

/** Big green tick that pops in with a ring pulse — the "it worked" beat at the end of a flow. */
export function SuccessBurst({ size = 56 }: { size?: number }) {
  return (
    <div className="relative mx-auto text-emerald-500" style={{ width: size, height: size }} aria-hidden>
      <span className="ls-ring absolute inset-0 rounded-full" />
      <span className="ls-pop absolute inset-0 rounded-full bg-emerald-500 text-white flex items-center justify-center">
        <Check style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={3} />
      </span>
    </div>
  );
}

/** Coins travelling along a track from one place to another, so a transfer reads as money moving. */
export function MoneyFlow({ from, to, active }: { from?: string; to?: string; active: boolean }) {
  return (
    <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2.5" role="img" aria-label={from && to ? `Money moves from ${from} to ${to}` : "Choose where the money moves"}>
      <div className="flex items-center gap-2 text-[11px] font-bold text-sky-900">
        <span className="flex-1 min-w-0 truncate">{from || "From"}</span>
        <span className="flex-1 min-w-0 truncate text-right">{to || "To"}</span>
      </div>
      <div className="relative h-5 mt-1">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-sky-300" />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-sky-600" />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-emerald-500" />
        {active && [0, 1, 2].map((i) => (
          <span key={i} className="ls-flow-dot absolute top-1/2 size-2 rounded-full bg-sky-600" style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </div>
    </div>
  );
}
