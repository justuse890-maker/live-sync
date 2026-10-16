import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Check, CreditCard, Loader2, Shield, TrendingUp, Zap } from "lucide-react";
import { api } from "../../lib/api";
import { isInvestorDemo } from "../../lib/demo";
import { notify } from "../../lib/notify";

const CHAPTERS = [
  {
    title: "Every rupee, connected.",
    body: "Bank accounts, credit cards, UPI, investments, insurance, gold, property — all in one honest view. No more guessing games.",
    highlight: "All accounts in one place",
    icon: CreditCard,
  },
  {
    title: "AI reads the chaos.",
    body: "₹8,200 silently drained by an unused subscription. ₹3,500 in 'Misc' was impulse shopping. We surface what you miss.",
    highlight: "Wealth leakage detected",
    icon: Zap,
  },
  {
    title: "Goals that move.",
    body: "Emergency fund. Vacation. House down payment. We bucket your money, track progress, and nudge you forward.",
    highlight: "Visual milestone tracking",
    icon: TrendingUp,
    progress: 68,
  },
];

// ─────────────────────────────────────────────────────────────────
export function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [cooldown, setCooldown] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(isInvestorDemo ? "investor@livesync.app" : "");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const friendly = (m: string) =>
    /rate limit|too many|429/i.test(m) ? "Too many attempts. Please wait a few minutes and try again."
    : /invalid login credentials/i.test(m) ? "Email or password is incorrect."
    : /email not confirmed/i.test(m) ? "Please verify your email before signing in."
    : m || "Something went wrong";

  const canSubmit = mode === "forgot"
    ? /^\S+@\S+\.\S+$/.test(email.trim()) && cooldown === 0
    : mode === "signup"
    ? !!email && password.length >= 8 && agreeTerms
    : !!email && !!password;

  const submit = async () => {
    setErr(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        await api.resetPassword(email);
        setSuccess("If an account exists for this email, a reset link is on its way. Check your inbox and spam folder, then open the link on this phone.");
        notify.success("Reset link sent", "Open it on this phone to set a new password.");
        setCooldown(60);
        return;
      }
      if (mode === "signup") {
        await api.signup(email, password, name || email.split("@")[0]);
        await api.signin(email, password);
        setSuccess("Welcome aboard!");
        notify.success("Welcome aboard!");
      } else {
        await api.signin(email, password);
        setSuccess("Signed in!");
      }
      setTimeout(() => navigate("/", { replace: true }), 500);
    } catch (e: any) {
      const msg = friendly(e.message || "");
      setErr(msg);
      notify.error(mode === "signup" ? "Could not create account" : mode === "forgot" ? "Could not send reset link" : "Could not sign in", msg);
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/85 px-5 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary">
            <span className="size-3 rounded-full bg-white" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">LiveSyncAI</span>
        </div>
        <button onClick={scrollToForm} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground">
          Get app
        </button>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="px-6 pt-14 pb-12 text-center">
        <div className="fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 shadow-sm">
          <span className="dot-pulse size-1.5 rounded-full bg-emerald-500" />
          <span className="eyebrow text-slate-600">Read-only • Encrypted • Ephemeral</span>
        </div>

        <h1 className="fade-up display-tight mt-7 text-[40px] font-bold text-slate-900" style={{ animationDelay: "80ms" }}>
          Your money,
          <span className="block font-normal text-slate-600">in plain language.</span>
          <span className="mt-1 block text-[30px] font-normal text-slate-400">No jargon. No panic.</span>
        </h1>

        <p className="fade-up mx-auto mt-6 max-w-sm text-[15px] leading-relaxed text-muted-foreground" style={{ animationDelay: "160ms" }}>
          LiveSync brings every account together and translates the chaos into clear actions — so you always know where you stand.
        </p>

        <div className="fade-up mt-8 flex items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
          <button
            onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Explore features <ArrowRight className="size-4" />
          </button>
          <button
            onClick={scrollToForm}
            className="rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Sign in
          </button>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section ref={featuresRef} className="px-5 pb-8">
        <div className="mb-6 text-center">
          <p className="eyebrow text-slate-400">What LiveSync gives you</p>
          <div className="mx-auto mt-3 h-px w-16 bg-border" />
        </div>
        <div className="space-y-4">
          {CHAPTERS.map((c, i) => {
            const Icon = c.icon;
            return (
              <article
                key={c.title}
                className="fade-up relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-indigo-50" />
                <div className="relative flex items-start justify-between gap-3">
                  <span className="flex size-12 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50">
                    <Icon className="size-5 text-indigo-600" />
                  </span>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                    {c.highlight}
                  </span>
                </div>
                <h3 className="relative mt-6 text-lg font-bold tracking-tight text-slate-900">{c.title}</h3>
                <p className="relative mt-2 text-[15px] leading-relaxed text-muted-foreground">{c.body}</p>
                {c.progress != null && (
                  <div className="relative mt-5">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="bar-grow h-full rounded-full bg-primary" style={{ width: `${c.progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">{c.progress}% to emergency fund</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Privacy note ────────────────────────────────────────── */}
      <section className="px-5 pb-8">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-5">
          <Shield className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            We never sell your data. All connections are read-only and encrypted. AI processes your data ephemerally — nothing is stored on our servers.{" "}
            <button type="button" onClick={() => navigate("/privacy-policy")} className="font-semibold text-slate-900 underline underline-offset-2">
              Review Privacy Policy
            </button>
          </p>
        </div>
      </section>

      {/* ── Auth ────────────────────────────────────────────────── */}
      <section ref={formRef} id="landing-form" className="px-5 pb-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          {!isInvestorDemo && mode !== "forgot" && (
            <div className="relative mb-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
              <span
                className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-card shadow-sm transition-transform duration-300"
                style={{ transform: mode === "signup" ? "translateX(100%)" : "none", transitionTimingFunction: "var(--ease-out)" }}
              />
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setErr(null); setSuccess(null); }}
                  className={`relative z-10 rounded-full py-2.5 text-[13.5px] font-semibold transition-colors ${mode === m ? "text-slate-900" : "text-slate-500"}`}
                >
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          <h2 className="display-tight text-2xl font-bold text-slate-900">
            {isInvestorDemo ? "Investor demo" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isInvestorDemo ? "Explore a sample financial profile — no real data." : mode === "signup" ? "Start your financial story today." : mode === "forgot" ? "Enter your email and we'll send you a link to choose a new password." : "Sign in to continue your journey."}
          </p>

          <div className="mt-5 space-y-4">
            {mode === "signup" && <Field label="Name" value={name} onChange={setName} placeholder="Aarav Sharma" />}
            <Field label="Email address" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
            {mode !== "forgot" && <Field label="Password" value={password} onChange={setPassword} placeholder="Min 8 characters" type="password" />}
            {mode === "signin" && !isInvestorDemo && (
              <div className="-mt-1 text-right">
                <button type="button" onClick={() => { setMode("forgot"); setErr(null); setSuccess(null); }} className="text-[13px] font-semibold text-slate-700">
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {mode === "signup" && (
            <button type="button" onClick={() => setAgreeTerms(!agreeTerms)} className="mt-4 flex w-full items-start gap-2.5 text-left">
              <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${agreeTerms ? "border-primary bg-primary" : "border-slate-300 bg-card"}`}>
                {agreeTerms && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
              </span>
              <span className="text-[12px] leading-relaxed text-muted-foreground">
                I agree to the{" "}
                <span onClick={(e) => { e.stopPropagation(); navigate("/terms"); }} className="font-semibold text-slate-900 underline">Terms & Conditions</span>{" "}and{" "}
                <span onClick={(e) => { e.stopPropagation(); navigate("/privacy-policy"); }} className="font-semibold text-slate-900 underline">Privacy Policy</span>.
              </span>
            </button>
          )}

          {err && <div role="alert" className="ls-rise mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed text-rose-600">{err}</div>}
          {success && <div role="status" className="ls-rise mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">{success}</div>}

          <button
            onClick={submit}
            disabled={loading || !canSubmit}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading
              ? mode === "signup" ? "Creating account…" : "Signing in…"
              : isInvestorDemo ? "Open investor demo"
              : mode === "signup" ? "Create account"
              : mode === "forgot" ? (cooldown > 0 ? `Resend in ${cooldown}s` : success ? "Resend link" : "Send reset link")
              : "Continue to LiveSync"}
          </button>

          {!isInvestorDemo && mode === "forgot" && (
            <button type="button" onClick={() => { setMode("signin"); setErr(null); setSuccess(null); }} className="mt-4 w-full text-center text-[13px] text-muted-foreground">
              Remembered it? <span className="font-semibold text-slate-900">Back to sign in</span>
            </button>
          )}
          {!isInvestorDemo && mode !== "forgot" && (
            <button
              type="button"
              onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); setSuccess(null); }}
              className="mt-4 w-full text-center text-[13px] text-muted-foreground"
            >
              {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
              <span className="font-semibold text-slate-900">{mode === "signup" ? "Sign in" : "Sign up"}</span>
            </button>
          )}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-slate-400">
            <Shield className="size-3" /> Secured by bank-grade encryption · Read-only access
          </p>
        </div>
        <p className="mt-4 px-4 text-center text-[11.5px] leading-relaxed text-slate-400">
          By continuing, you agree to our Terms and Privacy Policy. We'll never ask for your UPI PIN or OTP.
        </p>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="px-5 pb-10 text-center">
        <div className="mb-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <button type="button" onClick={() => navigate("/privacy-policy")}>Privacy</button>
          <button type="button" onClick={() => navigate("/terms")}>Terms</button>
          <button type="button" onClick={() => navigate("/contact")}>Support</button>
        </div>
        <p className="text-[11.5px] text-slate-400">© {new Date().getFullYear()} LiveSync AI · Made with care in India</p>
      </footer>
    </div>
  );
}

// ── Shared field component ────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === "password" ? "current-password" : type === "email" ? "email" : "off"}
        className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400"
      />
    </label>
  );
}
