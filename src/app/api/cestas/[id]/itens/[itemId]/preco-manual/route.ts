import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalcularApuracao } from "@/lib/apuracao";

function parseNumero(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseData(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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

    const formData = await request.formData();
    const valor = parseNumero(formData.get("valor"));
    const orgao = String(formData.get("orgao") || "Pesquisa direta").slice(0, 200);
    const uf = String(formData.get("uf") || "").slice(0, 2).toUpperCase() || null;
    const data = parseData(formData.get("data")) ?? new Date();

    if (valor <= 0) {
      return NextResponse.json({ error: "Valor deve ser maior que zero" }, { status: 400 });
    }

    const item = await prisma.cestaItem.findFirst({
      where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    await prisma.itemPreco.create({
      data: {
        itemId: itemIdNum,
        selecionado: true,
        origem: "MANUAL",
        valorManual: valor,
        orgaoManual: orgao,
        ufManual: uf,
        dataManual: data,
      },
    });

    await recalcularApuracao(itemIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao adicionar preço manual:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}