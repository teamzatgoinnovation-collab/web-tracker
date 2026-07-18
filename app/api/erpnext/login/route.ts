import { NextResponse } from "next/server";
import { erpnextLogin } from "@zatgo/erpnext";
import { writeServerSession } from "@/lib/erpnext-cookie";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    baseUrl?: string;
    usr?: string;
    pwd?: string;
  };
  const result = await erpnextLogin({
    baseUrl: body.baseUrl ?? "",
    usr: body.usr ?? "",
    pwd: body.pwd ?? "",
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 401 });
  }
  await writeServerSession(result.session);
  return NextResponse.json({
    ok: true,
    user: result.session.user,
    fullName: result.session.fullName,
    baseUrl: result.session.baseUrl,
  });
}
