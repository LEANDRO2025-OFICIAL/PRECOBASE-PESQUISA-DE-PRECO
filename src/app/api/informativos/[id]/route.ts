import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const informativoId = Number(id);

    if (!Number.isFinite(informativoId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const informativo = await prisma.informativo.findFirst({
      where: {
        id: informativoId,
        OR: [{ tenantId: session.tid }, { tenantId: null }],
      },
      select: {
        id: true,
        titulo: true,
        resumo: true,
        corpo: true,
        categoria: true,
        publicadoEm: true,
        tenantId: true,
      },
    });

    if (!informativo) {
      return NextResponse.json({ error: "Informativo não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ informativo });
  } catch (error) {
    console.error("Erro ao buscar informativo:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}