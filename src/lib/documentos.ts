import PDFKit from "pdfkit";
import ExcelJS from "exceljs";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  TextRun,
  PageOrientation,
  convertInchesToTwip,
} from "docx";

type PDFKitDoc = InstanceType<typeof PDFKit>;
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { resumoDaCesta } from "@/lib/queries";
import { brl, dateBR, qtd, num, pct } from "@/lib/format";
import type { CestaCompleta } from "@/lib/queries";

const TENANT_NOME = "PreçoBase";
const TENANT_TAGLINE = "Gestão de Pesquisa de Preços";
const TENANT_RODAPE = "PreçoBase · Gestão de Pesquisa de Preços";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

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

/** Valor efetivo de um vínculo de preço (corrigido > manual > fonte). */
export function valorVinculo(ip: { origem: string; valorManual: unknown; valorCorrigido: unknown; preco: { valor: unknown } | null }): number {
  if (ip.valorCorrigido !== null && ip.valorCorrigido !== undefined) return Number(ip.valorCorrigido);
  if (ip.origem === "MANUAL") return Number(ip.valorManual ?? 0);
  return ip.preco ? Number(ip.preco.valor) : 0;
}

/** Dados de preços agrupados por fonte sigla para um item. */
export type PrecoPorFonte = {
  sigla: string;
  nome: string;
  orgao: string;
  uf: string;
  data: string;
  valor: number;
};

export function extrairPrecosPorFonte(
  item: CestaCompleta["itens"][number],
): PrecoPorFonte[] {
  const porFonte = new Map<string, PrecoPorFonte>();
  for (const vp of item.precos) {
    const p = vp.preco;
    const valor = valorVinculo(vp);
    if (valor <= 0) continue;
    const sigla = p?.fonte?.sigla ?? (vp.origem === "MANUAL" ? "MANUAL" : "—");
    const existente = porFonte.get(sigla);
    if (!existente) {
      porFonte.set(sigla, {
        sigla,
        nome: p?.fonte?.nome ?? (vp.origem === "MANUAL" ? "Preço manual" : "—"),
        orgao: p?.orgao ?? vp.orgaoManual ?? "—",
        uf: p?.uf ?? vp.ufManual ?? "—",
        data: p ? dateBR(p.data) : vp.dataManual ? dateBR(vp.dataManual) : "—",
        valor,
      });
    } else if (valor < existente.valor) {
      existente.valor = valor;
    }
  }
  return [...porFonte.values()].sort((a, b) => a.sigla.localeCompare(b.sigla));
}

// ═════════════════════════════════════════════════════════════════════════════
// Helpers de PDF (pdfkit)
// ═════════════════════════════════════════════════════════════════════════════

type PageSizeName = "A4" | "A3";

function newPdf({ size, layout }: { size: PageSizeName; layout: "portrait" | "landscape" }) {
  return new PDFKit({ margin: 40, size, layout });
}

async function pdfBuffer(doc: PDFKitDoc): Promise<Buffer> {
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const promise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.end();
  return promise;
}

