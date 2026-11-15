import { NextRequest } from "next/server";
import { GET as baixarDocumento } from "@/app/api/documentos/[id]/route";

/**
 * Rota amigável para download de documentos anexados:
 *   /documentos/{id}
 * Delega para o handler central em /api/documentos/[id].
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return baixarDocumento(request, { params });
}
