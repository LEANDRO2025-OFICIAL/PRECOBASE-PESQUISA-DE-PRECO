import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, FileText, Tag } from "lucide-react";
import { PageHead } from "@/components/ui";
import { dateBR, rotuloCategoria } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function InformativoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const informativoId = Number(id);

  if (!Number.isFinite(informativoId)) notFound();

  const informativo = await prisma.informativo.findFirst({
    where: {
      id: informativoId,
      OR: [{ tenantId: session.tid }, { tenantId: null }],
    },
    select: {
      id: true,
      titulo: true,
      resumo: true,
      corpo: true,
      categoria: true,
      publicadoEm: true,
      tenantId: true,
    },
  });

  if (!informativo) notFound();

  return (
    <>
      <div className="breadcrumb">
        <Link href="/informativos">Informativos</Link>
        <span className="sep">/</span>
        <span>{informativo.titulo}</span>
      </div>

      <PageHead
        eyebrow={informativo.tenantId === null ? "Informativo global" : "Informativo do tenant"}
        title={informativo.titulo.length > 110 ? `${informativo.titulo.slice(0, 110)}…` : informativo.titulo}
        sub={
          <>
            <span className="badge neutral">{rotuloCategoria(informativo.categoria)}</span>{" "}
            <Calendar style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle", margin: "0 8px" }} />
            {dateBR(informativo.publicadoEm)}
          </>
        }
        actions={
          <Link href="/informativos" className="btn btn-ghost">
            <ArrowLeft style={{ width: 16, height: 16, marginRight: 6 }} /> Voltar
          </Link>
        }
      />

      <div className="card" style={{ maxWidth: 900 }}>
        <div className="card-body" style={{ padding: 32 }}>
          {informativo.resumo && (
            <div className="alert info" style={{ marginBottom: 24 }}>
              <FileText style={{ width: 18, height: 18 }} />
              <div>{informativo.resumo}</div>
            </div>
          )}

          <article style={{ lineHeight: 1.7, fontSize: 15 }}>
            {informativo.corpo.split("\n").map((paragraph: string, i: number) => (
              <p key={i} style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>
                {paragraph}
              </p>
            ))}
          </article>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 900, marginTop: 16 }}>
        <div className="card-head">
          <Tag style={{ width: 18, height: 18 }} />
          <h3>Metadados</h3>
        </div>
        <div className="card-body">
          <dl className="kv" style={{ gridTemplateColumns: "140px minmax(0,1fr)" }}>
            <dt>ID</dt>
            <dd className="mono">{informativo.id}</dd>
            <dt>Categoria</dt>
            <dd><span className="badge neutral">{rotuloCategoria(informativo.categoria)}</span></dd>
            <dt>Publicado em</dt>
            <dd>{dateBR(informativo.publicadoEm)} <span className="muted">({new Date(informativo.publicadoEm).toLocaleTimeString("pt-BR")})</span></dd>
            <dt>Âmbito</dt>
            <dd>
              {informativo.tenantId === null ? (
                <span className="badge info">Global (todos os tenants)</span>
              ) : (
                <span className="badge neutral">Tenant específico</span>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </>
  );
}
