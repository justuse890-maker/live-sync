import { useEffect, useMemo, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useStore } from "../store";
import { inr } from "./types";
import { OfferDraft, noteFromOffer, reminderOfferFor } from "../lib/billSuggest";
import { onReminderOffer } from "../lib/reminderOfferBus";
import { LEAD_CHOICES, leadLabel, planForNote } from "../lib/reminderPlan";
import { reminderPrefs } from "../lib/reminderPrefs";
import { getNotificationPermission, requestNotificationPermission } from "../lib/notifications";
import { feedback } from "../lib/feedback";
import type { Repeat } from "../lib/notes";

type Freq = Exclude<Repeat, "none">;
const FREQS: Array<{ id: Freq; label: string }> = [
  { id: "monthly", label: "Monthly" }, { id: "weekly", label: "Weekly" }, { id: "daily", label: "Daily" }, { id: "yearly", label: "Yearly" },
];

const chip = (on: boolean) => `px-3 py-2 rounded-xl border text-xs font-bold active:scale-95 transition ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`;

/**
 * After an expense is saved: "Remind me next time?" — how often, how early, at what time. Creates a bill reminder
 * that rings on the phone even when the app is closed. Shown only if the expense isn't already covered by a reminder.
 */
export function ReminderOffer() {
  const { notes, upsertNote } = useStore();
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [freq, setFreq] = useState<Freq>("monthly");
  const [lead, setLead] = useState<number>(reminderPrefs.leadDays);
  const [time, setTime] = useState(reminderPrefs.time);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => onReminderOffer((tx) => {
    if (!reminderPrefs.askAfterExpense || !reminderPrefs.enabled) return;
    const d = reminderOfferFor(tx, notes);
    if (!d) return;
    setDraft(d); setFreq(d.suggestedRepeat === "none" ? "monthly" : (d.suggestedRepeat as Freq));
    setLead(reminderPrefs.leadDays); setTime(reminderPrefs.time); setBlocked(false);
  }), [notes]);

  const preview = useMemo(() => {
    if (!draft) return null;
    const note = noteFromOffer(draft, { repeat: freq, leadDays: lead, time });
    const first = planForNote({ ...note, id: "preview" }, new Date())[0];
    return { due: new Date(note.reminder!.at), first };
  }, [draft, freq, lead, time]);

  const close = () => { setDraft(null); setBlocked(false); };

  const confirm = async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      await upsertNote(noteFromOffer(draft, { repeat: freq, leadDays: lead, time }) as any);
      reminderPrefs.setLeadDays(lead); reminderPrefs.setTime(time); // remembered for next time
      let perm = await getNotificationPermission();
      if (perm === "prompt") perm = await requestNotificationPermission();
      if (perm === "denied") { setBlocked(true); return; }
      feedback({ kind: "success", title: "Reminder set", subtitle: `${draft.title} · ${freq}${lead ? ` · ${leadLabel(lead).toLowerCase()}` : ""}` });
      close();
    } finally { setBusy(false); }
  };

  const stopAsking = () => {
    reminderPrefs.setAskAfterExpense(false);
    feedback({ kind: "success", title: "I won't ask again", subtitle: "Turn it back on in Notifications" });
    close();
  };

  const fmt = (d: Date) => d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BellRing className="size-4" /> Remind me next time?</DialogTitle></DialogHeader>
        {draft && blocked && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-bold text-emerald-700"><Check className="size-4" /> Reminder saved</div>
            <p className="text-xs text-slate-600 leading-relaxed">But notifications are blocked on this phone, so it can’t pop up. Open your phone’s <b>Settings → Apps → LiveSync → Notifications</b> and turn them on. Your reminder will start working straight away.</p>
            <button onClick={close} className="w-full h-11 rounded-xl bg-[#1E3A8A] text-white font-bold">OK</button>
          </div>
        )}
        {draft && !blocked && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm"><b>{draft.title}</b> · {inr(draft.amount)}</div>

            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">How often</div>
              <div className="flex flex-wrap gap-1.5">{FREQS.map((f) => <button key={f.id} onClick={() => setFreq(f.id)} className={chip(freq === f.id)}>{f.label}</button>)}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Alert me</div>
              <div className="flex flex-wrap gap-1.5">{LEAD_CHOICES.map((d) => <button key={d} onClick={() => setLead(d)} className={chip(lead === d)}>{d === 7 ? "A week before" : leadLabel(d)}</button>)}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">At</div>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value || reminderPrefs.time)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm" aria-label="Time of day for the alert" />
            </div>

            {preview && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-snug text-slate-700">
                Next due <b>{preview.due.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</b>.
                {preview.first && <> First alert <b>{fmt(preview.first.at)}</b>: “{preview.first.title}”.</>}
                <div className="mt-1 text-[11px] text-slate-500">It rings on your phone even when the app is closed. When it’s due, tap <b>Mark paid</b> and the expense is recorded for you.</div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={confirm} disabled={busy} className="flex-[2] h-12 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40 active:scale-[0.98]">{busy ? "Saving…" : "Set reminder"}</button>
              <button onClick={close} className="flex-1 h-12 rounded-xl border font-bold text-sm">Not now</button>
            </div>
            <button onClick={stopAsking} className="w-full text-center text-[11px] text-muted-foreground underline">Don’t ask me after expenses</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
