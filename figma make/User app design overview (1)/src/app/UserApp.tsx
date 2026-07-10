import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { BottomNav } from "./components/BottomNav";
import { QuickAdd } from "./components/QuickAdd";
import { ScreenId } from "./components/types";
import { Dashboard } from "./components/screens/Dashboard";
import { Transactions } from "./components/screens/Transactions";
import { Goals } from "./components/screens/Goals";
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
import { StoreProvider } from "./store";
import { EntitlementsProvider } from "./lib/useEntitlements";
import { api } from "./lib/api";

const tabRoots: ScreenId[] = ["dashboard", "transactions", "goals", "coach", "profile"];

export function UserApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api.session().then((s) => setAuthed(!!s));
    const sub = api.onAuth((signedIn) => setAuthed(signedIn));
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="size-full flex items-center justify-center bg-slate-100 p-0 md:p-6">
      <div className="relative w-full h-full md:w-[400px] md:h-[860px] md:rounded-[2.5rem] md:border md:border-slate-300 md:shadow-2xl overflow-hidden bg-background flex flex-col">
        {authed === null ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : authed ? (
          <StoreProvider>
            <EntitlementsProvider>
              <AuthedShell />
            </EntitlementsProvider>
          </StoreProvider>
        ) : (
          <Auth onAuthed={() => setAuthed(true)} />
        )}
      </div>
    </div>
  );
}

function AuthedShell() {
  const navigate = useNavigate();
  const { screen: routeScreen } = useParams<{ screen?: string }>();
  const [addOpen, setAddOpen] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

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
  const activeTab = isTab ? screen : "profile";

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
      {screen === "dashboard" && <Dashboard go={go} />}
      {screen === "transactions" && <Transactions />}
      {screen === "goals" && <Goals />}
      {screen === "coach" && <Coach />}
      {screen === "profile" && <Profile go={go} />}
      {screen === "health" && <Health onBack={onBack} />}
      {screen === "subscriptions" && <Subscriptions onBack={onBack} />}
      {screen === "budgets" && <Budgets onBack={onBack} />}
      {screen === "emergency" && <Emergency onBack={onBack} />}
      {screen === "reports" && <Reports onBack={onBack} />}
      {screen === "loans" && <Loans onBack={onBack} />}
      {screen === "categories" && <Categories onBack={onBack} />}
      {screen === "accounts" && <ConnectedAccounts onBack={onBack} />}
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
      {screen === "leakage" && <WealthLeakage onBack={onBack} />}
      {screen === "inflation" && <LifestyleInflation onBack={onBack} />}
      {screen === "fire" && <FIRE onBack={onBack} />}
      {screen === "simulator" && <Simulator onBack={onBack} />}
      {screen === "import" && <ImportTransactions onBack={onBack} onUpgrade={() => go("pricing")} />}
      {screen === "pricing" && <Pricing onBack={onBack} />}
      {screen === "feedback" && <Feedback onBack={onBack} />}

      <BottomNav active={activeTab} onChange={go} onAdd={() => setAddOpen(true)} />
      <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

const screenIds: ScreenId[] = [
  "dashboard",
  "transactions",
  "goals",
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