function cabecalhoInstitucional(doc: PDFKitDoc, cesta: { id: number; objeto: string; objetoDetalhado?: string | null }) {
  const pageWidth = doc.page.width - 80;
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#12211F").text(TENANT_NOME, { align: "left" });
  doc.fontSize(8).font("Helvetica").fillColor("#6B7B78").text(TENANT_TAGLINE, { align: "left" });
  doc.moveDown(0.3);

  // Caixas ID / DATA / VALOR TOTAL à direita
  const infoY = doc.y;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F");
  doc.text("ID", 40, infoY, { width: 60 });
  doc.text(String(cesta.id), 100, infoY, { width: 80 });
  doc.text("DATA", 190, infoY, { width: 60 });
  doc.text(dateBR(new Date()), 250, infoY, { width: 100 });
  doc.text("VALOR TOTAL", 40, infoY + 16, { width: 60 });
  // valor total será preenchido depois via doc.y; deixar espaço
  doc.moveDown(1.4);

  doc.fontSize(18).font("Helvetica-Bold").fillColor("#12211F").text("MAPA DE APURAÇÃO DE PREÇOS", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica").fillColor("#12211F").text(cesta.objeto, { align: "center" });
  if (cesta.objetoDetalhado) {
    doc.fontSize(9).font("Helvetica").fillColor("#6B7B78").text(cesta.objetoDetalhado, { align: "center" });
  }
  doc.moveDown(0.6);

  // Linha divisória
  doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
  doc.moveDown(0.4);
}

async function rodapePadrao(doc: PDFKitDoc, cestaId: number, token: string | null, pagina: string) {
  const pageWidth = doc.page.width - 80;
  const y = doc.page.height - 60;
  doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#6B7B78");
  doc.text("CONFORME LEI 14.133/21 E IN SEGES/ME 65/21", 40, y + 8, { width: pageWidth / 2 });
  doc.text("VALOR(ES) RETIRADO(S) POR INCOMPATIBILIDADE(S) DE PREÇO(S)", 40, y + 18, { width: pageWidth / 2 });
  doc.text(TENANT_RODAPE, 40, y + 30, { width: pageWidth / 2 });
  doc.text(`MAPA DE APURAÇÃO DE PREÇOS ${cestaId}`, 40, y + 8, {
    width: pageWidth / 2,
    align: "right",
  });
  doc.text(`Página ${pagina}`, 40, y + 18, { width: pageWidth / 2, align: "right" });

  // QR Code opcional
  if (token) {
    try {
      const qrDataUrl = await QRCode.toDataURL(`${BASE_URL}/p/${token}`, { width: 60, margin: 1 });
      const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
      doc.image(qrBuffer, { width: 60, align: "right", top: y + 8, left: 40 + pageWidth - 80 } as any);
    } catch {
      // QR opcional
    }
  }
}

/** Desenha tabela de cabeçalho de colunas no mapa (paisagem). */
function desenhaCabecalhoTabelaMapa(doc: PDFKitDoc, x: number, y: number, colunas: { chave: string; label: string; width: number; align?: "left" | "center" | "right" }[]) {
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");
  let cx = x;
  for (const c of colunas) {
    doc.rect(cx, y, c.width, 14).fill("#0E6E62");
    doc.text(c.label, cx + 2, y + 3, { width: c.width - 4, align: c.align ?? "center", lineHeight: 1 } as any);
    cx += c.width;
  }
  return y + 14;
}

/** Desenha uma linha de item no mapa. */
function desenhaLinhaItemMapa(
  doc: PDFKitDoc,
  x: number,
  y: number,
  valores: { texto: string; align?: "left" | "center" | "right" }[],
  colunas: { chave: string; label: string; width: number }[],
  alternado: boolean,
) {
  if (alternado) {
    let cx = x;
    for (const c of colunas) {
      doc.rect(cx, y, c.width, 12).fill("#F7F5F1");
      cx += c.width;
    }
  }
  let cx = x;
  for (let i = 0; i < valores.length; i++) {
    const c = colunas[i];
    const v = valores[i];
    doc.fontSize(7.5).font("Helvetica").fillColor("#12211F");
    doc.text(v.texto, cx + 2, y + 2, { width: c.width - 4, align: v.align ?? (c.width < 60 ? "center" : "left"), lineHeight: 1 } as any);
    cx += c.width;
  }
  doc.moveTo(x, y + 12).lineTo(x + colunas.reduce((a, c) => a + c.width, 0), y + 12).stroke();
  return y + 12;
}

/** Ordem fixa de colunas de fontes no mapa (padrão dos anexos). */
const FONTES_MAPA_ORDEM = ["SIMILARES", "BLL", "PNCP", "CGU NFE", "BNC", "MULTKA", "COMERCIAL VULTY"];

/** Gera o PDF do Mapa de Apuração de Preços em paisagem, padrão dos anexos. */
export async function gerarMapaPDF(cesta: CestaCompleta): Promise<Buffer> {
  const doc = newPdf({ size: "A4", layout: "landscape" });
  const resumo = resumoDaCesta(cesta);
  const totalGeral = resumo.total;
  const pageWidth = doc.page.width - 80; // 762 pt
  const pageHeight = doc.page.height;

  // Cabeçalho institucional
  cabecalhoInstitucional(doc, { id: cesta.id, objeto: cesta.objeto, objetoDetalhado: cesta.objetoDetalhado });

  // Caixa VALOR TOTAL à direita (sobre o cabeçalho da tabela)
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#12211F").text("VALOR TOTAL", 40, doc.y, { width: 90 });
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#0E6E62").text(brl(totalGeral, 2), 130, doc.y, { width: 120, align: "right" });
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
  doc.moveDown(0.3);

  // Monta colunas: fixas + fontes dinâmicas
  const fontesPresentes = new Set<string>();
  for (const item of cesta.itens) {
    for (const pf of extrairPrecosPorFonte(item)) {
      fontesPresentes.add(pf.sigla);
    }
  }
  const fontesOrdenadas = FONTES_MAPA_ORDEM.filter((f) => fontesPresentes.has(f));
  const fontesExtras = [...fontesPresentes].filter((f) => !FONTES_MAPA_ORDEM.includes(f)).sort();
  const colunasFonte = [...fontesOrdenadas, ...fontesExtras];

  const colunas: { chave: string; label: string; width: number; align: "left" | "center" | "right" }[] = [
    { chave: "anexo", label: "ANEXO", width: 40, align: "center" },
    { chave: "lote", label: "LOTE", width: 45, align: "center" },
    { chave: "item", label: "ITEM", width: 45, align: "center" },
    { chave: "produto", label: "PRODUTO / SERVIÇO", width: 210, align: "left" },
    { chave: "unqtd", label: "UNIDADE / QTDE.", width: 70, align: "center" },
    ...colunasFonte.map((f) => ({ chave: `fonte:${f}`, label: f, width: 55, align: "right" as const })),
    { chave: "media", label: "MÉDIA ARITMÉTICA", width: 62, align: "right" },
    { chave: "total", label: "VALOR TOTAL", width: 62, align: "right" },
    { chave: "pct", label: "PERCENTUAL DE DIFERENÇA DO MENOR PREÇO", width: 70, align: "right" },
  ];

  const larguraTotal = colunas.reduce((a, c) => a + c.width, 0);
  const escala = pageWidth / larguraTotal;
  colunas.forEach((c) => (c.width = Math.floor(c.width * escala)));

  const x = 40;
  let y = desenhaCabecalhoTabelaMapa(doc, x, doc.y, colunas);

  let totalAnterior = 0;
  let anexoAtual: string | null = null;

  for (const item of cesta.itens) {
    const r = resumo.itens.find((ri) => ri.id === item.id);
    if (!r) continue;

    const anexo = item.lote?.nome ?? "Sem lote";
    const novaLinhaAnexo = anexo !== anexoAtual;
    if (novaLinhaAnexo) {
      anexoAtual = anexo;
      totalAnterior = 0;
    }

    const precosFonte = extrairPrecosPorFonte(item);
    const mapaPrecos = new Map(precosFonte.map((p) => [p.sigla, p.valor]));
    const menor = r.estatisticas.menor;
    const media = r.estatisticas.media;
    const pctDif = menor > 0 ? ((media - menor) / menor) * 100 : 0;

    const valores: { texto: string; align?: "left" | "center" | "right" }[] = [
      { texto: novaLinhaAnexo ? (item.lote?.nome ?? "Sem lote") : "", align: "center" },
      { texto: "", align: "center" },
      { texto: String(item.ordem), align: "center" },
      { texto: item.descricao, align: "left" },
      { texto: `${item.unidade} / ${qtd(Number(item.quantidade))}`, align: "center" },
      ...colunasFonte.map((f) => ({
        texto: mapaPrecos.has(f) ? brl(mapaPrecos.get(f)!, 2) : "/////",
        align: "right" as const,
      })),
      { texto: r.semPreco ? "/////" : brl(media, 2), align: "right" },
      { texto: r.semPreco ? "/////" : brl(r.total, 2), align: "right" },
      { texto: r.semPreco ? "/////" : pct(pctDif), align: "right" },
    ];

    y = desenhaLinhaItemMapa(doc, x, y, valores, colunas, /* alternado */ item.id % 2 === 0);

    if (r.total > 0) totalAnterior += r.total;

    // Quebra de página se aproximando do rodapé
    if (y > pageHeight - 140) {
      await rodapePadrao(doc, cesta.id, cesta.token, "1");
      doc.addPage();
      y = desenhaCabecalhoTabelaMapa(doc, x, 40, colunas);
    }
  }

  // Total geral
  y += 8;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("TOTAL GERAL", x, y, { width: 300, align: "right" });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#0E6E62").text(brl(totalGeral, 2), 340, y, { width: 100, align: "right" });

  await rodapePadrao(doc, cesta.id, cesta.token, "1");
  return pdfBuffer(doc);
}

/** Todos os preços vinculados a um item (não apenas selecionados), com dados da fonte. */
export type PrecoVinculoDetalhe = {
  id: number;
  origem: string;
  valor: number;
  fonteSigla: string;
  fonteNome: string;
  orgao: string;
  uf: string;
  municipio: string | null;
  data: string;
  ataContrato: string | null;
  processo: string | null;
  unidade: string | null;
  quantidade: number | null;
};

export function extrairPrecosVinculos(item: CestaCompleta["itens"][number]): PrecoVinculoDetalhe[] {
  const out: PrecoVinculoDetalhe[] = [];
  for (const vp of item.precos) {
    const p = vp.preco;
    const valor = valorVinculo(vp);
    if (valor <= 0) continue;
    out.push({
      id: vp.id,
      origem: vp.origem,
      valor,
      fonteSigla: p?.fonte?.sigla ?? (vp.origem === "MANUAL" ? "MANUAL" : "—"),
      fonteNome: p?.fonte?.nome ?? (vp.origem === "MANUAL" ? "Preço manual" : "—"),
      orgao: p?.orgao ?? vp.orgaoManual ?? "—",
      uf: p?.uf ?? vp.ufManual ?? "—",
      municipio: p?.municipio ?? null,
      data: p ? dateBR(p.data) : vp.dataManual ? dateBR(vp.dataManual) : "—",
      ataContrato: p?.documentoRef ?? null,
      processo: p?.documentoUrl ?? null,
      unidade: p?.unidade ?? item.unidade,
      quantidade: p?.quantidade ? Number(p.quantidade) : null,
    });
  }
  return out.sort((a, b) => a.fonteSigla.localeCompare(b.fonteSigla));
}

function textoObjeto(cesta: CestaCompleta): string {
  return cesta.objetoDetalhado ?? cesta.objeto;
}

/** Cabeçalho institucional em retrato (padrão relatórios por fonte). */
function cabecalhoRelatorio(
  doc: PDFKitDoc,
  titulo: string,
  sub: string,
  cesta: CestaCompleta,
) {
  const pageWidth = doc.page.width - 80;
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#12211F").text(TENANT_NOME, { align: "left" });
  doc.fontSize(8).font("Helvetica").fillColor("#6B7B78").text(TENANT_TAGLINE, { align: "left" });
  doc.moveDown(0.3);

  const infoY = doc.y;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F");
  doc.text("ID", 40, infoY, { width: 60 });
  doc.text(String(cesta.id), 100, infoY, { width: 80 });
  doc.text("DATA", 190, infoY, { width: 60 });
  doc.text(dateBR(new Date()), 250, infoY, { width: 100 });
  doc.moveDown(1.2);

  doc.fontSize(17).font("Helvetica-Bold").fillColor("#12211F").text(titulo, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#6B7B78").text(sub, { align: "center" });
  doc.moveDown(0.4);

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#12211F").text("OBJETO", 40, doc.y);
  doc.fontSize(10).font("Helvetica").fillColor("#12211F").text(textoObjeto(cesta), 90, doc.y, {
    width: pageWidth - 50,
  });
  doc.moveDown(0.6);

  doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
  doc.moveDown(0.3);
}

async function rodapeRelatorio(doc: PDFKitDoc, cestaId: number, token: string | null, pagina: string) {
  const pageWidth = doc.page.width - 80;
  const y = doc.page.height - 55;
  doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#6B7B78");
  doc.text("CONFORME LEI 14.133/21 E IN SEGES/ME 65/21", 40, y + 6, { width: pageWidth / 2 });
  doc.text(TENANT_RODAPE, 40, y + 16, { width: pageWidth / 2 });
  doc.text(`Página ${pagina}`, 40, y + 6, { width: pageWidth / 2, align: "right" });
  if (token) {
    try {
      const qrDataUrl = await QRCode.toDataURL(`${BASE_URL}/p/${token}`, { width: 50, margin: 1 });
      const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
      doc.image(qrBuffer, { width: 50, align: "right", top: y + 2, left: 40 + pageWidth - 70 } as any);
    } catch {
      // opcional
    }
  }
}

/** Gera PDF "Pesquisas Unificadas" (retrato) — todas as fontes. */
export async function gerarPesquisasUnificadasPDF(cesta: CestaCompleta): Promise<Buffer> {
  const doc = newPdf({ size: "A4", layout: "portrait" });
  const resumo = resumoDaCesta(cesta);
  const pageWidth = doc.page.width - 80;
  const pageHeight = doc.page.height;

  cabecalhoRelatorio(
    doc,
    "RELATÓRIO UNIFICADO DAS PESQUISAS DE PREÇOS",
    "As informações detalhadas de cada fonte podem ser verificadas através do QR Code",
    cesta,
  );

  // Tabela resumo por item
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("ITEM", 40, doc.y, { width: 40 });
  doc.text("PRODUTO / SERVIÇO", 80, doc.y, { width: 220 });
  doc.text("UNIDADE / QUANTIDADE", 300, doc.y, { width: 120 });
  doc.text("MÉDIA ARITMÉTICA", 420, doc.y, { width: 100, align: "right" });
  doc.moveDown(0.2);
  doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
  doc.moveDown(0.2);

  let y = doc.y;
  let pagina = 1;
  for (const item of cesta.itens) {
    const r = resumo.itens.find((ri) => ri.id === item.id);
    if (!r) continue;
    const valores: { texto: string; align?: "left" | "center" | "right" }[] = [
      { texto: `${item.lote?.nome ?? "—"}/${item.ordem}`, align: "center" },
      { texto: item.descricao.length > 45 ? item.descricao.slice(0, 45) + "…" : item.descricao },
      { texto: `${item.unidade} / ${qtd(Number(item.quantidade))}`, align: "center" },
      { texto: r.semPreco ? "—" : brl(r.estatisticas.media, 2), align: "right" },
    ];
    const colunas = [
      { chave: "a", width: 40 },
      { chave: "b", width: 220 },
      { chave: "c", width: 120 },
      { chave: "d", width: 100 },
    ];
    y = desenhaLinhaItemMapa(doc, 40, y, valores, colunas as any, false);
    y += 4;

    // Detalhe do item + preços por fonte
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#12211F").text("DESCRIÇÃO DO ITEM", 40, y);
    doc.fontSize(8).font("Helvetica").fillColor("#12211F").text(item.descricao, 110, y, {
      width: pageWidth - 70,
    });
    y += 12;

    const vinculos = extrairPrecosVinculos(item);
    if (vinculos.length > 0) {
      // Tabela de preços por fonte
      const cols = [
        { label: "ÓRGÃO / ENTIDADE", width: 150 },
        { label: "ATA / CONTRATO / MODALIDADE", width: 120 },
        { label: "PROCESSO", width: 90 },
        { label: "HOMOLOGAÇÃO / DATA", width: 80 },
        { label: "ASSINATURA", width: 70 },
        { label: "UN.", width: 35 },
        { label: "QTDE.", width: 45 },
        { label: "VALOR", width: 70 },
      ];
      let cx = 40;
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#FFFFFF");
      for (const c of cols) {
        doc.rect(cx, y, c.width, 12).fill("#0E6E62");
        doc.text(c.label, cx + 2, y + 2, { width: c.width - 4, align: "center", lineHeight: 1 } as any);
        cx += c.width;
      }
      y += 12;

      for (let vi = 0; vi < vinculos.length; vi++) {
        const v = vinculos[vi];
        const vals = [
          { texto: v.orgao },
          { texto: v.ataContrato ?? "—" },
          { texto: v.processo ?? "—" },
          { texto: v.data },
          { texto: "—" },
          { texto: v.unidade ?? "UN", align: "center" },
          { texto: v.quantidade ? qtd(v.quantidade) : "—", align: "right" },
          { texto: brl(v.valor, 2), align: "right" },
        ];
        if (vi % 2 === 0) {
          cx = 40;
          for (const c of cols) {
            doc.rect(cx, y, c.width, 11).fill("#F7F5F1");
            cx += c.width;
          }
        }
        cx = 40;
        for (let ci = 0; ci < cols.length; ci++) {
          doc.fontSize(7).font("Helvetica").fillColor("#12211F");
          doc.text(vals[ci].texto, cx + 2, y + 1, {
            width: cols[ci].width - 4,
            align: vals[ci].align ?? "left",
            lineHeight: 1,
          } as any);
          cx += cols[ci].width;
        }
        doc.moveTo(40, y + 11).lineTo(40 + cols.reduce((a, c) => a + c.width, 0), y + 11).stroke();
        y += 11;
      }
    } else {
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("#6B7B78").text("Sem preços vinculados.", 110, y);
      y += 10;
    }
    y += 8;

    if (y > pageHeight - 150) {
      await rodapeRelatorio(doc, cesta.id, cesta.token, String(pagina));
      pagina += 1;
      doc.addPage();
      y = 80;
    }
  }

  rodapeRelatorio(doc, cesta.id, cesta.token, String(pagina));
  return pdfBuffer(doc);
}

/** Relatório por fonte (retrato) — filtra por sigla de fonte quando informada. */
export async function gerarRelatorioFontePDF(
  cesta: CestaCompleta,
  opts: { siglaFonte?: string; titulo: string; sub: string },
): Promise<Buffer> {
  const doc = newPdf({ size: "A4", layout: "portrait" });
  const resumo = resumoDaCesta(cesta);
  const pageWidth = doc.page.width - 80;
  const pageHeight = doc.page.height;

  cabecalhoRelatorio(doc, opts.titulo, opts.sub, cesta);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("ITEM", 40, doc.y, { width: 40 });
  doc.text("PRODUTO / SERVIÇO", 80, doc.y, { width: 220 });
  doc.text("UNIDADE / QUANTIDADE", 300, doc.y, { width: 120 });
  doc.text("MÉDIA ARITMÉTICA", 420, doc.y, { width: 100, align: "right" });
  doc.moveDown(0.2);
  doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
  doc.moveDown(0.2);

  let y = doc.y;
  let pagina = 1;
  for (const item of cesta.itens) {
    const r = resumo.itens.find((ri) => ri.id === item.id);
    if (!r) continue;
    const valores: { texto: string; align?: "left" | "center" | "right" }[] = [
      { texto: `${item.lote?.nome ?? "—"}/${item.ordem}`, align: "center" },
      { texto: item.descricao.length > 45 ? item.descricao.slice(0, 45) + "…" : item.descricao },
      { texto: `${item.unidade} / ${qtd(Number(item.quantidade))}`, align: "center" },
      { texto: r.semPreco ? "—" : brl(r.estatisticas.media, 2), align: "right" },
    ];
    const colunas = [
      { chave: "a", width: 40 },
      { chave: "b", width: 220 },
      { chave: "c", width: 120 },
      { chave: "d", width: 100 },
    ];
    y = desenhaLinhaItemMapa(doc, 40, y, valores, colunas as any, false);
    y += 4;

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#12211F").text("DESCRIÇÃO DO ITEM", 40, y);
    doc.fontSize(8).font("Helvetica").fillColor("#12211F").text(item.descricao, 110, y, {
      width: pageWidth - 70,
    });
    y += 12;

    let vinculos = extrairPrecosVinculos(item);
    if (opts.siglaFonte) {
      vinculos = vinculos.filter((v) => v.fonteSigla.toUpperCase() === opts.siglaFonte!.toUpperCase());
    }
    if (vinculos.length > 0) {
      const cols = [
        { label: "ÓRGÃO / ENTIDADE", width: 150 },
        { label: "ATA / CONTRATO / MODALIDADE", width: 120 },
        { label: "PROCESSO", width: 90 },
        { label: "HOMOLOGAÇÃO / DATA", width: 80 },
        { label: "ASSINATURA", width: 70 },
        { label: "UN.", width: 35 },
        { label: "QTDE.", width: 45 },
        { label: "VALOR", width: 70 },
      ];
      let cx = 40;
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#FFFFFF");
      for (const c of cols) {
        doc.rect(cx, y, c.width, 12).fill("#0E6E62");
        doc.text(c.label, cx + 2, y + 2, { width: c.width - 4, align: "center", lineHeight: 1 } as any);
        cx += c.width;
      }
      y += 12;

      for (let vi = 0; vi < vinculos.length; vi++) {
        const v = vinculos[vi];
        const vals = [
          { texto: v.orgao },
          { texto: v.ataContrato ?? "—" },
          { texto: v.processo ?? "—" },
          { texto: v.data },
          { texto: "—" },
          { texto: v.unidade ?? "UN", align: "center" },
          { texto: v.quantidade ? qtd(v.quantidade) : "—", align: "right" },
          { texto: brl(v.valor, 2), align: "right" },
        ];
        if (vi % 2 === 0) {
          cx = 40;
          for (const c of cols) {
            doc.rect(cx, y, c.width, 11).fill("#F7F5F1");
            cx += c.width;
          }
        }
        cx = 40;
        for (let ci = 0; ci < cols.length; ci++) {
          doc.fontSize(7).font("Helvetica").fillColor("#12211F");
          doc.text(vals[ci].texto, cx + 2, y + 1, {
            width: cols[ci].width - 4,
            align: vals[ci].align ?? "left",
            lineHeight: 1,
          } as any);
          cx += cols[ci].width;
        }
        doc.moveTo(40, y + 11).lineTo(40 + cols.reduce((a, c) => a + c.width, 0), y + 11).stroke();
        y += 11;
      }
    } else {
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("#6B7B78").text("Sem preços vinculados.", 110, y);
      y += 10;
    }
    y += 8;

    if (y > pageHeight - 150) {
      await rodapeRelatorio(doc, cesta.id, cesta.token, String(pagina));
      pagina += 1;
      doc.addPage();
      y = 80;
    }
  }

  await rodapeRelatorio(doc, cesta.id, cesta.token, String(pagina));
  return pdfBuffer(doc);
}

/** Coleta de Preço em PDF (versão simplificada), padrão dos anexos. */
/** Coleta de Preço em DOCX (versão simplificada), padrão dos anexos. */
export async function gerarColetaDOCX(cesta: CestaCompleta): Promise<Buffer> {
  const resumo = resumoDaCesta(cesta);
  const totalGeral = resumo.total;

  const conteudo: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: TENANT_NOME, bold: true, size: 16, font: "Helvetica", color: "12211F" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: TENANT_TAGLINE, size: 10, font: "Helvetica", color: "6B7B78" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: "COLETA DE PREÇO", bold: true, size: 14, font: "Helvetica", color: "12211F" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "PreçoBase · Gestão de Pesquisa de Preços", size: 9, font: "Helvetica", color: "6B7B78" })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Data ", bold: true, size: 10, font: "Helvetica", color: "12211F" }),
        new TextRun({ text: dateBR(new Date()), size: 10, font: "Helvetica", color: "12211F" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Código ", bold: true, size: 10, font: "Helvetica", color: "12211F" }),
        new TextRun({ text: String(cesta.id), size: 10, font: "Helvetica", color: "12211F" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Referente ao(s) memorando(s): ", bold: true, size: 10, font: "Helvetica", color: "12211F" }),
        new TextRun({ text: cesta.informacoesRodape ?? "—", size: 10, font: "Helvetica", color: "12211F" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Data da Cotação: ", bold: true, size: 10, font: "Helvetica", color: "12211F" }),
        new TextRun({ text: "____/____/_______", size: 10, font: "Helvetica", color: "12211F" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Itens", bold: true, size: 12, font: "Helvetica", color: "12211F" })],
    }),
  ];

  for (const item of cesta.itens) {
    const r = resumo.itens.find((ri: any) => ri.id === item.id);
    const valorUnitario = r?.valorUnitario ?? 0;
    const totalItem = r?.total ?? 0;
    conteudo.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 30 },
        children: [
          new TextRun({ text: item.ordem + ". " + item.descricao + " — " + item.unidade + " " + qtd(Number(item.quantidade)) + " — Vr. Unit. " + brl(valorUnitario,2) + " — Total " + brl(totalItem,2), size: 9, font: "Helvetica" }),
        ],
      }),
    );
  }

  conteudo.push(
    new Paragraph({ spacing: { before: 120, after: 40 } }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Total ", bold: true, size: 10, font: "Helvetica", color: "12211F" }),
        new TextRun({ text: brl(totalGeral,2), size: 10, font: "Helvetica", color: "12211F" }),
      ],
    }),
    new Paragraph({ spacing: { before: 120 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: "Assinaturas", bold: true, size: 12, font: "Helvetica", color: "12211F" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 10 },
      children: [new TextRun({ text: "Diretor Administrativo/Financeiro        Responsável        Fornecedor        Carimbo", size: 9, font: "Helvetica" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "__________________        __________________        __________________        __________________", size: 9 })],
    }),
    new Paragraph({ spacing: { before: 120 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: TENANT_RODAPE, size: 8, font: "Helvetica", color: "6B7B78" })],
    }),
  );

  const docFinal = new Document({
    sections: [{ children: conteudo }] as any,
  });

  return Packer.toBuffer(docFinal);
}

