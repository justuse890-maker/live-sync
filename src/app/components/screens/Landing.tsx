import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, CreditCard, TrendingUp, Zap, Shield, ArrowRight, Check } from "lucide-react";
import { LiveSyncLogoMark } from "../LiveSyncLogo";
import { Card } from "../ui/card";
import { api } from "../../lib/api";
import { isInvestorDemo } from "../../lib/demo";

// ── Story fragments ──────────────────────────────────────────────
const STORY = [
  {
    headline: "You check your balance.",
    body: "It's lower than you thought. Bills? Subscriptions? That weekend coffee habit? You shrug and scroll on.",
    icon: "💸",
  },
  {
    headline: "You've tried spreadsheets.",
    body: "Good for a week. Maybe two. Then life happens and your financial map gets dusty.",
    icon: "📊",
  },
  {
    headline: "You've tried other apps.",
    body: "They show numbers. Cold. Confusing. Overwhelming. You close them and go back to guessing.",
    icon: "🤷",
  },
  {
    headline: "Now there's LiveSync AI.",
    body: "We connect your banks, cards, and investments — and narrate your money story in plain language. No jargon. No panic.",
    icon: "✨",
  },
];

// ── Story sections shown after CTA ──────────────────────────────
const CHAPTERS = [
  {
    title: "Every rupee, connected.",
    body: "Bank accounts, credit cards, UPI, investments, insurance, gold, property — all in one honest view. No more guessing games.",
    highlight: "All accounts in one place",
    icon: CreditCard,
    color: "#0066FF",
  },
  {
    title: "AI reads the chaos.",
    body: "₹8,200 silently drained by an unused subscription. ₹3,500 in 'Misc' was impulse shopping. We surface what you miss.",
    highlight: "Wealth leakage detected",
    icon: Zap,
    color: "#8B5CF6",
  },
  {
    title: "Goals that move.",
    body: "Emergency fund. Vacation. House down payment. We bucket your money, track progress, and nudge you forward.",
    highlight: "Visual milestone tracking",
    icon: TrendingUp,
    color: "#10B981",
  },
];

