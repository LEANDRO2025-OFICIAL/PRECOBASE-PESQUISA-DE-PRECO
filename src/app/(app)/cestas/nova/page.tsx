import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { CestaForm } from "../cesta-form";

export const dynamic = "force-dynamic";

export default async function NovaCestaPage() {
  const session = await requireSession();
  const [secretarias, categorias, indices] = await Promise.all([
    prisma.secretaria.findMany({ where: { tenantId: session.tid, ativo: true }, orderBy: { nome: "asc" } }),
    prisma.categoriaObjeto.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" } }),
    prisma.indice.findMany({ where: { ativo: true }, orderBy: { sigla: "asc" } }),
  ]);

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <span>Nova cesta</span>
      </div>
      <PageHead
        eyebrow="Pesquisa de preços"
        title="Cadastrar cesta"
        sub="Defina o objeto, a secretaria, as categorias e as regras de cálculo. Depois de criada, você adiciona os itens e pesquisa os preços nas fontes."
        actions={
          <Link href="/cestas" className="btn btn-ghost">
            <ChevronLeft /> Voltar
          </Link>
        }
      />
      <CestaForm secretarias={secretarias} categorias={categorias} indices={indices} />
    </>
  );
}
