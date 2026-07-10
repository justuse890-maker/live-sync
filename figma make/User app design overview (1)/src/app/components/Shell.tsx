import { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { user } from "../data";
import { NotificationBell } from "./NotificationBell";

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
};

export function Header({ title, subtitle, showBack, onBack, right }: Omit<Props, "children">) {
  return (
    <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-lg border-b border-border">
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        {showBack ? (
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary text-primary-foreground">{user.initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
          <h1 className="truncate" style={{ fontSize: 20, fontWeight: 700 }}>{title}</h1>
        </div>
        {right ?? <NotificationBell />}
      </div>
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-y-auto pb-28">{children}</div>;
}
