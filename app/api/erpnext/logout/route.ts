import { NextResponse } from "next/server";
import { erpnextLogout } from "@zatgo/erpnext";
import { clearServerSession, readServerSession } from "@/lib/erpnext-cookie";

export async function POST() {
  const session = await readServerSession();
  if (session) await erpnextLogout(session);
  await clearServerSession();
  return NextResponse.json({ ok: true });
}
