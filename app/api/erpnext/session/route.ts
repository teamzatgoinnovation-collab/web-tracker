import { NextResponse } from "next/server";
import { readServerSession } from "@/lib/erpnext-cookie";

export async function GET() {
  const session = await readServerSession();
  if (!session) {
    return NextResponse.json({
      connected: false,
      user: null,
      fullName: null,
      baseUrl: null,
    });
  }
  return NextResponse.json({
    connected: true,
    user: session.user,
    fullName: session.fullName,
    baseUrl: session.baseUrl,
  });
}