// ─────────────────────────────────────────────────────────────────
export function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(isInvestorDemo ? "investor@livesync.app" : "");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = mode === "signup"
    ? !!email && !!password && agreeTerms
    : !!email && !!password;

  const submit = async () => {
    setErr(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.signup(email, password, name || email.split("@")[0]);
        await api.signin(email, password);
        setSuccess("Welcome aboard!");
      } else {
        await api.signin(email, password);
        setSuccess("Signed in!");
      }
      setTimeout(() => navigate("/", { replace: true }), 500);
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById("landing-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="px-6 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-full mb-6" style={{ fontWeight: 700 }}>
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Financial clarity for real life
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight mb-4 px-2">
          Where every rupee<br />
          <span className="text-primary">has a story.</span>
        </h1>

        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8 leading-relaxed">
          Stop guessing where your money goes. Start knowing — confidently — with a clear path forward.
        </p>

        <button
          onClick={scrollToForm}
          className="w-full max-w-xs mx-auto bg-primary text-primary-foreground rounded-2xl py-4 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25"
          style={{ fontWeight: 700 }}
        >
          Sign in to LiveSync
          <ArrowRight className="size-4" />
        </button>
      </section>

      {/* ── Story: The Problem ──────────────────────────────────── */}
      <section className="px-5 pb-8">
        <div className="space-y-4">
          {STORY.map((s, i) => (
            <Card key={i} className={`p-5 ${i === 0 ? "border-primary/40 bg-primary/5" : ""}`}>
              <div className="flex items-start gap-4">
                <span className="text-2xl shrink-0 mt-0.5">{s.icon}</span>
                <div>
                  <p className="text-sm font-bold mb-1.5">{s.headline}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Chapter divider ─────────────────────────────────────── */}
      <section className="px-5 pb-6 text-center">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />
        <p className="text-xs text-muted-foreground uppercase tracking-widest" style={{ fontWeight: 700 }}>
          What LiveSync gives you
        </p>
      </section>

      {/* ── Chapters: The Solution ──────────────────────────────── */}
      <section className="px-5 pb-8 space-y-4">
        {CHAPTERS.map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i} className="p-5 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10" style={{ background: c.color }} />
              <div className="flex items-start gap-4 relative">
                <div
                  className="size-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}18` }}
                >
                  <Icon className="size-5" style={{ color: c.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold mb-1.5">{c.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{c.body}</p>
                  <div
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
                    style={{ background: `${c.color}15`, color: c.color, fontWeight: 700 }}
                  >
                    <Check className="size-3" strokeWidth={3} />
                    {c.highlight}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      {/* ── Privacy note ────────────────────────────────────────── */}
      <section className="px-5 pb-8">
        <Card className="p-4 bg-muted/40 border-border/60">
          <div className="flex items-start gap-3">
            <Shield className="size-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              We never sell your data. All connections are read-only and encrypted. AI processes your data ephemerally — nothing is stored on our servers.{" "}
              <button
                type="button"
                onClick={() => navigate("/privacy-policy")}
                className="text-primary underline inline font-semibold hover:opacity-80 transition cursor-pointer"
              >
                Review Privacy Policy
              </button>
            </p>
          </div>
        </Card>
      </section>

      {/* ── Auth Form (Sign In & Sign Up) ─────────────────────────── */}
      <section id="landing-form" className="px-5 pb-10">
        <Card className="p-5 shadow-sm border-border/80">
          {/* Segmented Control / Tab Switcher to move vice-versa */}
          {!isInvestorDemo && (
            <div className="grid grid-cols-2 p-1 bg-muted/70 rounded-xl mb-5 border border-border/50">
              <button
                type="button"
                onClick={() => { setMode("signin"); setErr(null); setSuccess(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === "signin"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setErr(null); setSuccess(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === "signup"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="mb-5">
            <h2 className="font-display text-xl font-bold mb-1">
              {isInvestorDemo ? "Investor demo" : mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isInvestorDemo
                ? "Explore a sample financial profile — no real data."
                : mode === "signup"
                  ? "Start your financial story today."
                  : "Sign in to continue your journey."}
            </p>
          </div>

          <div className="space-y-3 mb-4">
            {mode === "signup" && (
              <Field
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Aarav Sharma"
              />
            )}
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Min 6 characters"
              type="password"
            />
          </div>

          {/* T&C consent on signup */}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => setAgreeTerms(!agreeTerms)}
              className="w-full flex items-start gap-2.5 text-left mb-4"
            >
              <div
                className={`mt-0.5 size-4 shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                  agreeTerms ? "bg-primary border-primary" : "border-border bg-card"
                }`}
              >
                {agreeTerms && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
              </div>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate("/terms"); }}
                  className="text-primary underline font-semibold cursor-pointer"
                >
                  Terms & Conditions
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate("/privacy-policy"); }}
                  className="text-primary underline font-semibold cursor-pointer"
                >
                  Privacy Policy
                </button>.
              </span>
            </button>
          )}

          {err && (
            <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 leading-relaxed">
              {err}
            </div>
          )}
          {success && (
            <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              {success}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !canSubmit}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{ fontWeight: 700 }}
          >
            {loading
              ? mode === "signup" ? "Creating account…" : "Signing in…"
              : isInvestorDemo
                ? "Open investor demo"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
          </button>

          {!isInvestorDemo && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setErr(null);
                setSuccess(null);
              }}
              className="mt-3.5 w-full text-xs text-muted-foreground text-center"
            >
              {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
              <span className="text-primary font-semibold hover:underline">
                {mode === "signup" ? "Sign in" : "Sign up"}
              </span>
            </button>
          )}
        </Card>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="px-5 pb-8 text-center">
        <div className="h-px bg-border mb-5" />
        <div className="flex items-center justify-center gap-2 mb-3">
          <LiveSyncLogoMark className="size-5" color="#0066FF" />
          <span className="text-xs font-bold" style={{ fontWeight: 700 }}>
            LiveSync<span className="text-primary">AI</span>
          </span>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <button type="button" onClick={() => navigate("/privacy-policy")} className="underline hover:text-foreground">Privacy Policy</button>
          <span>·</span>
          <button type="button" onClick={() => navigate("/terms")} className="underline hover:text-foreground">Terms</button>
          <span>·</span>
          <button type="button" onClick={() => navigate("/contact")} className="underline hover:text-foreground">Support</button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} LiveSync AI · Made with care in India 🇮🇳
        </p>
      </footer>
    </div>
  );
}

// ── Shared field component ────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
