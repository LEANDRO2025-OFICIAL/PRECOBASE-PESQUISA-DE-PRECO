import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { importarPaginaCatalogo } from "@/lib/catalogo";

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const body = await request.json();
    const origem: string = body.origem ?? "CATMAT";
    const pagina: number = Number(body.pagina ?? 1);
    const tamanho: number = Number(body.tamanho ?? 10);
    const termo: string | undefined = body.termo;

    if (!["CATMAT", "CATSER"].includes(origem)) {
      return NextResponse.json({ error: "Origem inválida" }, { status: 400 });
    }

    const resultado = await importarPaginaCatalogo({
      origem: origem as "CATMAT" | "CATSER",
      pagina,
      tamanho,
      termo,
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("Erro ao importar catálogo:", error);
    return NextResponse.json({ error: error?.message ?? "Erro interno" }, { status: 500 });
  }
}