/** Coleta de Preço em PDF (versão simplificada), padrão dos anexos. */
export async function gerarColetaPDF(cesta: CestaCompleta): Promise<Buffer> {
  const doc = newPdf({ size: "A4", layout: "portrait" });
  const resumo = resumoDaCesta(cesta);
  const totalGeral = resumo.total;
  const pageWidth = doc.page.width - 80;

  doc.fontSize(13).font("Helvetica-Bold").fillColor("#12211F").text(TENANT_NOME, { align: "left" });
  doc.fontSize(8).font("Helvetica").fillColor("#6B7B78").text(TENANT_TAGLINE, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#12211F").text("COLETA DE PREÇO", { align: "center" });
  doc.fontSize(9).font("Helvetica").fillColor("#6B7B78").text(TENANT_RODAPE, { align: "center" });
  doc.moveDown(0.4);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Data", 40, doc.y, { width: 60 });
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text(dateBR(new Date()), 100, doc.y, { width: 100 });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Código", 40, doc.y + 16, { width: 60 });
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text(String(cesta.id), 100, doc.y + 16, { width: 100 });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Memorando(s)", 40, doc.y + 32, { width: 80 });
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text(cesta.informacoesRodape ?? "—", 100, doc.y + 32, {
    width: pageWidth - 80,
  });
  doc.moveDown(1.2);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Condições de Pagamento", 40, doc.y);
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text("—", 140, doc.y, { width: pageWidth - 120 });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Prazo de Entrega", 40, doc.y + 16);
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text("—", 140, doc.y + 16, { width: pageWidth - 120 });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Validade da Proposta", 40, doc.y + 32);
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text("—", 140, doc.y + 32, { width: pageWidth - 120 });
  doc.moveDown(1);

  const colunas = [
    { chave: "cod", label: "CÓD.", width: 40, align: "center" },
    { chave: "desc", label: "DESCRIÇÃO DO PRODUTO", width: 220, align: "left" },
    { chave: "un", label: "UN", width: 30, align: "center" },
    { chave: "qtd", label: "Quantidade", width: 70, align: "center" },
    { chave: "marca", label: "Marca", width: 70, align: "left" },
    { chave: "vunit", label: "Vr. Unitário", width: 80, align: "right" },
    { chave: "total", label: "Total", width: 90, align: "right" },
  ];
  let y = doc.y;
  let cx = 40;
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");
  for (const c of colunas) {
    doc.rect(cx, y, c.width, 14).fill("#0E6E62");
    doc.text(c.label, cx + 2, y + 2, { width: c.width - 4, align: c.align, lineHeight: 1 } as any);
    cx += c.width;
  }
  y += 14;

  let totalLinha = 0;
  for (let ii = 0; ii < cesta.itens.length; ii++) {
    const item = cesta.itens[ii];
    const r = resumo.itens.find((ri) => ri.id === item.id);
    const valorUnitario = r?.valorUnitario ?? 0;
    const totalItem = r?.total ?? 0;
    totalLinha += totalItem;
    const alternado = ii % 2 === 0;
    const valores: { texto: string; align?: "left" | "center" | "right" }[] = [
      { texto: String(item.ordem), align: "center" },
      { texto: item.descricao },
      { texto: item.unidade, align: "center" },
      { texto: qtd(Number(item.quantidade)), align: "center" },
      { texto: "—" },
      { texto: brl(valorUnitario, 2), align: "right" },
      { texto: brl(totalItem, 2), align: "right" },
    ];
    y = desenhaLinhaItemMapa(doc, 40, y, valores, colunas as any, alternado);
  }

  y += 6;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Total", 40, y, { width: 620, align: "right" });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#0E6E62").text(brl(totalGeral, 2), 660, y, { width: 80, align: "right" });
  y += 24;

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Aplicação do Item(s)", 40, y);
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text("—", 150, y, { width: pageWidth - 130 });
  y += 16;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Núcleo de Consumo / Veículo / Placa", 40, y);
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text("—", 220, y, { width: pageWidth - 200 });
  y += 16;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#12211F").text("Observação", 40, y);
  doc.fontSize(9).font("Helvetica").fillColor("#12211F").text(cesta.observacao ?? "—", 110, y, {
    width: pageWidth - 90,
  });
  y += 30;

  const assinaturas = ["Diretor Administrativo/Financeiro", "Responsável", "Fornecedor", "Carimbo"];
  let cx2 = 40;
  for (const a of assinaturas) {
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#12211F").text(a, cx2, y, { width: 170, align: "center" });
    cx2 += 180;
  }
  y += 30;
  cx2 = 40;
  for (const a of assinaturas) {
    doc.moveTo(cx2, y).lineTo(cx2 + 150, y).stroke();
    doc.fontSize(8).font("Helvetica").fillColor("#6B7B78").text(a, cx2, y + 6, { width: 170, align: "center" });
    cx2 += 180;
  }

  await rodapeRelatorio(doc, cesta.id, cesta.token, "1");
  return pdfBuffer(doc);
}

