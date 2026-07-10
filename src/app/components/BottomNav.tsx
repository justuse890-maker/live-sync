import { Home, ArrowLeftRight, Target, Sparkles, User, Plus } from "lucide-react";
import { ScreenId } from "./types";

const tabs: { id: ScreenId; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "transactions", label: "Activity", icon: ArrowLeftRight },
  { id: "goals", label: "Goals", icon: Target },
  { id: "coach", label: "Coach", icon: Sparkles },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNav({ active, onChange, onAdd }: { active: ScreenId; onChange: (id: ScreenId) => void; onAdd: () => void }) {
  return (
    <div className="absolute bottom-0 inset-x-0 z-30">
      <button
        onClick={onAdd}
        className="absolute -top-6 left-1/2 -translate-x-1/2 size-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition"
        aria-label="Quick add transaction"
      >
        <Plus className="size-6" />
      </button>
      <div className="bg-card border-t border-border px-2 pt-2 pb-3 flex">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          const isFabSlot = i === 2;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition ${
                isActive ? "text-primary" : "text-muted-foreground"
              } ${isFabSlot ? "opacity-0 pointer-events-none" : ""}`}
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
