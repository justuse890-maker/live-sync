import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Search, Plus, Pin, PinOff, Bell, BellRing, Repeat as RepeatIcon, CheckSquare, Square, Receipt, Palette,
  Archive, ArchiveRestore, Trash2, X, ChevronLeft, StickyNote, ListChecks, IndianRupee, Clock, CheckCircle2, SkipForward, Lock,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import {
  Note, NoteColor, NOTE_COLORS, Repeat, REPEAT_LABEL, BILL_TEMPLATES, formatReminder, isBill, skipCycle, emptyNote,
} from "../../lib/notes";
import { daysUntil } from "../../lib/obligations";
import { feedback, tap } from "../../lib/feedback";
import { getNotificationPermission, requestNotificationPermission } from "../../lib/notifications";

type Tab = "notes" | "reminders" | "bills" | "archive";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function NotesScreen({ onBack }: { onBack: () => void }) {
  const { notes, upsertNote, removeNote, payBill, categories } = useStore();
  const [params] = useSearchParams();
  const handledRef = useRef("");
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "notes");
  const [q, setQ] = useState("");
  const [editing, setEditingState] = useState<Note | null>(null);
  const draftRef = useRef<Note | null>(null);
  const closingRef = useRef(false);

  // Open the editor as its own history entry so the phone's Back button
  // saves & closes the note (like Google Keep) instead of leaving the screen.
  const setEditing = (n: Note | null) => {
    if (n && !editingRef.current) window.history.pushState({ noteEditor: true }, "");
    draftRef.current = n;
    setEditingState(n);
  };
  const editingRef = useRef<Note | null>(null);
  editingRef.current = editing;

  useEffect(() => {
    const onPop = () => {
      if (closingRef.current) { closingRef.current = false; return; }
      if (editingRef.current && draftRef.current) void save(draftRef.current, true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  // Deep links: ?new=bill | ?new=reminder | ?note=<id>
  useEffect(() => {
    const n = params.get("new");
    const id = params.get("note");
    const sig = params.toString();
    if (!sig || handledRef.current === sig) return;
    if (n) {
      handledRef.current = sig;
      openNew(n === "bill" ? "bill" : n === "reminder" ? "reminder" : "note");
    } else if (id) {
      const found = notes.find((x) => x.id === id);
      if (found) { handledRef.current = sig; setEditing(found); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, notes.length]);

  function openNew(kind: "note" | "checklist" | "bill" | "reminder") {
    tap();
    const tomorrow9 = new Date();
    tomorrow9.setDate(tomorrow9.getDate() + 1);
    tomorrow9.setHours(9, 0, 0, 0);
    setEditing(emptyNote({
      checklist: kind === "checklist" ? [{ id: crypto.randomUUID(), text: "", done: false }] : undefined,
      amount: kind === "bill" ? 0 : undefined,
      color: kind === "bill" ? "fog" : "default",
      reminder: kind === "bill" || kind === "reminder" ? { at: tomorrow9.toISOString(), repeat: kind === "bill" ? "monthly" : "none" } : undefined,
    }));
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (tab === "archive") return n.archived;
        if (n.archived) return false;
        if (tab === "reminders") return !!n.reminder;
        if (tab === "bills") return isBill(n);
        return true;
      })
      .filter((n) => !needle || `${n.title} ${n.body} ${(n.checklist || []).map((c) => c.text).join(" ")} ${n.category || ""}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (tab === "reminders" || tab === "bills") {
          return new Date(a.reminder?.at || 8e15).getTime() - new Date(b.reminder?.at || 8e15).getTime();
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, tab, q]);

  const pinned = tab === "notes" ? filtered.filter((n) => n.pinned) : [];
  const others = tab === "notes" ? filtered.filter((n) => !n.pinned) : filtered;
  const billsThisMonth = notes.filter((n) => isBill(n) && !n.archived && n.reminder && daysUntil(new Date(n.reminder.at)) <= 30);
  const billsTotal = billsThisMonth.reduce((a, n) => a + (n.amount || 0), 0);

  const closeEditor = (fromHistory: boolean) => {
    draftRef.current = null;
    setEditingState(null);
    if (!fromHistory && window.history.state?.noteEditor) {
      closingRef.current = true;
      window.history.back();
    }
  };

  const save = async (n: Note, fromHistory = false) => {
    const empty = !n.title.trim() && !n.body.trim() && !(n.checklist || []).some((c) => c.text.trim()) && !isBill(n);
    if (empty) { closeEditor(fromHistory); return; }
    const isNew = !n.id;
    if (isBill(n) || n.amount !== undefined) {
      if (!n.title.trim()) n = { ...n, title: n.category && n.category !== "Other" ? `${n.category} bill` : "Bill" };
    }
    if (n.reminder && n.reminder.repeat === "monthly") n = { ...n, dueDay: new Date(n.reminder.at).getDate() };
    await upsertNote({ ...n, id: n.id || undefined, checklist: n.checklist?.filter((c) => c.text.trim() || !isNew) });
    closeEditor(fromHistory);
    feedback({
      kind: "success",
      title: isNew ? (isBill(n) ? "Bill added" : n.reminder ? "Reminder set" : "Note saved") : "Saved",
      subtitle: n.reminder ? `${formatReminder(n.reminder.at)}${n.reminder.repeat !== "none" ? ` · ${REPEAT_LABEL[n.reminder.repeat]}` : ""}` : undefined,
    });
    if (n.reminder) {
      const p = await getNotificationPermission();
      if (p === "prompt") await requestNotificationPermission();
    }
  };

  return (
    <>
      <Header title="Notes & reminders" subtitle="Bills, home expenses & to-dos" showBack onBack={onBack} right={<div className="w-1" />} />
      <Screen>
        <div className="px-4 pt-1 pb-36">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2.5 shadow-xs">
            <Search className="size-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your notes" className="flex-1 bg-transparent text-sm outline-none" />
            {q && <button onClick={() => setQ("")}><X className="size-4 text-slate-400" /></button>}
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {([
              ["notes", "Notes", StickyNote],
              ["reminders", "Reminders", Bell],
              ["bills", "Bills", Receipt],
              ["archive", "Archive", Archive],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => { tap(); setTab(id); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition active:scale-95 ${tab === id ? "bg-[#0F172A] text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          {tab === "bills" && billsThisMonth.length > 0 && (
            <div className="mt-3 rounded-2xl p-3.5 bg-indigo-50 border border-indigo-100 flex items-center justify-between ls-rise">
              <div>
                <div className="text-[11px] font-semibold text-indigo-700">Next 30 days</div>
                <div className="text-lg font-black text-slate-900">{inr(billsTotal)}</div>
              </div>
              <div className="text-xs text-indigo-700 font-semibold">{billsThisMonth.length} bills</div>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyNotes tab={tab} onNew={openNew} searching={!!q} />
          ) : (
            <>
              {pinned.length > 0 && <SectionLabel>Pinned</SectionLabel>}
              {pinned.length > 0 && <Grid notes={pinned} onOpen={setEditing} onPay={(id) => payBill(id)} />}
              {pinned.length > 0 && others.length > 0 && <SectionLabel>Others</SectionLabel>}
              <Grid notes={others} onOpen={setEditing} onPay={(id) => payBill(id)} list={tab === "reminders" || tab === "bills"} />
            </>
          )}

          <div className="text-[10px] text-center text-slate-400 mt-6 flex items-center justify-center gap-1"><Lock className="size-3" /> Notes are stored only on this phone</div>
        </div>
      </Screen>

      {/* Keep-style bottom bar */}
      {!editing && (
        <div className="absolute inset-x-0 bottom-24 z-30 px-4">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-900/10 p-1.5">
            <button onClick={() => openNew("note")} className="flex-1 text-left px-3 py-2 text-sm text-slate-500 font-medium active:scale-[0.99]">Take a note…</button>
            <IconBtn label="Checklist" onClick={() => openNew("checklist")}><ListChecks className="size-5" /></IconBtn>
            <IconBtn label="Bill" onClick={() => openNew("bill")}><Receipt className="size-5" /></IconBtn>
            <IconBtn label="Reminder" onClick={() => openNew("reminder")}><BellRing className="size-5" /></IconBtn>
          </div>
        </div>
      )}

      {editing && (
        <NoteEditor
          note={editing}
          categories={categories}
          onChange={(d) => { draftRef.current = d; }}
          onClose={(d) => save(d)}
          onDelete={async (id) => { await removeNote(id); closeEditor(false); feedback({ kind: "success", title: "Note deleted" }); }}
          onPay={async (d) => { await upsertNote(d); await payBill(d.id); closeEditor(false); }}
          onSkip={async (d) => { await upsertNote(skipCycle(d)); closeEditor(false); feedback({ kind: "success", title: "Skipped this cycle", subtitle: "Next reminder scheduled" }); }}
        />
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2 px-1">{children}</div>;
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="size-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-90 transition">
      {children}
    </button>
  );
}

function Grid({ notes, onOpen, onPay, list }: { notes: Note[]; onOpen: (n: Note) => void; onPay: (id: string) => void; list?: boolean }) {
  return (
    <div className={list ? "space-y-2.5 mt-3" : "columns-2 gap-2.5 mt-3 [&>*]:mb-2.5"}>
      {notes.map((n, i) => <NoteCard key={n.id} n={n} i={i} onOpen={() => { tap(); onOpen(n); }} onPay={() => onPay(n.id)} />)}
    </div>
  );
}

function NoteCard({ n, i, onOpen, onPay }: { n: Note; i: number; onOpen: () => void; onPay: () => void }) {
  const c = NOTE_COLORS[n.color] || NOTE_COLORS.default;
  const due = n.reminder ? new Date(n.reminder.at) : null;
  const overdue = !!due && due.getTime() < Date.now();
  const bill = isBill(n);
  return (
    <div
      onClick={onOpen}
      role="button"
      style={{ background: c.bg, borderColor: c.border, animationDelay: `${Math.min(i, 10) * 30}ms` }}
      className="break-inside-avoid rounded-2xl border p-3.5 cursor-pointer active:scale-[0.98] transition ls-rise"
    >
      <div className="flex items-start gap-2">
        {n.title && <div translate="no" className="flex-1 text-sm font-bold text-slate-900 leading-snug">{n.title}</div>}
        {n.pinned && <Pin className="size-3.5 text-slate-500 shrink-0 mt-0.5" />}
      </div>
      {n.body && <p translate="no" className="text-[13px] text-slate-700 mt-1 whitespace-pre-wrap line-clamp-6 leading-snug">{n.body}</p>}
      {n.checklist && n.checklist.length > 0 && (
        <div translate="no" className="mt-1.5 space-y-0.5">
          {n.checklist.slice(0, 5).map((it) => (
            <div key={it.id} className={`flex items-center gap-1.5 text-[13px] ${it.done ? "line-through text-slate-400" : "text-slate-700"}`}>
              {it.done ? <CheckSquare className="size-3.5 shrink-0" /> : <Square className="size-3.5 shrink-0" />}
              <span className="truncate">{it.text}</span>
            </div>
          ))}
          {n.checklist.length > 5 && <div className="text-[11px] text-slate-500">+{n.checklist.length - 5} more</div>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {bill && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-white/70 border border-black/5 rounded-full px-2 py-0.5">
            <IndianRupee className="size-3" />{Math.round(n.amount || 0).toLocaleString("en-IN")}
          </span>
        )}
        {due && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 border ${overdue ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-white/70 text-slate-700 border-black/5"}`}>
            <Clock className="size-3" />{formatReminder(n.reminder!.at)}
            {n.reminder!.repeat !== "none" && <RepeatIcon className="size-3" />}
          </span>
        )}
      </div>
      {bill && due && !n.archived && daysUntil(due) <= 5 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPay(); }}
          className="mt-2.5 w-full text-xs font-bold bg-[#0F172A] text-white rounded-xl py-2 active:scale-95 flex items-center justify-center gap-1"
        >
          <CheckCircle2 className="size-3.5" /> Mark paid
        </button>
      )}
    </div>
  );
}

