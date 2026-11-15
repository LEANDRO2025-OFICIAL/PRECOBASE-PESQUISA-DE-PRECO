import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const documentoId = Number(id);

    if (!Number.isFinite(documentoId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const documento = await prisma.documento.findFirst({
      where: { id: documentoId, cesta: { tenantId: session.tid } },
      select: { id: true, nome: true, tipo: true, tamanho: true, conteudo: true, cestaId: true },
    });

    if (!documento) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    const contentType = documento.tipo === "PDF" ? "application/pdf" :
      documento.tipo === "IMAGEM" ? "image/png" :
      "application/octet-stream";

    const buffer = documento.conteudo ? Buffer.from(documento.conteudo) : Buffer.alloc(0);

    // Cabeçalhos HTTP só aceitam bytes ASCII: usa fallback sanitizado + RFC 5987.
    const nomeArquivo = documento.nome || "documento";
    const nomeAscii = nomeArquivo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_");
    const nomeCodificado = encodeURIComponent(nomeArquivo);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${nomeAscii}"; filename*=UTF-8''${nomeCodificado}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar documento:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}