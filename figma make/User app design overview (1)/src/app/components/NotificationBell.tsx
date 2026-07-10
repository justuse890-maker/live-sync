import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";

type Notif = { id: string; title: string; body?: string; kind: string; at: string; read: boolean };

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const navigate = useNavigate();

  async function load() {
    try { setItems(await api.notifications()); } catch (e) { console.warn("notifications load failed", e); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative p-1.5 rounded-lg hover:bg-muted transition"
      aria-label="Notifications"
    >
      <Bell className="size-5 text-muted-foreground" />
      {unread > 0 && (
        <span className="absolute top-0 right-0 size-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
