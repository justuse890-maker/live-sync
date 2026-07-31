import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { LiveSyncLogoMark } from "./LiveSyncLogo";

type Profile = {
  id: "onboarding";
  completed: boolean;
  ageBand?: string;
  occupation?: string;
  monthlyIncomeBand?: string;
  primaryGoal?: string;
  goalNote?: string;
  whyApp?: string;
  completedAt?: string;
};

const AGE_BANDS = ["18–24", "25–34", "35–44", "45–54", "55+"];
const OCCUPATIONS = ["Salaried", "Freelancer", "Business owner", "Student", "Homemaker", "Retired", "Other"];
const INCOME_BANDS = ["Under ₹25k", "₹25k–₹50k", "₹50k–₹1L", "₹1L–₹2L", "₹2L–₹5L", "Above ₹5L"];
const GOALS = [
  { key: "wealth", label: "Build long-term wealth", note: "Disciplined investing toward a serious corpus." },
  { key: "fire", label: "Reach financial independence (FIRE)", note: "Replace your salary with passive income." },
  { key: "debt", label: "Get out of debt", note: "Loans, credit cards, EMIs — clear them faster." },
  { key: "buy", label: "Save for a big purchase", note: "Home, car, education, wedding." },
  { key: "spend", label: "Stop overspending", note: "See where money leaks and fix the habit." },
  { key: "plan", label: "Plan retirement", note: "Build the right corpus and withdrawal strategy." },
  { key: "tax", label: "Optimise tax", note: "Pay only what you owe — not a rupee more." },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({ id: "onboarding", completed: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const items = await api.list<Profile>("settings");
        const existing = items.find((s) => s.id === "onboarding");
        if (existing?.completed) onDone();
        else if (existing) setProfile({ ...profile, ...existing });
      } catch (e) {
        console.warn("Onboarding load failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSaving(true);
    try {
      const completed: Profile = { ...profile, id: "onboarding", completed: true, completedAt: new Date().toISOString() };
      await api.create<Profile>("settings", completed);
      onDone();
    } catch (e) {
      console.error("Onboarding save failed:", e);
      alert("Could not save your answers. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-background flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-indigo-600" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {step === 0 && (
          <Welcome onStart={next} />
        )}
        {step === 1 && (
          <Picker
            title="Which life stage are you in?"
            subtitle="Helps us tune the math to your reality."
            value={profile.ageBand}
            options={AGE_BANDS}
            onChange={(v) => setProfile({ ...profile, ageBand: v })}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 2 && (
          <Picker
            title="What do you do for a living?"
            subtitle="Income patterns differ by work type — we'll adapt."
            value={profile.occupation}
            options={OCCUPATIONS}
            onChange={(v) => setProfile({ ...profile, occupation: v })}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 3 && (
          <Picker
            title="Roughly what's your monthly income?"
            subtitle="This stays on your account. We use it to size goals and tax estimates — not to judge."
            value={profile.monthlyIncomeBand}
            options={INCOME_BANDS}
            onChange={(v) => setProfile({ ...profile, monthlyIncomeBand: v })}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 4 && (
          <GoalAndIntent
            profile={profile}
            setProfile={setProfile}
            onBack={back}
            onFinish={finish}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center pt-10 space-y-5">
      <div className="size-16 rounded-2xl bg-white shadow-xl border border-slate-100 p-2.5 flex items-center justify-center">
        <LiveSyncLogoMark className="size-full" />
      </div>
      <div>
        <h1 className="text-2xl font-bold font-display mb-1">
          Welcome to LiveSync <span className="text-[#0066FF]">AI</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Four quick questions — about 30 seconds — so the app meets you where you are. You can change any answer later in Settings.
        </p>
      </div>
      <div className="text-left bg-muted/40 rounded-2xl p-4 max-w-xs text-xs space-y-2">
        <Bullet>Personalised goal sizing and tax math</Bullet>
        <Bullet>Offers and tips matched to your situation</Bullet>
        <Bullet>Your data stays on your device first</Bullet>
      </div>
      <button onClick={onStart} className="w-full max-w-xs h-11 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 inline-flex items-center justify-center gap-2">
        Get started <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="size-3.5 mt-0.5 text-emerald-500 shrink-0" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function Picker({ title, subtitle, value, options, onChange, onNext, onBack }: { title: string; subtitle: string; value?: string; options: string[]; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="pt-4 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${value === o ? "border-indigo-500 bg-indigo-500/5 text-foreground" : "border-border hover:bg-muted/40"}`}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontWeight: 500 }}>{o}</span>
              {value === o && <Check className="size-4 text-indigo-500" />}
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">Back</button>
        <button onClick={onNext} disabled={!value} className="flex-[2] h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          Continue <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function GoalAndIntent({ profile, setProfile, onBack, onFinish, saving }: { profile: Profile; setProfile: React.Dispatch<React.SetStateAction<Profile>>; onBack: () => void; onFinish: () => void; saving: boolean }) {
  const canFinish = !!profile.primaryGoal;
  return (
    <div className="pt-4 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">What matters most right now?</h2>
        <p className="text-sm text-muted-foreground mt-1">Pick your primary goal. The whole app prioritises this.</p>
      </div>
      <div className="space-y-2">
        {GOALS.map((g) => {
          const active = profile.primaryGoal === g.key;
          return (
            <button
              type="button"
              key={g.key}
              onClick={() => setProfile((p) => ({ ...p, primaryGoal: g.key }))}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${active ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:bg-muted/40"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm" style={{ fontWeight: 600 }}>{g.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{g.note}</div>
                </div>
                {active && <Check className="size-4 text-indigo-500 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <label className="block text-sm font-medium mb-1">In your own words — why are you using LiveSync? <span className="text-muted-foreground font-normal">(optional)</span></label>
        <textarea
          value={profile.whyApp || ""}
          onChange={(e) => {
            const v = e.target.value;
            setProfile((p) => ({ ...p, whyApp: v }));
          }}
          rows={3}
          placeholder="e.g. I keep saving but never know if it's enough. I want a clear plan."
          className="w-full bg-card border border-border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
        />
        <div className="text-[11px] text-muted-foreground mt-1">Honest is better than polished. Helps us tune the AI coach.</div>
      </div>

      <div className="flex gap-2 pt-2 pb-4">
        <button type="button" onClick={onBack} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">Back</button>
        <button type="button" onClick={onFinish} disabled={!canFinish || saving} className="flex-[2] h-11 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Start using LiveSync
        </button>
      </div>
    </div>
  );
}
