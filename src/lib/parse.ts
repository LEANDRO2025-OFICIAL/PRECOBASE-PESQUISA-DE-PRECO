/** Conversões tolerantes de valores digitados em pt-BR ou formato técnico. */

export function parseNumero(input: unknown, fallback = 0): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : fallback;
  const raw = String(input ?? "").trim();
  if (!raw) return fallback;
  let texto = raw.replace(/\s|R\$|%/g, "");
  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");
  if (temVirgula && temPonto) {
    // pt-BR: 1.234,56
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    texto = texto.replace(",", ".");
  }
  const n = Number(texto);
  return Number.isFinite(n) ? n : fallback;
}

export function parseInteiro(input: unknown, fallback = 0): number {
  const n = parseNumero(input, NaN);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function parseData(input: unknown): Date | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function texto(fd: FormData, chave: string): string {
  return String(fd.get(chave) ?? "").trim();
}

export function textoOpcional(fd: FormData, chave: string): string | null {
  const v = texto(fd, chave);
  return v.length ? v : null;
}
