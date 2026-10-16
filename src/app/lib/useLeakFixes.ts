import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { LeakFixes } from "./leakSavings";

type Doc = { id: "leakFixes"; fixes: LeakFixes };

/** Leaks the user has sorted out, kept on the device with the other preferences. */
export function useLeakFixes() {
  const [fixes, setFixes] = useState<LeakFixes>({});
  useEffect(() => {
    let live = true;
    api.list<Doc>("settings").then((d) => { if (live) setFixes(d.find((x) => x.id === "leakFixes")?.fixes ?? {}); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const save = useCallback(async (next: LeakFixes) => { setFixes(next); await api.create<Doc>("settings", { id: "leakFixes", fixes: next }); }, []);
  return { fixes, save };
}
