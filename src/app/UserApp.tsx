import { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Loader2, WifiOff, AlertTriangle } from "lucide-react";
import { BottomNav } from "./components/BottomNav";
import { QuickAdd } from "./components/QuickAdd";
import { InAppBanner } from "./components/InAppBanner";
import { ScreenId } from "./components/types";
import { Dashboard } from "./components/screens/Dashboard";
import { Transactions } from "./components/screens/Transactions";
import { Goals } from "./components/screens/Goals";
import { BucketsList } from "./components/screens/BucketsList";
import { BucketDetail } from "./components/screens/BucketDetail";
import { Coach } from "./components/screens/Coach";
import { Profile } from "./components/screens/Profile";
import { Health } from "./components/screens/Health";
import { Subscriptions } from "./components/screens/Subscriptions";
import { Budgets } from "./components/screens/Budgets";
import { Emergency } from "./components/screens/Emergency";
import { Reports } from "./components/screens/Reports";
import { Loans } from "./components/screens/Loans";
import { Categories } from "./components/screens/Categories";
import { ConnectedAccounts } from "./components/screens/ConnectedAccounts";
import { DocumentVault } from "./components/screens/DocumentVault";
import { TaxAssistant } from "./components/screens/TaxAssistant";
import { Security } from "./components/screens/Security";
import { Privacy } from "./components/screens/Privacy";
import { NetWorth } from "./components/screens/NetWorth";
import { Timeline } from "./components/screens/Timeline";
import { LifeCalendar } from "./components/screens/LifeCalendar";
import { Notifications } from "./components/screens/Notifications";
import { Family } from "./components/screens/Family";
import { CashWallet } from "./components/screens/CashWallet";
import { WealthLeakage } from "./components/screens/WealthLeakage";
import { LifestyleInflation } from "./components/screens/LifestyleInflation";
import { FIRE } from "./components/screens/FIRE";
import { Simulator } from "./components/screens/Simulator";
import { ImportTransactions } from "./components/screens/ImportTransactions";
import { Pricing } from "./components/screens/Pricing";
import { Feedback } from "./components/screens/Feedback";
import { Auth } from "./components/Auth";
import { Onboarding } from "./components/Onboarding";
import { Landing } from "./components/screens/Landing";
import { StoreProvider } from "./store";
import { EntitlementsProvider } from "./lib/useEntitlements";
import { api } from "./lib/api";
import { SIPTracker } from "./components/screens/SIPTracker";
import { Insurance } from "./components/screens/Insurance";
import { Investments } from "./components/screens/Investments";
import { Gold } from "./components/screens/Gold";
import { PropertyScreen } from "./components/screens/Property";
import { CreditScore } from "./components/screens/CreditScore";
import { CreditCards } from "./components/screens/CreditCards";
import { FraudAlerts } from "./components/screens/FraudAlerts";
import { PrivacyPolicy } from "./components/screens/PrivacyPolicy";
import { TermsConditions } from "./components/screens/TermsConditions";
import { ContactUs } from "./components/screens/ContactUs";
import { DataSafety } from "./components/screens/DataSafety";
import { ItrFiling } from "./components/screens/ItrFiling";
import { CloudBackup } from "./components/screens/CloudBackup";
import { SpendingPatterns } from "./components/screens/SpendingPatterns";
import { SavingsFlow } from "./components/screens/SavingsFlow";
import { FigmaFrameDemo } from "./components/figma/FigmaFrameDemo";

const tabRoots: ScreenId[] = ["dashboard", "transactions", "buckets", "coach", "profile"];

/** Global offline + degraded-service banner */
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      className="absolute top-0 inset-x-0 z-[200] flex items-center gap-2 px-4 py-2.5 text-white text-xs"
      style={{ background: "#1e1e2e", fontWeight: 600 }}
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>No internet — some features may not load until you reconnect.</span>
    </div>
  );
}

