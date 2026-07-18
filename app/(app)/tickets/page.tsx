"use client";

import { useCallback, useEffect, useState } from "react";
import { TrackerApi } from "@zatgo/erpnext";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type TicketRow = {
  name?: string;
  subject?: string;
  status?: string;
  project?: string;
  priority?: string;
};

function asRows(data: unknown): TicketRow[] {
  return Array.isArray(data) ? (data as TicketRow[]) : [];
}

export default function TicketsPage() {
  const [status, setStatus] = useState("Loading…");
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const env = await callZatGoApi<TicketRow[]>(TrackerApi.ticketsList, {
      page: 1,
      page_size: 50,
    });
    setRows(asRows(env.data));
    setStatus("Connected");
  }, []);

  useEffect(() => {
    void load().catch((e) => setStatus(e instanceof Error ? e.message : "API error"));
  }, [load]);

  const createTicket = async () => {
    if (!subject.trim()) return;
    setBusy(true);
    try {
      await callZatGoApi(TrackerApi.ticketsCreate, { subject: subject.trim() });
      setSubject("");
      toast.success("Ticket created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{status}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[16rem] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="New ticket subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <button
          className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={busy || !subject.trim()}
          onClick={() => void createTicket()}
        >
          Create
        </button>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[var(--color-muted-foreground)]" colSpan={3}>
                  No tickets.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.name} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2">{row.subject || row.name}</td>
                  <td className="px-3 py-2">{row.project ?? "—"}</td>
                  <td className="px-3 py-2">{row.status ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
