"use server";

import { prisma } from "@/lib/db";

export type OrigemCatalogo = "CATMAT" | "CATSER";

/** Monta a URL da API de dados abertos do Compras.gov.br para um catálogo. */
function urlCatalogo(origem: OrigemCatalogo, pagina: number, tamanho: number, termo?: string): string {
  const base =
    origem === "CATSER"
      ? "https://dadosabertos.compras.gov.br/modulo-servico/6_consultarItemServico"
      : "https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial";
  const params = new URLSearchParams({ pagina: String(pagina), tamanhoPagina: String(tamanho) });
  if (termo) params.set("descricaoItem", termo);
  return `${base}?${params.toString()}`;
}

/** Extrai o array de itens da resposta da API (aceita objeto com `resultado` ou array direto). */
function extrairItens(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.resultado)) return payload.resultado;
  if (payload && Array.isArray(payload.dados)) return payload.dados;
  if (payload && Array.isArray(payload.itens)) return payload.itens;
  return [];
}

/** Normaliza um item bruto da API para o formato de CatalogoItem. */
function normalizarItem(origem: OrigemCatalogo, raw: any): {
  codigo: string;
  descricao: string;
  grupo: string | null;
  classe: string | null;
  unidade: string | null;
  ncm: string | null;
  statusItem: boolean;
} {
  const codigo =
    raw.codigoItem ??
    raw.codigoServico ??
    raw.codigo ??
    raw.id ??
    "";
  const descricao =
    raw.descricaoItem ??
    raw.nomeServico ??
    raw.descricao ??
    raw.nome ??
    "";
  const grupo =
    raw.nomeGrupo ?? raw.grupo ?? raw.codigoGrupo ? (raw.codigoGrupo != null ? String(raw.codigoGrupo) : null) : null;
  const classe =
    raw.nomeClasse ?? raw.classe ?? raw.codigoClasse ? (raw.codigoClasse != null ? String(raw.codigoClasse) : null) : null;
  const unidade = raw.unidade ?? raw.siglaUnidade ?? "UN";
  const ncm = raw.codigo_ncm ?? raw.ncm ?? null;
  const statusItem = raw.statusItem ?? raw.statusServico ?? true;

  return { codigo: String(codigo), descricao: String(descricao), grupo, classe, unidade, ncm, statusItem };
}

/**
 * Importa uma página de um catálogo externo (CATMAT ou CATSER) e faz upsert por (origem, codigo).
 * Retorna estatísticas da importação.
 */
