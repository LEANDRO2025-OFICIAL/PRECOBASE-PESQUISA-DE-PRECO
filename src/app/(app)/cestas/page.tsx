import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderSearch,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contarPorStatus, listarCestas, valorDaCestaResumo } from "@/lib/queries";
import { brl, dateBR, prazo, qtd } from "@/lib/format";
import { Empty, PageHead, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  ["TODAS", "Todas"],
  ["EM_ABERTO", "Em aberto"],
  ["EM_ANDAMENTO", "Em andamento"],
  ["PRONTA", "Prontas"],
  ["FINALIZADA", "Finalizadas"],
] as const;

type SP = { status?: string; q?: string; secretariaId?: string };

export default async function CestasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const status = sp.status ?? "TODAS";
  const q = sp.q?.trim() ?? "";
  const secretariaId = Number(sp.secretariaId) || undefined;

  const [cestas, contagens, secretarias] = await Promise.all([
    listarCestas(session.tid, { status, q, secretariaId }),
    contarPorStatus(session.tid),
    prisma.secretaria.findMany({ where: { tenantId: session.tid, ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  const totalFiltrado = cestas.reduce((acc, c) => acc + valorDaCestaResumo(c), 0);

  return (
    <>
      <PageHead
        eyebrow="Pesquisa de preços"
        title="Cestas de preços"
        sub="Cada cesta reúne os itens de um objeto, os preços coletados nas fontes e o mapa de apuração."
        actions={
          <>
            <Link href="/pesquisa-rapida" className="btn btn-ghost">
              <Search /> Pesquisa rápida
            </Link>
            <Link href="/cestas/nova" className="btn btn-primary">
              <Plus /> Nova cesta
            </Link>
          </>
        }
      />

      <div className="card">
        <div className="tabs" style={{ padding: "0 8px" }}>
          {TABS.map(([valor, label]) => {
            const params = new URLSearchParams();
            if (valor !== "TODAS") params.set("status", valor);
            if (q) params.set("q", q);
            if (sp.secretariaId) params.set("secretariaId", sp.secretariaId);
            const href = params.toString() ? `/cestas?${params}` : "/cestas";
            return (
              <Link
                key={valor}
                href={href}
                className="tab"
                aria-selected={status === valor}
                style={{ textDecoration: "none" }}
              >
                {label}
                <span className="count">{contagens[valor] ?? 0}</span>
              </Link>
            );
          })}
        </div>

        <form className="toolbar" method="get" action="/cestas">
          {status !== "TODAS" ? <input type="hidden" name="status" value={status} /> : null}
          <div className="searchbox">
            <Search />
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="Buscar por objeto ou descrição…"
              aria-label="Buscar cestas"
            />
          </div>
          <select className="select" name="secretariaId" defaultValue={sp.secretariaId ?? ""} style={{ width: 240 }}>
            <option value="">Todas as secretarias</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sigla ? `${s.sigla} — ` : ""}
                {s.nome}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            <Filter /> Filtrar
          </button>
          {q || sp.secretariaId ? (
            <Link href="/cestas" className="btn btn-ghost btn-sm">
              Limpar
            </Link>
          ) : null}
          <div className="spacer" />
          <span className="small muted nowrap">
            {cestas.length} cesta{cestas.length === 1 ? "" : "s"} · {brl(totalFiltrado)}
          </span>
        </form>

        {cestas.length === 0 ? (
          <Empty
            title="Nenhuma cesta encontrada"
            text="Ajuste os filtros ou crie uma nova cesta de preços para o seu objeto."
          >
            <Link href="/cestas/nova" className="btn btn-primary btn-sm">
              <Plus /> Nova cesta
            </Link>
          </Empty>
        ) : (
          <div className="list" style={{ padding: 0 }}>
            {cestas.map((cesta) => {
              const p = prazo(cesta.prazoEnvioCotacoes);
              const valor = valorDaCestaResumo(cesta);
              const comPreco = cesta.itens.filter((i) => i.apuracao).length;
              return (
                <div key={cesta.id} className="list-item" style={{ padding: "18px 20px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 7, marginBottom: 6 }}>
                      <StatusBadge status={cesta.status} />
                      {cesta.situacao === "SUPORTE" ? <span className="badge info">suporte</span> : null}
                      <span className="tiny muted mono">#{cesta.id}</span>
                      {cesta.token ? <span className="chip-alert">LINK PÚBLICO</span> : null}
                    </div>

                    <Link
                      href={`/cestas/${cesta.id}`}
                      style={{ color: "var(--ink)", display: "block" }}
                    >
                      <div className="list-title" style={{ fontSize: 15 }}>
                        {cesta.objeto}
                      </div>
                    </Link>
                    {cesta.objetoDetalhado ? (
                      <div className="list-meta clamp-2" style={{ maxWidth: "90ch" }}>
                        {cesta.objetoDetalhado}
                      </div>
                    ) : null}

                    <div className="row wrap" style={{ gap: 14, marginTop: 9, fontSize: 11.5, color: "var(--muted)" }}>
                      <span className="row" style={{ gap: 4 }}>
                        <FolderSearch style={{ width: 12, height: 12 }} />
                        {cesta.secretaria?.sigla ?? "Sem secretaria"}
                      </span>
                      <span className="row" style={{ gap: 4 }}>
                        <CalendarDays style={{ width: 12, height: 12 }} />
                        {dateBR(cesta.dataSolicitacao)}
                      </span>
                      <span>
                        {qtd(cesta._count.itens)} itens · {comPreco} com preços
                      </span>
                      {cesta.prazoEnvioCotacoes ? (
                        <span className={p.tom === "late" ? "badge danger" : p.tom === "warn" ? "badge warn" : "badge neutral"}>
                          {p.texto}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="cesta-valor" style={{ flex: "0 0 210px", textAlign: "right" }}>
                    <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
                      Valor estimado
                    </div>
                    <div className="mono strong" style={{ fontSize: 17 }}>
                      {brl(valor)}
                    </div>
                    <div className="row end" style={{ gap: 6, marginTop: 9 }}>
                      <Link href={`/cestas/${cesta.id}/itens`} className="btn btn-sm">
                        Itens
                      </Link>
                      <Link href={`/cestas/${cesta.id}`} className="btn btn-sm btn-primary">
                        Abrir <ChevronRight />
                      </Link>
                    </div>
                    <div className="row end" style={{ gap: 2, marginTop: 4 }}>
                      <Link
                        href={`/cestas/${cesta.id}/relatorio/mapa.pdf`}
                        className="btn-icon"
                        title="Mapa em PDF"
                        aria-label="Mapa em PDF"
                      >
                        <FileText />
                      </Link>
                      <Link
                        href={`/cestas/${cesta.id}/relatorio/mapa.xlsx`}
                        className="btn-icon"
                        title="Mapa em XLS"
                        aria-label="Mapa em XLS"
                      >
                        <FileSpreadsheet />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
