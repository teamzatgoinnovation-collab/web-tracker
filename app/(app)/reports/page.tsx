"use client";

import { useCallback, useEffect, useState } from "react";
import { TrackerApi } from "@zatgo/erpnext";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type HoursRow = {
  project?: string;
  employee?: string;
  employee_name?: string;
  user?: string;
  hours?: number;
  entries?: number;
};

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [byProject, setByProject] = useState<HoursRow[]>([]);
  const [byUser, setByUser] = useState<HoursRow[]>([]);
  const [status, setStatus] = useState("Loading…");
  const [canSubmitTs, setCanSubmitTs] = useState(false);

  const load = useCallback(async () => {
    setStatus("Loading…");
    const args = { from_date: fromDate, to_date: toDate, page_size: 100 };
    const [p, u, tree] = await Promise.all([
      callZatGoApi<HoursRow[]>(TrackerApi.hoursByProject, args),
      callZatGoApi<HoursRow[]>(TrackerApi.hoursByUser, args),
      callZatGoApi<{ can_submit_timesheets?: boolean }>(TrackerApi.hierarchyMyTree, {}),
    ]);
    setByProject(Array.isArray(p.data) ? p.data : []);
    setByUser(Array.isArray(u.data) ? u.data : []);
    setCanSubmitTs(!!tree.data?.can_submit_timesheets);
    setStatus("Connected");
  }, [fromDate, toDate]);

  const submitTeam = async () => {
    try {
      const env = await callZatGoApi<{ submitted?: string[]; errors?: { name: string; error: string }[] }>(
        TrackerApi.timesheetsSubmitTeam,
        { from_date: fromDate, to_date: toDate },
      );
      const n = env.data?.submitted?.length || 0;
      const err = env.data?.errors?.length || 0;
      setStatus(`Submitted ${n} timesheet(s), ${err} error(s)`);
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Submit failed");
    }
  };

  useEffect(() => {
    void load().catch((e) => setStatus(e instanceof Error ? e.message : "Error"));
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Hours</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{status}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          From
          <input
            type="date"
            className="ml-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-2 py-1"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            className="ml-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-2 py-1"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <button
          className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white"
          onClick={() => void load()}
        >
          Load
        </button>
        {canSubmitTs ? (
          <button
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
            onClick={() => void submitTeam()}
          >
            Submit team timesheets
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <HoursTable
          title="By project"
          rows={byProject}
          columns={[
            { key: "project", label: "Project" },
            { key: "hours", label: "Hours" },
            { key: "entries", label: "Entries" },
          ]}
        />
        <HoursTable
          title="By user"
          rows={byUser}
          columns={[
            { key: "employee_name", label: "Employee" },
            { key: "user", label: "User" },
            { key: "hours", label: "Hours" },
            { key: "entries", label: "Entries" },
          ]}
        />
      </div>
    </div>
  );
}

function HoursTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: HoursRow[];
  columns: { key: keyof HoursRow; label: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] px-3 py-2 font-medium">{title}</div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-[var(--color-muted-foreground)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-[var(--color-muted-foreground)]" colSpan={columns.length}>
                No hours in range.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                {columns.map((c) => {
                  let v = r[c.key];
                  if (c.key === "hours" && typeof v === "number") v = v.toFixed(2);
                  return (
                    <td key={c.key} className="px-3 py-2">
                      {v == null || v === "" ? "—" : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
