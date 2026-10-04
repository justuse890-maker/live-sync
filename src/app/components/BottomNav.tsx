import { Home, ArrowLeftRight, Target, Sparkles, User, Plus } from "lucide-react";
import { ScreenId } from "./types";
import { hapticLight } from "../lib/native";
import { useTranslation } from "../lib/i18n";

type TabDef = { id: ScreenId; labelKey: string; icon: typeof Home };

const tabs: TabDef[] = [
  { id: "dashboard", labelKey: "nav.home", icon: Home },
  { id: "transactions", labelKey: "nav.activity", icon: ArrowLeftRight },
  { id: "buckets", labelKey: "nav.buckets", icon: Target },
  { id: "coach", labelKey: "nav.coach", icon: Sparkles },
  { id: "profile", labelKey: "nav.profile", icon: User },
];

export function BottomNav({ active, onChange, onAdd, hideFab }: { active: ScreenId; onChange: (id: ScreenId) => void; onAdd: () => void; hideFab?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="bottom-nav relative z-30">
      {!hideFab && <button
        onClick={() => { hapticLight(); onAdd(); }}
        className="absolute bottom-full mb-5 right-7 size-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-slate-900/20 flex items-center justify-center active:scale-90 transition-transform duration-150 z-40"
        aria-label="Quick add transaction"
      >
        <Plus className="size-5" />
      </button>}
      <div className="mx-3 mb-3 rounded-2xl bg-card border border-border px-2 pt-2 pb-2 flex relative z-30 shadow-sm shadow-slate-900/[0.04]">
        {tabs.map((t_tab) => {
          const Icon = t_tab.icon;
          const isActive = active === t_tab.id;
          return (
            <button
              key={t_tab.id}
              onClick={() => { hapticLight(); onChange(t_tab.id); }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all duration-150 active:scale-90 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{t(t_tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
