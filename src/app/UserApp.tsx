import { useEffect, useState, useCallback, useRef } from "react";
import { Navigate, useNavigate, useNavigationType, useParams } from "react-router";
import { Toaster } from "sonner";
import { Loader2, WifiOff, RefreshCw } from "lucide-react";
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
import { Staff } from "./components/screens/Staff";
import { Society } from "./components/screens/Society";
import { Reminders } from "./components/screens/Reminders";
import { Household } from "./components/screens/Household";
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
import { StoreProvider, useStore } from "./store";
import { EntitlementsProvider } from "./lib/useEntitlements";
import { api } from "./lib/api";
import { SIPTracker } from "./components/screens/SIPTracker";
import { ChitFunds } from "./components/screens/ChitFunds";
import { CALens } from "./components/screens/CALens";
import { AiSettings } from "./components/screens/AiSettings";
import { PasteMessages } from "./components/screens/PasteMessages";
import { listenForShares } from "./lib/shareTarget";
import { ReminderOffer } from "./components/ReminderOffer";
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
import { LanguageSettings } from "./components/screens/LanguageSettings";
import { NotesScreen } from "./components/screens/NotesScreen";
import { FeedbackLayer } from "./components/FeedbackLayer";
import { LanguageProvider } from "./lib/i18n";
import { exitApp, initBackButton, initDeepLinks } from "./lib/native";
import { notify } from "./lib/notify";
import { showBanner } from "./components/InAppBanner";
import { loadAuthSession, saveAuthSession } from "./lib/localCache";
import { drainOfflineQueue } from "./store";
import { PromoCelebration, usePromoCelebration } from "./components/PromoCelebration";
import { useEntitlements } from "./lib/useEntitlements";

const tabRoots: ScreenId[] = ["dashboard", "transactions", "buckets", "coach", "profile"];

/** Global offline banner — shown when device has no connectivity */
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      setSyncing(true);
      drainOfflineQueue().finally(() => setSyncing(false));
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline && !syncing) return null;

  if (syncing) {
    return (
      <div
        className="absolute top-0 inset-x-0 z-[200] flex items-center gap-2 px-4 py-2 text-white text-xs safe-top"
        style={{ background: "#1d6a3a", fontWeight: 600 }}
      >
        <RefreshCw className="size-3 shrink-0 animate-spin" />
        <span>Back online</span>
      </div>
    );
  }

  return (
    <div
      className="absolute top-0 inset-x-0 z-[200] flex items-center gap-2 px-4 py-2.5 text-white text-xs safe-top"
      style={{ background: "#243B7A", fontWeight: 600 }}
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>Offline — everything still works and saves on this phone. Only AI Coach needs internet.</span>
    </div>
  );
}

export function UserApp() {
  const navigate = useNavigate();
  const { screen: routeScreen } = useParams<{ screen?: string }>();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  // Password-reset e-mail links: the APK receives them as a deep link, the web build as a PASSWORD_RECOVERY event.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    initDeepLinks(async (url) => {
      const result = await api.handleAuthLink(url);
      if (result?.kind === "recovery") setRecoveryMode(true);
      else if (result?.kind === "error") notify.error("Reset link problem", result.message);
    }).then((off) => { if (cancelled) off?.(); else stop = off; });
    const sub = api.onPasswordRecovery(() => setRecoveryMode(true));
    return () => { cancelled = true; stop?.(); sub.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    // Check if we are in recovery mode (user clicked email link)
    if (window.location.hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }

    // ── Instant auth from IndexedDB cache (no network needed) ────────────────
    // Show home immediately if we have a cached session,
    // then validate with Supabase in the background.
    loadAuthSession().then((cached) => {
      if (cached) {
        setAuthed(true); // instant — no spinner for returning users
      }
      // Always validate with Supabase (refreshes token, handles sign-out)
      api.session().then((live) => {
        if (live) {
          setAuthed(true);
          saveAuthSession(live).catch(() => {});
        } else {
          // No live session — only show login if we also have no cache
          if (!cached) setAuthed(false);
          // If we had a cached session but no live session, keep showing
          // the app for now (offline) — it will be cleared on next sign-out
        }
      }).catch(() => {
        // Network error — if we had cache, stay logged in offline
        if (!cached) setAuthed(false);
      });
    }).catch(() => {
      api.session().then((s) => setAuthed(!!s)).catch(() => setAuthed(false));
    });

    // Drain any queued offline ops from previous session
    if (navigator.onLine) {
      drainOfflineQueue().catch(() => {});
    }

    const sub = api.onAuth((signedIn) => setAuthed(signedIn));
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  return (
    <div style={{ height: "var(--app-height, 100svh)" }} className="w-full flex items-center justify-center bg-slate-100 p-0 md:p-6">
      <div className="h-full md:h-[860px] relative w-full md:w-[400px] md:rounded-[2.5rem] md:border md:border-slate-300 md:shadow-2xl overflow-hidden bg-background app-container flex flex-col">
        {authed === null ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recoveryMode ? (
          <UpdatePassword onDone={() => { setRecoveryMode(false); window.location.hash = ""; }} />
        ) : authed ? (
          <LanguageProvider>
            <StoreProvider>
              <EntitlementsProvider>
                <AuthedShell />
              </EntitlementsProvider>
            </StoreProvider>
          </LanguageProvider>
        ) : routeScreen === "privacy-policy" ? (
          <PrivacyPolicy onBack={() => navigate("/")} />
        ) : routeScreen === "terms" ? (
          <TermsConditions onBack={() => navigate("/")} />
        ) : routeScreen === "contact" ? (
          <ContactUs onBack={() => navigate("/")} />
        ) : (
          <Landing />
        )}
      </div>
    </div>
  );
}

