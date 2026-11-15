import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
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

    const cesta = await prisma.cesta.findFirst({
      where: { id: cestaId, tenantId: session.tid },
      select: {
        id: true,
        objeto: true,
        tipoCalculo: true,
        casasDecimais: true,
        alertaPercentual: true,
        priorizarPrecosPraticadosDias: true,
      },
    });

    if (!cesta) {
      return NextResponse.json({ error: "Cesta não encontrada" }, { status: 404 });
    }

    const item = await prisma.cestaItem.findFirst({
      where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
      include: {
        produto: { select: { id: true, codigoBr: true } },
        cesta: { select: { tipoCalculo: true, casasDecimais: true, alertaPercentual: true } },
        apuracao: { select: { calculadoEm: true } },
        precos: {
          include: { preco: { include: { fonte: { select: { id: true, sigla: true, nome: true, tipo: true } } } } },
          orderBy: { id: "asc" },
        },
        lote: { select: { nome: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const fontes = await prisma.fonte.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      select: { id: true, sigla: true, nome: true, tipo: true },
    });

    return NextResponse.json({ cesta, item, fontes, precos: item.precos });
  } catch (error) {
    console.error("Erro ao carregar pesquisa de fontes:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}