import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { personaFromOccupation, resolveMode, ViewMode } from "./persona";
import type { Persona } from "./ratios";

type Doc = { id: string; occupation?: string; viewMode?: ViewMode };

let cache: { persona: Persona; mode: ViewMode } | null = null;
const subs = new Set<(v: { persona: Persona; mode: ViewMode }) => void>();
const push = (v: { persona: Persona; mode: ViewMode }) => { cache = v; subs.forEach((s) => s(v)); };

/** Persona (from onboarding) and the Simple/Books mode, shared across screens. */
export function usePersona() {
  const [state, setState] = useState(cache ?? { persona: "other" as Persona, mode: "books" as ViewMode });
  const [loaded, setLoaded] = useState(cache !== null);

  useEffect(() => {
    const on = (v: { persona: Persona; mode: ViewMode }) => setState(v);
    subs.add(on);
    if (!cache) {
      (async () => {
        try {
          const docs = await api.list<Doc>("settings");
          const persona = personaFromOccupation(docs.find((d) => d.id === "onboarding")?.occupation);
          push({ persona, mode: resolveMode(docs.find((d) => d.id === "preferences")?.viewMode, persona) });
        } catch (e) {
          console.warn("Persona load failed; using defaults:", e);
          push({ persona: "other", mode: "books" });
        } finally { setLoaded(true); }
      })();
    }
    return () => { subs.delete(on); };
  }, []);

  const setMode = useCallback(async (mode: ViewMode) => {
    const docs = await api.list<Doc>("settings");
    const existing = docs.find((d) => d.id === "preferences") || { id: "preferences" };
    await api.create<Doc>("settings", { ...existing, id: "preferences", viewMode: mode });
    push({ persona: cache?.persona ?? "other", mode });
  }, []);

  return { ...state, loaded, setMode };
}
