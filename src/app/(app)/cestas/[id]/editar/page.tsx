import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/ui";
import { CestaForm } from "../../cesta-form";

export const dynamic = "force-dynamic";

export default async function EditarCestaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const cestaId = Number(id);
  if (!Number.isFinite(cestaId)) notFound();

  const [cesta, secretarias, categorias, indices] = await Promise.all([
    prisma.cesta.findFirst({
      where: { id: cestaId, tenantId: session.tid },
      include: { categorias: { select: { categoriaId: true } } },
    }),
    prisma.secretaria.findMany({ where: { tenantId: session.tid, ativo: true }, orderBy: { nome: "asc" } }),
    prisma.categoriaObjeto.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" } }),
    prisma.indice.findMany({ where: { ativo: true }, orderBy: { sigla: "asc" } }),
  ]);

  if (!cesta) notFound();

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cesta.id}`}>#{cesta.id}</Link>
        <span className="sep">/</span>
        <span>Editar</span>
      </div>
      <PageHead
        eyebrow="Cadastro da cesta"
        title="Editar cesta"
        sub="Alterações nas regras de cálculo afetam o mapa imediatamente. Recalcule os itens depois de mudar o tipo de cálculo."
        actions={
          <Link href={`/cestas/${cesta.id}`} className="btn btn-ghost">
            <ChevronLeft /> Voltar
          </Link>
        }
      />
      <CestaForm
        defaults={{
          id: cesta.id,
          objeto: cesta.objeto,
          objetoDetalhado: cesta.objetoDetalhado ?? "",
          secretariaId: cesta.secretariaId ? String(cesta.secretariaId) : "",
          categorias: cesta.categorias.map((c) => c.categoriaId),
          tipoContratacao: cesta.tipoContratacao,
          tipoCalculo: cesta.tipoCalculo,
          casasDecimais: String(cesta.casasDecimais),
          dataSolicitacao: isoDate(cesta.dataSolicitacao),
          situacao: cesta.situacao,
          posse: cesta.posse,
          prazoEnvioCotacoes: isoDate(cesta.prazoEnvioCotacoes),
          observacao: cesta.observacao ?? "",
          informacoesRodape: cesta.informacoesRodape ?? "",
          alertaPercentual: String(cesta.alertaPercentual),
          priorizarPrecosPraticadosDias: String(cesta.priorizarPrecosPraticadosDias),
          mapaVerticalizarColunas: String(cesta.mapaVerticalizarColunas),
          corrigirAtivo: Boolean(cesta.corrigirIndice),
          corrigirIncidirSobre: cesta.corrigirIncidirSobre ?? "VALOR",
          corrigirIndice: cesta.corrigirIndice ?? "",
          corrigirDataInicial: isoDate(cesta.corrigirDataInicial),
          corrigirDataFinal: isoDate(cesta.corrigirDataFinal),
        }}
        secretarias={secretarias}
        categorias={categorias}
        indices={indices}
      />
    </>
  );
}
