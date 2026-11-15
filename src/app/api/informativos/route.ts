import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();
    const categoria = searchParams.get("categoria");
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || "10")));

    const where: any = {
      OR: [{ tenantId: session.tid }, { tenantId: null }],
    };
    if (categoria) where.categoria = categoria;
    if (q) {
      where.OR = [
        { titulo: { contains: q, mode: "insensitive" } },
        { resumo: { contains: q, mode: "insensitive" } },
        { corpo: { contains: q, mode: "insensitive" } },
      ];
    }

    const [informativos, total, categorias] = await Promise.all([
      prisma.informativo.findMany({
        where,
        select: {
          id: true,
          titulo: true,
          resumo: true,
          corpo: true,
          categoria: true,
          publicadoEm: true,
          tenantId: true,
        },
        orderBy: { publicadoEm: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.informativo.count({ where }),
      prisma.informativo.findMany({
        where: { OR: [{ tenantId: session.tid }, { tenantId: null }] },
        select: { categoria: true },
        distinct: ["categoria"],
        orderBy: { categoria: "asc" },
      }),
    ]);

    return NextResponse.json({
      informativos,
      total,
      categorias: categorias.map((c) => c.categoria),
    });
  } catch (error) {
    console.error("Erro ao listar informativos:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}