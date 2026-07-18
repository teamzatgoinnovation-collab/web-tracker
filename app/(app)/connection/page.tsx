"use client";

import { Button } from "@zatgo/ui";
import { Loader2 } from "@zatgo/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { logoutFromErpnext, testConnection } from "@/lib/client";
import { useSessionStore } from "@/store/session";


export default function ConnectionPage() {
  const router = useRouter();
  const connected = useSessionStore((s) => s.connected);
  const user = useSessionStore((s) => s.user);
  const fullName = useSessionStore((s) => s.fullName);
  const lastError = useSessionStore((s) => s.lastError);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Connection</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          ERPNext session status. Sign in with site email and password.
        </p>
      </div>
      <div className="max-w-xl space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        {connected ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--app-sidebar-active)] px-3 py-2 text-sm">
            Signed in as <strong>{fullName || user}</strong>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">Not signed in.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    await logoutFromErpnext();
                    toast.success("Signed out");
                    router.replace("/login");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sign out
            </Button>
          ) : (
            <Button type="button" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await testConnection();
                  if (result.ok) toast.success(result.message);
                  else toast.error(result.message);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Test site
          </Button>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Status:{" "}
          <span className={connected ? "text-[var(--color-primary)]" : ""}>
            {connected ? `Connected as ${user}` : "Not signed in"}
          </span>
          {lastError ? ` — ${lastError}` : null}
        </p>
      </div>
    </div>
  );
}
