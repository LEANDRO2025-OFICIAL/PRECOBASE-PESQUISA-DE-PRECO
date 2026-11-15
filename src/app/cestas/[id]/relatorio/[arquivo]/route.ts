import { NextRequest } from "next/server";
import { GET as gerarRelatorio } from "@/app/api/cestas/[id]/relatorio/route";
import type { TipoDocumento } from "@/app/api/cestas/[id]/relatorio/route";

/**
 * Rota amigável para download de documentos da cesta:
 *   /cestas/{id}/relatorio/mapa.pdf          -> tipo mapa-pdf
 *   /cestas/{id}/relatorio/mapa.xlsx         -> tipo mapa-xlsx
 *   /cestas/{id}/relatorio/coleta.pdf        -> tipo coleta-pdf
 *   /cestas/{id}/relatorio/coleta.docx       -> tipo coleta-docx
 *   /cestas/{id}/relatorio/tr.xlsx           -> tipo tr-xlsx
 *   /cestas/{id}/relatorio/subanexo-x.xlsx   -> tipo subanexo-x-xlsx
 *   /cestas/{id}/relatorio/mapa-xlsx-layout  -> tipo mapa-xlsx-layout
 * Delega para o handler central em /api/cestas/[id]/relatorio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; arquivo: string }> },
) {
  const { id, arquivo } = await params;
  const nome = arquivo.toLowerCase();

  let tipo: TipoDocumento = "mapa-pdf";
  if (nome.endsWith(".xlsx")) {
    if (nome.includes("subanexo")) tipo = "subanexo-x-xlsx";
    else if (nome.startsWith("tr") || nome.includes("termo") || nome.includes("-tr")) tipo = "tr-xlsx";
    else if (nome.includes("mapa-xlsx-layout")) tipo = "mapa-xlsx-layout";
    else tipo = "mapa-xlsx-layout";
  } else if (nome.endsWith(".docx")) {
    tipo = "coleta-docx";
  } else if (nome.includes("coleta")) {
    tipo = "coleta-pdf";
  } else if (nome.includes("pesquisas-unificadas")) {
    tipo = "pesquisas-unificadas-pdf";
  } else if (nome.includes("contratacoes-similares")) {
    tipo = "contratacoes-similares-pdf";
  } else if (nome.includes("relatorio-fonte")) {
    tipo = "relatorio-fonte-pdf";
  } else {
    tipo = "mapa-pdf";
  }

  const url = new URL(request.url);
  url.searchParams.set("tipo", tipo);

  const requisicao = new NextRequest(url, {
    method: "GET",
    headers: request.headers,
  });

  return gerarRelatorio(requisicao, { params: Promise.resolve({ id }) });
}
