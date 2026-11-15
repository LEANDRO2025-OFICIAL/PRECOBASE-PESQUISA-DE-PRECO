import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalcularApuracao } from "@/lib/apuracao";

async function vincularAcervo(itemId: number, dias: number) {
  const item = await prisma.cestaItem.findUnique({
    where: { id: itemId },
    include: { cesta: { select: { priorizarPrecosPraticadosDias: true } } },
  });
  if (!item?.produtoId) return 0;

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, itemId } = await params;
    const cestaId = Number(id);
    const itemIdNum = Number(itemId);

    if (!Number.isFinite(cestaId) || !Number.isFinite(itemIdNum)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    const item = await prisma.cestaItem.findFirst({
      where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
      include: { cesta: { select: { priorizarPrecosPraticadosDias: true } } },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const dias = Math.max(0, item.cesta.priorizarPrecosPraticadosDias);
    const count = await vincularAcervo(itemIdNum, dias);

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Erro ao revincular acervo:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}