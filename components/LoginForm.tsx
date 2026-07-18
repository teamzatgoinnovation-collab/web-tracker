"use client";

import { ErpnextLoginCard } from "@zatgo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loginWithPassword, testConnection } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export function LoginForm() {
  const router = useRouter();
  const connection = useSessionStore((s) => s.connection);
  const connected = useSessionStore((s) => s.connected);
  const lastError = useSessionStore((s) => s.lastError);
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (connected) router.replace("/");
  }, [connected, router]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await loginWithPassword({
        baseUrl: connection.baseUrl,
        usr,
        pwd,
      });
      if (result.ok) {
        toast.success(`Signed in as ${result.fullName || result.user}`);
        router.replace("/");
      } else toast.error(result.message);
    } finally {
      setBusy(false);
    }
  };

  const onPing = async () => {
    setBusy(true);
    try {
      const result = await testConnection();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpnextLoginCard
      productTitle="Project Tracker"
      usr={usr}
      pwd={pwd}
      busy={busy}
      error={lastError}
      onUsrChange={setUsr}
      onPwdChange={setPwd}
      onSubmit={(e) => void onLogin(e)}
      onTestSite={() => void onPing()}
      footerHint={
        <>
          Login uses the Next.js BFF and an encrypted httpOnly cookie. Set{" "}
          <code className="rounded bg-[var(--color-muted)] px-1">ERPNEXT_SESSION_SECRET</code> in
          production. For local dev, copy{" "}
          <code className="rounded bg-[var(--color-muted)] px-1">.env.example</code> to{" "}
          <code className="rounded bg-[var(--color-muted)] px-1">.env.local</code>.
        </>
      }
    />
  );
}
