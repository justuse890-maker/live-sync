import { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { useHasFeature } from "../lib/useEntitlements";

type Props = {
  feature: string;
  title?: string;
  description?: string;
  onUpgrade?: () => void;
  children: ReactNode;
};

export function PremiumLock({ feature, title, description, onUpgrade, children }: Props) {
  const allowed = useHasFeature(feature);
  if (allowed) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-40">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/70 backdrop-blur-[1px]">
        <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-5 shadow-lg text-center space-y-3">
          <div className="size-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
            <Lock className="size-5" />
          </div>
          <div className="text-base font-semibold">{title ?? "Pro feature"}</div>
          <div className="text-sm text-muted-foreground">
            {description ?? "Upgrade to Pro to unlock this feature. Your 7-day trial includes everything."}
          </div>
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              <Sparkles className="size-4" /> Upgrade to Pro · ₹99/mo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