export async function importarPaginaCatalogo({
  origem,
  pagina = 1,
  tamanho = 10,
  termo,
}: {
  origem: OrigemCatalogo;
  pagina?: number;
  tamanho?: number;
  termo?: string;
}): Promise<{
  registros: number;
  inseridos: number;
  atualizados: number;
  totalPaginas: number;
  paginasRestantes: number;
  erro?: string;
}> {
  const tamanhoEfetivo = Math.max(10, Math.min(tamanho, 500));
  let payload: any;
  try {
    const res = await fetch(urlCatalogo(origem, pagina, tamanhoEfetivo, termo), {
      headers: { Accept: "application/json", "User-Agent": "precobase-catalogo/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    payload = await res.json();
  } catch (e: any) {
    await prisma.logImportacaoCatalogo.create({
      data: {
        origem,
        pagina,
        tamanho: tamanhoEfetivo,
        registros: 0,
        inseridos: 0,
        atualizados: 0,
        erro: e?.message ?? String(e),
      },
    });
    return { registros: 0, inseridos: 0, atualizados: 0, totalPaginas: 0, paginasRestantes: 0, erro: e?.message ?? String(e) };
  }

  const totalRegistros = Number(payload.totalRegistros ?? 0);
  const totalPaginas = Number(payload.totalPaginas ?? 0);
  const paginasRestantes = Number(payload.paginasRestantes ?? Math.max(0, totalPaginas - pagina));
  const itens = extrairItens(payload);

  let inseridos = 0;
  let atualizados = 0;

  for (const raw of itens) {
    const n = normalizarItem(origem, raw);
    if (!n.codigo || !n.descricao) continue;
    const existente = await prisma.catalogoItem.findFirst({
      where: { origem, codigo: n.codigo },
      select: { id: true, atualizadoEm: true },
    });
    if (existente) {
      await prisma.catalogoItem.update({
        where: { id: existente.id },
        data: {
          descricao: n.descricao,
          grupo: n.grupo,
          classe: n.classe,
          unidade: n.unidade,
          ncm: n.ncm,
          statusItem: n.statusItem,
          atualizadoEm: new Date(),
        },
      });
      atualizados += 1;
    } else {
      await prisma.catalogoItem.create({
        data: {
          origem,
          codigo: n.codigo,
          descricao: n.descricao,
          grupo: n.grupo,
          classe: n.classe,
          unidade: n.unidade,
          ncm: n.ncm,
          statusItem: n.statusItem,
        },
      });
      inseridos += 1;
    }
  }

  await prisma.logImportacaoCatalogo.create({
    data: {
      origem,
      pagina,
      tamanho: tamanhoEfetivo,
      registros: itens.length,
      inseridos,
      atualizados,
    },
  });

  return { registros: totalRegistros, inseridos, atualizados, totalPaginas, paginasRestantes };
}

/**
 * Busca textual no catálogo unificado (CATMAT + CATSER + produtos próprios).
 * Retorna todos os resultados que contenham o termo, com origem.
 */
export async function buscarCatalogoUnificado({
  q,
  origem,
  take = 100,
}: {
  q: string;
  origem?: OrigemCatalogo | "TODAS";
  take?: number;
}): Promise<Array<{
  id: number;
  origem: string;
  codigo: string;
  descricao: string;
  grupo: string | null;
  classe: string | null;
  unidade: string | null;
  ncm: string | null;
  statusItem: boolean;
  tipo: string; // "CATMAT" | "CATSER"
  label: string;
}>> {
  const termo = (q ?? "").trim();
  if (!termo) return [];

  const whereExterno: { descricao: { contains: string; mode: "insensitive" }; statusItem: boolean; origem?: string } = {
    descricao: { contains: termo, mode: "insensitive" },
    statusItem: true,
  };
  if (origem && origem !== "TODAS") whereExterno.origem = origem;

  const externos = await prisma.catalogoItem.findMany({
    where: whereExterno,
    select: {
      id: true,
      origem: true,
      codigo: true,
      descricao: true,
      grupo: true,
      classe: true,
      unidade: true,
      ncm: true,
      statusItem: true,
    },
    orderBy: [{ origem: "asc" }, { descricao: "asc" }],
    take,
  });

  // Produtos próprios (catálogo próprio) — mesclados como origem "PROPRIO"
  const proprios = await prisma.produto.findMany({
    where: {
      ativo: true,
      OR: [
        { descricao: { contains: termo, mode: "insensitive" } },
        { codigoBr: { contains: termo, mode: "insensitive" } },
        { grupo: { contains: termo, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      codigoBr: true,
      descricao: true,
      grupo: true,
      unidade: true,
      ativo: true,
    },
    orderBy: { descricao: "asc" },
    take,
  });

  const resultado = [
    ...externos.map((e) => ({
      id: e.id,
      origem: e.origem,
      codigo: e.codigo,
      descricao: e.descricao,
      grupo: e.grupo ?? null,
      classe: e.classe ?? null,
      unidade: e.unidade ?? "UN",
      ncm: e.ncm ?? null,
      statusItem: e.statusItem,
      tipo: e.origem,
      label: `${e.codigo} — ${e.descricao}`,
    })),
    ...proprios.map((p) => ({
      id: p.id,
      origem: "PROPRIO",
      codigo: p.codigoBr,
      descricao: p.descricao,
      grupo: p.grupo ?? null,
      classe: null,
      unidade: p.unidade ?? "UN",
      ncm: null,
      statusItem: p.ativo,
      tipo: "PROPRIO",
      label: `${p.codigoBr} — ${p.descricao}`,
    })),
  ];

  // Ordena: origem primeiro (CATMAT, CATSER, PROPRIO), depois descrição
  const ordemOrigem: Record<string, number> = { CATMAT: 0, CATSER: 1, PROPRIO: 2 };
  return resultado.sort((a, b) => {
    const oa = ordemOrigem[a.origem] ?? 99;
    const ob = ordemOrigem[b.origem] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.descricao.localeCompare(b.descricao, undefined, { sensitivity: "base" });
  });
}

/** Logs de importação mais recentes. */
export async function listarLogsImportacao(limite = 20) {
  return prisma.logImportacaoCatalogo.findMany({
    orderBy: { executadoEm: "desc" },
    take: limite,
  });
}
