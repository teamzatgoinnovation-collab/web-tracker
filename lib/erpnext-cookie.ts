import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type ErpnextSession } from "@zatgo/erpnext";
import { sessionSecretKey } from "@zatgo/erpnext/secrets-node";

export const SESSION_COOKIE = "zatgo_ptw_erpnext";

function getSecret(): Buffer {
  return sessionSecretKey();
}

export function sealSession(session: ErpnextSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecret(), iv);
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function unsealSession(token: string): ErpnextSession | null {
  try {
    const buf = Buffer.from(token, "base64url");
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getSecret(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as ErpnextSession;
    if (
      !parsed?.baseUrl ||
      !parsed?.user ||
      typeof parsed.cookieHeader !== "string" ||
      typeof parsed.csrfToken !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readServerSession(): Promise<ErpnextSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return unsealSession(token);
}

export async function writeServerSession(session: ErpnextSession): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sealSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearServerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
