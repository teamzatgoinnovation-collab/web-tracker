"use client";

import { useEffect, useState } from "react";
import { TrackerApi, ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type ProjectRow = {
  name?: string;
  project_name?: string;
  status?: string;
  rag_status?: string;
  company?: string;
};

function asRows(data: unknown): ProjectRow[] {
  return Array.isArray(data) ? (data as ProjectRow[]) : [];
}

export default function ProjectsPage() {
  const [status, setStatus] = useState("Loading…");
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const env = await callZatGoApi<ProjectRow[]>(TrackerApi.projectsList, {
          page: 1,
          page_size: 50,
        });
        if (cancelled) return;
        setRows(asRows(env.data));
        setTotal(typeof env.meta?.total === "number" ? Number(env.meta.total) : asRows(env.data).length);
        setStatus("Connected");
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "API error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {status}
          {total !== null ? ` · ${total} total` : null}
        </p>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">RAG</th>
              <th className="px-3 py-2 font-medium">Company</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[var(--color-muted-foreground)]" colSpan={4}>
                  No projects returned.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.name} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2">{row.project_name || row.name}</td>
                  <td className="px-3 py-2">{row.status ?? "—"}</td>
                  <td className="px-3 py-2">{row.rag_status ?? "—"}</td>
                  <td className="px-3 py-2">{row.company ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
