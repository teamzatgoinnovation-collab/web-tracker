"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type DashboardStats = {
  projects_total?: number;
  projects_active?: number;
  projects_on_hold?: number;
  projects_rag_red?: number;
  tasks_open?: number;
  tasks_completed?: number;
};

export default function HomePage() {
  const [status, setStatus] = useState("Loading…");
  const [hubOk, setHubOk] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await callZatGoApi(ZatGoApi.projectTracker.ping);
        if (!cancelled) setHubOk(true);
        const env = await callZatGoApi<DashboardStats>(ZatGoApi.projectTracker.dashboardSummary);
        if (cancelled) return;
        setStats(env.data ?? null);
        setStatus("Connected");
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "API error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards: { label: string; value: number | undefined }[] = [
    { label: "Projects", value: stats?.projects_total },
    { label: "Active", value: stats?.projects_active },
    { label: "Open tasks", value: stats?.tasks_open },
    { label: "Completed tasks", value: stats?.tasks_completed },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Project Tracker</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Status: {status}
          {hubOk ? " · hub ok" : null}
        </p>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3"
            >
              <p className="text-xs text-[var(--color-muted-foreground)]">{c.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{c.value ?? "—"}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="underline underline-offset-2" href="/projects">
          Projects
        </Link>
        <Link className="underline underline-offset-2" href="/tasks">
          Tasks
        </Link>
      </div>
    </div>
  );
}
