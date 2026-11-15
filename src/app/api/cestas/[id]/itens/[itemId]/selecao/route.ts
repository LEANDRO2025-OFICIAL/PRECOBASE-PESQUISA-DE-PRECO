import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalcularApuracao } from "@/lib/apuracao";

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

    const formData = await request.formData();
    const acao = formData.get("acao") as string;
    const visiveisStr = formData.get("visiveis") as string;
    const selecionadosStr = formData.get("selecionados") as string;

    if (!visiveisStr) {
      return NextResponse.json({ error: "Lista de visíveis obrigatória" }, { status: 400 });
    }

    const visiveis = visiveisStr
      .split(",")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!visiveis.length) {
      return NextResponse.json({ error: "Nenhum preço visível" }, { status: 400 });
    }

    const item = await prisma.cestaItem.findFirst({
      where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const marcados = new Set(
      (selecionadosStr || "")
        .split(",")
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0),
    );

    const selecionar =
      acao === "todos" ? new Set(visiveis) : acao === "nenhum" ? new Set<number>() : marcados;

    await prisma.$transaction(
      visiveis.map((vinculoId) =>
        prisma.itemPreco.updateMany({
          where: { id: vinculoId, itemId: itemIdNum },
          data: { selecionado: selecionar.has(vinculoId) },
        }),
      ),
    );

    await recalcularApuracao(itemIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar seleção:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}