export function brl(value: number | string | null | undefined, casas = 2): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function num(value: number | string | null | undefined, casas = 2): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function qtd(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function dateBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Campo_Grande" });
}

export function dateTimeBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Campo_Grande",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function pct(value: number, casas = 1): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function prazo(d: Date | string | null | undefined): { texto: string; tom: "ok" | "warn" | "late" } {
  if (!d) return { texto: "sem prazo", tom: "ok" };
  const date = typeof d === "string" ? new Date(d) : d;
  const dias = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (dias < 0) return { texto: `vencido há ${Math.abs(dias)}d`, tom: "late" };
  if (dias === 0) return { texto: "vence hoje", tom: "warn" };
  if (dias <= 5) return { texto: `vence em ${dias}d`, tom: "warn" };
  return { texto: `vence em ${dias}d`, tom: "ok" };
}

export const STATUS_LABEL: Record<string, string> = {
  EM_ABERTO: "Em aberto",
  EM_ANDAMENTO: "Em andamento",
  PRONTA: "Pronta",
  FINALIZADA: "Finalizada",
};

export const STATUS_TONE: Record<string, string> = {
  EM_ABERTO: "neutral",
  EM_ANDAMENTO: "info",
  PRONTA: "success",
  FINALIZADA: "dark",
};

export const CALCULO_LABEL: Record<string, string> = {
  MEDIA_ARITMETICA: "Média aritmética",
  MEDIANA: "Mediana",
  MENOR: "Menor preço",
  MAIOR: "Maior preço",
};

export const CONTRATACAO_LABEL: Record<string, string> = {
  LICITACAO: "Licitação",
  DISPENSA: "Dispensa",
  INEXIGIBILIDADE: "Inexigibilidade",
  ADESAO: "Adesão a ata",
  CONTRATO: "Contrato",
};

export function rotuloCategoria(categoria: string | null | undefined): string {
  if (!categoria) return "—";
  const texto = categoria.replace(/_/g, " ").toLocaleLowerCase("pt-BR").trim();
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

export function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
