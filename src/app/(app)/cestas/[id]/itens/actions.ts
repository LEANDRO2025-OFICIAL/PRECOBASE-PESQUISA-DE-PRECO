"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalcularApuracao } from "@/lib/apuracao";
import { parseInteiro, parseData, parseNumero, texto, textoOpcional } from "@/lib/parse";

function revalidar(cestaId: number, itemId?: number) {
  revalidatePath("/");
  revalidatePath("/cestas");
  revalidatePath(`/cestas/${cestaId}`);
  revalidatePath(`/cestas/${cestaId}/itens`);
  if (itemId) revalidatePath(`/cestas/${cestaId}/itens/${itemId}`);
  revalidatePath(`/cestas/${cestaId}/itens/novo`);
}

async function cestaDaSessao(cestaId: number, tenantId: number) {
  return prisma.cesta.findFirst({ where: { id: cestaId, tenantId }, select: { id: true } });
}

async function resolverLote(
  cestaId: number,
  loteIdInformado: number,
  novoLoteNome: string | null,
): Promise<number | null> {
  if (novoLoteNome) {
    const ultimo = await prisma.lote.findFirst({
      where: { cestaId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    const lote = await prisma.lote.create({
      data: { cestaId, nome: novoLoteNome.slice(0, 120), ordem: (ultimo?.ordem ?? 0) + 1 },
    });
    return lote.id;
  }
  if (!loteIdInformado) return null;
  const lote = await prisma.lote.findFirst({ where: { id: loteIdInformado, cestaId }, select: { id: true } });
  return lote?.id ?? null;
}

/** Vincula ao item os preços do acervo para o produto, priorizando a janela configurada. */
async function vincularAcervo(itemId: number) {
  const item = await prisma.cestaItem.findUnique({
    where: { id: itemId },
    include: { cesta: { select: { priorizarPrecosPraticadosDias: true } } },
  });
  if (!item?.produtoId) return 0;

  const dias = Math.max(0, item.cesta.priorizarPrecosPraticadosDias);
  const desde = new Date(Date.now() - dias * 86400000);
  let precos = await prisma.preco.findMany({
    where: { produtoId: item.produtoId, data: { gte: desde } },
    orderBy: { data: "desc" },
    take: 60,
    select: { id: true },
  });
  if (precos.length === 0) {
    precos = await prisma.preco.findMany({
      where: { produtoId: item.produtoId },
      orderBy: { data: "desc" },
      take: 12,
      select: { id: true },
    });
  }
  if (precos.length === 0) return 0;

  await prisma.itemPreco.createMany({
    data: precos.map((p) => ({ itemId, precoId: p.id, selecionado: true, origem: "FONTE" })),
    skipDuplicates: true,
  });
  await recalcularApuracao(itemId);
  return precos.length;
}

export type ItemFormState = { error?: string };

/** Inclui um item do catálogo externo (CATMAT/CATSER): resolve/cria o Produto correspondente e vincula o acervo. */
export async function adicionarItemCatalogoExterno(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;

  const origem = texto(fd, "origem");
  const codigo = texto(fd, "codigo");
  if (!origem || !codigo) return;

  const quantidade = Math.max(0, parseNumero(fd.get("quantidade"), 1));
  const loteId = await resolverLote(cestaId, parseInteiro(fd.get("loteId")), textoOpcional(fd, "novoLote"));

  const codigoBr = `${origem}:${codigo}`;
  let produto = await prisma.produto.findUnique({ where: { codigoBr } });
  if (!produto) {
    const cat = await prisma.catalogoItem.findFirst({
      where: { origem, codigo },
      select: { descricao: true, unidade: true, grupo: true },
    });
    produto = await prisma.produto.create({
      data: {
        codigoBr,
        descricao: cat?.descricao ?? codigo,
        unidade: cat?.unidade ?? "UN",
        grupo: cat?.grupo ?? null,
        ativo: true,
      },
    });
  }

  const ultimo = await prisma.cestaItem.findFirst({
    where: { cestaId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const item = await prisma.cestaItem.create({
    data: {
      cestaId,
      loteId,
      produtoId: produto.id,
      descricao: produto.descricao,
      unidade: produto.unidade,
      quantidade,
      ordem: (ultimo?.ordem ?? 0) + 1,
      situacao: "ATIVO",
    },
  });

  await vincularAcervo(item.id);
  revalidar(cestaId, item.id);
  redirect(`/cestas/${cestaId}/itens`);
}

export async function adicionarItemCatalogo(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;

  const produtoId = parseInteiro(fd.get("produtoId"));
  const quantidade = Math.max(0, parseNumero(fd.get("quantidade"), 1));
  const produto = await prisma.produto.findFirst({ where: { id: produtoId, ativo: true } });
  if (!produto) return;

  const loteId = await resolverLote(cestaId, parseInteiro(fd.get("loteId")), textoOpcional(fd, "novoLote"));

  const ultimo = await prisma.cestaItem.findFirst({
    where: { cestaId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const item = await prisma.cestaItem.create({
    data: {
      cestaId,
      loteId,
      produtoId: produto.id,
      descricao: produto.descricao,
      unidade: produto.unidade,
      quantidade,
      ordem: (ultimo?.ordem ?? 0) + 1,
      situacao: "ATIVO",
    },
  });

  await vincularAcervo(item.id);
  revalidar(cestaId, item.id);
  redirect(`/cestas/${cestaId}/itens`);
}

export async function adicionarItemAvulso(_prev: ItemFormState, fd: FormData): Promise<ItemFormState> {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return { error: "Cesta não encontrada." };

  const descricao = texto(fd, "descricao");
  if (descricao.length < 4) return { error: "Descreva o item com pelo menos 4 caracteres." };
  const unidade = (texto(fd, "unidade") || "UN").slice(0, 12).toUpperCase();
  const quantidade = Math.max(0, parseNumero(fd.get("quantidade"), 1));
  const loteId = await resolverLote(cestaId, parseInteiro(fd.get("loteId")), textoOpcional(fd, "novoLote"));

  const ultimo = await prisma.cestaItem.findFirst({
    where: { cestaId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const item = await prisma.cestaItem.create({
    data: {
      cestaId,
      loteId,
      descricao,
      unidade,
      quantidade,
      ordem: (ultimo?.ordem ?? 0) + 1,
      observacao: textoOpcional(fd, "observacao"),
      justificativa: textoOpcional(fd, "justificativa"),
      situacao: "ATIVO",
    },
  });

  revalidar(cestaId, item.id);
  redirect(`/cestas/${cestaId}/itens/${item.id}/pesquisar-fontes`);
}

export async function salvarItem(_prev: ItemFormState, fd: FormData): Promise<ItemFormState> {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const itemId = parseInteiro(fd.get("itemId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return { error: "Cesta não encontrada." };

  const item = await prisma.cestaItem.findFirst({ where: { id: itemId, cestaId }, select: { id: true } });
  if (!item) return { error: "Item não encontrado." };

  const descricao = texto(fd, "descricao");
  if (descricao.length < 4) return { error: "Descreva o item com pelo menos 4 caracteres." };

  const loteId = await resolverLote(cestaId, parseInteiro(fd.get("loteId")), textoOpcional(fd, "novoLote"));

  await prisma.cestaItem.update({
    where: { id: itemId },
    data: {
      descricao,
      unidade: (texto(fd, "unidade") || "UN").slice(0, 12).toUpperCase(),
      quantidade: Math.max(0, parseNumero(fd.get("quantidade"), 0)),
      loteId,
      observacao: textoOpcional(fd, "observacao"),
      justificativa: textoOpcional(fd, "justificativa"),
    },
  });

  revalidar(cestaId, itemId);
  redirect(`/cestas/${cestaId}/itens`);
}

export async function excluirItem(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const itemId = parseInteiro(fd.get("itemId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;
  await prisma.cestaItem.deleteMany({ where: { id: itemId, cestaId } });
  revalidar(cestaId);
  redirect(`/cestas/${cestaId}/itens`);
}

export async function salvarSelecaoPrecos(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const itemId = parseInteiro(fd.get("itemId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;

  const item = await prisma.cestaItem.findFirst({ where: { id: itemId, cestaId }, select: { id: true } });
  if (!item) return;

  const visiveis = [
    ...new Set(
      fd
        .getAll("visiveis")
        .flatMap((v) => String(v).split(","))
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  if (!visiveis.length) return;

  const acao = texto(fd, "acao") || "salvar";
  const marcados = new Set(
    fd
      .getAll("selecionados")
      .flatMap((v) => String(v).split(","))
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
  const selecionar =
    acao === "todos" ? new Set(visiveis) : acao === "nenhum" ? new Set<number>() : marcados;

  await prisma.$transaction(
    visiveis.map((vinculoId) =>
      prisma.itemPreco.updateMany({
        where: { id: vinculoId, itemId },
        data: { selecionado: selecionar.has(vinculoId) },
      }),
    ),
  );

  await recalcularApuracao(itemId);
  revalidar(cestaId, itemId);
  revalidatePath(`/cestas/${cestaId}/itens/${itemId}/pesquisar-fontes`);
}

export async function adicionarPrecoManual(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const itemId = parseInteiro(fd.get("itemId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;

  const item = await prisma.cestaItem.findFirst({ where: { id: itemId, cestaId }, select: { id: true } });
  if (!item) return;

  const valor = parseNumero(fd.get("valor"), 0);
  if (valor <= 0) return;

  await prisma.itemPreco.create({
    data: {
      itemId,
      selecionado: true,
      origem: "MANUAL",
      valorManual: valor,
      orgaoManual: texto(fd, "orgao") || "Pesquisa direta",
      ufManual: (texto(fd, "uf") || "").slice(0, 2).toUpperCase() || null,
      dataManual: parseData(fd.get("data")) ?? new Date(),
    },
  });

  await recalcularApuracao(itemId);
  revalidar(cestaId, itemId);
  revalidatePath(`/cestas/${cestaId}/itens/${itemId}/pesquisar-fontes`);
}

export async function excluirVinculoPreco(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const itemId = parseInteiro(fd.get("itemId"));
  const vinculoId = parseInteiro(fd.get("vinculoId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;

  await prisma.itemPreco.deleteMany({ where: { id: vinculoId, itemId, item: { cestaId } } });
  await recalcularApuracao(itemId);
  revalidar(cestaId, itemId);
  revalidatePath(`/cestas/${cestaId}/itens/${itemId}/pesquisar-fontes`);
}

export async function revincularAcervo(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const itemId = parseInteiro(fd.get("itemId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;

  const item = await prisma.cestaItem.findFirst({ where: { id: itemId, cestaId }, select: { id: true } });
  if (!item) return;

  await vincularAcervo(itemId);
  revalidar(cestaId, itemId);
  revalidatePath(`/cestas/${cestaId}/itens/${itemId}/pesquisar-fontes`);
}

export async function criarLote(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;
  const nome = texto(fd, "nome");
  if (nome.length < 2) return;
  const ultimo = await prisma.lote.findFirst({
    where: { cestaId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  await prisma.lote.create({ data: { cestaId, nome: nome.slice(0, 120), ordem: (ultimo?.ordem ?? 0) + 1 } });
  revalidar(cestaId);
}

export async function excluirLote(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  const loteId = parseInteiro(fd.get("loteId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;
  const lote = await prisma.lote.findFirst({ where: { id: loteId, cestaId }, select: { id: true } });
  if (!lote) return;
  await prisma.lote.delete({ where: { id: loteId } });
  revalidar(cestaId);
}

export async function recalcularCesta(fd: FormData) {
  const session = await requireSession();
  const cestaId = parseInteiro(fd.get("cestaId"));
  if (!(await cestaDaSessao(cestaId, session.tid))) return;
  const itens = await prisma.cestaItem.findMany({ where: { cestaId }, select: { id: true } });
  for (const item of itens) await recalcularApuracao(item.id);
  revalidar(cestaId);
}
