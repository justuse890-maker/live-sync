import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { useAlerts } from "../lib/useAlerts";
import { tap } from "../lib/feedback";

export function NotificationBell() {
  const { unread } = useAlerts();
  const navigate = useNavigate();
  const prev = useRef(unread);
  const [ring, setRing] = useState(false);

  // Wiggle the bell whenever a new alert arrives.
  useEffect(() => {
    if (unread > prev.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 900);
      prev.current = unread;
      return () => clearTimeout(t);
    }
    prev.current = unread;
  }, [unread]);

  return (
    <button
      onClick={() => { tap(); navigate("/notifications"); }}
      className="relative p-1.5 rounded-lg hover:bg-muted transition active:scale-90"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className={`size-5 text-muted-foreground ${ring ? "ls-bell-ring" : ""}`} />
      {unread > 0 && (
        <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ls-pop">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
