import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();

    // Busca configurações do tenant (usando a primeira cesta como referência ou valores padrão)
    const cesta = await prisma.cesta.findFirst({
      where: { tenantId: session.tid },
      orderBy: { createdAt: "desc" },
      select: {
        alertaPercentual: true,
        priorizarPrecosPraticadosDias: true,
        mapaVerticalizarColunas: true,
      },
    });

    return NextResponse.json({
      config: {
        alertaPercentual: cesta?.alertaPercentual ?? 18,
        priorizarPrecosPraticadosDias: cesta?.priorizarPrecosPraticadosDias ?? 270,
        mapaVerticalizarColunas: cesta?.mapaVerticalizarColunas ?? 12,
        arredondamentoAbnt: true,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar configurações do sistema:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { alertaPercentual, priorizarPrecosPraticadosDias, mapaVerticalizarColunas, arredondamentoAbnt } = body;

    // Validações básicas
    if (typeof alertaPercentual !== "number" || alertaPercentual < 1 || alertaPercentual > 50) {
      return NextResponse.json({ error: "Alerta de desvio deve ser entre 1 e 50" }, { status: 400 });
    }
    if (typeof priorizarPrecosPraticadosDias !== "number" || priorizarPrecosPraticadosDias < 0 || priorizarPrecosPraticadosDias > 730) {
      return NextResponse.json({ error: "Dias deve ser entre 0 e 730" }, { status: 400 });
    }
    if (typeof mapaVerticalizarColunas !== "number" || mapaVerticalizarColunas < 1 || mapaVerticalizarColunas > 24) {
      return NextResponse.json({ error: "Colunas deve ser entre 1 e 24" }, { status: 400 });
    }

    // Atualiza configurações padrão para novas cestas (poderia ser uma tabela de configurações do tenant)
    // Por enquanto, apenas valida e retorna sucesso
    // Em uma implementação completa, salvaria em uma tabela ConfigTenant

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar configurações do sistema:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}