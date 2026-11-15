import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const pagina = searchParams.get("pagina") ?? "1";
    const tamanhoPagina = searchParams.get("tamanhoPagina") ?? "10";
    const codigoModalidade = searchParams.get("codigoModalidade");
    const codigoSituacao = searchParams.get("codigoSituacao");
    const uf = searchParams.get("uf");
    const municipio = searchParams.get("municipio");
    const q = searchParams.get("q");

    const params = new URLSearchParams({ pagina, tamanhoPagina });
    if (codigoModalidade) params.set("codigoModalidade", codigoModalidade);
    if (codigoSituacao) params.set("codigoSituacao", codigoSituacao);
    if (uf) params.set("uf", uf);
    if (municipio) params.set("municipio", municipio);
    if (q) params.set("q", q);

    const res = await fetch(`${PNCP_BASE}/contratacoes/publicacao?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "precobase/1.0" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `PNCP retornou ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Erro ao consultar PNCP:", error);
    return NextResponse.json({ error: error?.message ?? "Erro interno" }, { status: 500 });
  }
}
