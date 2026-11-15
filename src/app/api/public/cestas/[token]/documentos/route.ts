import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
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
      select: { id: true },
    });

    if (!cesta) {
      return NextResponse.json({ error: "Cesta não encontrada" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const resultados = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        resultados.push({ nome: file.name, erro: "Arquivo excede 10MB" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const tipo = file.type || "application/octet-stream";

      const doc = await prisma.documento.create({
        data: {
          cestaId: cesta.id,
          nome: file.name,
          tipo: tipo.startsWith("image/") ? "IMAGEM" : tipo === "application/pdf" ? "PDF" : "OUTRO",
          tamanho: file.size,
          conteudo: buffer,
        },
        select: { id: true, nome: true, tipo: true, tamanho: true, createdAt: true },
      });

      resultados.push(doc);
    }

    return NextResponse.json({ documentos: resultados });
  } catch (error) {
    console.error("Erro ao enviar documentos:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}