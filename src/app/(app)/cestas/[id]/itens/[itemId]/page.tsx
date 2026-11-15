import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resumoDoItem } from "@/lib/queries";
import { brl, dateBR, qtd } from "@/lib/format";
import { PageHead } from "@/components/ui";
import { excluirItem, excluirVinculoPreco } from "../actions";
import { ItemForm } from "./item-form";

export const dynamic = "force-dynamic";

export default async function ItemDetalhePage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const session = await requireSession();
  const { id, itemId } = await params;
  const cestaId = Number(id);
  const itemIdNum = Number(itemId);
  if (!Number.isFinite(cestaId) || !Number.isFinite(itemIdNum)) notFound();

  const item = await prisma.cestaItem.findFirst({
    where: { id: itemIdNum, cestaId, cesta: { tenantId: session.tid } },
    include: {
      cesta: { include: { lotes: { orderBy: { ordem: "asc" } } } },
      produto: true,
      lote: true,
      apuracao: true,
      precos: {
        include: { preco: { include: { fonte: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!item) notFound();

  const resumo = resumoDoItem(
    { ...item, precos: item.precos } as Parameters<typeof resumoDoItem>[0],
    item.cesta.tipoCalculo,
    item.cesta.casasDecimais,
  );
  const casas = item.cesta.casasDecimais;
  const manuais = item.precos.filter((p) => p.origem === "MANUAL");
  const daFonte = item.precos.filter((p) => p.origem !== "MANUAL");

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cestaId}`}>#{cestaId}</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cestaId}/itens`}>Itens</Link>
        <span className="sep">/</span>
        <span>Item {item.ordem}</span>
      </div>

      <PageHead
        eyebrow={item.lote?.nome ?? "Item sem lote"}
        title={item.descricao.length > 110 ? `${item.descricao.slice(0, 110)}…` : item.descricao}
        sub={
          <>
            {item.produto ? `cód. ${item.produto.codigoBr} · ` : "item avulso · "}
            {qtd(Number(item.quantidade))} {item.unidade} · {resumo.selecionados} preço(s) selecionado(s)
            {item.apuracao ? ` · apurado em ${dateBR(item.apuracao.calculadoEm)}` : ""}
          </>
        }
        actions={
          <>
            <Link href={`/cestas/${cestaId}/itens`} className="btn btn-ghost">
              Voltar
            </Link>
            <Link href={`/cestas/${cestaId}/itens/${item.id}/pesquisar-fontes`} className="btn btn-primary">
              <Search /> Pesquisar fontes
            </Link>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Menor preço</div>
          <div className="stat-value" style={{ fontSize: 21 }}>
            {resumo.semPreco ? "—" : brl(resumo.estatisticas.menor, casas)}
          </div>
          <div className="stat-meta">{resumo.estatisticas.qtd} preço(s) na apuração</div>
        </div>
        <div className="stat">
          <div className="stat-label">Média</div>
          <div className="stat-value" style={{ fontSize: 21 }}>
            {resumo.semPreco ? "—" : brl(resumo.estatisticas.media, casas)}
          </div>
          <div className="stat-meta">desvio padrão {brl(resumo.estatisticas.desvioPadrao, casas)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Mediana / maior</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {resumo.semPreco ? "—" : brl(resumo.estatisticas.mediana, casas)}
            <span className="muted" style={{ fontSize: 13 }}>
              {" "}
              / {resumo.semPreco ? "—" : brl(resumo.estatisticas.maior, casas)}
            </span>
          </div>
          <div className="stat-meta">coeficiente {resumo.estatisticas.coeficiente.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total do item</div>
          <div className="stat-value" style={{ fontSize: 21 }}>
            {brl(resumo.total, 2)}
          </div>
          <div className="stat-meta">
            {qtd(resumo.quantidade)} {item.unidade} × {brl(resumo.valorUnitario, casas)}
          </div>
        </div>
      </div>

      <div className="grid grid-side">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <Pencil style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Dados do item</h3>
            </div>
            <div className="card-body">
              <ItemForm
                cestaId={cestaId}
                itemId={item.id}
                lotes={item.cesta.lotes.map((l) => ({ id: l.id, nome: l.nome }))}
                defaults={{
                  descricao: item.descricao,
                  unidade: item.unidade,
                  quantidade: String(Number(item.quantidade)),
                  loteId: item.loteId ? String(item.loteId) : "",
                  observacao: item.observacao ?? "",
                  justificativa: item.justificativa ?? "",
                }}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <FileSpreadsheet style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Preços do acervo vinculados</h3>
              <div className="card-actions">
                <span className="tiny muted">{daFonte.length} vínculo(s)</span>
              </div>
            </div>
            {daFonte.length === 0 ? (
              <div className="empty" style={{ padding: "32px 16px" }}>
                <Search />
                <h4>Nenhum preço de fonte vinculado</h4>
                <p>Use Pesquisar fontes para selecionar preços do acervo ou cadastre um preço manual.</p>
                <Link href={`/cestas/${cestaId}/itens/${item.id}/pesquisar-fontes`} className="btn btn-sm btn-primary">
                  <Search /> Pesquisar fontes
                </Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Situação</th>
                      <th>Fonte</th>
                      <th>Órgão</th>
                      <th>UF</th>
                      <th>Data</th>
                      <th className="num">Valor</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {daFonte.map((vinculo) => (
                      <tr key={vinculo.id}>
                        <td>
                          {vinculo.selecionado ? (
                            <span className="badge success">
                              <span className="dot" /> selecionado
                            </span>
                          ) : (
                            <span className="badge neutral">fora da apuração</span>
                          )}
                        </td>
                        <td className="small">{vinculo.preco?.fonte.sigla ?? "—"}</td>
                        <td className="small" style={{ maxWidth: 260 }}>
                          <div className="truncate">{vinculo.preco?.orgao ?? "—"}</div>
                          {vinculo.preco?.municipio ? (
                            <div className="tiny muted">{vinculo.preco.municipio}</div>
                          ) : null}
                        </td>
                        <td className="small">{vinculo.preco?.uf ?? "—"}</td>
                        <td className="small">{dateBR(vinculo.preco?.data)}</td>
                        <td className="num strong">
                          {brl(
                            vinculo.valorCorrigido
                              ? Number(vinculo.valorCorrigido)
                              : Number(vinculo.preco?.valor ?? 0),
                            casas,
                          )}
                        </td>
                        <td>
                          <form action={excluirVinculoPreco}>
                            <input type="hidden" name="cestaId" value={cestaId} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="vinculoId" value={vinculo.id} />
                            <button className="btn-icon" type="submit" title="Desvincular" aria-label="Desvincular preço">
                              <Trash2 />
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <CheckCircle2 style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Preços manuais</h3>
              <div className="card-actions">
                <span className="tiny muted">{manuais.length} registro(s)</span>
              </div>
            </div>
            {manuais.length === 0 ? (
              <div className="card-body">
                <p className="muted small" style={{ margin: 0 }}>
                  Nenhum preço manual. Você pode incluir preços de pesquisa direta na tela de fontes.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Situação</th>
                      <th>Órgão</th>
                      <th>UF</th>
                      <th>Data</th>
                      <th className="num">Valor</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {manuais.map((vinculo) => (
                      <tr key={vinculo.id}>
                        <td>
                          {vinculo.selecionado ? (
                            <span className="badge success">
                              <span className="dot" /> selecionado
                            </span>
                          ) : (
                            <span className="badge neutral">fora da apuração</span>
                          )}
                        </td>
                        <td className="small">{vinculo.orgaoManual ?? "Pesquisa direta"}</td>
                        <td className="small">{vinculo.ufManual ?? "—"}</td>
                        <td className="small">{dateBR(vinculo.dataManual)}</td>
                        <td className="num strong">{brl(Number(vinculo.valorManual ?? 0), casas)}</td>
                        <td>
                          <form action={excluirVinculoPreco}>
                            <input type="hidden" name="cestaId" value={cestaId} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="vinculoId" value={vinculo.id} />
                            <button className="btn-icon" type="submit" title="Excluir" aria-label="Excluir preço manual">
                              <Trash2 />
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <Search style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Apuração</h3>
            </div>
            <div className="card-body">
              <dl className="kv" style={{ gridTemplateColumns: "120px minmax(0,1fr)", fontSize: 12 }}>
                <dt>Menor</dt>
                <dd>{resumo.semPreco ? "—" : brl(resumo.estatisticas.menor, casas)}</dd>
                <dt>Média</dt>
                <dd>{resumo.semPreco ? "—" : brl(resumo.estatisticas.media, casas)}</dd>
                <dt>Mediana</dt>
                <dd>{resumo.semPreco ? "—" : brl(resumo.estatisticas.mediana, casas)}</dd>
                <dt>Maior</dt>
                <dd>{resumo.semPreco ? "—" : brl(resumo.estatisticas.maior, casas)}</dd>
                <dt>Preços</dt>
                <dd>{resumo.estatisticas.qtd}</dd>
                <dt>Desvio padrão</dt>
                <dd>{brl(resumo.estatisticas.desvioPadrao, casas)}</dd>
                <dt>Coeficiente</dt>
                <dd>{resumo.estatisticas.coeficiente.toFixed(3)}</dd>
                <dt>Valor unitário</dt>
                <dd className="strong">{brl(resumo.valorUnitario, casas)}</dd>
              </dl>
              <Link
                href={`/cestas/${cestaId}/itens/${item.id}/pesquisar-fontes`}
                className="btn btn-sm btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
              >
                <Search /> Revisar fontes
              </Link>
            </div>
          </div>

          {resumo.alertas > 0 ? (
            <div className="alert warn">
              <AlertTriangle />
              <div>
                <strong>{resumo.alertas} preço(s) fora da faixa de {item.cesta.alertaPercentual}%</strong>
                <div style={{ marginTop: 2 }}>Revise os preços destacados para evitar distorção na média.</div>
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="card-head">
              <FileSpreadsheet style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Relatórios</h3>
            </div>
            <div className="card-body stack" style={{ gap: 8 }}>
              <Link href={`/cestas/${cestaId}/relatorio/mapa.pdf`} className="btn" style={{ justifyContent: "flex-start" }}>
                Mapa de apuração em PDF <ArrowRight style={{ marginLeft: "auto" }} />
              </Link>
              <Link href={`/cestas/${cestaId}/relatorio/mapa.xlsx`} className="btn" style={{ justifyContent: "flex-start" }}>
                Mapa de apuração em XLS <ArrowRight style={{ marginLeft: "auto" }} />
              </Link>
            </div>
          </div>

          <details className="card">
            <summary className="card-head" style={{ cursor: "pointer", listStyle: "none" }}>
              <Trash2 style={{ width: 16, height: 16, color: "var(--danger)" }} />
              <h3 style={{ color: "var(--danger)" }}>Zona de risco</h3>
            </summary>
            <div className="card-body">
              <p className="small muted" style={{ marginTop: 0 }}>
                Excluir o item remove os preços vinculados e a apuração.
              </p>
              <form action={excluirItem}>
                <input type="hidden" name="cestaId" value={cestaId} />
                <input type="hidden" name="itemId" value={item.id} />
                <button className="btn btn-danger" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                  <Trash2 /> Excluir item
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
