import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  FolderSearch,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { carregarCesta, resumoDaCesta } from "@/lib/queries";
import { brl, qtd } from "@/lib/format";
import { PageHead, StatusBadge } from "@/components/ui";
import { criarLote, excluirItem, excluirLote, recalcularCesta } from "./actions";

export const dynamic = "force-dynamic";

export default async function ItensDaCestaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const cestaId = Number(id);
  if (!Number.isFinite(cestaId)) notFound();

  const cesta = await carregarCesta(session.tid, cestaId);
  if (!cesta) notFound();

  const resumo = resumoDaCesta(cesta);
  const casas = cesta.casasDecimais;
  const grupos = new Map<string, typeof resumo.itens>();
  for (const item of resumo.itens) {
    const chave = item.lote;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  const totalSelecionados = resumo.itens.reduce((acc, i) => acc + i.selecionados, 0);
  const totalDisponiveis = resumo.itens.reduce((acc, i) => acc + i.disponiveis, 0);
  const alertas = resumo.itens.reduce((acc, i) => acc + i.alertas, 0);

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cesta.id}`}>#{cesta.id}</Link>
        <span className="sep">/</span>
        <span>Itens</span>
      </div>

      <PageHead
        eyebrow={`Cesta #${cesta.id}`}
        title="Itens e apuração"
        sub={
          <>
            {cesta.objeto} · {resumo.totalItens} item(ns) · {totalSelecionados} de {totalDisponiveis} preços
            selecionados
          </>
        }
        actions={
          <>
            <form action={recalcularCesta}>
              <input type="hidden" name="cestaId" value={cesta.id} />
              <button className="btn btn-ghost" type="submit">
                <RefreshCw /> Recalcular
              </button>
            </form>
            <Link href={`/cestas/${cesta.id}`} className="btn">
              <ArrowRight /> Ver cesta
            </Link>
            <Link href={`/cestas/${cesta.id}/itens/novo`} className="btn btn-primary">
              <Plus /> Adicionar item
            </Link>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Itens</div>
          <div className="stat-value">{resumo.totalItens}</div>
          <div className="stat-meta">{grupos.size} agrupamento(s)</div>
        </div>
        <div className="stat">
          <div className="stat-label">Preços selecionados</div>
          <div className="stat-value">{totalSelecionados}</div>
          <div className="stat-meta">{totalDisponiveis} vinculados ao acervo</div>
        </div>
        <div className="stat">
          <div className="stat-label">Alertas de dispersão</div>
          <div className="stat-value">{alertas}</div>
          <div className="stat-meta">acima de {cesta.alertaPercentual}% da média</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total dos preços estimados</div>
          <div className="stat-value" style={{ fontSize: 21 }}>
            {brl(resumo.total, 2)}
          </div>
          <div className="stat-meta">
            {cesta.tipoCalculo === "MEDIANA"
              ? "mediana"
              : cesta.tipoCalculo === "MENOR"
                ? "menor preço"
                : cesta.tipoCalculo === "MAIOR"
                  ? "maior preço"
                  : "média aritmética"}
          </div>
        </div>
      </div>

      {resumo.itens.length === 0 ? (
        <div className="card">
          <div className="empty">
            <FolderSearch />
            <h4>Nenhum item nesta cesta</h4>
            <p>Adicione itens do catálogo de produtos ou cadastre um item avulso para começar a pesquisa.</p>
            <Link href={`/cestas/${cesta.id}/itens/novo`} className="btn btn-primary">
              <Plus /> Adicionar primeiro item
            </Link>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          {[...grupos.entries()].map(([lote, itens]) => {
            const totalLote = itens.reduce((acc, i) => acc + i.total, 0);
            const loteRegistro = cesta.lotes.find((l) => l.nome === lote);
            return (
              <div className="card" key={lote}>
                <div className="card-head">
                  <Layers style={{ width: 16, height: 16, color: "var(--muted)" }} />
                  <h3>{lote === "Sem lote" ? "Itens sem lote" : lote}</h3>
                  <div className="card-actions">
                    <span className="tiny muted">
                      {itens.length} item(ns) · {brl(totalLote, 2)}
                    </span>
                    {loteRegistro ? (
                      <form action={excluirLote}>
                        <input type="hidden" name="cestaId" value={cesta.id} />
                        <input type="hidden" name="loteId" value={loteRegistro.id} />
                        <button
                          className="btn-icon"
                          type="submit"
                          title="Excluir lote (os itens ficam sem lote)"
                          aria-label={`Excluir ${lote}`}
                        >
                          <Trash2 />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>#</th>
                        <th style={{ width: "34%" }}>Item</th>
                        <th>Un.</th>
                        <th className="num">Qtd.</th>
                        <th className="num">Menor</th>
                        <th className="num">Média</th>
                        <th className="num">Mediana</th>
                        <th className="num">Maior</th>
                        <th className="num">Total</th>
                        <th style={{ width: 120 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item) => (
                        <tr key={item.id}>
                          <td className="muted">{item.ordem}</td>
                          <td style={{ maxWidth: 380 }}>
                            <Link href={`/cestas/${cesta.id}/itens/${item.id}`} className="strong">
                              {item.descricao.length > 110 ? `${item.descricao.slice(0, 110)}…` : item.descricao}
                            </Link>
                            <div className="tiny muted">
                              {item.codigoBr ? `cód. ${item.codigoBr} · ` : ""}
                              {item.selecionados} preço(s) selecionado(s)
                              {item.alertas > 0 ? (
                                <>
                                  {" · "}
                                  <span className="chip-alert">
                                    <AlertTriangle style={{ width: 10, height: 10 }} /> {item.alertas} alerta(s)
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td className="muted">{item.unidade}</td>
                          <td className="num">{qtd(item.quantidade)}</td>
                          <td className="num">{item.semPreco ? "—" : brl(item.estatisticas.menor, casas)}</td>
                          <td className="num strong">{item.semPreco ? "—" : brl(item.estatisticas.media, casas)}</td>
                          <td className="num">{item.semPreco ? "—" : brl(item.estatisticas.mediana, casas)}</td>
                          <td className="num">{item.semPreco ? "—" : brl(item.estatisticas.maior, casas)}</td>
                          <td className="num strong">{brl(item.total, 2)}</td>
                          <td>
                            <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                              <Link
                                href={`/cestas/${cesta.id}/itens/${item.id}/pesquisar-fontes`}
                                className="btn-icon"
                                title="Pesquisar fontes"
                                aria-label="Pesquisar fontes"
                              >
                                <Search />
                              </Link>
                              <Link
                                href={`/cestas/${cesta.id}/itens/${item.id}`}
                                className="btn-icon"
                                title="Editar item"
                                aria-label="Editar item"
                              >
                                <Pencil />
                              </Link>
                              <form action={excluirItem}>
                                <input type="hidden" name="cestaId" value={cesta.id} />
                                <input type="hidden" name="itemId" value={item.id} />
                                <button className="btn-icon" type="submit" title="Excluir item" aria-label="Excluir item">
                                  <Trash2 />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={8} className="right strong">
                          Total do lote
                        </td>
                        <td className="num strong">{brl(totalLote, 2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="card">
            <div className="card-head">
              <Calculator style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Total dos preços estimados</h3>
              <div className="card-actions">
                <StatusBadge status={cesta.status} />
              </div>
            </div>
            <div className="card-body">
              <div className="row between">
                <div className="small muted">
                  Soma de {resumo.totalItens} item(ns), aplicando{" "}
                  {cesta.tipoCalculo === "MEDIANA"
                    ? "a mediana"
                    : cesta.tipoCalculo === "MENOR"
                      ? "o menor preço"
                      : cesta.tipoCalculo === "MAIOR"
                        ? "o maior preço"
                        : "a média aritmética"}{" "}
                  e {casas} casas decimais.
                </div>
                <div className="strong" style={{ fontFamily: "var(--mono)", fontSize: 20 }}>
                  {brl(resumo.total, 2)}
                </div>
              </div>
              {resumo.semPreco > 0 ? (
                <div className="alert warn" style={{ marginTop: 14 }}>
                  <AlertTriangle />
                  <div>
                    <strong>{resumo.semPreco} item(ns) sem preço selecionado.</strong>
                    <div style={{ marginTop: 2 }}>
                      Abra <em>Pesquisar fontes</em> para vincular preços do acervo ou cadastrar um preço manual.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <Layers style={{ width: 16, height: 16, color: "var(--muted)" }} />
          <h3>Lotes da cesta</h3>
          <div className="card-actions">
            <span className="tiny muted">agrupamento dos itens no mapa</span>
          </div>
        </div>
        <div className="card-body stack" style={{ gap: 12 }}>
          {cesta.lotes.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              Nenhum lote cadastrado. Crie um lote para agrupar itens no mapa de apuração.
            </p>
          ) : (
            <div className="row wrap" style={{ gap: 8 }}>
              {cesta.lotes.map((lote) => (
                <span key={lote.id} className="badge neutral">
                  {lote.nome} · {cesta.itens.filter((i) => i.loteId === lote.id).length} item(ns)
                </span>
              ))}
            </div>
          )}
          <form action={criarLote} className="row wrap" style={{ gap: 8, alignItems: "flex-end" }}>
            <input type="hidden" name="cestaId" value={cesta.id} />
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label className="label" htmlFor="nome-lote">
                Novo lote
              </label>
              <input
                id="nome-lote"
                name="nome"
                className="input"
                placeholder="Ex.: ANEXO I - LOTE 002"
                maxLength={120}
                required
              />
            </div>
            <button className="btn" type="submit">
              <Plus /> Criar lote
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
