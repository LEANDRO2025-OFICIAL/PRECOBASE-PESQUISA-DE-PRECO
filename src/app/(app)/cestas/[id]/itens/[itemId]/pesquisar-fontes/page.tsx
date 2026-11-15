import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resumoDoItem, type ItemCompleto } from "@/lib/queries";
import PesquisarFontesClient from "./PesquisarFontesClient";

export default async function PesquisarFontesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession();
  const { id, itemId } = await params;
  const cestaId = Number(id);
  const itemIdNum = Number(itemId);
  const sp = await searchParams;

  if (!Number.isFinite(cestaId) || !Number.isFinite(itemIdNum)) notFound();

  const cesta = await prisma.cesta.findFirst({
    where: { id: cestaId, tenantId: session.tid },
    select: { id: true, objeto: true },
  });

  if (!cesta) notFound();

  const item = await prisma.cestaItem.findFirst({
    where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
    include: {
      produto: { select: { id: true, codigoBr: true } },
      cesta: { select: { tipoCalculo: true, casasDecimais: true, alertaPercentual: true } },
      apuracao: { select: { calculadoEm: true } },
      precos: {
        include: { preco: { include: { fonte: true } } },
        orderBy: { id: "asc" },
      },
      lote: { select: { nome: true } },
    },
  });

  if (!item) notFound();

  const fontes = await prisma.fonte.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, sigla: true, nome: true, tipo: true },
  });

  const resumo = resumoDoItem(item as unknown as ItemCompleto, item.cesta.tipoCalculo, item.cesta.casasDecimais);

  return (
    <PesquisarFontesClient
      cestaId={cestaId}
      itemId={itemIdNum}
      item={item}
      cesta={cesta}
      fontes={fontes}
      precos={item.precos}
      resumo={resumo}
      initialFilters={{
        uf: (sp.uf as string) || "",
        dias: (sp.dias as string) || "",
        incluirDispensas: sp.incluirDispensas === "true",
        fonte: (sp.fonte as string) || "TODAS",
      }}
    />
  );
}
