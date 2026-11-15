import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

export const SESSION_COOKIE = "pb_session";
const MAX_AGE = 60 * 60 * 12; // 12h

export type SessionPayload = {
  uid: number;
  tid: number;
  nome: string;
  papel: string;
  exp: number;
};

function secret() {
  return process.env.AUTH_SECRET || "precobase-dev-secret-change-me";
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function signSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.uid || !payload.tid || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: number, tenantId: number, nome: string, papel: string) {
  const payload: SessionPayload = {
    uid: userId,
    tid: tenantId,
    nome,
    papel,
    exp: Date.now() + MAX_AGE * 1000,
  };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    // Em produção real (HTTPS) defina COOKIE_SECURE=true no .env.
    // Em execução local via http://localhost o cookie precisa ser não-secure.
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findFirst({
    where: { id: session.uid, tenantId: session.tid, ativo: true },
    include: { tenant: true },
  });
}
