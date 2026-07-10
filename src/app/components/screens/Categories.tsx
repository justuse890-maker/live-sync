import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";

const DEFAULT_CATEGORIES = ["Food", "Travel", "Shopping", "Grocery", "Medical", "Rent", "Entertainment", "Other"];

export function Categories({ onBack }: { onBack: () => void }) {
  const { categories, addCategory, removeCategory } = useStore();
  const [name, setName] = useState("");
  const custom = categories.filter((c) => !DEFAULT_CATEGORIES.includes(c));

  const submit = async () => {
    if (!name.trim()) return;
    await addCategory(name);
    setName("");
  };

  return (
    <>
      <Header title="Expense Categories" subtitle="Customize how you tag spending" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>Add a new category</div>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="e.g. Gym, Pets, Coffee"
                className="flex-1 bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={submit} disabled={!name.trim()} className="px-4 rounded-xl bg-primary text-primary-foreground text-sm disabled:opacity-40 flex items-center gap-1" style={{ fontWeight: 600 }}>
                <Plus className="size-4" /> Add
              </button>
            </div>
          </div>

          <Section title="Default">
            {DEFAULT_CATEGORIES.map((c) => (
              <Row key={c} name={c} locked />
            ))}
          </Section>

          {custom.length > 0 && (
            <Section title="Custom">
              {custom.map((c) => (
                <Row key={c} name={c} onRemove={() => removeCategory(c)} />
              ))}
            </Section>
          )}

          {custom.length === 0 && (
            <div className="text-xs text-muted-foreground text-center px-6">
              Add categories that match how you actually spend — they'll show up in the quick-add sheet.
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ name, locked, onRemove }: { name: string; locked?: boolean; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0">
      <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
        <Tag className="size-4 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm" style={{ fontWeight: 500 }}>{name}</span>
      {locked ? (
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Default</span>
      ) : (
        <button onClick={onRemove} className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
