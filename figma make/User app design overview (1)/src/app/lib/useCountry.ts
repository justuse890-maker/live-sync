import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { CountryCode, TAX_PACKS, fmt as fmtBase } from "./taxPacks";

type Prefs = { id: string; country?: CountryCode };

let cachedCountry: CountryCode | null = null;
const subscribers = new Set<(c: CountryCode) => void>();

function broadcast(c: CountryCode) {
  cachedCountry = c;
  for (const s of subscribers) s(c);
}

export function useCountry() {
  const [country, setCountry] = useState<CountryCode>(cachedCountry ?? "IN");
  const [loaded, setLoaded] = useState(cachedCountry !== null);

  const load = useCallback(async () => {
    try {
      const items = await api.list<Prefs>("settings");
      const prefs = items.find((s) => s.id === "preferences");
      const c = (prefs?.country as CountryCode) || "IN";
      broadcast(c);
      setCountry(c);
    } catch (e) {
      console.warn("Country prefs load failed; defaulting to IN:", e);
      broadcast("IN");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (cachedCountry === null) load();
    const onChange = (c: CountryCode) => setCountry(c);
    subscribers.add(onChange);
    return () => { subscribers.delete(onChange); };
  }, [load]);

  const setAndPersist = useCallback(async (c: CountryCode) => {
    const items = await api.list<Prefs>("settings");
    const existing = items.find((s) => s.id === "preferences") || { id: "preferences" };
    await api.create<Prefs>("settings", { ...existing, id: "preferences", country: c });
    broadcast(c);
  }, []);

  return { country, pack: TAX_PACKS[country], loaded, setCountry: setAndPersist, refresh: load };
}

export function fmtFor(amount: number, country?: CountryCode) {
  return fmtBase(amount, country ?? cachedCountry ?? "IN");
}