/** Mapa de Apuração em XLSX (layout padrão A1:O8). */
export async function gerarMapaXXLSX(cesta: CestaCompleta): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mapa de Apuração");
  const resumo = resumoDaCesta(cesta);
  const casas = cesta.casasDecimais;

  ws.mergeCells("A1:O1");
  ws.getCell("A1").value = "MAPA DE APURAÇÃO DE PREÇOS";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.mergeCells("A2:O2");
  ws.getCell("A2").value = cesta.objeto;
  ws.getCell("A2").alignment = { horizontal: "center" };
  ws.getCell("A2").font = { size: 11 };

  // fontes presentes
  const fontesPresentes = new Set<string>();
  for (const item of cesta.itens) for (const pf of extrairPrecosPorFonte(item)) fontesPresentes.add(pf.sigla);
  const fontesOrdenadas = FONTES_MAPA_ORDEM.filter((f) => fontesPresentes.has(f));
  const fontesExtras = [...fontesPresentes].filter((f) => !FONTES_MAPA_ORDEM.includes(f)).sort();
  const colFonte = [...fontesOrdenadas, ...fontesExtras];

  const headers = ["ANEXO", "LOTE", "ITEM", "PRODUTO / SERVIÇO", "UNIDADE / QTDE.", ...colFonte, "MÉDIA ARITMÉTICA", "VALOR TOTAL", "PERCENTUAL DE DIFERENÇA DO MENOR PREÇO"];
  const hRow = 4;
  headers.forEach((h, i) => {
    const cell = ws.getCell(hRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8, color: { argb: "FFFFFFFF" } as any };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E6E62" } as any };
    cell.alignment = { horizontal: "center", wrapText: true } as any;
    cell.border = { bottom: { style: "thin" } };
  });

  let row = hRow + 1;
  for (const item of cesta.itens) {
    const r = resumo.itens.find((ri) => ri.id === item.id);
    if (!r) continue;
    const precosFonte = extrairPrecosPorFonte(item);
    const mapa = new Map(precosFonte.map((p) => [p.sigla, p.valor]));
    const menor = r.estatisticas.menor;
    const media = r.estatisticas.media;
    const pctDif = menor > 0 ? ((media - menor) / menor) * 100 : 0;
    const vals: any[] = [
      item.lote?.nome ?? "—",
      "",
      item.ordem,
      item.descricao,
      `${item.unidade} / ${qtd(Number(item.quantidade))}`,
    ];
    for (const f of colFonte) vals.push(mapa.has(f) ? (mapa.get(f) as number) : "/////");
    vals.push(r.semPreco ? "/////" : media, r.semPreco ? "/////" : r.total, r.semPreco ? "/////" : pctDif);
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 8 };
      cell.alignment = { horizontal: i === 2 || i === 4 || i >= 5 ? "center" : "left", wrapText: true };
      if (typeof v === "number" && i >= 5) cell.numFmt = `#,##0.${"0".repeat(casas)}`;
    });
    row++;
  }

  // Total geral
  ws.getCell(row, 1).value = "TOTAL GERAL";
  ws.getCell(row, 1).font = { bold: true, size: 10 };
  ws.getCell(row, colFonte.length + 6).value = resumo.total;
  ws.getCell(row, colFonte.length + 6).font = { bold: true, size: 10 };
  ws.getCell(row, colFonte.length + 6).numFmt = "#,##0.00";

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as any;
}

