"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fatorIndice } from "@/lib/queries";
import { recalcularApuracao } from "@/lib/apuracao";
import { dec } from "@/lib/queries";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  return v.length ? v : null;
};
const inteiro = (fd: FormData, k: string, fallback = 0) => {
  const n = Number(txt(fd, k).replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const decimal = (fd: FormData, k: string, fallback = 0) => {
  const raw = txt(fd, k).replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};
const data = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const listaIds = (fd: FormData, k: string) =>
  fd
    .getAll(k)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

function revalidarCesta(id?: number) {
  revalidatePath("/");
  revalidatePath("/cestas");
  if (id) {
    revalidatePath(`/cestas/${id}`);
    revalidatePath(`/cestas/${id}/itens`);
  }
}

export type CestaFormState = { error?: string };

export async function salvarCesta(_prev: CestaFormState, fd: FormData): Promise<CestaFormState> {
  const session = await requireSession();
  const id = inteiro(fd, "id");
  const objeto = txt(fd, "objeto");
  if (objeto.length < 4) return { error: "Descreva o objeto da cesta com pelo menos 4 caracteres." };

  const categorias = listaIds(fd, "categorias");
  const alerta = Math.min(100, Math.max(1, inteiro(fd, "alertaPercentual", 18)));
  const dias = Math.max(0, inteiro(fd, "priorizarPrecosPraticadosDias", 270));
  const colunas = Math.min(30, Math.max(1, inteiro(fd, "mapaVerticalizarColunas", 12)));
  const casas = [2, 3, 4].includes(inteiro(fd, "casasDecimais")) ? inteiro(fd, "casasDecimais") : 2;
  const tiposCalculo = ["MEDIA_ARITMETICA", "MEDIANA", "MENOR", "MAIOR"];
  const tipoCalculo = tiposCalculo.includes(txt(fd, "tipoCalculo")) ? txt(fd, "tipoCalculo") : "MEDIA_ARITMETICA";
  const contratacoes = ["LICITACAO", "DISPENSA", "INEXIGIBILIDADE", "ADESAO", "CONTRATO"];
  const tipoContratacao = contratacoes.includes(txt(fd, "tipoContratacao"))
    ? txt(fd, "tipoContratacao")
    : "LICITACAO";
  const corrigirAtivo = fd.get("corrigirAtivo") !== null;

  const dados = {
    objeto,
    objetoDetalhado: opt(fd, "objetoDetalhado"),
    secretariaId: inteiro(fd, "secretariaId") || null,
    tipoContratacao,
    tipoCalculo,
    casasDecimais: casas,
    dataSolicitacao: data(fd, "dataSolicitacao") ?? new Date(),
    situacao: txt(fd, "situacao") === "SUPORTE" ? "SUPORTE" : "CLIENTE",
    posse: txt(fd, "posse") === "SUPORTE" ? "SUPORTE" : "CLIENTE",
    prazoEnvioCotacoes: data(fd, "prazoEnvioCotacoes"),
    observacao: opt(fd, "observacao"),
    informacoesRodape: opt(fd, "informacoesRodape"),
    alertaPercentual: alerta,
    priorizarPrecosPraticadosDias: dias,
    mapaVerticalizarColunas: colunas,
    corrigirIncidirSobre: corrigirAtivo ? (txt(fd, "corrigirIncidirSobre") === "DESCRICAO" ? "DESCRICAO" : "VALOR") : null,
    corrigirIndice: corrigirAtivo ? opt(fd, "corrigirIndice") : null,
    corrigirDataInicial: corrigirAtivo ? data(fd, "corrigirDataInicial") : null,
    corrigirDataFinal: corrigirAtivo ? data(fd, "corrigirDataFinal") : null,
  };

  let cestaId = id;
  try {
    if (id) {
      const existente = await prisma.cesta.findFirst({ where: { id, tenantId: session.tid }, select: { id: true } });
      if (!existente) return { error: "Cesta não encontrada nesta instituição." };
      await prisma.$transaction([
        prisma.cesta.update({ where: { id }, data: dados }),
        prisma.cestaCategoria.deleteMany({ where: { cestaId: id } }),
        ...(categorias.length
          ? [
              prisma.cestaCategoria.createMany({
                data: categorias.map((categoriaId) => ({ cestaId: id, categoriaId })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);
    } else {
      const criada = await prisma.cesta.create({
        data: {
          ...dados,
          tenantId: session.tid,
          usuarioId: session.uid,
          status: "EM_ABERTO",
          categorias: categorias.length
            ? { createMany: { data: categorias.map((categoriaId) => ({ categoriaId })) } }
            : undefined,
        },
      });
      cestaId = criada.id;
    }
  } catch (erro) {
    console.error("salvarCesta", erro);
    return { error: "Não foi possível salvar a cesta. Verifique os campos e tente novamente." };
  }

  revalidarCesta(cestaId);
  redirect(`/cestas/${cestaId}`);
}

export async function alterarStatusCesta(fd: FormData) {
  const session = await requireSession();
  const id = inteiro(fd, "id");
  const status = txt(fd, "status");
  if (!["EM_ABERTO", "EM_ANDAMENTO", "PRONTA", "FINALIZADA"].includes(status)) return;
  const cesta = await prisma.cesta.findFirst({ where: { id, tenantId: session.tid }, select: { id: true } });
  if (!cesta) return;
  await prisma.cesta.update({
    where: { id },
    data: {
      status,
      finalizadaEm: status === "FINALIZADA" ? new Date() : null,
    },
  });
  revalidarCesta(id);
}

export async function excluirCesta(fd: FormData) {
  const session = await requireSession();
  const id = inteiro(fd, "id");
  const cesta = await prisma.cesta.findFirst({ where: { id, tenantId: session.tid }, select: { id: true } });
  if (!cesta) return;
  await prisma.cesta.delete({ where: { id } });
  revalidarCesta();
  redirect("/cestas");
}

export async function duplicarCesta(fd: FormData) {
  const session = await requireSession();
  const id = inteiro(fd, "id");
  const original = await prisma.cesta.findFirst({
    where: { id, tenantId: session.tid },
    include: {
      categorias: true,
      lotes: true,
      itens: { include: { precos: true } },
    },
  });
  if (!original) return;

  const nova = await prisma.cesta.create({
    data: {
      tenantId: session.tid,
      usuarioId: session.uid,
      objeto: `${original.objeto} (cópia)`,
      objetoDetalhado: original.objetoDetalhado,
      secretariaId: original.secretariaId,
      tipoContratacao: original.tipoContratacao,
      tipoCalculo: original.tipoCalculo,
      casasDecimais: original.casasDecimais,
      dataSolicitacao: new Date(),
      situacao: original.situacao,
      posse: "CLIENTE",
      status: "EM_ABERTO",
      prazoEnvioCotacoes: original.prazoEnvioCotacoes,
      observacao: original.observacao,
      informacoesRodape: original.informacoesRodape,
      alertaPercentual: original.alertaPercentual,
      priorizarPrecosPraticadosDias: original.priorizarPrecosPraticadosDias,
      mapaVerticalizarColunas: original.mapaVerticalizarColunas,
      categorias: { createMany: { data: original.categorias.map((c) => ({ categoriaId: c.categoriaId })) } },
    },
  });

  const mapa = new Map<number, number>();
  for (const lote of original.lotes) {
    const novoLote = await prisma.lote.create({
      data: { cestaId: nova.id, nome: lote.nome, ordem: lote.ordem },
    });
    mapa.set(lote.id, novoLote.id);
  }

  for (const item of original.itens) {
    const novoItem = await prisma.cestaItem.create({
      data: {
        cestaId: nova.id,
        loteId: item.loteId ? mapa.get(item.loteId) ?? null : null,
        produtoId: item.produtoId,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        ordem: item.ordem,
        situacao: item.situacao,
        pesquisarPor: item.pesquisarPor,
        observacao: item.observacao,
        justificativa: item.justificativa,
      },
    });
    if (item.precos.length) {
      await prisma.itemPreco.createMany({
        data: item.precos.map((p) => ({
          itemId: novoItem.id,
          precoId: p.precoId,
          selecionado: p.selecionado,
          origem: p.origem,
          valorManual: p.valorManual,
          orgaoManual: p.orgaoManual,
          ufManual: p.ufManual,
          dataManual: p.dataManual,
          valorCorrigido: p.valorCorrigido,
          fatorCorrecao: p.fatorCorrecao,
        })),
        skipDuplicates: true,
      });
    }
    await recalcularApuracao(novoItem.id);
  }

  revalidarCesta(nova.id);
  redirect(`/cestas/${nova.id}`);
}

export async function gerarLinkPublico(fd: FormData) {
  const session = await requireSession();
  const id = inteiro(fd, "id");
  const cesta = await prisma.cesta.findFirst({ where: { id, tenantId: session.tid }, select: { id: true, token: true } });
  if (!cesta) return;
  if (!cesta.token) {
    await prisma.cesta.update({
      where: { id },
      data: { token: randomBytes(18).toString("base64url") },
    });
  }
  revalidarCesta(id);
}

export async function revogarLinkPublico(fd: FormData) {
  const session = await requireSession();
  const id = inteiro(fd, "id");
  const cesta = await prisma.cesta.findFirst({ where: { id, tenantId: session.tid }, select: { id: true } });
  if (!cesta) return;
  await prisma.cesta.update({ where: { id }, data: { token: null } });
  revalidarCesta(id);
}

export async function enviarDocumento(fd: FormData) {
  const session = await requireSession();
  const cestaId = inteiro(fd, "cestaId");
  const cesta = await prisma.cesta.findFirst({ where: { id: cestaId, tenantId: session.tid }, select: { id: true } });
  if (!cesta) return;

  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return;
  if (arquivo.size > 8 * 1024 * 1024) return;

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  await prisma.documento.create({
    data: {
      cestaId,
      nome: arquivo.name.slice(0, 180),
      tipo: txt(fd, "tipo") || "COMPROVANTE",
      tamanho: arquivo.size,
      conteudo: bytes,
    },
  });
  revalidarCesta(cestaId);
}

export async function excluirDocumento(fd: FormData) {
  const session = await requireSession();
  const cestaId = inteiro(fd, "cestaId");
  const documentoId = inteiro(fd, "documentoId");
  const cesta = await prisma.cesta.findFirst({ where: { id: cestaId, tenantId: session.tid }, select: { id: true } });
  if (!cesta) return;
  await prisma.documento.deleteMany({ where: { id: documentoId, cestaId } });
  revalidarCesta(cestaId);
}

export async function aplicarCorrecao(fd: FormData) {
  const session = await requireSession();
  const cestaId = inteiro(fd, "id");
  const cesta = await prisma.cesta.findFirst({
    where: { id: cestaId, tenantId: session.tid },
    include: { itens: { include: { precos: { include: { preco: true } } } } },
  });
  if (!cesta) return;

  const sigla = txt(fd, "indice");
  const inicio = data(fd, "dataInicial");
  const fim = data(fd, "dataFinal");
  const incidirSobre = txt(fd, "incidirSobre") === "DESCRICAO" ? "DESCRICAO" : "VALOR";
  if (!sigla || !inicio || !fim) return;

  const { fator } = await fatorIndice(sigla, inicio, fim);
  if (!Number.isFinite(fator) || fator <= 0) return;

  await prisma.$transaction([
    prisma.cesta.update({
      where: { id: cestaId },
      data: {
        corrigirIncidirSobre: incidirSobre,
        corrigirIndice: sigla,
        corrigirDataInicial: inicio,
        corrigirDataFinal: fim,
      },
    }),
    ...cesta.itens.flatMap((item) =>
      item.precos.map((p) => {
        const base = p.origem === "MANUAL" ? dec(p.valorManual) : dec(p.preco?.valor);
        return prisma.itemPreco.update({
          where: { id: p.id },
          data: {
            valorCorrigido: Number((base * fator).toFixed(4)),
            fatorCorrecao: Number(fator.toFixed(4)),
          },
        });
      }),
    ),
  ]);

  for (const item of cesta.itens) await recalcularApuracao(item.id);
  revalidarCesta(cestaId);
}

export async function limparCorrecao(fd: FormData) {
  const session = await requireSession();
  const cestaId = inteiro(fd, "id");
  const cesta = await prisma.cesta.findFirst({
    where: { id: cestaId, tenantId: session.tid },
    include: { itens: { select: { id: true } } },
  });
  if (!cesta) return;

  await prisma.$transaction([
    prisma.cesta.update({
      where: { id: cestaId },
      data: {
        corrigirIncidirSobre: null,
        corrigirIndice: null,
        corrigirDataInicial: null,
        corrigirDataFinal: null,
      },
    }),
    prisma.itemPreco.updateMany({
      where: { item: { cestaId } },
      data: { valorCorrigido: null, fatorCorrecao: null },
    }),
  ]);

  for (const item of cesta.itens) await recalcularApuracao(item.id);
  revalidarCesta(cestaId);
}
