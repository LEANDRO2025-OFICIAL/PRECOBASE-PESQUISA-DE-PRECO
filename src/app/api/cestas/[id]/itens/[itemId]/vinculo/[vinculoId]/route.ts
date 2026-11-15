import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalcularApuracao } from "@/lib/apuracao";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; vinculoId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, itemId, vinculoId } = await params;
    const cestaId = Number(id);
    const itemIdNum = Number(itemId);
    const vinculoIdNum = Number(vinculoId);

    if (!Number.isFinite(cestaId) || !Number.isFinite(itemIdNum) || !Number.isFinite(vinculoIdNum)) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    const item = await prisma.cestaItem.findFirst({
      where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    await prisma.itemPreco.deleteMany({
      where: { id: vinculoIdNum, itemId: itemIdNum, item: { cestaId } },
    });

    await recalcularApuracao(itemIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir vínculo:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}