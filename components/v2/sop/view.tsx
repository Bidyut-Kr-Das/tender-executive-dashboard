"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Clamp } from "@/components/v2/data-table/cells";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn, type SortState } from "@/components/v2/data-table/types";
import type { ColumnValues } from "@/components/v2/data-table/use-client-table";
import { DatePicker } from "@/components/v2/ui/calendar";
import { describeError, toastError } from "@/components/v2/ui/errors";
import { Badge, Checkbox, Dash, type Tone } from "@/components/v2/ui/field";

interface SopRow {
  id: number;
  columnName: string;
  description: string | null;
  allocatedTo: string | null;
  email: string | null;
  dailyLog: string | null;
  date: string | null;
  source: string | null;
  doneFromWhere: string | null;
  isManual: boolean;
  dailyLogEnabled: boolean;
  dateEnabled: boolean;
}

interface DailyLog {
  id: number;
  sopResponsibilityId: number;
  date: string;
  isChecked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
}

/** A responsibility with its tick for the chosen day. */
type Row = SopRow & { log?: DailyLog; day: string };

function getIstToday(): string {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`;
}

const SopContext = createContext<{
  signedIn: boolean;
  toggling: number | null;
  toggle: (row: Row) => void;
}>({ signedIn: false, toggling: null, toggle: () => {} });

function DailyLogCell({ row }: { row: Row }) {
  const { signedIn, toggling, toggle } = use(SopContext);
  return (
    <Checkbox
      checked={!!row.log?.isChecked}
      disabled={!signedIn || toggling === row.id || !row.dailyLogEnabled}
      onChange={() => toggle(row)}
    >
      <span className="sr-only">Done on {row.day}</span>
    </Checkbox>
  );
}

const SOURCE_TONES: Record<string, Tone> = { MANUAL: "accent", AI: "warn" };

const yesNo = (id: "isManual" | "dailyLogEnabled" | "dateEnabled", header: string): DataTableColumn<Row> => ({
  id,
  header,
  width: 120,
  search: false,
  filter: { type: "boolean" },
  text: (row) => (row[id] ? "Yes" : "No"),
});

const columns: DataTableColumn<Row>[] = [
  {
    id: "columnName",
    header: "Column Name",
    width: 200,
    frozen: true,
    filter: selectFilter(),
    cell: (row) => <Clamp className="font-semibold">{row.columnName}</Clamp>,
  },
  { id: "description", header: "Description", width: 260, frozen: true, filter: selectFilter(), text: (r) => r.description ?? "" },
  { id: "doneFromWhere", header: "Done From Where", width: 220, filter: selectFilter(), text: (r) => r.doneFromWhere ?? "" },
  {
    id: "source",
    header: "Source",
    width: 150,
    filter: selectFilter(),
    text: (r) => r.source ?? "",
    cell: (r) => (r.source ? <Badge tone={SOURCE_TONES[r.source] ?? "neutral"}>{r.source}</Badge> : <Dash />),
  },
  yesNo("isManual", "Manual?"),
  { id: "allocatedTo", header: "Allocated To", width: 170, filter: selectFilter(), text: (r) => r.allocatedTo ?? "" },
  {
    id: "email",
    header: "Email",
    width: 220,
    filter: selectFilter(),
    text: (r) => r.email ?? "",
    cell: (r) =>
      r.email ? (
        <a href={`mailto:${r.email}`} className="text-accent-ink hover:underline">
          {r.email}
        </a>
      ) : (
        <Dash />
      ),
  },
  {
    id: "dailyLogCheck",
    header: "Daily Log",
    width: 120,
    search: false,
    filter: { type: "boolean" },
    cell: (row) => <DailyLogCell row={row} />,
  },
  yesNo("dailyLogEnabled", "DailyLog En"),
  yesNo("dateEnabled", "Date En"),
  {
    id: "date",
    header: "Info",
    width: 200,
    search: false,
    cell: (row) => (
      <div className="flex flex-col text-xs text-ink-2">
        {row.log?.isChecked ? (
          <span>
            by <b>{row.log.checkedBy}</b>
          </span>
        ) : (
          <span>not done for {row.day}</span>
        )}
        {row.date && (
          <span className="text-ink-3">
            {new Date(row.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
          </span>
        )}
      </div>
    ),
  },
];

const values: ColumnValues<Row> = { dailyLogCheck: (row) => !!row.log?.isChecked };
const defaultSort: SortState = { column: "columnName", direction: "asc" };
const getRowId = (row: Row) => String(row.id);

export function SopView() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";
  const [sopRows, setSopRows] = useState<SopRow[]>([]);
  const [logs, setLogs] = useState<Map<number, DailyLog>>(new Map());
  const [day, setDay] = useState(getIstToday);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (await fetch("/api/sop-responsibilities")).json();
      if (!data.success) throw new Error(data.error || "Failed to load SOP");
      setSopRows(data.data);
      setError(null);
    } catch (err) {
      setError(await describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    let stale = false;
    fetch(`/api/sop-daily-logs?date=${day}`)
      .then((res) => res.json())
      .then((data) => {
        if (stale || !data.success) return;
        setLogs(new Map((data.data as DailyLog[]).map((l) => [l.sopResponsibilityId, l])));
      })
      .catch((err) => toastError("Daily logs not loaded", err));
    return () => {
      stale = true;
    };
  }, [day]);

  const rows = useMemo<Row[]>(
    () => sopRows.map((r) => ({ ...r, log: logs.get(r.id), day })),
    [sopRows, logs, day],
  );

  const toggle = useCallback(
    async (row: Row) => {
      if (!signedIn) {
        toast.error("Please sign in to update daily log");
        return;
      }
      if (!row.dailyLogEnabled) {
        toast.error("DailyLog disabled for this column (AI/parse)");
        return;
      }
      const previous = row.log;
      const next = !previous?.isChecked;
      const put = (log: DailyLog | undefined) =>
        setLogs((m) => {
          const n = new Map(m);
          if (log) n.set(row.id, log);
          else n.delete(row.id);
          return n;
        });

      put({
        id: previous?.id || 0,
        sopResponsibilityId: row.id,
        date: row.day,
        isChecked: next,
        checkedBy: session?.user?.email || session?.user?.name || "you",
        checkedAt: new Date().toISOString(),
      });
      setToggling(row.id);
      try {
        const res = await fetch("/api/sop-daily-logs/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sopResponsibilityId: row.id, date: row.day, isChecked: next }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Toggle failed");
        put(data.data);
        toast.success(next ? "Marked done" : "Unchecked");
      } catch (err) {
        put(previous);
        toastError("Daily log not saved", err);
      } finally {
        setToggling(null);
      }
    },
    [signedIn, session],
  );

  const context = useMemo(() => ({ signedIn, toggling, toggle }), [signedIn, toggling, toggle]);

  return (
    <SopContext value={context}>
      <ClientTablePage
        title="SOP"
        noun="responsibilities"
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        loading={loading}
        error={error}
        onRetry={loadRows}
        defaultSort={defaultSort}
        values={values}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-2">IST date</span>
          <DatePicker
            label="IST date"
            className="w-40"
            value={day}
            // Pressing the selected day again clears the picker; a day is always needed here.
            onChange={(next) => next && setDay(next)}
          />
          {!signedIn && <span className="text-warn">Sign in to tick daily logs</span>}
        </div>
      </ClientTablePage>
    </SopContext>
  );
}
