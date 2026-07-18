import { NextResponse } from "next/server";
import { erpnextPing } from "@zatgo/erpnext";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { baseUrl?: string };
  const result = await erpnextPing(body.baseUrl ?? "");
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
