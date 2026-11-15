import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resumoDaCesta } from "@/lib/queries";
import { brl, dateBR, qtd } from "@/lib/format";
import { gerarMapaPDF } from "@/lib/documentos";
import { gerarPesquisasUnificadasPDF } from "@/lib/documentos";
import { gerarRelatorioFontePDF } from "@/lib/documentos";
import { gerarColetaDOCX } from "@/lib/documentos";
import { gerarColetaPDF } from "@/lib/documentos";
import { gerarMapaXXLSX } from "@/lib/documentos";
import { gerarTRXLSX } from "@/lib/documentos";
import { gerarSubanexoXXLSX } from "@/lib/documentos";

export type TipoDocumento =
  | "mapa-pdf"
  | "mapa-xlsx"
  | "pesquisas-unificadas-pdf"
  | "contratacoes-similares-pdf"
  | "relatorio-fonte-pdf"
  | "coleta-pdf"
  | "coleta-docx"
  | "tr-xlsx"
  | "mapa-xlsx-layout"
  | "subanexo-x-xlsx";

function tipoParaFormato(tipo: string | null): { tipo: TipoDocumento; extensao: string } {
  const t = (tipo ?? "mapa-pdf") as TipoDocumento;
  const ext = t.endsWith("-xlsx") ? "xlsx" : t.endsWith("-docx") ? "docx" : "pdf";
  return { tipo: t, extensao: ext };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const cestaId = Number(id);

    if (!Number.isFinite(cestaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const tipoParam = searchParams.get("tipo");
    const formatoParam = searchParams.get("formato"); // legado: pdf | xlsx

    let tipo: TipoDocumento;
    let extensao: string;
    if (tipoParam) {
      ({ tipo, extensao } = tipoParaFormato(tipoParam));
    } else {
      tipo = formatoParam === "xlsx" ? "mapa-xlsx" : "mapa-pdf";
      extensao = formatoParam === "xlsx" ? "xlsx" : "pdf";
    }

    const cesta = await prisma.cesta.findFirst({
      where: { id: cestaId, tenantId: session.tid },
      include: {
        secretaria: true,
        lotes: { orderBy: { ordem: "asc" } },
        itens: {
          orderBy: [{ loteId: "asc" }, { ordem: "asc" }],
          include: {
            produto: true,
            lote: true,
            apuracao: true,
            precos: {
              where: { selecionado: true },
              include: { preco: { include: { fonte: true } } },
              orderBy: { id: "asc" },
            },
          },
        },
        documentos: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!cesta) {
      return NextResponse.json({ error: "Cesta não encontrada" }, { status: 404 });
    }

    const resumo = resumoDaCesta(cesta as any);

    // Dispatch por tipo de documento
    if (tipo === "mapa-pdf") {
      const buffer = await gerarMapaPDF(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="mapa-apuracao-cesta-${cesta.id}.pdf"`,
        },
      });
    }

    if (tipo === "mapa-xlsx") {
      return gerarXLSX(cesta, resumo);
    }

    if (tipo === "pesquisas-unificadas-pdf") {
      const buffer = await gerarPesquisasUnificadasPDF(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="pesquisas-unificadas-cesta-${cesta.id}.pdf"`,
        },
      });
    }

    if (tipo === "relatorio-fonte-pdf" || tipo === "contratacoes-similares-pdf") {
      const sigla = searchParams.get("fonte") ?? undefined;
      const buffer = await gerarRelatorioFontePDF(cesta as any, {
        siglaFonte: sigla,
        titulo:
          tipo === "contratacoes-similares-pdf"
            ? "CONTRATAÇÕES SIMILARES DE OUTROS ÓRGÃOS"
            : "RELATÓRIO DE PESQUISA DE PREÇOS",
        sub: tipo === "contratacoes-similares-pdf" ? "Pesquisa de preços praticados por outros órgãos e entidades" : "",
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${tipo === "contratacoes-similares-pdf" ? "contratacoes-similares" : "relatorio-fonte"}-cesta-${cesta.id}.pdf"`,
        },
      });
    }

    if (tipo === "coleta-docx") {
      const buffer = await gerarColetaDOCX(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="coleta-preco-cesta-${cesta.id}.docx"`,
        },
      });
    }

    if (tipo === "coleta-pdf") {
      // Versão PDF simplificada da coleta de preço
      const buffer = await gerarColetaPDF(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="coleta-preco-cesta-${cesta.id}.pdf"`,
        },
      });
    }

    if (tipo === "mapa-xlsx-layout") {
      const buffer = await gerarMapaXXLSX(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="mapa-apuracao-cesta-${cesta.id}.xlsx"`,
        },
      });
    }

    if (tipo === "tr-xlsx") {
      const buffer = await gerarTRXLSX(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="termo-referencia-cesta-${cesta.id}.xlsx"`,
        },
      });
    }

    if (tipo === "subanexo-x-xlsx") {
      const buffer = await gerarSubanexoXXLSX(cesta as any);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="subanexo-x-cesta-${cesta.id}.xlsx"`,
        },
      });
    }

    // Legacy: redireciona para mapa-pdf por padrão
    const buffer = await gerarMapaPDF(cesta as any);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mapa-apuracao-cesta-${cesta.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

async function gerarXLSX(cesta: any, resumo: any) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mapa de Apuração");

  const casas = cesta.casasDecimais;

  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = "MAPA DE APURAÇÃO DE PREÇOS";
  ws.getCell("A1").font = { bold: true, size: 16 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:H2");
  ws.getCell("A2").value = cesta.objeto;
  ws.getCell("A2").font = { size: 12 };
  ws.getCell("A2").alignment = { horizontal: "center" };

  if (cesta.objetoDetalhado) {
    ws.mergeCells("A3:H3");
    ws.getCell("A3").value = cesta.objetoDetalhado;
    ws.getCell("A3").font = { size: 10 };
    ws.getCell("A3").alignment = { horizontal: "center" };
  }

  let row = 5;
  const info = [
    ["Cesta:", `#${cesta.id}`],
    ["Secretaria:", cesta.secretaria?.nome ?? "—"],
    ["Data:", dateBR(cesta.dataSolicitacao)],
    ["Tipo de cálculo:", cesta.tipoCalculo.replace("_", " ")],
    ["Casas decimais:", casas],
    ["Situação:", cesta.situacao],
    ["Posse:", cesta.posse],
    ["Status:", cesta.status],
  ];
  for (const [label, value] of info) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true, size: 9 };
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = { size: 9 };
    ws.mergeCells(`B${row}:C${row}`);
    row++;
  }
  row++;

  for (const lote of cesta.lotes) {
    const itensLote = cesta.itens.filter((i: any) => i.loteId === lote.id);
    if (itensLote.length === 0) continue;

    ws.mergeCells(`A${row}:H${row}`);
    ws.getCell(`A${row}`).value = lote.nome;
    ws.getCell(`A${row}`).font = { bold: true, size: 11, underline: true };
    row++;

    const headers = ["Item", "Descrição", "Un", "Qtd", "Menor", "Média", "Mediana", "Maior"];
    headers.forEach((h, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 8 };
      cell.alignment = { horizontal: i === 0 || i >= 2 ? "center" : "left" };
      cell.border = { bottom: { style: "thin" } };
    });
    row++;

    for (const item of itensLote) {
      const r = resumo.itens.find((ri: any) => ri.id === item.id);
      if (!r) continue;

      const vals = [
        item.ordem,
        item.descricao,
        item.unidade,
        Number(item.quantidade),
        r.semPreco ? null : r.estatisticas.menor,
        r.semPreco ? null : r.estatisticas.media,
        r.semPreco ? null : r.estatisticas.mediana,
        r.semPreco ? null : r.estatisticas.maior,
      ];
      vals.forEach((v, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = v;
        cell.font = { size: 8 };
        cell.alignment = { horizontal: i === 0 || i >= 2 ? "center" : "left" };
        if (i >= 4 && v !== null) cell.numFmt = `#,##0.${"0".repeat(casas)}`;
      });
      row++;

      if (item.precos.length > 0) {
        for (const vp of item.precos) {
          if (!vp.selecionado) continue;
          const valor = vp.valorCorrigido !== null ? Number(vp.valorCorrigido) : vp.origem === "MANUAL" ? Number(vp.valorManual ?? 0) : Number(vp.preco?.valor ?? 0);
          const fonte = vp.preco?.fonte?.sigla ?? vp.orgaoManual ?? "Manual";
          const orgao = vp.preco?.orgao ?? vp.orgaoManual ?? "—";
          const data = vp.preco ? dateBR(vp.preco.data) : vp.dataManual ? dateBR(vp.dataManual) : "—";
          ws.getCell(row, 1).value = "";
          ws.getCell(row, 2).value = `  ${fonte} — ${orgao} (${data})`;
          ws.getCell(row, 2).font = { size: 7, italic: true };
          ws.getCell(row, 5).value = valor;
          ws.getCell(row, 5).numFmt = `#,##0.${"0".repeat(casas)}`;
          ws.getCell(row, 5).font = { size: 8 };
          row++;
        }
      }
    }

    const totalLote = itensLote.reduce((acc: number, item: any) => {
      const r = resumo.itens.find((ri: any) => ri.id === item.id);
      return acc + (r?.total ?? 0);
    }, 0);
    ws.getCell(`A${row}`).value = `Total do ${lote.nome}:`;
    ws.getCell(`A${row}`).font = { bold: true, size: 9 };
    ws.mergeCells(`A${row}:D${row}`);
    ws.getCell(`E${row}`).value = totalLote;
    ws.getCell(`E${row}`).numFmt = "#,##0.00";
    ws.getCell(`E${row}`).font = { bold: true, size: 9 };
    ws.mergeCells(`E${row}:H${row}`);
    row += 2;
  }

  ws.getCell(`A${row}`).value = "TOTAL GERAL:";
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`E${row}`).value = resumo.total;
  ws.getCell(`E${row}`).numFmt = "#,##0.00";
  ws.getCell(`E${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`E${row}:H${row}`);

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 45;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 16;
  ws.getColumn(7).width = 16;
  ws.getColumn(8).width = 16;

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mapa-apuracao-cesta-${cesta.id}.xlsx"`,
    },
  });
}
