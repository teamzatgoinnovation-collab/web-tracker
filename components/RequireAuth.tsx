"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { hydrateErpnextSession } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const connected = useSessionStore((s) => s.connected);
  const hydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    void hydrateErpnextSession();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!connected) router.replace("/login");
  }, [hydrated, connected, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        Checking ERPNext session…
      </div>
    );
  }

  if (!connected) return null;
  return children;
}
