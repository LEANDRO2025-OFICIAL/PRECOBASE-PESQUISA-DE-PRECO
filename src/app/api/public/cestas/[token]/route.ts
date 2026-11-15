import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const cesta = await prisma.cesta.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        objeto: true,
        objetoDetalhado: true,
        secretaria: { select: { nome: true, sigla: true } },
        dataSolicitacao: true,
        prazoEnvioCotacoes: true,
        situacao: true,
        itens: {
          orderBy: { ordem: "asc" },
          select: {
            id: true,
            ordem: true,
            descricao: true,
            unidade: true,
            quantidade: true,
            produto: { select: { codigoBr: true } },
          },
        },
        documentos: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            nome: true,
            tipo: true,
            tamanho: true,
            createdAt: true,
          },
        },
      },
    });

    if (!cesta) {
      return NextResponse.json({ error: "Cesta não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ cesta });
  } catch (error) {
    console.error("Erro ao buscar cesta pública:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}