function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = password.length >= 8 && password === confirm;

  const submit = async () => {
    setLoading(true);
    setErr(null);
    try {
      await api.updatePassword(password);
      notify.success("Password updated", "You're signed in with your new password.");
      onDone();
    } catch (e: any) {
      const msg = /same password|different from the old/i.test(e?.message || "")
        ? "Choose a password you haven't used before."
        : e?.message || "Failed to update password";
      setErr(msg);
      notify.error("Could not update password", msg);
    } finally {
      setLoading(false);
    }
  };

  const input = "mt-1.5 w-full bg-card border border-border rounded-xl px-4 py-3 text-[14.5px] outline-none placeholder:text-slate-400";
  return (
    <div className="flex-1 flex flex-col px-7 pt-16 pb-8 bg-background fade-up">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary">
        <span className="size-3.5 rounded-full bg-white" />
      </span>
      <div className="mb-8 mt-8">
        <h1 className="display-tight" style={{ fontSize: 30, fontWeight: 700 }}>Set a new password</h1>
        <p className="text-sm text-muted-foreground mt-2">Choose a strong password you don't use anywhere else.</p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-semibold text-slate-700">New password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={input} />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-slate-700">Confirm password</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className={input} />
          {confirm && password !== confirm && <span className="mt-1.5 block text-xs text-rose-600">Passwords don't match.</span>}
        </label>
      </div>

      {err && <div role="alert" className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl p-3">{err}</div>}

      <button
        onClick={submit}
        disabled={loading || !valid}
        className="w-full mt-6 bg-primary text-primary-foreground rounded-full py-3.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Update password
      </button>
    </div>
  );
}

function AuthedShell() {
  const navigate = useNavigate();
  const navType = useNavigationType();
  const { screen: routeScreen, id } = useParams<{ screen?: string; id?: string }>();
  const [addOpen, setAddOpen] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const exitArmedAt = useRef(0);

  // ── Promo celebration ───────────────────────────────────────────────
  const { isPromoUser, promoDaysLeft, loading: entLoading } = useEntitlements();
  const { show: showPromo, dismiss: dismissPromo } = usePromoCelebration(
    isPromoUser, promoDaysLeft, entLoading
  );

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
        // Existing users whose settings haven't reached this device yet (e.g. first
        // launch after the on-device update while offline) shouldn't be re-onboarded.
        const hasData = ob?.completed ? true : (await api.list<any>("transactions")).length > 0;
        setOnboarded(!!ob?.completed || hasData);
      } catch {
        setOnboarded(true);
      }
    })();
  }, []);

  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  // Re-schedule device notifications whenever anything with a due date changes.
  const [reminderPrefsTick, setReminderPrefsTick] = useState(0);
  useEffect(() => {
    const on = () => setReminderPrefsTick((n) => n + 1);
    window.addEventListener("ls-reminder-prefs", on);
    return () => window.removeEventListener("ls-reminder-prefs", on);
  }, []);
  useEffect(() => {
    if (!store.ready) return;
    import("./lib/notifications").then((m) => m.syncNotifications(store));
  }, [reminderPrefsTick, 
    store.ready, store.notes, store.structuredLoans, store.subscriptions, store.creditCards, store.insurance,
    store.householdReminders, store.societyNotices, store.loans, store.notificationSound,
  ]);

  // Listeners (tap → deep link, foreground banner) + in-app ticker for due reminders.
  useEffect(() => {
    if (!store.ready) return;
    let stop: (() => void) | undefined;
    import("./lib/notifications").then(async (m) => {
      await m.initNotificationListeners((path) => navigate(path));
      stop = m.startReminderTicker(() => storeRef.current, (o) => navigate(o.noteId ? `/notes?note=${o.noteId}` : `/${o.screen}`));
      // First time the user has something to be reminded about, ask once.
      try {
        if (!localStorage.getItem("ls_notif_asked")) {
          const { buildObligations } = await import("./lib/obligations");
          if (buildObligations(storeRef.current, 45).length > 0 && (await m.getNotificationPermission()) === "prompt") {
            localStorage.setItem("ls_notif_asked", "1");
            await m.requestNotificationPermission();
            m.syncNotifications(storeRef.current);
          }
        }
      } catch {}
    });
    return () => stop?.();
  }, [store.ready]);

  const screen = normalizeScreen(routeScreen);
  const go = (id: ScreenId) => navigate(screenPath(id));
  const back = () => navigate(-1);
  const fallbackBack = () => navigate(screenPath("profile"));
  const isTab = tabRoots.includes(screen);
  const activeTab = screen === "goals" ? "buckets" : isTab ? screen : "dashboard";

  // Text shared into LiveSync from another app (a bank alert) opens the review screen. Nothing is saved without a tap.
  useEffect(() => listenForShares(() => navigate(screenPath("paste"))), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep Android back inside the product. A modal closes first, then a screen
  // navigates back; the home screen requires a deliberate second press to exit.
  useEffect(() => {
    let remove: (() => Promise<void>) | undefined;
    let disposed = false;
    const handleHardwareBack = () => {
      if (addOpen) {
        closeQuickAdd();
        return;
      }
      if (screen !== "dashboard") {
        navigate(-1);
        return;
      }
      const now = Date.now();
      if (now - exitArmedAt.current < 2200) {
        void exitApp();
        return;
      }
      exitArmedAt.current = now;
      showBanner({ title: "Press back again to exit", body: "Your data is saved safely.", tint: "#94A3B8" });
    };
    void initBackButton(handleHardwareBack).then((cleanup) => {
      if (disposed) void cleanup?.();
      else remove = cleanup;
    });
    return () => { disposed = true; void remove?.(); };
  }, [addOpen, closeQuickAdd, navigate, screen]);

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
    <>
      {/* ── Launch celebration (shows once for new users) ── */}
      {showPromo && (
        <PromoCelebration daysLeft={promoDaysLeft} onDismiss={dismissPromo} />
      )}

      {/* ── Global offline banner ── */}
      <OfflineBanner />
      {/* ── In-app notification banner ── */}
      <InAppBanner />
      <Toaster position="top-center" offset={14} closeButton visibleToasts={3} toastOptions={{ classNames: { toast: "!rounded-2xl !border !border-border !bg-card !text-foreground", title: "!font-semibold", description: "!text-muted-foreground" } }} />

      {/* Direction-aware page transition: tabs fade up, drilling in slides from the right, back slides from the left. */}
      <div key={`${screen}/${id ?? ""}`} className={`page-transition ${isTab ? "pt-fade" : navType === "POP" ? "pt-back" : "pt-forward"}`}>
      {screen === "dashboard" && <Dashboard go={go} onAdd={openQuickAdd} />}
      {screen === "household" && <Household onBack={onBack} go={go} />}
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
      {screen === "staff" && <Staff onBack={onBack} />}
      {screen === "society" && <Society onBack={onBack} />}
      {screen === "reminders" && <Reminders onBack={onBack} />}
      {screen === "cash" && <CashWallet onBack={onBack} />}
      {screen === "leakage" && <WealthLeakage onBack={onBack} onUpgrade={() => go("pricing")} />}
      {screen === "inflation" && <LifestyleInflation onBack={onBack} />}
      {screen === "fire" && <FIRE onBack={onBack} />}
      {screen === "simulator" && <Simulator onBack={onBack} />}
      {screen === "import" && <ImportTransactions onBack={onBack} onUpgrade={() => go("pricing")} />}
      {screen === "pricing" && <Pricing onBack={onBack} />}
      {screen === "feedback" && <Feedback onBack={onBack} />}
      {screen === "sip" && <SIPTracker onBack={onBack} />}
      {screen === "chits" && <ChitFunds onBack={onBack} />}
      {screen === "calens" && <CALens onBack={onBack} go={go} />}
      {screen === "ai-settings" && <AiSettings onBack={onBack} />}
      {screen === "paste" && <PasteMessages onBack={onBack} />}
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
      {screen === "language-settings" && <LanguageSettings onBack={onBack} />}
      {screen === "notes" && <NotesScreen onBack={onBack} />}
      {screen === "figma" && <FigmaFrameDemo />}
      </div>

      {routeScreen === "figma" ? null : <BottomNav active={activeTab} onChange={go} onAdd={openQuickAdd} hideFab={screen === "notes"} />}
      <QuickAdd open={addOpen} onClose={closeQuickAdd} />
      <ReminderOffer />
      <FeedbackLayer />
    </>
  );
}

const screenIds: ScreenId[] = [
  "dashboard",
  "household",
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
  "staff",
  "society",
  "reminders",
  "cash",
  "leakage",
  "inflation",
  "fire",
  "simulator",
  "import",
  "pricing",
  "feedback",
  "sip",
  "chits",
  "calens",
  "ai-settings",
  "paste",
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
  "language-settings",
  "notes",
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
