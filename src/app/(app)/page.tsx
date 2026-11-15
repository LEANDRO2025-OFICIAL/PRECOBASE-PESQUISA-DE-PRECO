import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Database,
  FolderSearch,
  Newspaper,
  PackageSearch,
  Plus,
  TrendingUp,
  Zap,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dashboard, valorDaCestaResumo } from "@/lib/queries";
import { brl, dateBR, num, prazo, qtd } from "@/lib/format";
import { PageHead, Stat, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const session = await requireSession();
  const [tenant, dados] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tid } }),
    dashboard(session.tid),
  ]);

  const maiorRanking = Math.max(1, ...dados.ranking.map((r) => r.valor));
  const abertas = dados.ativas.slice(0, 5);

  return (
    <>
      <PageHead
        eyebrow="Visão geral"
        title="Painel de controle"
        sub={
          <>
            {tenant?.nome ?? "Instituição"} · {dateBR(new Date())} · {num(dados.precos, 0)} preços no acervo
            consultável.
          </>
        }
        actions={
          <>
            <Link href="/pesquisa-rapida" className="btn btn-ghost">
              <Zap /> Pesquisa rápida
            </Link>
            <Link href="/cestas/nova" className="btn btn-primary">
              <Plus /> Nova cesta
            </Link>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <Stat
          label="Cestas ativas"
          value={dados.ativas.length}
          meta={
            <>
              {dados.contagens.EM_ABERTO} em aberto · {dados.contagens.EM_ANDAMENTO} em andamento
            </>
          }
        />
        <Stat
          label="Valor estimado ativo"
          value={brl(dados.valorAtivo)}
          meta={
            <>
              {dados.itensAtivos} itens em pesquisa · {brl(dados.valorTotal)} no histórico
            </>
          }
        />
        <Stat
          label="Acervo de preços"
          value={num(dados.precos, 0)}
          meta={
            <>
              <span className="up">{dados.fontes} fontes ativas</span> · {num(dados.produtos, 0)} produtos
            </>
          }
        />
        <Stat
          label="Fornecedores"
          value={num(dados.fornecedores, 0)}
          meta="cadastrados para cotação"
        />
      </div>

      <div className="grid grid-side">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <FolderSearch style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Cestas em andamento</h3>
              <div className="card-actions">
                <Link href="/cestas" className="btn btn-ghost btn-sm">
                  Ver todas <ArrowRight />
                </Link>
              </div>
            </div>
            {abertas.length === 0 ? (
              <div className="empty">
                <FolderSearch />
                <h4>Nenhuma cesta ativa</h4>
                <p>Crie a primeira cesta para começar a pesquisa de preços.</p>
                <Link href="/cestas/nova" className="btn btn-primary btn-sm">
                  <Plus /> Nova cesta
                </Link>
              </div>
            ) : (
              <div className="list">
                {abertas.map((cesta) => {
                  const p = prazo(cesta.prazoEnvioCotacoes);
                  return (
                    <div className="list-item" key={cesta.id}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                          <StatusBadge status={cesta.status} />
                          <span className="tiny muted mono">#{cesta.id}</span>
                          <span className={`badge ${cesta.posse === "CLIENTE" ? "outline" : "warn"}`}>
                            posse {cesta.posse === "CLIENTE" ? "cliente" : "suporte"}
                          </span>
                        </div>
                        <Link href={`/cestas/${cesta.id}`} className="list-title clamp-2" style={{ display: "block" }}>
                          {cesta.objeto}
                        </Link>
                        <div className="list-meta">
                          {cesta.secretaria?.sigla ?? "—"} · {cesta._count.itens} itens ·{" "}
                          {dateBR(cesta.dataSolicitacao)}
                          {cesta.prazoEnvioCotacoes ? (
                            <>
                              {" "}
                              · <span className={p.tom === "late" ? "down" : p.tom === "warn" ? "strong" : ""}>{p.texto}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="right" style={{ flex: "0 0 auto" }}>
                        <div className="mono strong">{brl(valorDaCestaResumo(cesta))}</div>
                        <div className="tiny muted">valor estimado</div>
                        <Link href={`/cestas/${cesta.id}/itens`} className="btn btn-sm" style={{ marginTop: 6 }}>
                          Itens
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <TrendingUp style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Valor por secretaria</h3>
              <div className="card-actions">
                <span className="tiny muted">todas as cestas</span>
              </div>
            </div>
            <div className="card-body">
              {dados.ranking.length === 0 ? (
                <p className="muted small">Sem dados suficientes.</p>
              ) : (
                <div className="stack" style={{ gap: 12 }}>
                  {dados.ranking.map((r) => (
                    <div key={r.nome}>
                      <div className="row between" style={{ marginBottom: 4 }}>
                        <span className="small strong truncate" title={r.nome}>
                          {r.sigla ? `${r.sigla} — ` : ""}
                          {r.nome}
                        </span>
                        <span className="mono small">{brl(r.valor)}</span>
                      </div>
                      <div className="price-bar">
                        <span style={{ width: `${Math.max(3, (r.valor / maiorRanking) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <CalendarClock style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Cestas concluídas</h3>
              <div className="card-actions">
                <span className="tiny muted">{dados.prontas.length} no histórico</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th>Objeto</th>
                    <th>Secretaria</th>
                    <th>Status</th>
                    <th className="num">Itens</th>
                    <th className="num">Valor estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.prontas.slice(0, 6).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/cestas/${c.id}`} className="strong">
                          {c.objeto.length > 62 ? `${c.objeto.slice(0, 62)}…` : c.objeto}
                        </Link>
                      </td>
                      <td className="muted">{c.secretaria?.sigla ?? "—"}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="num">{qtd(c._count.itens)}</td>
                      <td className="num">{brl(valorDaCestaResumo(c))}</td>
                    </tr>
                  ))}
                  {dados.prontas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="center muted small" style={{ padding: 24 }}>
                        Nenhuma cesta concluída ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <Zap style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Atalhos</h3>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 8 }}>
              <Link href="/pesquisa-rapida" className="btn" style={{ justifyContent: "flex-start" }}>
                <Zap /> Pesquisar preço de um produto
              </Link>
              <Link href="/produtos" className="btn" style={{ justifyContent: "flex-start" }}>
                <PackageSearch /> Catálogo de produtos
              </Link>
              <Link href="/fornecedores" className="btn" style={{ justifyContent: "flex-start" }}>
                <Building2 /> Catálogo de fornecedores
              </Link>
              <Link href="/configuracoes" className="btn" style={{ justifyContent: "flex-start" }}>
                <Database /> Fontes e índices
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Newspaper style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Informativos</h3>
              <div className="card-actions">
                <Link href="/informativos" className="btn btn-ghost btn-sm">
                  Todos
                </Link>
              </div>
            </div>
            <div className="list">
              {dados.informativos.map((i) => (
                <Link
                  key={i.id}
                  href={`/informativos/${i.id}`}
                  className="list-item"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                    <span className="badge neutral">{i.categoria.replaceAll("_", " ")}</span>
                    <span className="tiny muted">{dateBR(i.publicadoEm)}</span>
                  </div>
                  <div className="list-title" style={{ fontSize: 12.5 }}>
                    {i.titulo}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="alert info">
            <TrendingUp />
            <div>
              <strong>Alerta de 18%</strong>
              <div style={{ marginTop: 2 }}>
                Preços que se afastam mais de 18% da média são destacados no mapa e exigem justificativa
                técnica no item.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