export function UserApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    // Check if we are in recovery mode (user clicked email link)
    if (window.location.hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }

    api.session().then((s) => setAuthed(!!s));
    const sub = api.onAuth((signedIn) => setAuthed(signedIn));
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  return (
    <div style={{ height: "var(--app-height, 100svh)" }} className="w-full flex items-center justify-center bg-slate-100 p-0 md:p-6">
      <div style={{ height: "var(--app-height, 100svh)" }} className="relative w-full md:w-[400px] md:h-[860px] md:rounded-[2.5rem] md:border md:border-slate-300 md:shadow-2xl overflow-hidden bg-background app-container">
        {authed === null ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recoveryMode ? (
          <UpdatePassword onDone={() => { setRecoveryMode(false); window.location.hash = ""; }} />
        ) : authed ? (
          <StoreProvider>
            <EntitlementsProvider>
              <AuthedShell />
            </EntitlementsProvider>
          </StoreProvider>
        ) : (
          <Landing />
        )}
      </div>
    </div>
  );
}

function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    try {
      await api.updatePassword(password);
      onDone();
    } catch (e: any) {
      setErr(e.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-7 pt-16 pb-8 bg-gradient-to-b from-primary/5 to-background">
      <div className="mb-8 mt-10">
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>
          Update your password
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Please enter your new password below.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>New Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      {err && <div className="mt-3 text-xs text-rose-600 bg-rose-50 rounded-lg p-2.5">{err}</div>}

      <button
        onClick={submit}
        disabled={loading || !password}
        className="w-full mt-6 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ fontWeight: 700 }}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Update password
      </button>
    </div>
  );
}

