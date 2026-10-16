import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Check, Clock } from "lucide-react";
import { api } from "../lib/api";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { Capacitor } from "@capacitor/core";
import { getGoogleWebClientId, GOOGLE_CONFIGURATION_ERROR } from "../lib/googleAuth";
import { investorDemoCredentials, isInvestorDemo } from "../lib/demo";
import { notify } from "../lib/notify";

export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState(isInvestorDemo ? investorDemoCredentials.email : "");
  const [password, setPassword] = useState(isInvestorDemo ? investorDemoCredentials.password : "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Resend cooldown for password reset (60s)
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const friendlyError = (msg: string): string => {
    if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials"))
      return "Email or password is incorrect. Please try again.";
    if (msg.includes("Email not confirmed"))
      return "Please verify your email before signing in. Check your inbox.";
    if (msg.includes("User already registered"))
      return "An account with this email already exists. Try signing in.";
    if (msg.includes("over_email_send_rate_limit") || msg.includes("429"))
      return "Too many attempts. Please wait a minute and try again.";
    if (msg.includes("Password should be at least"))
      return "Password must be at least 6 characters.";
    if (msg.includes("Unacceptable audience") || msg.includes("invalid audience"))
      return "Google sign-in is misconfigured. The Google Web client ID must match the one configured in Supabase Auth.";
    if (msg.includes("Provider is not enabled") || msg.includes("Unsupported provider"))
      return "Google sign-in has not been enabled in Supabase Auth yet.";
    if (msg.includes("redirect_uri_mismatch"))
      return "This app URL has not been added to Google OAuth's authorized redirect URLs.";
    if (msg.includes("DEVELOPER_ERROR") || msg.includes("ApiException: 10") || msg.includes("12500"))
      return "Google sign-in is not authorized for this Android app. Verify package com.livesync.ai and this build's SHA-1 in Google Cloud.";
    if (msg.includes("network_error") || msg.includes("NetworkError"))
      return "Google sign-in needs an internet connection. Please check your network and try again.";
    return msg;
  };

  const canSubmit = mode === "forgot" ? !!email : !!email && !!password;

  const submit = async () => {
    setErr(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await api.signin(email, password);
        onAuthed();
      } else if (mode === "forgot") {
        await api.resetPassword(email);
        setSuccess("Password reset link sent! Check your inbox (and spam folder).");
        notify.success("Reset link sent", "Check your inbox and spam folder.");
        startCooldown();
      }
    } catch (e: any) {
      const msg = friendlyError(e.message || "Something went wrong");
      setErr(msg);
      notify.error("Sign-in failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErr(null);

      if (Capacitor.isNativePlatform()) {
        const clientId = getGoogleWebClientId();
        if (!clientId) throw new Error(GOOGLE_CONFIGURATION_ERROR);

        // Android's plugin uses `clientId` to create the ID token. Supplying it
        // here avoids falling back to the plugin's invalid default placeholder.
        await GoogleAuth.initialize({
          clientId,
          scopes: ["profile", "email"],
          grantOfflineAccess: false,
        });
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser.authentication?.idToken;

        if (!idToken) {
          throw new Error("Google did not return an ID token. Please try again.");
        }

        await api.signInWithGoogleIdToken(idToken);
        onAuthed();
      } else {
        // Web preview/browser fallback: Redirect via Supabase Google OAuth
        await api.signInWithGoogleOAuth();
      }
    } catch (err: any) {
      console.error("Google Sign-In error details:", err);
      const message = err?.message || err?.error || (typeof err === "string" ? err : "Google Sign-In failed");

      // Ignore user cancelled errors (Code 12501 or explicit cancel)
      if (message.includes("cancelled") || message.includes("12501") || message.includes("popup_closed_by_user")) {
        return;
      }

      setErr(friendlyError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-7 pt-16 pb-8 bg-background fade-up">
      <div className="flex items-center gap-3 mb-10">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary">
          <span className="size-3.5 rounded-full bg-white" />
        </span>
        <div>
          <div className="text-[17px] font-semibold tracking-tight">LiveSyncAI</div>
          <div className="text-xs text-muted-foreground -mt-0.5">Your financial OS</div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="display-tight" style={{ fontSize: 30, fontWeight: 700 }}>
          {isInvestorDemo ? "Investor demo" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isInvestorDemo ? "Explore a sample financial profile. This build contains no real customer data." : mode === "signup" ? "Start tracking, predicting, and improving your financial life." : mode === "forgot" ? "Enter your email to receive a password reset link." : "Sign in to pick up where you left off."}
        </p>
      </div>

      {/* ── Google Sign-In — hidden until a real OAuth Client ID is configured ──
           To re-enable: set GOOGLE_SIGNIN_ENABLED = true below and add a valid
           VITE_GOOGLE_WEB_CLIENT_ID to .env */}
      {false && mode !== "forgot" && (
        <>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 transition active:scale-[0.98]"
            style={{ fontWeight: 600 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border"></div>
            <div className="text-xs text-muted-foreground font-medium uppercase">Or</div>
            <div className="flex-1 h-px bg-border"></div>
          </div>
        </>
      )}

      <div className="space-y-3">
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        {mode !== "forgot" && (
          <div>
            <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />
            {!isInvestorDemo && (
              <div className="mt-2 text-right">
                <button onClick={() => { setMode("forgot"); setErr(null); setSuccess(null); }} className="text-xs text-primary" style={{ fontWeight: 600 }}>Forgot password?</button>
              </div>
            )}
          </div>
        )}
      </div>

      {err && <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 leading-relaxed">{err}</div>}
      {success && (
        <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3 leading-relaxed">
          {success}
          {mode === "forgot" && resendCooldown > 0 && (
            <div className="flex items-center gap-1 mt-2 text-muted-foreground">
              <Clock className="size-3" />
              Resend available in {resendCooldown}s
            </div>
          )}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading || !canSubmit || (mode === "forgot" && resendCooldown > 0)}
        className="w-full mt-6 bg-primary text-primary-foreground rounded-full py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ fontWeight: 700 }}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {isInvestorDemo ? "Open investor demo" : mode === "forgot" ? (success ? "Resend link" : "Send reset link") : "Sign in"}
      </button>

      {!isInvestorDemo && mode === "forgot" && (
        <button
          onClick={() => { setMode("signin"); setErr(null); setSuccess(null); }}
          className="mt-4 text-sm text-muted-foreground"
        >
          Remember your password?{" "}
          <span className="text-primary" style={{ fontWeight: 600 }}>
            Sign in
          </span>
        </button>
      )}

      <div className="mt-auto pt-8 text-center text-[11px] text-muted-foreground leading-relaxed">
        By continuing you agree to LiveSync's{" "}
        <a href="#/terms" className="text-primary underline">Terms & Conditions</a>{" "}
        and{" "}
        <a href="#/privacy-policy" className="text-primary underline">Privacy Policy</a>.
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full bg-card border border-border rounded-xl px-4 py-3 text-[14.5px] outline-none placeholder:text-slate-400"
      />
    </label>
  );
}
