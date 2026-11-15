import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { arredondar, estatisticas, valorCalculado, type Estatisticas } from "./calc";

/** Converte Decimal do Prisma, string ou number em number seguro. */
export function dec(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  const maybe = v as { toNumber?: () => number };
  if (typeof maybe.toNumber === "function") return maybe.toNumber();
  return Number(v);
}

type VinculoPreco = {
  origem: string;
  valorManual: unknown;
  valorCorrigido: unknown;
  preco: { valor: unknown } | null;
};

/** Valor efetivo de um preço vinculado ao item (corrigido > manual > fonte). */
export function valorDoVinculo(ip: VinculoPreco): number {
  if (ip.valorCorrigido !== null && ip.valorCorrigido !== undefined) return dec(ip.valorCorrigido);
  if (ip.origem === "MANUAL") return dec(ip.valorManual);
  return ip.preco ? dec(ip.preco.valor) : 0;
}

export const cestaInclude = {
  secretaria: true,
  usuario: true,
  categorias: { include: { categoria: true } },
  lotes: { orderBy: { ordem: "asc" as const } },
  documentos: { orderBy: { createdAt: "desc" as const } },
  itens: {
    orderBy: [{ loteId: "asc" as const }, { ordem: "asc" as const }],
    include: {
      produto: true,
      lote: true,
      apuracao: true,
      precos: {
        include: {
          preco: { include: { fonte: true } },
        },
      },
    },
  },
} satisfies Prisma.CestaInclude;

export type CestaCompleta = Prisma.CestaGetPayload<{ include: typeof cestaInclude }>;
export type ItemCompleto = CestaCompleta["itens"][number];

export type ItemResumo = {
  id: number;
  ordem: number;
  lote: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  codigoBr: string | null;
  selecionados: number;
  disponiveis: number;
  estatisticas: Estatisticas;
  valorUnitario: number;
  total: number;
  semPreco: boolean;
  alertas: number;
};

export function resumoDoItem(item: ItemCompleto, tipoCalculo: string, casas: number): ItemResumo {
  const selecionados = item.precos.filter((p) => p.selecionado);
  const valores = selecionados.map(valorDoVinculo).filter((v) => v > 0);
  const e = estatisticas(valores);
  const valorUnitario = arredondar(valorCalculado(e, tipoCalculo), casas);
  const quantidade = dec(item.quantidade);
  const media = e.media;
  const alertas = selecionados.filter((p) => {
    const v = valorDoVinculo(p);
    return media > 0 && Math.abs(v - media) / media > 0.18;
  }).length;

  return {
    id: item.id,
    ordem: item.ordem,
    lote: item.lote?.nome ?? "Sem lote",
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade,
    codigoBr: item.produto?.codigoBr ?? null,
    selecionados: selecionados.length,
    disponiveis: item.precos.length,
    estatisticas: e,
    valorUnitario,
    total: arredondar(valorUnitario * quantidade, 2),
    semPreco: valores.length === 0,
    alertas,
  };
}

export function resumoDaCesta(cesta: CestaCompleta) {
  const itens = cesta.itens.map((i) => resumoDoItem(i, cesta.tipoCalculo, cesta.casasDecimais));
  const total = arredondar(itens.reduce((acc, i) => acc + i.total, 0), 2);
  const semPreco = itens.filter((i) => i.semPreco).length;
  return { itens, total, semPreco, totalItens: itens.length };
}

export async function carregarCesta(tenantId: number, cestaId: number) {
  const cesta = await prisma.cesta.findFirst({
    where: { id: cestaId, tenantId },
    include: cestaInclude,
  });
  return cesta;
}

const cestaResumoInclude = {
  secretaria: true,
  _count: { select: { itens: true, documentos: true } },
  itens: {
    select: {
      quantidade: true,
      apuracao: true,
      precos: { where: { selecionado: true }, select: { id: true } },
    },
  },
} satisfies Prisma.CestaInclude;

export type CestaResumo = Prisma.CestaGetPayload<{ include: typeof cestaResumoInclude }>;

export function valorDaCestaResumo(cesta: CestaResumo): number {
  let total = 0;
  for (const item of cesta.itens) {
    if (!item.apuracao) continue;
    const a = item.apuracao;
    const unit =
      cesta.tipoCalculo === "MEDIANA"
        ? dec(a.mediana)
        : cesta.tipoCalculo === "MENOR"
          ? dec(a.menor)
          : cesta.tipoCalculo === "MAIOR"
            ? dec(a.maior)
            : dec(a.media);
    total += unit * dec(item.quantidade);
  }
  return arredondar(total, 2);
}

export type FiltroCestas = {
  status?: string;
  q?: string;
  secretariaId?: number;
  posse?: string;
};

export async function listarCestas(tenantId: number, filtro: FiltroCestas = {}) {
  const where: Prisma.CestaWhereInput = { tenantId };
  if (filtro.status && filtro.status !== "TODAS") where.status = filtro.status;
  if (filtro.posse) where.posse = filtro.posse;
  if (filtro.secretariaId) where.secretariaId = filtro.secretariaId;
  if (filtro.q) {
    where.OR = [
      { objeto: { contains: filtro.q, mode: "insensitive" } },
      { objetoDetalhado: { contains: filtro.q, mode: "insensitive" } },
    ];
  }
  return prisma.cesta.findMany({
    where,
    include: cestaResumoInclude,
    orderBy: [{ status: "asc" }, { dataSolicitacao: "desc" }],
  });
}

