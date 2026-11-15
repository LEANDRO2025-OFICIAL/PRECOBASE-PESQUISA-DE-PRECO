import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();
    const grupo = searchParams.get("grupo");
    const ativos = searchParams.get("ativos") !== "false";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));

    const where: any = {};
    if (ativos) where.ativo = true;
    if (grupo) where.grupo = grupo;
    if (q) {
      where.OR = [
        { codigoBr: { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
        { grupo: { contains: q, mode: "insensitive" } },
      ];
    }

    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        select: {
          id: true,
          codigoBr: true,
          descricao: true,
          unidade: true,
          grupo: true,
          ativo: true,
          _count: { select: { precos: true } },
        },
        orderBy: [{ grupo: "asc" }, { codigoBr: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.produto.count({ where }),
    ]);

    return NextResponse.json({ produtos, total });
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}