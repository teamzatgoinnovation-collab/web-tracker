import { useSessionStore } from "@/store/session";

export type LoginResult =
  | { ok: true; user: string; fullName: string; baseUrl: string }
  | { ok: false; message: string };

export async function loginWithPassword(input: {
  baseUrl: string;
  usr: string;
  pwd: string;
}): Promise<LoginResult> {
  const res = await fetch("/api/erpnext/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
      usr: input.usr.trim(),
      pwd: input.pwd,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as LoginResult & { message?: string };

  if (!res.ok || !body.ok) {
    const message =
      ("message" in body && typeof body.message === "string" ? body.message : null) ||
      `Login failed (HTTP ${res.status})`;
    useSessionStore.getState().setSession({ connected: false, error: message });
    return { ok: false, message };
  }

  useSessionStore.getState().setSession({
    connected: true,
    user: body.user,
    fullName: body.fullName,
    baseUrl: body.baseUrl,
    error: null,
  });
  useSessionStore.getState().setAllowMockWithoutLogin(false);
  return body;
}

export async function logoutFromErpnext(): Promise<void> {
  await fetch("/api/erpnext/logout", { method: "POST" });
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setAllowMockWithoutLogin(false);
}

export async function hydrateErpnextSession(): Promise<void> {
  try {
    const res = await fetch("/api/erpnext/session");
    const body = (await res.json()) as {
      connected: boolean;
      user: string | null;
      fullName: string | null;
      baseUrl: string | null;
    };
    if (body.connected && body.user && body.baseUrl) {
      useSessionStore.getState().setSession({
        connected: true,
        user: body.user,
        fullName: body.fullName,
        baseUrl: body.baseUrl,
        error: null,
      });
    } else if (useSessionStore.getState().connected) {
      useSessionStore.getState().clearSession();
    }
  } finally {
    useSessionStore.getState().setHydrated(true);
  }
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const { connection } = useSessionStore.getState();
  if (!connection.baseUrl.trim()) return { ok: false, message: "Site URL is required" };
  try {
    const res = await fetch("/api/erpnext/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: connection.baseUrl }),
    });
    return (await res.json()) as { ok: boolean; message: string };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}

/** Authenticated site request via BFF proxy. */
export async function erpnextApi<T = unknown>(
  methodPath: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const path = methodPath.startsWith("/api/")
    ? methodPath
    : `/api/method/${methodPath}`;
  const res = await fetch("/api/erpnext/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
    }),
  });
  const envelope = (await res.json()) as {
    ok?: boolean;
    status?: number;
    bodyText?: string;
    message?: string;
  };
  if (!res.ok && !envelope.bodyText) {
    throw new Error(envelope.message || `HTTP ${res.status}`);
  }
  const json = JSON.parse(envelope.bodyText || "{}") as { message?: T };
  if (!envelope.ok) {
    throw new Error(
      typeof json.message === "string" ? json.message : `HTTP ${envelope.status}`,
    );
  }
  return (json.message ?? json) as T;
}