/** Termo de Referência em XLSX (layout padrão A1:H11). */

/** Termo de Referência em XLSX (layout padrão, sem mesclagens conflitantes). */
export async function gerarTRXLSX(cesta: CestaCompleta): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("TERMO DE REFERÊNCIA");
  const casas = cesta.casasDecimais;
  const resumo = resumoDaCesta(cesta);

  ws.getCell("A1").value = "ID:";
  ws.getCell("B1").value = cesta.id;
  ws.getCell("A2").value = "DATA:";
  ws.getCell("B2").value = dateBR(new Date());
  ws.getCell("A3").value = "OBJETO:";
  ws.getCell("C3").value = textoObjeto(cesta);
  ws.getRow(3).height = 42;

  ws.getCell("A5").value = "TERMO DE REFERÊNCIA";
  ws.getCell("A5").font = { bold: true, size: 13 };
  ws.getCell("A5").alignment = { horizontal: "center" };

  const headers = ["ANEXO", "LOTE", "ITEM", "PRODUTO / SERVIÇO", "UNIDADE", "QUANTIDADE", "VALOR UNITÁRIO MÁXIMO", "VALOR TOTAL MÁXIMO"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(7, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center" } as any;
    cell.border = { bottom: { style: "thin" } };
  });

  let row = 8;
  let anexoAtual: string | null = null;
  for (const item of cesta.itens) {
    const r = resumo.itens.find((ri: any) => ri.id === item.id);
    if (!r) continue;
    const anexo = item.lote?.nome ?? "Sem lote";
    if (anexo !== anexoAtual) {
      anexoAtual = anexo;
      ws.getCell("A" + row).value = anexo.toUpperCase();
      ws.getCell("A" + row).font = { bold: true, size: 9 };
      row++;
    }
    const vals = [item.lote?.nome ?? "—", "", item.ordem, item.descricao, item.unidade, Number(item.quantidade), r.semPreco ? null : r.valorUnitario, r.semPreco ? null : r.total];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: i === 0 || i >= 2 ? "center" : "left" } as any;
      if (typeof v === "number" && i >= 6) cell.numFmt = "#,##0." + "0".repeat(casas);
    });
    row++;
  }

  ws.getCell("A" + row).value = "Valor total do anexo após análise";
  ws.getCell("A" + row).font = { bold: true, size: 9 };
  ws.getCell("H" + row).value = resumo.total;
  ws.getCell("H" + row).font = { bold: true, size: 9 };
  ws.getCell("H" + row).numFmt = "#,##0.00";
  row += 2;
  ws.getCell("A" + row).value = "Valor total geral do anexo";
  ws.getCell("A" + row).font = { bold: true, size: 10 };
  ws.getCell("H" + row).value = resumo.total;
  ws.getCell("H" + row).font = { bold: true, size: 10 };
  ws.getCell("H" + row).numFmt = "#,##0.00";

  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 60;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 20;
  ws.getColumn(8).width = 20;

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as any;
}