export async function contarPorStatus(tenantId: number) {
  const grupos = await prisma.cesta.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { _all: true },
  });
  const out: Record<string, number> = { TODAS: 0 };
  for (const g of grupos) {
    out[g.status] = g._count._all;
    out.TODAS += g._count._all;
  }
  return out;
}

export async function dashboard(tenantId: number) {
  const [cestas, fornecedores, produtos, precos, informativos, secretarias, fontes] = await Promise.all([
    listarCestas(tenantId),
    prisma.fornecedor.count({ where: { OR: [{ tenantId }, { tenantId: null }] } }),
    prisma.produto.count({ where: { ativo: true } }),
    prisma.preco.count(),
    prisma.informativo.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { publicadoEm: "desc" },
      take: 4,
    }),
    prisma.secretaria.findMany({ where: { tenantId, ativo: true }, orderBy: { nome: "asc" } }),
    prisma.fonte.count({ where: { ativo: true } }),
  ]);

  const ativas = cestas.filter((c) => c.status === "EM_ABERTO" || c.status === "EM_ANDAMENTO");
  const prontas = cestas.filter((c) => c.status === "PRONTA" || c.status === "FINALIZADA");
  const valorAtivo = arredondar(ativas.reduce((acc, c) => acc + valorDaCestaResumo(c), 0), 2);
  const valorTotal = arredondar(cestas.reduce((acc, c) => acc + valorDaCestaResumo(c), 0), 2);
  const itensAtivos = ativas.reduce((acc, c) => acc + c._count.itens, 0);

  const porSecretaria = new Map<string, { nome: string; sigla: string | null; valor: number; cestas: number }>();
  for (const c of cestas) {
    const chave = c.secretaria?.nome ?? "Sem secretaria";
    const atual = porSecretaria.get(chave) ?? {
      nome: chave,
      sigla: c.secretaria?.sigla ?? null,
      valor: 0,
      cestas: 0,
    };
    atual.valor += valorDaCestaResumo(c);
    atual.cestas += 1;
    porSecretaria.set(chave, atual);
  }
  const ranking = [...porSecretaria.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);

  return {
    cestas,
    ativas,
    prontas,
    valorAtivo,
    valorTotal,
    itensAtivos,
    fornecedores,
    produtos,
    precos,
    fontes,
    informativos,
    secretarias,
    ranking,
    contagens: {
      TODAS: cestas.length,
      EM_ABERTO: cestas.filter((c) => c.status === "EM_ABERTO").length,
      EM_ANDAMENTO: cestas.filter((c) => c.status === "EM_ANDAMENTO").length,
      PRONTA: cestas.filter((c) => c.status === "PRONTA").length,
      FINALIZADA: cestas.filter((c) => c.status === "FINALIZADA").length,
    },
  };
}

/** Fator de correção acumulado de um índice entre duas competências. */
export async function fatorIndice(sigla: string, inicio: Date, fim: Date): Promise<{ fator: number; meses: number }> {
  const indice = await prisma.indice.findUnique({ where: { sigla } });
  if (!indice) return { fator: 1, meses: 0 };
  const valores = await prisma.indiceValor.findMany({
    where: {
      indiceId: indice.id,
      competencia: {
        gte: `${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth() + 1).padStart(2, "0")}`,
        lte: `${fim.getUTCFullYear()}-${String(fim.getUTCMonth() + 1).padStart(2, "0")}`,
      },
    },
    orderBy: { competencia: "asc" },
  });
  const fator = valores.reduce((acc, v) => acc * (1 + dec(v.variacao)), 1);
  return { fator, meses: valores.length };
}

export async function estatisticasProduto(produtoId: number) {
  const precos = await prisma.preco.findMany({
    where: { produtoId },
    include: { fonte: true },
    orderBy: { data: "desc" },
  });
  const valores = precos.map((p) => dec(p.valor));
  const e = estatisticas(valores);
  const porFonte = new Map<string, { sigla: string; nome: string; qtd: number; menor: number; media: number }>();
  for (const p of precos) {
    const atual = porFonte.get(p.fonte.sigla) ?? {
      sigla: p.fonte.sigla,
      nome: p.fonte.nome,
      qtd: 0,
      menor: Infinity,
      media: 0,
    };
    const v = dec(p.valor);
    atual.qtd += 1;
    atual.menor = Math.min(atual.menor, v);
    atual.media += v;
    porFonte.set(p.fonte.sigla, atual);
  }
  const fontes = [...porFonte.values()]
    .map((f) => ({ ...f, media: f.media / f.qtd }))
    .sort((a, b) => b.qtd - a.qtd);
  return { precos, estatisticas: e, fontes };
}

export function serieMensal(precos: Array<{ data: Date; valor: unknown }>) {
  const mapa = new Map<string, number[]>();
  for (const p of precos) {
    const d = new Date(p.data);
    const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const arr = mapa.get(chave) ?? [];
    arr.push(dec(p.valor));
    mapa.set(chave, arr);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valores]) => ({
      mes,
      media: valores.reduce((a, b) => a + b, 0) / valores.length,
      qtd: valores.length,
    }));
}
