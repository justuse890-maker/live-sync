import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, Users as UsersIcon, Tag, Gift, LogOut, ShieldCheck, MessageSquare } from "lucide-react";
import { supabase, adminApi } from "../lib/adminApi";
import { AdminAuth } from "./AdminAuth";
import { Overview } from "./screens/Overview";
import { Users } from "./screens/Users";
import { UserDetail } from "./screens/UserDetail";
import { Plans } from "./screens/Plans";
import { Offers } from "./screens/Offers";
import { AdminFeedback } from "./screens/Feedback";

type Tab = "overview" | "users" | "plans" | "offers" | "feedback";

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string } | null>(null);

  async function verify() {
    try {
      const { data } = await supabase().auth.getSession();
      if (!data.session) { setAuthed(false); return; }
      const r = await adminApi.me();
      setMe({ email: r.email });
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }

  useEffect(() => { verify(); }, []);

  async function signOut() {
    await supabase().auth.signOut();
    setAuthed(false);
    setMe(null);
  }

  if (authed === null) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!authed) return <AdminAuth onAuthed={verify} />;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><ShieldCheck className="size-4" /></div>
          <div>
            <div className="text-sm font-semibold">LiveSync Admin</div>
            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{me?.email}</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem active={tab === "overview"} onClick={() => { setTab("overview"); setUserId(null); }} icon={<LayoutDashboard className="size-4" />} label="Overview" />
          <NavItem active={tab === "users"} onClick={() => { setTab("users"); setUserId(null); }} icon={<UsersIcon className="size-4" />} label="Users" />
          <NavItem active={tab === "plans"} onClick={() => { setTab("plans"); setUserId(null); }} icon={<Tag className="size-4" />} label="Plans" />
          <NavItem active={tab === "offers"} onClick={() => { setTab("offers"); setUserId(null); }} icon={<Gift className="size-4" />} label="Offers" />
          <NavItem active={tab === "feedback"} onClick={() => { setTab("feedback"); setUserId(null); }} icon={<MessageSquare className="size-4" />} label="Feedback" />
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition">
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {tab === "overview" && <Overview />}
        {tab === "users" && !userId && <Users onOpen={(id) => setUserId(id)} />}
        {tab === "users" && userId && <UserDetail id={userId} onBack={() => setUserId(null)} />}
        {tab === "plans" && <Plans />}
        {tab === "offers" && <Offers />}
        {tab === "feedback" && <AdminFeedback />}
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${active ? "bg-indigo-500/15 text-indigo-200" : "text-slate-300 hover:bg-slate-800"}`}
    >
      {icon} {label}
    </button>
  );
}