/** Subanexo X em XLSX (layout padrão A1:J26). */
export async function gerarSubanexoXXLSX(cesta: CestaCompleta): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SUBANEXO X");

  const linhas: Array<{ a: string; b?: string }> = [
    { a: "UNIDADE GESTORA", b: TENANT_NOME },
    { a: "PROCESSO ADMINISTRATIVO", b: String(cesta.id) },
    { a: "NÚMERO DA LICITAÇÃO", b: "—" },
    { a: "FONTES UTILIZADAS", b: "PNCP, BLL, BNC, CGU NFE, HISTÓRICO" },
    { a: "Pesquisa realizada em fontes públicas?", b: "SIM" },
    { a: "Preços atualizados para a data da cotação?", b: "SIM" },
    { a: "Existe orçamento financeiro disponível?", b: "SIM" },
    { a: "Ainda há necessidade da contratação?", b: "SIM" },
    { a: "Os preços estão de acordo com o mercado?", b: "SIM" },
    { a: "Observações", b: cesta.observacao ?? "—" },
  ];

  let row = 1;
  for (const l of linhas) {
    ws.getCell(`A${row}`).value = l.a;
    ws.getCell(`A${row}`).font = { bold: true, size: 10 };
    ws.mergeCells(`B${row}:J${row}`);
    if (l.b !== undefined) ws.getCell(`B${row}`).value = l.b;
    row++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as any;
}


