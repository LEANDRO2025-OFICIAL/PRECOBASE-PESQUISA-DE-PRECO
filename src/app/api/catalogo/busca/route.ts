import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buscarCatalogoUnificado, type OrigemCatalogo } from "@/lib/catalogo";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const origem = (searchParams.get("origem") ?? "TODAS") as OrigemCatalogo | "TODAS";
    const take = Math.max(1, Math.min(Number(searchParams.get("take") ?? "100"), 500));

    const resultado = await buscarCatalogoUnificado({ q, origem, take });
    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("Erro ao buscar catálogo:", error);
    return NextResponse.json({ error: error?.message ?? "Erro interno" }, { status: 500 });
  }
}
