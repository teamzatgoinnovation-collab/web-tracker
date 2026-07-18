"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrackerApi } from "@zatgo/erpnext";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

const TASK_STATUSES = ["Open", "Working", "Pending Review", "Completed", "Cancelled"] as const;

type TaskRow = {
  name?: string;
  subject?: string;
  status?: string;
  project?: string;
  priority?: string;
  parent_task?: string;
  _assign?: string;
};

type ActiveSession = {
  name?: string;
  status?: string;
  task?: string;
  elapsed_seconds?: number;
} | null;

function asRows(data: unknown): TaskRow[] {
  return Array.isArray(data) ? (data as TaskRow[]) : [];
}

function formatElapsed(sec?: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function TasksPage() {
  const [status, setStatus] = useState("Loading…");
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveSession>(null);
  const [newSubject, setNewSubject] = useState("");
  const [assignUser, setAssignUser] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const load = useCallback(async () => {
    const params: Record<string, unknown> = { page: 1, page_size: 100, tree: 1 };
    if (scope === "mine") params.mine = 1;
    else params.team = 1;
    const env = await callZatGoApi<TaskRow[]>(TrackerApi.tasksList, params);
    const activeEnv = await callZatGoApi<ActiveSession>(TrackerApi.activityActive);
    setRows(asRows(env.data));
    setTotal(typeof env.meta?.total === "number" ? Number(env.meta.total) : asRows(env.data).length);
    const sess = (activeEnv.data as ActiveSession) ?? null;
    setActive(sess);
    setElapsed(sess?.elapsed_seconds || 0);
    setStatus("Connected");
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "API error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (active?.status !== "Running") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [active?.status, active?.name]);

  const treeRows = useMemo(() => {
    const byParent = new Map<string, TaskRow[]>();
    const roots: TaskRow[] = [];
    for (const row of rows) {
      const p = row.parent_task || "";
      if (!p) roots.push(row);
      else {
        const list = byParent.get(p) || [];
        list.push(row);
        byParent.set(p, list);
      }
    }
    const out: { row: TaskRow; depth: number }[] = [];
    const walk = (list: TaskRow[], depth: number) => {
      for (const row of list) {
        out.push({ row, depth });
        walk(byParent.get(row.name || "") || [], depth + 1);
      }
    };
    walk(roots, 0);
    // orphans (parent not in list)
    const seen = new Set(out.map((x) => x.row.name));
    for (const row of rows) {
      if (!seen.has(row.name)) out.push({ row, depth: 0 });
    }
    return out;
  }, [rows]);

  const onStatusChange = async (name: string, next: string) => {
    setBusy(name);
    try {
      await callZatGoApi(TrackerApi.updateTaskStatus, { name, status: next });
      toast.success(`Updated ${name} → ${next}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const createTask = async () => {
    if (!newSubject.trim()) return;
    setBusy("create");
    try {
      await callZatGoApi(TrackerApi.tasksCreate, {
        subject: newSubject.trim(),
        parent_task: selected || undefined,
      });
      setNewSubject("");
      toast.success("Task created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const assignSelected = async () => {
    if (!selected || !assignUser.trim()) return;
    setBusy("assign");
    try {
      await callZatGoApi(TrackerApi.hierarchyAssign, {
        doctype: "Task",
        name: selected,
        user: assignUser.trim(),
      });
      toast.success("Assigned");
      setAssignUser("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  };

  const runActivity = async (kind: "start" | "pause" | "next" | "stop") => {
    setBusy(kind);
    try {
      if (kind === "start") {
        if (!selected) return;
        await callZatGoApi(TrackerApi.activityStart, { task: selected });
      } else if (kind === "pause") {
        await callZatGoApi(TrackerApi.activityPause, {});
      } else if (kind === "stop") {
        await callZatGoApi(TrackerApi.activityStop, {});
      } else {
        if (!selected) return;
        await callZatGoApi(TrackerApi.activityNext, { task: selected });
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activity failed");
    } finally {
      setBusy(null);
    }
  };

  const running = active?.status === "Running";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {status}
            {total !== null ? ` · ${total} total` : null}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            className={`rounded-[var(--radius-md)] px-3 py-1.5 ${scope === "mine" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`}
            onClick={() => setScope("mine")}
          >
            My Work
          </button>
          <button
            className={`rounded-[var(--radius-md)] px-3 py-1.5 ${scope === "team" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`}
            onClick={() => setScope("team")}
          >
            Team
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
        <div className="min-w-[12rem] flex-1">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Active session
          </div>
          <div className="font-medium">
            {active
              ? `${active.status}: ${active.task || active.name} · ${formatElapsed(elapsed)}`
              : "None"}
          </div>
        </div>
        <button
          className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={!selected || running || !!busy}
          onClick={() => void runActivity("start")}
        >
          Start
        </button>
        <button
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={!running || !!busy}
          onClick={() => void runActivity("pause")}
        >
          Pause
        </button>
        <button
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={!selected || !!busy}
          onClick={() => void runActivity("next")}
        >
          Next
        </button>
        <button
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={!active || !!busy}
          onClick={() => void runActivity("stop")}
        >
          Stop
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[14rem] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder={selected ? "New subtask under selection" : "New task subject"}
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
        />
        <button
          className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!!busy || !newSubject.trim()}
          onClick={() => void createTask()}
        >
          Create
        </button>
        <input
          className="min-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Assign user@…"
          value={assignUser}
          onChange={(e) => setAssignUser(e.target.value)}
        />
        <button
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"
          disabled={!!busy || !selected || !assignUser.trim()}
          onClick={() => void assignSelected()}
        >
          Assign
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {treeRows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[var(--color-muted-foreground)]" colSpan={4}>
                  No tasks returned.
                </td>
              </tr>
            ) : (
              treeRows.map(({ row, depth }) => (
                <tr
                  key={row.name}
                  className={`cursor-pointer border-b border-[var(--color-border)] last:border-0 ${
                    selected === row.name ? "bg-[var(--color-muted)]/50" : ""
                  }`}
                  onClick={() => setSelected(row.name ?? null)}
                >
                  <td className="px-3 py-2" style={{ paddingLeft: `${12 + depth * 16}px` }}>
                    {row.subject || row.name}
                  </td>
                  <td className="px-3 py-2">{row.project ?? "—"}</td>
                  <td className="px-3 py-2">{row.priority ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-2 py-1"
                      value={row.status ?? "Open"}
                      disabled={!row.name || busy === row.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (row.name) void onStatusChange(row.name, e.target.value);
                      }}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