function EmptyNotes({ tab, onNew, searching }: { tab: Tab; onNew: (k: "note" | "bill" | "reminder") => void; searching: boolean }) {
  if (searching) return <div className="py-16 text-center text-sm text-slate-500">No matching notes</div>;
  if (tab === "bills") {
    return (
      <div className="mt-4">
        <div className="text-center py-6">
          <Receipt className="size-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold mt-2">No bills yet</div>
          <div className="text-xs text-slate-500 mt-1">Add what you pay every month — we'll remind you a day before and on the due date.</div>
        </div>
        <div className="text-center">
          <button onClick={() => onNew("bill")} className="text-xs font-bold text-white bg-[#0F172A] px-4 py-2 rounded-full active:scale-95"><Plus className="size-3.5 inline -mt-0.5" /> Add a bill</button>
        </div>
      </div>
    );
  }
  const map = {
    notes: { icon: StickyNote, title: "Notes you add appear here", sub: "Groceries to buy, home repair costs, things to pay — jot them down." },
    reminders: { icon: Bell, title: "No reminders", sub: "Add a reminder to any note and it'll notify you on time." },
    archive: { icon: Archive, title: "Archive is empty", sub: "Paid one-time bills and archived notes show up here." },
  } as const;
  const m = map[tab as keyof typeof map];
  const Icon = m.icon;
  return (
    <div className="py-16 text-center ls-rise">
      <Icon className="size-12 text-slate-300 mx-auto" />
      <div className="text-sm font-bold mt-3">{m.title}</div>
      <div className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto">{m.sub}</div>
      {tab !== "archive" && (
        <button onClick={() => onNew(tab === "reminders" ? "reminder" : "note")} className="mt-4 text-xs font-bold text-primary bg-primary/10 px-4 py-2 rounded-full active:scale-95">
          <Plus className="size-3.5 inline -mt-0.5" /> {tab === "reminders" ? "New reminder" : "New note"}
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────── Editor ────────────────────────────── */

function NoteEditor({ note, categories, onChange, onClose, onDelete, onPay, onSkip }: {
  note: Note;
  categories: string[];
  onChange: (n: Note) => void;
  onClose: (n: Note) => void;
  onDelete: (id: string) => void;
  onPay: (n: Note) => void;
  onSkip: (n: Note) => void;
}) {
  const [n, setN] = useState<Note>(note);
  useEffect(() => { onChange(n); }, [n]);
  const [showColors, setShowColors] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const c = NOTE_COLORS[n.color] || NOTE_COLORS.default;
  const bill = n.amount !== undefined;
  const set = (patch: Partial<Note>) => setN((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = `${bodyRef.current.scrollHeight}px`;
    }
  }, [n.body]);

  const setReminderAt = (d: Date, repeat?: Repeat) => {
    tap();
    set({ reminder: { at: d.toISOString(), repeat: repeat ?? n.reminder?.repeat ?? (bill ? "monthly" : "none") } });
  };
  const quick = (() => {
    const now = new Date();
    const later = new Date(now); later.setHours(18, 0, 0, 0); if (later <= now) later.setHours(now.getHours() + 3, 0, 0, 0);
    const tmr = new Date(now); tmr.setDate(now.getDate() + 1); tmr.setHours(9, 0, 0, 0);
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); nextWeek.setHours(9, 0, 0, 0);
    return [
      { label: "Later today", sub: later.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), d: later },
      { label: "Tomorrow", sub: "9:00 am", d: tmr },
      { label: "Next week", sub: nextWeek.toLocaleDateString("en-IN", { weekday: "short" }) + ", 9:00 am", d: nextWeek },
    ];
  })();

  return (
    <div className="absolute inset-0 z-[60] flex flex-col ls-rise" style={{ background: c.bg }}>
      {/* Top bar */}
      <div className="flex items-center gap-1 px-2 pt-3 pb-1">
        <button onClick={() => onClose(n)} aria-label="Save and close" className="size-10 rounded-full flex items-center justify-center hover:bg-black/5 active:scale-90"><ChevronLeft className="size-5" /></button>
        <div className="flex-1" />
        <button onClick={() => { tap(); set({ pinned: !n.pinned }); }} aria-label={n.pinned ? "Unpin" : "Pin"} className="size-10 rounded-full flex items-center justify-center hover:bg-black/5 active:scale-90">
          {n.pinned ? <PinOff className="size-5" /> : <Pin className="size-5" />}
        </button>
        <button onClick={() => { tap(); setShowReminder((v) => !v); }} aria-label="Reminder" className={`size-10 rounded-full flex items-center justify-center hover:bg-black/5 active:scale-90 ${n.reminder ? "text-indigo-700" : ""}`}>
          <BellRing className="size-5" />
        </button>
        {n.id && (
          <button onClick={() => { tap(); onClose({ ...n, archived: !n.archived }); }} aria-label={n.archived ? "Unarchive" : "Archive"} className="size-10 rounded-full flex items-center justify-center hover:bg-black/5 active:scale-90">
            {n.archived ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <input
          value={n.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={bill ? "Bill name (e.g. Electricity bill)" : "Title"}
          className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-slate-400 py-2"
          autoFocus={!note.id}
        />

        {bill && !n.id && !n.title && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {BILL_TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => {
                  tap();
                  const now = new Date();
                  let d = new Date(now.getFullYear(), now.getMonth(), t.day, 9, 0, 0);
                  if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, t.day, 9, 0, 0);
                  set({ title: t.title, category: t.category, dueDay: t.day, reminder: { at: d.toISOString(), repeat: "monthly" } });
                }}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold bg-white/80 border border-black/10 rounded-full px-3 py-1.5 active:scale-95"
              >
                <span>{t.emoji}</span>{t.title}
              </button>
            ))}
          </div>
        )}
        {bill && (
          <div className="grid grid-cols-2 gap-2 my-2">
            <label className="bg-white/70 rounded-xl px-3 py-2 border border-black/5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Amount</span>
              <div className="flex items-center gap-1">
                <IndianRupee className="size-4 text-slate-500" />
                <input type="number" inputMode="decimal" value={n.amount || ""} onChange={(e) => set({ amount: Number(e.target.value) || 0 })} placeholder="0" className="w-full bg-transparent text-base font-bold outline-none" />
              </div>
            </label>
            <label className="bg-white/70 rounded-xl px-3 py-2 border border-black/5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Category</span>
              <select value={n.category || "Other"} onChange={(e) => set({ category: e.target.value })} className="w-full bg-transparent text-sm font-semibold outline-none">
                {Array.from(new Set([...(n.category ? [n.category] : []), ...categories, "Utilities", "Insurance", "Credit Card"])).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>
        )}

        {n.checklist ? (
          <div className="space-y-1 py-1">
            {n.checklist.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-2">
                <button onClick={() => { tap(); set({ checklist: n.checklist!.map((x) => x.id === it.id ? { ...x, done: !x.done } : x) }); }}>
                  {it.done ? <CheckSquare className="size-5 text-slate-500" /> : <Square className="size-5 text-slate-500" />}
                </button>
                <input
                  value={it.text}
                  onChange={(e) => set({ checklist: n.checklist!.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const list = [...n.checklist!];
                      list.splice(idx + 1, 0, { id: crypto.randomUUID(), text: "", done: false });
                      set({ checklist: list });
                    }
                  }}
                  placeholder="List item"
                  className={`flex-1 bg-transparent text-[15px] outline-none py-1.5 ${it.done ? "line-through text-slate-400" : ""}`}
                />
                <button onClick={() => set({ checklist: n.checklist!.filter((x) => x.id !== it.id) })} className="text-slate-400"><X className="size-4" /></button>
              </div>
            ))}
            <button onClick={() => set({ checklist: [...n.checklist!, { id: crypto.randomUUID(), text: "", done: false }] })} className="flex items-center gap-2 text-sm text-slate-500 py-1.5">
              <Plus className="size-4" /> List item
            </button>
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            value={n.body}
            onChange={(e) => set({ body: e.target.value })}
            placeholder={bill ? "Notes (account no., how to pay…)" : "Note"}
            className="w-full bg-transparent text-[15px] leading-relaxed outline-none resize-none min-h-[120px] placeholder:text-slate-400"
          />
        )}

        {/* Reminder */}
        {n.reminder && !showReminder && (
          <button onClick={() => setShowReminder(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-white/80 border border-black/10 rounded-full px-3 py-1.5">
            <Clock className="size-3.5" /> {formatReminder(n.reminder.at)}
            {n.reminder.repeat !== "none" && <><RepeatIcon className="size-3.5" /> {REPEAT_LABEL[n.reminder.repeat]}</>}
          </button>
        )}
        {showReminder && (
          <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-3 shadow-lg ls-rise">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold">Remind me</div>
              <button onClick={() => setShowReminder(false)}><X className="size-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              {quick.map((qq) => (
                <button key={qq.label} onClick={() => { setReminderAt(qq.d); }} className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 text-sm">
                  <span>{qq.label}</span><span className="text-slate-500 text-xs">{qq.sub}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-slate-100">
              <label className="text-xs text-slate-500 font-semibold">
                Pick date & time
                <input
                  type="datetime-local"
                  value={n.reminder ? toLocalInput(new Date(n.reminder.at)) : ""}
                  onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setReminderAt(d); }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-500 font-semibold">
                Repeat
                <select
                  value={n.reminder?.repeat ?? "none"}
                  onChange={(e) => {
                    const r = e.target.value as Repeat;
                    const at = n.reminder?.at ?? quick[1].d.toISOString();
                    set({ reminder: { at, repeat: r } });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900 bg-white"
                >
                  {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-3">
              {n.reminder && <button onClick={() => { set({ reminder: undefined }); setShowReminder(false); }} className="flex-1 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg py-2">Remove</button>}
              <button onClick={() => setShowReminder(false)} className="flex-1 text-xs font-bold text-white bg-indigo-600 rounded-lg py-2">Done</button>
            </div>
          </div>
        )}

        {/* Bill actions */}
        {bill && n.id && n.reminder && !n.archived && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => onPay(n)} disabled={!n.amount} className="bg-[#0F172A] text-white text-xs font-bold rounded-xl py-3 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40">
              <CheckCircle2 className="size-4" /> Mark paid {n.amount ? `· ${inr(n.amount)}` : ""}
            </button>
            <button onClick={() => onSkip(n)} className="bg-white/80 border border-black/10 text-slate-700 text-xs font-bold rounded-xl py-3 flex items-center justify-center gap-1.5 active:scale-95">
              <SkipForward className="size-4" /> Skip this cycle
            </button>
            <p className="col-span-2 text-[11px] text-slate-600 leading-relaxed">
              "Mark paid" records an expense of this amount today and moves the reminder to the next {n.reminder.repeat === "none" ? "— one-time bills go to Archive" : REPEAT_LABEL[n.reminder.repeat].toLowerCase() + " due date"}.
            </p>
            {n.paidCycles && n.paidCycles.length > 0 && (
              <div className="col-span-2 text-[11px] text-slate-600">
                Paid: {n.paidCycles.slice(-4).map((d) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      {showColors && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-t border-black/5 bg-white/60">
          {(Object.keys(NOTE_COLORS) as NoteColor[]).map((k) => (
            <button key={k} aria-label={NOTE_COLORS[k].label} onClick={() => { tap(); set({ color: k }); }}
              className={`size-9 rounded-full border-2 shrink-0 ${n.color === k ? "border-indigo-600 scale-110" : "border-black/10"} transition`}
              style={{ background: NOTE_COLORS[k].bg }} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-black/5 bg-white/40 safe-bottom">
        <button onClick={() => { tap(); setShowColors((v) => !v); }} aria-label="Colour" className="size-10 rounded-full flex items-center justify-center hover:bg-black/5"><Palette className="size-5" /></button>
        {!bill && (
          <button
            onClick={() => {
              tap();
              if (n.checklist) set({ body: n.checklist.map((x) => x.text).filter(Boolean).join("\n"), checklist: undefined });
              else set({ checklist: (n.body ? n.body.split("\n") : [""]).map((t) => ({ id: crypto.randomUUID(), text: t, done: false })), body: "" });
            }}
            aria-label="Toggle checklist" className="size-10 rounded-full flex items-center justify-center hover:bg-black/5"
          >
            <ListChecks className="size-5" />
          </button>
        )}
        {!bill && (
          <button onClick={() => { tap(); set({ amount: 0, reminder: n.reminder ?? { at: quick[1].d.toISOString(), repeat: "monthly" } }); }} aria-label="Make it a bill" className="size-10 rounded-full flex items-center justify-center hover:bg-black/5"><Receipt className="size-5" /></button>
        )}
        <div className="flex-1 text-center text-[11px] text-slate-500">
          {n.id ? `Edited ${new Date(n.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "New"}
        </div>
        {n.id && (
          <button onClick={() => onDelete(n.id)} aria-label="Delete" className="size-10 rounded-full flex items-center justify-center hover:bg-black/5 text-rose-600"><Trash2 className="size-5" /></button>
        )}
        <button onClick={() => onClose(n)} className="ml-1 px-4 h-9 rounded-full bg-[#0F172A] text-white text-xs font-bold active:scale-95">Save</button>
      </div>
    </div>
  );
}
