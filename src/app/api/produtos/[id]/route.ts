import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estatisticasProduto, serieMensal } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const produtoId = Number(id);

    if (!Number.isFinite(produtoId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true, codigoBr: true, descricao: true, unidade: true, grupo: true, ativo: true },
    });

    if (!produto) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const precos = await prisma.preco.findMany({
      where: { produtoId },
      include: { fonte: { select: { id: true, sigla: true, nome: true } } },
      orderBy: { data: "desc" },
    });

    const { estatisticas, fontes } = await estatisticasProduto(produtoId);
    const serie = serieMensal(precos.map((p) => ({ data: p.data, valor: p.valor })));

    return NextResponse.json({ produto, precos, estatisticas, fontes, serie });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}