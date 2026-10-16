import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { CloseRecord } from "./monthClose";

type Doc = { id: "monthClose"; records: Record<string, CloseRecord> };

/** Closed months, kept on the device in the "settings" collection like the other preferences. */
export function useMonthClose() {
  const [records, setRecords] = useState<Record<string, CloseRecord>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    api.list<Doc>("settings")
      .then((docs) => { if (live) setRecords(docs.find((d) => d.id === "monthClose")?.records ?? {}); })
      .catch((e) => console.warn("Month-close load failed:", e))
      .finally(() => live && setLoaded(true));
    return () => { live = false; };
  }, []);

  const persist = useCallback(async (next: Record<string, CloseRecord>) => {
    setRecords(next);
    await api.create<Doc>("settings", { id: "monthClose", records: next });
  }, []);

  const close = useCallback((rec: CloseRecord) => persist({ ...records, [rec.month]: rec }), [records, persist]);
  const reopen = useCallback((month: string) => {
    const { [month]: _gone, ...rest } = records;
    return persist(rest);
  }, [records, persist]);

  return { records, loaded, close, reopen };
}
