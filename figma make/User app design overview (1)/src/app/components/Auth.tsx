import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "../lib/api";

export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.signup(email, password, name || email.split("@")[0]);
      }
      await api.signin(email, password);
      onAuthed();
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-7 pt-16 pb-8 bg-gradient-to-b from-primary/5 to-background">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="size-11 rounded-2xl bg-primary flex items-center justify-center">
          <Sparkles className="size-5 text-white" />
        </div>
        <div>
          <div className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>LiveSync</div>
          <div className="text-xs text-muted-foreground -mt-0.5">Your financial OS</div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {mode === "signup" ? "Start tracking, predicting, and improving your financial life." : "Sign in to pick up where you left off."}
        </p>
      </div>

      <div className="space-y-3">
        {mode === "signup" && (
          <Field label="Name" value={name} onChange={setName} placeholder="Aarav Sharma" />
        )}
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />
      </div>

      {err && <div className="mt-3 text-xs text-rose-600 bg-rose-50 rounded-lg p-2.5">{err}</div>}

      <button
        onClick={submit}
        disabled={loading || !email || !password}
        className="w-full mt-6 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ fontWeight: 700 }}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {mode === "signup" ? "Create account" : "Sign in"}
      </button>

      <button
        onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); }}
        className="mt-4 text-sm text-muted-foreground"
      >
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <span className="text-primary" style={{ fontWeight: 600 }}>
          {mode === "signup" ? "Sign in" : "Create account"}
        </span>
      </button>

      <div className="mt-auto pt-8 text-center text-[11px] text-muted-foreground">
        By continuing you agree to LiveSync's terms.
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
        className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
