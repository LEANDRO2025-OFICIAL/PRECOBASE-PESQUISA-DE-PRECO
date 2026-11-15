import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Link2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { carregarCesta, resumoDaCesta, valorDoVinculo } from "@/lib/queries";
import { brl, CALCULO_LABEL, CONTRATACAO_LABEL, dateBR, num, prazo, qtd } from "@/lib/format";
import { PageHead, StatusBadge } from "@/components/ui";
import {
  alterarStatusCesta,
  aplicarCorrecao,
  duplicarCesta,
  enviarDocumento,
  excluirCesta,
  excluirDocumento,
  gerarLinkPublico,
  limparCorrecao,
  revogarLinkPublico,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS = ["EM_ABERTO", "EM_ANDAMENTO", "PRONTA", "FINALIZADA"] as const;

export default async function CestaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const cestaId = Number(id);
  if (!Number.isFinite(cestaId)) notFound();

  const [cesta, indices] = await Promise.all([
    carregarCesta(session.tid, cestaId),
    prisma.indice.findMany({ where: { ativo: true }, orderBy: { sigla: "asc" } }),
  ]);
  if (!cesta) notFound();

  const resumo = resumoDaCesta(cesta);
  const selecionados = cesta.itens.reduce(
    (acc, item) => acc + item.precos.filter((p) => p.selecionado).length,
    0,
  );
  const p = prazo(cesta.prazoEnvioCotacoes);
  const hosts = await headers();
  const host = hosts.get("host") ?? "localhost:3100";
  const proto = hosts.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const publicUrl = cesta.token ? `${proto}://${host}/p/${cesta.token}` : null;
  const qr =
    publicUrl &&
    (await QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 220,
      color: { dark: "#12211F", light: "#FFFFFF" },
    }));

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <span>#{cesta.id}</span>
      </div>

      <PageHead
        eyebrow={`Cesta #${cesta.id}`}
        title={cesta.objeto}
        sub={
          <>
            {cesta.secretaria ? `${cesta.secretaria.sigla ? `${cesta.secretaria.sigla} — ` : ""}${cesta.secretaria.nome}` : "Sem secretaria"}
            {" · "}
            {dateBR(cesta.dataSolicitacao)} · {cesta.itens.length} itens · {selecionados} preços selecionados
          </>
        }
        actions={
          <>
            <Link href={`/cestas/${cesta.id}/editar`} className="btn btn-ghost">
              <Pencil /> Editar
            </Link>
            <Link href={`/cestas/${cesta.id}/itens`} className="btn">
              <FolderSearch /> Itens
            </Link>
            <Link href={`/cestas/${cesta.id}/itens/novo`} className="btn btn-primary">
              <Plus /> Adicionar item
            </Link>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Status</div>
          <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: "wrap" }}>
            <StatusBadge status={cesta.status} />
            {cesta.situacao === "SUPORTE" ? <span className="badge info">suporte</span> : null}
          </div>
          <div className="stat-meta">
            {cesta.finalizadaEm ? `finalizada em ${dateBR(cesta.finalizadaEm)}` : "em elaboração"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Valor estimado</div>
          <div className="stat-value">{brl(resumo.total, cesta.casasDecimais)}</div>
          <div className="stat-meta">
            {CALCULO_LABEL[cesta.tipoCalculo]} · {cesta.casasDecimais} casas
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Itens</div>
          <div className="stat-value">{resumo.totalItens}</div>
          <div className="stat-meta">
            {resumo.semPreco > 0 ? (
              <span className="down">{resumo.semPreco} sem preço</span>
            ) : (
              <span className="up">todos com apuração</span>
            )}{" "}
            · {cesta.lotes.length} lote{cesta.lotes.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Prazo de cotações</div>
          <div className="stat-value" style={{ fontSize: 21 }}>
            {cesta.prazoEnvioCotacoes ? dateBR(cesta.prazoEnvioCotacoes) : "—"}
          </div>
          <div className="stat-meta">
            <span className={p.tom === "late" ? "down" : p.tom === "warn" ? "strong" : ""}>{p.texto}</span>
          </div>
        </div>
      </div>

          <div className="card">
            <div className="card-head">
              <FolderSearch style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Itens e apuração</h3>
              <div className="card-actions">
                <Link href={`/cestas/${cesta.id}/itens`} className="btn btn-ghost btn-sm">
                  Ver todos <ArrowRight />
                </Link>
              </div>
            </div>
            {resumo.itens.length === 0 ? (
              <div className="empty">
                <FolderSearch />
                <h4>Nenhum item cadastrado</h4>
                <p>Adicione itens do catálogo ou avulsos para iniciar a pesquisa de preços.</p>
                <Link href={`/cestas/${cesta.id}/itens/novo`} className="btn btn-primary btn-sm">
                  <Plus /> Adicionar item
                </Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Un.</th>
                      <th className="num">Qtd.</th>
                      <th className="num">Menor</th>
                      <th className="num">Média</th>
                      <th className="num">Mediana</th>
                      <th className="num">Maior</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.itens.slice(0, 8).map((item) => (
                      <tr key={item.id}>
                        <td style={{ maxWidth: 360 }}>
                          <Link href={`/cestas/${cesta.id}/itens/${item.id}`} className="strong">
                            {item.ordem}. {item.descricao.length > 90 ? `${item.descricao.slice(0, 90)}…` : item.descricao}
                          </Link>
                          <div className="tiny muted">
                            {item.lote} · {item.selecionados} preço{item.selecionados === 1 ? "" : "s"}
                            {item.alertas > 0 ? ` · ${item.alertas} alerta(s) 18%` : ""}
                          </div>
                        </td>
                        <td className="muted">{item.unidade}</td>
                        <td className="num">{qtd(item.quantidade)}</td>
                        <td className="num">{item.semPreco ? "—" : brl(item.estatisticas.menor, cesta.casasDecimais)}</td>
                        <td className="num strong">{item.semPreco ? "—" : brl(item.estatisticas.media, cesta.casasDecimais)}</td>
                        <td className="num">{item.semPreco ? "—" : brl(item.estatisticas.mediana, cesta.casasDecimais)}</td>
                        <td className="num">{item.semPreco ? "—" : brl(item.estatisticas.maior, cesta.casasDecimais)}</td>
                        <td className="num strong">{brl(item.total, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="right strong">
                        Total dos preços estimados
                      </td>
                      <td className="num strong">{brl(resumo.total, 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {resumo.semPreco > 0 ? (
              <div className="card-foot">
                <div className="alert warn" style={{ margin: 0 }}>
                  <AlertTriangle />
                  <div>
                    <strong>{resumo.semPreco} item(ns) sem preço selecionado.</strong>
                    <div style={{ marginTop: 2 }}>
                      Abra o item e use <em>Pesquisar fontes</em> para vincular os preços do acervo.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>


      <div className="grid grid-side">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <FileText style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Informações da cesta</h3>
              <div className="card-actions">
                <Link href={`/cestas/${cesta.id}/editar`} className="btn btn-ghost btn-sm">
                  <Pencil /> Editar dados
                </Link>
              </div>
            </div>
            <div className="card-body">
              <dl className="kv">
                <dt>Objeto</dt>
                <dd>{cesta.objeto}</dd>
                {cesta.objetoDetalhado ? (
                  <>
                    <dt>Objeto detalhado</dt>
                    <dd style={{ whiteSpace: "pre-line" }}>{cesta.objetoDetalhado}</dd>
                  </>
                ) : null}
                <dt>Secretaria</dt>
                <dd>{cesta.secretaria?.nome ?? "—"}</dd>
                <dt>Categorias</dt>
                <dd>
                  {cesta.categorias.length === 0 ? (
                    <span className="muted">Nenhuma categoria vinculada</span>
                  ) : (
                    <div className="row wrap" style={{ gap: 6 }}>
                      {cesta.categorias.map((c) => (
                        <span key={c.categoriaId} className="badge neutral">
                          {c.categoria.codigo} · {c.categoria.nome}
                        </span>
                      ))}
                    </div>
                  )}
                </dd>
                <dt>Tipo de contratação</dt>
                <dd>{CONTRATACAO_LABEL[cesta.tipoContratacao] ?? cesta.tipoContratacao}</dd>
                <dt>Tipo de cálculo</dt>
                <dd>
                  {CALCULO_LABEL[cesta.tipoCalculo] ?? cesta.tipoCalculo} · {cesta.casasDecimais} casas decimais
                </dd>
                <dt>Data da solicitação</dt>
                <dd>{dateBR(cesta.dataSolicitacao)}</dd>
                <dt>Situação</dt>
                <dd>
                  {cesta.situacao === "CLIENTE" ? "Cliente" : "Suporte"}
                </dd>
                <dt>Prazo de cotações</dt>
                <dd>{cesta.prazoEnvioCotacoes ? dateBR(cesta.prazoEnvioCotacoes) : "sem prazo definido"}</dd>
                <dt>Responsável</dt>
                <dd>{cesta.usuario?.nome ?? "—"}</dd>
                {cesta.observacao ? (
                  <>
                    <dt>Observações internas</dt>
                    <dd style={{ whiteSpace: "pre-line" }}>{cesta.observacao}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Upload style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Documentos e modelos</h3>
              <div className="card-actions">
                <span className="tiny muted">{cesta.documentos.length} arquivo(s)</span>
              </div>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <form action={enviarDocumento} className="row wrap" style={{ gap: 8, alignItems: "flex-end" }}>
                <input type="hidden" name="cestaId" value={cesta.id} />
                <div className="field" style={{ flex: 1, minWidth: 220 }}>
                  <label className="label" htmlFor="arquivo">
                    Enviar arquivo
                  </label>
                  <input
                    id="arquivo"
                    className="input"
                    type="file"
                    name="arquivo"
                    required
                    style={{ paddingTop: 7 }}
                  />
                </div>
                <div className="field" style={{ width: 190 }}>
                  <label className="label" htmlFor="tipo">
                    Tipo
                  </label>
                  <select id="tipo" name="tipo" className="select" defaultValue="COMPROVANTE">
                    <option value="COMPROVANTE">Comprovante de preço</option>
                    <option value="MODELO">Modelo / termo</option>
                    <option value="PESQUISA">Pesquisa de mercado</option>
                    <option value="JUSTIFICATIVA">Justificativa</option>
                  </select>
                </div>
                <button className="btn btn-primary" type="submit">
                  <Upload /> Enviar
                </button>
              </form>

              {cesta.documentos.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Nenhum documento anexado. Você também pode receber documentos pelo link público de pesquisas.
                </p>
              ) : (
                <div className="doc-list">
                  {cesta.documentos.map((doc) => (
                    <div className="doc-item" key={doc.id}>
                      <FileText />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate strong">{doc.nome}</div>
                        <div className="tiny muted">
                          {doc.tipo.toLowerCase()} · {num(doc.tamanho / 1024, 1)} KB · {dateBR(doc.createdAt)}
                        </div>
                      </div>
                      <Link
                        href={`/documentos/${doc.id}`}
                        className="btn-icon"
                        title="Baixar documento"
                        aria-label={`Baixar ${doc.nome}`}
                      >
                        <Download />
                      </Link>
                      <form action={excluirDocumento}>
                        <input type="hidden" name="cestaId" value={cesta.id} />
                        <input type="hidden" name="documentoId" value={doc.id} />
                        <button className="btn-icon" type="submit" title="Excluir documento" aria-label="Excluir documento">
                          <Trash2 />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {cesta.informacoesRodape ? (
            <div className="card">
              <div className="card-head">
                <FileText style={{ width: 16, height: 16, color: "var(--muted)" }} />
                <h3>Rodapé do mapa</h3>
              </div>
              <div className="card-body">
                <p className="small" style={{ whiteSpace: "pre-line", margin: 0 }}>
                  {cesta.informacoesRodape}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <QrCode style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Documentos das pesquisas</h3>
            </div>
            <div className="card-body">
              {publicUrl && qr ? (
                <>
                  <div className="qr-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="QR Code do link público de documentos" />
                    <div style={{ minWidth: 0 }}>
                      <div className="strong small">Link público ativo</div>
                      <div className="tiny muted" style={{ marginTop: 4, wordBreak: "break-all" }}>
                        {publicUrl}
                      </div>
                      <Link href={`/p/${cesta.token}`} target="_blank" className="btn btn-sm" style={{ marginTop: 8 }}>
                        <Link2 /> Abrir página
                      </Link>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 12 }}>
                    <form action={revogarLinkPublico}>
                      <input type="hidden" name="id" value={cesta.id} />
                      <button className="btn btn-sm btn-danger" type="submit">
                        Revogar link
                      </button>
                    </form>
                  </div>
                  <p className="hint" style={{ marginTop: 10 }}>
                    O fornecedor acessa a página, vê os itens da pesquisa e envia os documentos da cotação. Os arquivos
                    aparecem na lista ao lado.
                  </p>
                </>
              ) : (
                <>
                  <p className="small muted" style={{ marginTop: 0 }}>
                    Gere um link público e um QR Code para o fornecedor enviar documentos da pesquisa sem precisar de
                    login.
                  </p>
                  <form action={gerarLinkPublico}>
                    <input type="hidden" name="id" value={cesta.id} />
                    <button className="btn btn-primary" type="submit">
                      <QrCode /> Gerar link e QR Code
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <FileText style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Relatórios</h3>
            </div>
            <div className="card-body stack" style={{ gap: 8 }}>
              <div className="small strong">Mapa de apuração</div>
              <Link href={`/cestas/${cesta.id}/relatorio/mapa.pdf`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileText /> Mapa de apuração em PDF
              </Link>
              <Link href={`/cestas/${cesta.id}/relatorio/mapa.xlsx`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileSpreadsheet /> Mapa de apuração em XLSX
              </Link>
              <Link href={`/cestas/${cesta.id}/relatorio/tr.xlsx`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileText /> Termo de Referência (XLSX)
              </Link>
              <Link href={`/cestas/${cesta.id}/relatorio/subanexo-x.xlsx`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileSpreadsheet /> Subanexo X (XLSX)
              </Link>
              <div className="small strong" style={{ marginTop: 8 }}>Pesquisas de preços</div>
              <Link href={`/cestas/${cesta.id}/relatorio/pesquisas-unificadas.pdf`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileText /> Pesquisas unificadas (PDF)
              </Link>
              <Link href={`/cestas/${cesta.id}/relatorio/contratacoes-similares.pdf`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileText /> Contratações similares (PDF)
              </Link>
              <div className="small strong" style={{ marginTop: 8 }}>Coleta de preço</div>
              <Link href={`/cestas/${cesta.id}/relatorio/coleta.pdf`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileText /> Coleta de preço (PDF)
              </Link>
              <Link href={`/cestas/${cesta.id}/relatorio/coleta.docx`} className="btn" style={{ justifyContent: "flex-start" }}>
                <FileText /> Coleta de preço (DOCX)
              </Link>
              <p className="hint" style={{ margin: 0 }}>
                Os documentos seguem o padrão institucional (PreçoBase) e incluem QR Code do portal do fornecedor quando aplicável.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <RefreshCw style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Status da cesta</h3>
            </div>
            <div className="card-body">
              <form action={alterarStatusCesta} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="id" value={cesta.id} />
                <select name="status" className="select" defaultValue={cesta.status} aria-label="Status da cesta">
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s === "EM_ABERTO"
                        ? "Em aberto"
                        : s === "EM_ANDAMENTO"
                          ? "Em andamento"
                          : s === "PRONTA"
                            ? "Pronta"
                            : "Finalizada"}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary" type="submit">
                  <CheckCircle2 /> Atualizar status
                </button>
              </form>
              <form action={duplicarCesta} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={cesta.id} />
                <button className="btn btn-sm" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                  <Copy /> Duplicar cesta
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <CalendarDays style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Configurações</h3>
            </div>
            <div className="card-body">
              <dl className="kv" style={{ gridTemplateColumns: "130px minmax(0, 1fr)", fontSize: 12 }}>
                <dt>Alerta de dispersão</dt>
                <dd>{cesta.alertaPercentual}%</dd>
                <dt>Janela de preços</dt>
                <dd>{cesta.priorizarPrecosPraticadosDias} dias</dd>
                <dt>Colunas do mapa</dt>
                <dd>{cesta.mapaVerticalizarColunas}</dd>
                <dt>Correção</dt>
                <dd>
                  {cesta.corrigirIndice
                    ? `${cesta.corrigirIndice} · ${dateBR(cesta.corrigirDataInicial)} a ${dateBR(cesta.corrigirDataFinal)}`
                    : "não aplicada"}
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <RefreshCw style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Corrigir valores</h3>
            </div>
            <div className="card-body">
              <form action={aplicarCorrecao} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="id" value={cesta.id} />
                <select name="incidirSobre" className="select" defaultValue={cesta.corrigirIncidirSobre ?? "VALOR"}>
                  <option value="VALOR">Incidir sobre o valor</option>
                  <option value="DESCRICAO">Incidir sobre a descrição</option>
                </select>
                <select name="indice" className="select" defaultValue={cesta.corrigirIndice ?? ""} required>
                  <option value="">Índice…</option>
                  {indices.map((i) => (
                    <option key={i.sigla} value={i.sigla}>
                      {i.sigla} — {i.nome}
                    </option>
                  ))}
                </select>
                <div className="field-row" style={{ gap: 8 }}>
                  <input
                    type="date"
                    name="dataInicial"
                    className="input"
                    defaultValue={cesta.corrigirDataInicial ? cesta.corrigirDataInicial.toISOString().slice(0, 10) : ""}
                    aria-label="Data inicial"
                    required
                  />
                  <input
                    type="date"
                    name="dataFinal"
                    className="input"
                    defaultValue={cesta.corrigirDataFinal ? cesta.corrigirDataFinal.toISOString().slice(0, 10) : ""}
                    aria-label="Data final"
                    required
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  <RefreshCw /> Aplicar correção
                </button>
              </form>
              {cesta.corrigirIndice ? (
                <form action={limparCorrecao} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={cesta.id} />
                  <button className="btn btn-sm" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                    Limpar correção
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <details className="card">
            <summary className="card-head" style={{ cursor: "pointer", listStyle: "none" }}>
              <Trash2 style={{ width: 16, height: 16, color: "var(--danger)" }} />
              <h3 style={{ color: "var(--danger)" }}>Zona de risco</h3>
            </summary>
            <div className="card-body">
              <p className="small muted" style={{ marginTop: 0 }}>
                Excluir a cesta remove itens, preços vinculados, documentos e apurações. Não é possível desfazer.
              </p>
              <form action={excluirCesta}>
                <input type="hidden" name="id" value={cesta.id} />
                <button className="btn btn-danger" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                  <Trash2 /> Excluir cesta
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
