import { Home, ArrowLeftRight, Target, Sparkles, User, Plus } from "lucide-react";
import { ScreenId } from "./types";
import { hapticLight } from "../lib/native";

const tabs: { id: ScreenId; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "transactions", label: "Activity", icon: ArrowLeftRight },
  { id: "buckets", label: "Buckets", icon: Target },
  { id: "coach", label: "Coach", icon: Sparkles },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNav({ active, onChange, onAdd }: { active: ScreenId; onChange: (id: ScreenId) => void; onAdd: () => void }) {
  return (
    <div className="bottom-nav relative z-30">
      <button
        onClick={() => { hapticLight(); onAdd(); }}
        className="absolute bottom-full mb-4 right-4 size-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-90 transition-transform duration-150 z-40"
        aria-label="Quick add transaction"
      >
        <Plus className="size-6" />
      </button>
      <div className="bg-card border-t border-border px-2 pt-2 pb-3 flex relative z-30">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { hapticLight(); onChange(t.id); }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all duration-150 active:scale-90 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

