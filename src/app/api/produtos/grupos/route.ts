import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const grupos = await prisma.produto.findMany({
      where: { ativo: true, grupo: { not: null } },
      select: { grupo: true },
      distinct: ["grupo"],
      orderBy: { grupo: "asc" },
    });
    return NextResponse.json(grupos.map((g) => g.grupo!).filter((g): g is string => !!g));
  } catch (error) {
    console.error("Erro ao buscar grupos:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}