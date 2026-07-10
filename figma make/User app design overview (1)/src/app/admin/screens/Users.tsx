import { useEffect, useState } from "react";
import { Loader2, Search, Tag, Gift } from "lucide-react";
import { adminApi, AdminUser } from "../lib/adminApi";

export function Users({ onOpen }: { onOpen: (id: string) => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { adminApi.users().then(setUsers).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="text-rose-400 text-sm">Failed to load users: {err}</div>;
  if (!users) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="size-4 animate-spin" /> Loading users…</div>;

  const filtered = q
    ? users.filter((u) => (u.email + " " + (u.name || "")).toLowerCase().includes(q.toLowerCase()))
    : users;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-slate-400">{users.length} total · click a row to manage plan & offers.</p>
        </div>
        <label className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 w-full sm:w-72">
          <Search className="size-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name"
            className="bg-transparent text-sm flex-1 focus:outline-none text-slate-100 placeholder:text-slate-500"
          />
        </label>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-right px-4 py-3">Features</th>
              <th className="text-right px-4 py-3">Txns</th>
              <th className="text-left px-4 py-3">Offer</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => onOpen(u.id)}
                className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer transition"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">{u.name || u.email.split("@")[0]}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  {u.planId ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full">
                      <Tag className="size-3" /> {u.planId}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Free</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{u.featureCount}</td>
                <td className="px-4 py-3 text-right text-slate-300">{u.txCount}</td>
                <td className="px-4 py-3">
                  {u.hasOffer && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full">
                      <Gift className="size-3" /> Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No users match "{q}".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