function AuthedShell() {
  const navigate = useNavigate();
  const { screen: routeScreen, id } = useParams<{ screen?: string; id?: string }>();
  const [addOpen, setAddOpen] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // ─── Hardware back button closes QuickAdd before navigating away ──────
  const openQuickAdd = useCallback(() => {
    if (addOpen) return;
    // Push a dummy history entry so back = close modal
    window.history.pushState({ quickAdd: true }, "");
    setAddOpen(true);
  }, [addOpen]);

  const closeQuickAdd = useCallback(() => {
    if (!addOpen) return;
    setAddOpen(false);
    // Pop the dummy state we pushed (only if it's still there)
    if (window.history.state?.quickAdd) {
      window.history.back();
    }
  }, [addOpen]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // If the modal is open and user pressed back, close it
      if (addOpen) {
        setAddOpen(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [addOpen]);

  useEffect(() => {
    (async () => {
      try {
        const items = await api.list<any>("settings");
        const ob = items.find((s) => s.id === "onboarding");
        setOnboarded(!!ob?.completed);
      } catch {
        setOnboarded(true);
      }
    })();
  }, []);

  const screen = normalizeScreen(routeScreen);
  const go = (id: ScreenId) => navigate(screenPath(id));
  const back = () => navigate(-1);
  const fallbackBack = () => navigate(screenPath("profile"));
  const isTab = tabRoots.includes(screen);
  const activeTab = screen === "goals" ? "buckets" : isTab ? screen : "dashboard";

  if (routeScreen && !isScreenId(routeScreen)) {
    return <Navigate to="/" replace />;
  }

  if (onboarded === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  const onBack = screen === "profile" ? fallbackBack : back;

  return (
    <div className="app-container">
      {/* ── Global offline banner ── */}
      <OfflineBanner />
      {/* ── In-app notification banner ── */}
      <InAppBanner />

      {screen === "dashboard" && <Dashboard go={go} />}
      {screen === "transactions" && <Transactions />}
      {screen === "goals" && <Goals />}
      {screen === "buckets" && !id && <BucketsList onBack={onBack} />}
      {screen === "buckets" && id && <BucketDetail onBack={() => navigate("/buckets")} />}
      {screen === "coach" && <Coach />}
      {screen === "profile" && <Profile go={go} />}
      {screen === "health" && <Health onBack={onBack} />}
      {screen === "subscriptions" && <Subscriptions onBack={onBack} />}
      {screen === "budgets" && <Budgets onBack={onBack} />}
      {screen === "emergency" && <Emergency onBack={onBack} />}
      {screen === "reports" && <Reports onBack={onBack} go={go} />}
      {screen === "loans" && <Loans onBack={onBack} />}
      {screen === "categories" && <Categories onBack={onBack} />}
      {screen === "accounts" && <ConnectedAccounts onBack={onBack} go={go} />}
      {screen === "documents" && <DocumentVault onBack={onBack} />}
      {screen === "tax" && <TaxAssistant onBack={onBack} />}
      {screen === "security" && <Security onBack={onBack} />}
      {screen === "privacy" && <Privacy onBack={onBack} />}
      {screen === "networth" && <NetWorth onBack={onBack} />}
      {screen === "timeline" && <Timeline onBack={onBack} />}
      {screen === "calendar" && <LifeCalendar onBack={onBack} />}
      {screen === "notifications" && <Notifications onBack={onBack} />}
      {screen === "family" && <Family onBack={onBack} />}
      {screen === "cash" && <CashWallet onBack={onBack} />}
      {screen === "leakage" && <WealthLeakage onBack={onBack} onUpgrade={() => go("pricing")} />}
      {screen === "inflation" && <LifestyleInflation onBack={onBack} />}
      {screen === "fire" && <FIRE onBack={onBack} />}
      {screen === "simulator" && <Simulator onBack={onBack} />}
      {screen === "import" && <ImportTransactions onBack={onBack} onUpgrade={() => go("pricing")} />}
      {screen === "pricing" && <Pricing onBack={onBack} />}
      {screen === "feedback" && <Feedback onBack={onBack} />}
      {screen === "sip" && <SIPTracker onBack={onBack} />}
      {screen === "insurance" && <Insurance onBack={onBack} />}
      {screen === "investments" && <Investments onBack={onBack} />}
      {screen === "gold" && <Gold onBack={onBack} />}
      {screen === "property" && <PropertyScreen onBack={onBack} />}
      {screen === "creditscore" && <CreditScore onBack={onBack} />}
      {screen === "cards" && <CreditCards onBack={onBack} />}
      {screen === "fraud" && <FraudAlerts onBack={onBack} />}
      {screen === "itr-filing" && <ItrFiling onBack={onBack} />}
      {screen === "privacy-policy" && <PrivacyPolicy onBack={onBack} />}
      {screen === "terms" && <TermsConditions onBack={onBack} />}
      {screen === "contact" && <ContactUs onBack={onBack} />}
      {screen === "data-safety" && <DataSafety onBack={onBack} onDeleteSuccess={() => { /* api.onAuth listener auto-updates authed */ }} />}
      {screen === "cloud-backup" && <CloudBackup onBack={onBack} />}
      {screen === "spending-patterns" && <SpendingPatterns onBack={onBack} />}
      {screen === "money-flow" && <SavingsFlow onBack={onBack} onUpgrade={() => go("pricing")} />}
      {screen === "figma" && <FigmaFrameDemo />}

      {routeScreen === "figma" ? null : <BottomNav active={activeTab} onChange={go} onAdd={openQuickAdd} />}
      <QuickAdd open={addOpen} onClose={closeQuickAdd} />
    </div>
  );
}

const screenIds: ScreenId[] = [
  "dashboard",
  "transactions",
  "goals",
  "buckets",
  "coach",
  "profile",
  "budgets",
  "subscriptions",
  "health",
  "emergency",
  "reports",
  "review",
  "loans",
  "categories",
  "accounts",
  "documents",
  "tax",
  "security",
  "privacy",
  "networth",
  "timeline",
  "calendar",
  "notifications",
  "family",
  "cash",
  "leakage",
  "inflation",
  "fire",
  "simulator",
  "import",
  "pricing",
  "feedback",
  "sip",
  "insurance",
  "investments",
  "gold",
  "property",
  "creditscore",
  "cards",
  "fraud",
  "itr-filing",
  "privacy-policy",
  "terms",
  "contact",
  "data-safety",
  "cloud-backup",
  "spending-patterns",
  "money-flow",
  "figma",
];

function isScreenId(value: string): value is ScreenId {
  return screenIds.includes(value as ScreenId);
}

function normalizeScreen(value?: string): ScreenId {
  return value && isScreenId(value) ? value : "dashboard";
}

function screenPath(id: ScreenId) {
  return id === "dashboard" ? "/" : `/${id}`;
}
