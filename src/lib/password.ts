import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(plain.normalize("NFKC"), salt, KEYLEN, { N, r: 8, p: 1 }).toString("hex");
  return `scrypt$${N}$${salt}$${key}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const [algo, nStr, salt, keyHex] = stored.split("$");
    if (algo !== "scrypt" || !salt || !keyHex) return false;
    const key = Buffer.from(keyHex, "hex");
    const test = scryptSync(plain.normalize("NFKC"), salt, key.length, {
      N: Number(nStr) || N,
      r: 8,
      p: 1,
    });
    return key.length === test.length && timingSafeEqual(key, test);
  } catch {
    return false;
  }
}
