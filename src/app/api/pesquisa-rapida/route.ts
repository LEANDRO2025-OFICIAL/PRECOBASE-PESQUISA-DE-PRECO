import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estatisticasProduto, serieMensal } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();
    const uf = searchParams.get("uf")?.toUpperCase();
    const dias = Math.max(0, Number(searchParams.get("dias") || "270"));
    const fonteId = searchParams.get("fonte");
    const incluirDispensas = searchParams.get("incluirDispensas") === "true";

    if (!q || q.length < 3) {
      return NextResponse.json({ error: "Termo de busca deve ter pelo menos 3 caracteres" }, { status: 400 });
    }

    // Busca produto por código BR, descrição ou grupo
    const produto = await prisma.produto.findFirst({
      where: {
        ativo: true,
        OR: [
          { codigoBr: { contains: q, mode: "insensitive" } },
          { descricao: { contains: q, mode: "insensitive" } },
          { grupo: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, codigoBr: true, descricao: true, unidade: true, grupo: true },
    });

    if (!produto) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    // Busca preços
    const where: any = { produtoId: produto.id };
    if (uf) where.uf = uf;
    if (dias > 0) {
      const desde = new Date(Date.now() - dias * 86400000);
      where.data = { gte: desde };
    }
    if (fonteId && fonteId !== "TODAS") where.fonteId = Number(fonteId);
    if (!incluirDispensas) where.dispensa = false;

    const precos = await prisma.preco.findMany({
      where,
      include: { fonte: { select: { id: true, sigla: true, nome: true } } },
      orderBy: { data: "desc" },
      take: 500,
    });

    // Estatísticas
    const { estatisticas, fontes } = await estatisticasProduto(produto.id);
    const serie = serieMensal(precos.map((p) => ({ data: p.data, valor: p.valor })));

    return NextResponse.json({
      produto,
      precos,
      estatisticas,
      fontes,
      serie,
    });
  } catch (error) {
    console.error("Erro na pesquisa rápida:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}