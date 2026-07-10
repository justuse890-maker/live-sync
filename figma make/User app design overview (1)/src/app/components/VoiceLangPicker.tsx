import { useState } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { VOICE_LANGS, findVoiceLang } from "../lib/voiceLangs";

export function VoiceLangPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = findVoiceLang(value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 text-xs"
        style={{ fontWeight: 600 }}
      >
        <Globe className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-left truncate">
          {current ? `${current.label} · ${current.native}` : value}
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 left-0 right-0 max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-lg">
          {(["India", "World"] as const).map((group) => (
            <div key={group}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0" style={{ fontWeight: 700 }}>
                {group}
              </div>
              {VOICE_LANGS.filter((l) => l.group === group).map((l) => {
                const active = l.code === value;
                return (
                  <button
                    key={l.code}
                    onClick={() => { onChange(l.code); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted ${active ? "text-primary" : ""}`}
                  >
                    <span className="flex-1 truncate">
                      <span style={{ fontWeight: 600 }}>{l.label}</span>
                      <span className="text-muted-foreground"> · {l.native}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{l.code}</span>
                    {active && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
