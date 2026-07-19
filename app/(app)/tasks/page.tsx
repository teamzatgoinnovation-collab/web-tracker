"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrackerApi } from "@zatgo/erpnext";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type TaskRow = {
  name?: string;
  subject?: string;
  status?: string;
  stage?: string;
  project?: string;
  priority?: string;
  parent_task?: string;
  _assign?: string;
};

type TreePerson = { user?: string; full_name?: string; is_self?: boolean };
type Caps = {
  can_manage_work?: boolean;
  can_review?: boolean;
  can_submit_timesheets?: boolean;
};
type Preset = { id?: string; name?: string; scope?: string; project?: string; status?: string };

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Loading…");
  const [scope, setScope] = useState<"mine" | "team" | "both">(
    (searchParams.get("scope") as "mine" | "team" | "both") || "mine",
  );
  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveSession>(null);
  const [newSubject, setNewSubject] = useState("");
  const [assignUser, setAssignUser] = useState("");
  const [people, setPeople] = useState<TreePerson[]>([]);
  const [caps, setCaps] = useState<Caps>({});
  const [elapsed, setElapsed] = useState(0);

  const syncQuery = useCallback(
    (next: { scope: string; project?: string; status?: string }) => {
      const q = new URLSearchParams();
      q.set("scope", next.scope);
      if (next.project) q.set("project", next.project);
      if (next.status) q.set("status", next.status);
      router.replace(`${pathname}?${q.toString()}`);
      void callZatGoApi(TrackerApi.filtersSetLast, {
        scope: next.scope,
        project: next.project || undefined,
        status: next.status || undefined,
      }).catch(() => undefined);
    },
    [pathname, router],
  );

  const load = useCallback(async () => {
    const params: Record<string, unknown> = { page: 1, page_size: 100, tree: 1 };
    if (scope === "mine" || scope === "both") params.mine = 1;
    if (scope === "team" || scope === "both") params.team = 1;
    if (projectFilter.trim()) params.project = projectFilter.trim();
    if (statusFilter.trim()) params.status = statusFilter.trim();
    const [env, activeEnv, treeEnv, presetsEnv] = await Promise.all([
      callZatGoApi<TaskRow[]>(TrackerApi.tasksList, params),
      callZatGoApi<ActiveSession>(TrackerApi.activityActive),
      callZatGoApi<Caps & { people?: TreePerson[] }>(TrackerApi.hierarchyMyTree),
      callZatGoApi<{ last?: Preset; presets?: Preset[] }>(TrackerApi.filtersGetPresets),
    ]);
    setRows(asRows(env.data));
    setTotal(typeof env.meta?.total === "number" ? Number(env.meta.total) : asRows(env.data).length);
    const sess = (activeEnv.data as ActiveSession) ?? null;
    setActive(sess);
    setElapsed(sess?.elapsed_seconds || 0);
    setPeople(Array.isArray(treeEnv.data?.people) ? treeEnv.data.people : []);
    setCaps({
      can_manage_work: !!treeEnv.data?.can_manage_work,
      can_review: !!treeEnv.data?.can_review,
      can_submit_timesheets: !!treeEnv.data?.can_submit_timesheets,
    });
    setPresets(Array.isArray(presetsEnv.data?.presets) ? presetsEnv.data.presets : []);
    setStatus("Connected");
  }, [scope, projectFilter, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!searchParams.get("scope")) {
          try {
            const presetsEnv = await callZatGoApi<{ last?: Preset }>(TrackerApi.filtersGetPresets);
            const last = presetsEnv.data?.last;
            if (last?.scope && !cancelled) {
              setScope((last.scope as "mine" | "team" | "both") || "mine");
              setProjectFilter(last.project || "");
              setStatusFilter(last.status || "");
              syncQuery({
                scope: last.scope,
                project: last.project || undefined,
                status: last.status || undefined,
              });
            }
          } catch {
            /* ignore */
          }
        }
        await load();
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "API error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, searchParams, syncQuery]);

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
    const seen = new Set(out.map((x) => x.row.name));
    for (const row of rows) {
      if (!seen.has(row.name)) out.push({ row, depth: 0 });
    }
    return out;
  }, [rows]);

  const applyScope = (next: "mine" | "team" | "both") => {
    setScope(next);
    syncQuery({ scope: next, project: projectFilter || undefined, status: statusFilter || undefined });
  };

  const lifecycle = async (name: string, kind: "ready" | "approve" | "rework") => {
    setBusy(name);
    try {
      if (kind === "ready") {
        await callZatGoApi(TrackerApi.tasksSubmitForReview, { name });
        toast.success("Submitted for review");
      } else if (kind === "approve") {
        await callZatGoApi(TrackerApi.tasksApprove, { name });
        toast.success("Approved");
      } else {
        const note = window.prompt("Rework note");
        if (!note?.trim()) return;
        await callZatGoApi(TrackerApi.tasksRequestRework, { name, note: note.trim() });
        toast.success("Rework requested");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
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

  const savePreset = async () => {
    const name = window.prompt("Filter name");
    if (!name?.trim()) return;
    try {
      const env = await callZatGoApi<{ presets?: Preset[] }>(TrackerApi.filtersSavePreset, {
        name: name.trim(),
        scope,
        project: projectFilter || undefined,
        status: statusFilter || undefined,
      });
      setPresets(Array.isArray(env.data?.presets) ? env.data.presets : []);
      toast.success("Filter saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
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
        <div className="flex flex-wrap gap-2 text-sm">
          {(["mine", "team", "both"] as const).map((s) => (
            <button
              key={s}
              className={`rounded-[var(--radius-md)] px-3 py-1.5 ${scope === s ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`}
              onClick={() => applyScope(s)}
            >
              {s === "mine" ? "My Work" : s === "team" ? "Team" : "Mine + Team"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="w-40 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          onBlur={() =>
            syncQuery({
              scope,
              project: projectFilter || undefined,
              status: statusFilter || undefined,
            })
          }
        />
        <input
          className="w-32 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          onBlur={() =>
            syncQuery({
              scope,
              project: projectFilter || undefined,
              status: statusFilter || undefined,
            })
          }
        />
        <select
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value || x.name === e.target.value);
            if (!p) return;
            const nextScope = (p.scope as "mine" | "team" | "both") || "mine";
            setScope(nextScope);
            setProjectFilter(p.project || "");
            setStatusFilter(p.status || "");
            syncQuery({
              scope: nextScope,
              project: p.project || undefined,
              status: p.status || undefined,
            });
          }}
        >
          <option value="">Presets…</option>
          {presets.map((p) => (
            <option key={p.id || p.name} value={p.id || p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm"
          onClick={() => void savePreset()}
        >
          Save filter
        </button>
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

      {caps.can_manage_work ? (
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[14rem] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder={selected ? "New subtask under selection" : "New task subject (Draft)"}
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
          <select
            className="min-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            value={assignUser}
            onChange={(e) => setAssignUser(e.target.value)}
          >
            <option value="">Assign to…</option>
            {people.map((p) => (
              <option key={p.user} value={p.user}>
                {(p.full_name || p.user) + (p.is_self ? " (you)" : "")}
              </option>
            ))}
          </select>
          <button
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"
            disabled={!!busy || !selected || !assignUser.trim()}
            onClick={() => void assignSelected()}
          >
            Assign
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Actions</th>
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
              treeRows.map(({ row, depth }) => {
                const stage = row.stage || row.status || "—";
                return (
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
                    <td className="px-3 py-2">{stage}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {stage === "In Progress" && row.name ? (
                          <button
                            className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs"
                            disabled={!!busy}
                            onClick={() => void lifecycle(row.name!, "ready")}
                          >
                            Ready for Review
                          </button>
                        ) : null}
                        {stage === "Ready for Review" && caps.can_review && row.name ? (
                          <>
                            <button
                              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs"
                              disabled={!!busy}
                              onClick={() => void lifecycle(row.name!, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs"
                              disabled={!!busy}
                              onClick={() => void lifecycle(row.name!, "rework")}
                            >
                              Rework
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
