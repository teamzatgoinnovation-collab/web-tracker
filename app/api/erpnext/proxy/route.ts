import { NextResponse } from "next/server";
import { erpnextRequest } from "@zatgo/erpnext";
import { readServerSession, writeServerSession } from "@/lib/erpnext-cookie";

export async function POST(request: Request) {
  const session = await readServerSession();
  if (!session) {
    return NextResponse.json({ message: "Not logged in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
    method?: string;
    body?: string | null;
    headers?: Record<string, string>;
  };
  if (!body.path) {
    return NextResponse.json({ message: "path is required" }, { status: 400 });
  }
  const result = await erpnextRequest(session, {
    path: body.path,
    method: body.method,
    body: body.body,
    headers: body.headers,
  });
  await writeServerSession(result.session);
  return NextResponse.json(
    { ok: result.ok, status: result.status, bodyText: result.bodyText },
    { status: result.ok ? 200 : result.status },
  );
}
