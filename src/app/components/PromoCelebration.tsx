import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, Star, Crown, Zap, Gift, X, ArrowRight, Check } from "lucide-react";
import { PROMO_DAYS, PROMO_SEEN_KEY } from "../lib/promoConfig";

// ── Confetti particle system ─────────────────────────────────────────────────
const CONFETTI_COLORS = [
  "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96E6A1",
  "#DDA0DD", "#F7DC6F", "#82E0AA", "#F1948A", "#85C1E9",
];

type Particle = {
  id: number;
  x: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "rect" | "circle" | "star";
};

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const idRef = useRef(0);

  const spawnBurst = useCallback(() => {
    const newParticles: Particle[] = Array.from({ length: 60 }, () => ({
      id: idRef.current++,
      x: Math.random() * window.innerWidth,
      vx: (Math.random() - 0.5) * 6,
      vy: -(Math.random() * 8 + 4),
      size: Math.random() * 10 + 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
      shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
    }));
    particles.current = [...particles.current, ...newParticles];
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Initial burst
    spawnBurst();
    // Follow-up bursts
    const t1 = setTimeout(spawnBurst, 600);
    const t2 = setTimeout(spawnBurst, 1200);
    const t3 = setTimeout(spawnBurst, 2000);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => p.opacity > 0.01 && p.x > -50 && p.x < canvas.width + 50);
      for (const p of particles.current) {
        p.vy += 0.25; // gravity
        p.x += p.vx;
        const y = (p as any).y ?? 0;
        (p as any).y = y + p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, p.opacity - 0.004);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, (p as any).y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Star
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = i === 0 ? p.size / 2 : p.size / 4;
            ctx[i === 0 ? "moveTo" : "lineTo"](Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      particles.current = [];
    };
  }, [active, spawnBurst]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ mixBlendMode: "normal" }}
    />
  );
}

// ── Feature list shown in celebration ────────────────────────────────────────
const PRO_FEATURES = [
  { icon: "🤖", label: "AI Financial Coach" },
  { icon: "🔥", label: "FIRE Retirement Engine" },
  { icon: "📊", label: "Advanced Analytics & Reports" },
  { icon: "🔒", label: "Encrypted Document Vault" },
  { icon: "📤", label: "Statement Import Tool" },
  { icon: "☁️", label: "Cross-device Cloud Backup" },
];

// ── Main celebration modal ────────────────────────────────────────────────────
export function PromoCelebration({ daysLeft, onDismiss }: { daysLeft: number; onDismiss: () => void }) {
  const [phase, setPhase] = useState<"burst" | "card" | "done">("burst");
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    // Show burst animation for 0.5s then reveal card
    const t = setTimeout(() => setPhase("card"), 500);
    // Auto-stop confetti after 4s
    const t2 = setTimeout(() => setConfetti(false), 4000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  const handleDismiss = useCallback(() => {
    setPhase("done");
    onDismiss();
  }, [onDismiss]);

  if (phase === "done") return null;

  return (
    <div
      className="absolute inset-0 z-[500] flex flex-col items-center justify-end"
      style={{
        background: "linear-gradient(160deg, #0a0a1a 0%, #0d1b4f 40%, #1a0a3e 100%)",
      }}
    >
      <ConfettiCanvas active={confetti} />

      {/* Animated stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
              opacity: Math.random() * 0.6 + 0.2,
              animation: `pulse ${1.5 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Top hero area */}
      <div className="absolute top-0 inset-x-0 flex flex-col items-center pt-16 gap-4 z-20">
        {/* Crown badge */}
        <div
          className="relative size-24 rounded-3xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)",
            boxShadow: "0 0 60px rgba(255,215,0,0.5), 0 0 120px rgba(255,140,0,0.2)",
          }}
        >
          <Crown className="size-12 text-white drop-shadow-lg" strokeWidth={1.5} />
          {/* Orbiting sparkles */}
          {[0, 72, 144, 216, 288].map((deg, i) => (
            <div
              key={i}
              className="absolute size-4 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.15)",
                transform: `rotate(${deg}deg) translateX(52px)`,
                animation: `spin 8s linear infinite`,
              }}
            >
              <Star className="size-2.5 text-yellow-200 fill-yellow-200" />
            </div>
          ))}
        </div>

        {/* Title */}
        <div className="text-center px-6 mt-2">
          <div
            className="font-display font-black text-white text-center"
            style={{ fontSize: 30, lineHeight: 1.1, letterSpacing: -0.5 }}
          >
            🎉 Welcome to
          </div>
          <div
            className="font-display font-black text-center"
            style={{
              fontSize: 36,
              lineHeight: 1.05,
              background: "linear-gradient(90deg, #FFD700, #FF8C00, #FFD700)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundSize: "200% auto",
              animation: "shimmer 2s linear infinite",
            }}
          >
            LiveSync Pro
          </div>
          <div className="text-blue-200 text-sm mt-2 font-medium">
            You're part of our launch celebration! 🚀
          </div>
        </div>

        {/* Days counter pill */}
        <div
          className="flex items-center gap-2 px-5 py-2.5 rounded-full"
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.15))",
            border: "1px solid rgba(255,215,0,0.35)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Gift className="size-4 text-yellow-300" />
          <span className="text-yellow-200 text-sm font-bold">
            {daysLeft} days of Pro — absolutely free
          </span>
        </div>
      </div>

      {/* Bottom card with features */}
      <div
        className="relative z-20 w-full rounded-t-3xl p-6 pt-7"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderBottom: "none",
        }}
      >
        {/* What you get */}
        <div className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">
          ✨ Everything unlocked for you
        </div>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PRO_FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-base leading-none">{f.icon}</span>
              <span className="text-white text-[11px] font-medium leading-tight">{f.label}</span>
            </div>
          ))}
        </div>

        {/* Promo note */}
        <div
          className="flex items-start gap-2.5 rounded-2xl p-3 mb-5"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <Zap className="size-4 text-indigo-300 shrink-0 mt-0.5" />
          <p className="text-indigo-200 text-[11px] leading-relaxed">
            As a launch celebration, all new users get <strong className="text-white">{PROMO_DAYS} days of Pro free</strong>.
            No credit card, no catch. Enjoy every feature and see how LiveSync transforms your finances.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleDismiss}
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-sm"
          style={{
            background: "linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)",
            color: "#1a0a00",
            boxShadow: "0 8px 32px rgba(255,215,0,0.35)",
          }}
        >
          <Sparkles className="size-4" />
          Start exploring LiveSync Pro
          <ArrowRight className="size-4" />
        </button>

        <p className="text-center text-white/35 text-[10px] mt-3">
          {daysLeft} days remaining • No payment needed
        </p>
      </div>

      {/* Skip button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 z-30 size-8 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
      >
        <X className="size-4 text-white/60" />
      </button>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin {
          from { transform: rotate(var(--start, 0deg)) translateX(52px) rotate(0deg); }
          to { transform: rotate(calc(var(--start, 0deg) + 360deg)) translateX(52px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Hook that returns whether the celebration modal should be shown.
 * Marks as seen in localStorage so it only ever shows once.
 */
export function usePromoCelebration(isPromoUser: boolean, promoDaysLeft: number, loading: boolean) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading || !isPromoUser || promoDaysLeft <= 0) return;
    // Only show once per install
    try {
      if (!localStorage.getItem(PROMO_SEEN_KEY)) {
        // Small delay so the app shell renders first
        const t = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [isPromoUser, promoDaysLeft, loading]);

  const dismiss = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(PROMO_SEEN_KEY, "1"); } catch {}
  }, []);

  return { show, dismiss };
}
