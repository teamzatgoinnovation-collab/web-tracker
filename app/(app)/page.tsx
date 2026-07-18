"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrackerApi, ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type TaskRow = { name?: string; status?: string; project?: string };
type ProjectRow = { name?: string; status?: string };

export default function HomePage() {
  const [status, setStatus] = useState("Loading…");
  const [hubOk, setHubOk] = useState(false);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [tasksOpen, setTasksOpen] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [running, setRunning] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await callZatGoApi(ZatGoApi.health.ping);
        if (!cancelled) setHubOk(true);
        const [projects, tasks, runningEnv] = await Promise.all([
          callZatGoApi<ProjectRow[]>(TrackerApi.projectsList, { page: 1, page_size: 200 }),
          callZatGoApi<TaskRow[]>(TrackerApi.tasksList, { mine: 1, page: 1, page_size: 200 }),
          callZatGoApi<unknown[]>(TrackerApi.activityRunningNow),
        ]);
        if (cancelled) return;
        const plist = Array.isArray(projects.data) ? projects.data : [];
        const tlist = Array.isArray(tasks.data) ? tasks.data : [];
        setProjectsTotal(plist.length);
        setTasksOpen(tlist.filter((t) => t.status !== "Completed" && t.status !== "Cancelled").length);
        setTasksDone(tlist.filter((t) => t.status === "Completed").length);
        setRunning(Array.isArray(runningEnv.data) ? runningEnv.data.length : 0);
        setStatus("Connected");
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "API error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Projects", value: projectsTotal },
    { label: "Open tasks (mine)", value: tasksOpen },
    { label: "Completed (mine)", value: tasksDone },
    { label: "Running now", value: running },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Tracker</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Status: {status}
          {hubOk ? " · hub ok" : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3"
          >
            <p className="text-xs text-[var(--color-muted-foreground)]">{c.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="underline underline-offset-2" href="/projects">
          Projects
        </Link>
        <Link className="underline underline-offset-2" href="/tasks">
          Tasks
        </Link>
        <Link className="underline underline-offset-2" href="/tickets">
          Tickets
        </Link>
      </div>
    </div>
  );
}
