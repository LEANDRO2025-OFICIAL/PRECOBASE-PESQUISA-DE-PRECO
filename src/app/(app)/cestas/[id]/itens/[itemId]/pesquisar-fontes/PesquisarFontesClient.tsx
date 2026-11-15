"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Plus,
  Check,
  CheckSquare,
  Square,
  RotateCcw,
  Download,
  Upload,
  FileText,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHead } from "@/components/ui";
import { brl, dateBR, qtd } from "@/lib/format";
import {
  adicionarPrecoManual,
  excluirVinculoPreco,
  revincularAcervo,
  salvarSelecaoPrecos,
} from "../../actions";
import type { ItemResumo } from "@/lib/queries";
import type { ItemPreco, Preco, Fonte } from "@prisma/client";

type PrecoComFonte = ItemPreco & {
  preco: (Preco & { fonte: Fonte }) | null;
};

export default function PesquisarFontesClient({
  cestaId,
  itemId,
  item,
  cesta,
  fontes,
  precos,
  resumo,
  initialFilters,
}: {
  cestaId: number;
  itemId: number;
  item: {
    id: number;
    ordem: number;
    descricao: string;
    unidade: string;
    quantidade: unknown;
    produto: { codigoBr: string } | null;
    cesta: { tipoCalculo: string; casasDecimais: number; alertaPercentual: number };
    apuracao: { calculadoEm: Date } | null;
  };
  cesta: { id: number; objeto: string };
  fontes: Array<{ id: number; sigla: string; nome: string; tipo: string }>;
  precos: PrecoComFonte[];
  resumo: ItemResumo;
  initialFilters: { uf: string; dias: string; incluirDispensas: boolean; fonte: string };
}) {
  const [ufFilter, setUfFilter] = useState(initialFilters.uf);
  const [diasFilter, setDiasFilter] = useState(initialFilters.dias);
  const [incluirDispensas, setIncluirDispensas] = useState(initialFilters.incluirDispensas);
  const [fonteFilter, setFonteFilter] = useState(initialFilters.fonte);
  const [expandedFonte, setExpandedFonte] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const casas = item.cesta.casasDecimais;
  const alertaPercentual = item.cesta.alertaPercentual;

  // Agrupa preços por fonte
  const precosPorFonte = new Map<number, PrecoComFonte[]>();
  for (const p of precos) {
    const fid = p.preco?.fonteId ?? 0;
    if (!precosPorFonte.has(fid)) precosPorFonte.set(fid, []);
    precosPorFonte.get(fid)!.push(p);
  }

  // Filtra preços visíveis
  const getPrecosVisiveis = useCallback(() => {
    let result = precos;
    if (fonteFilter !== "TODAS") {
      const fid = Number(fonteFilter);
      result = result.filter((p) => p.preco?.fonteId === fid);
    }
    if (ufFilter) {
      result = result.filter((p) => p.preco?.uf?.toUpperCase() === ufFilter.toUpperCase());
    }
    if (diasFilter) {
      const dias = Number(diasFilter);
      const desde = new Date(Date.now() - dias * 86400000);
      result = result.filter((p) => p.preco && new Date(p.preco.data) >= desde);
    }
    if (!incluirDispensas) {
      result = result.filter((p) => !p.preco?.dispensa);
    }
    if (busca) {
      const q = busca.toLowerCase();
      result = result.filter(
        (p) =>
          p.preco?.orgao?.toLowerCase().includes(q) ||
          p.preco?.municipio?.toLowerCase().includes(q) ||
          p.preco?.fonte?.sigla.toLowerCase().includes(q) ||
          p.preco?.fonte?.nome.toLowerCase().includes(q),
      );
    }
    return result;
  }, [precos, fonteFilter, ufFilter, diasFilter, incluirDispensas, busca]);

  const precosVisiveis = getPrecosVisiveis();

  // Estatísticas dos preços SELECIONADOS (para alerta 18%)
  const selecionados = precos.filter((p) => p.selecionado);
  const valoresSelecionados = selecionados
    .map((p) => {
      if (p.valorCorrigido !== null && p.valorCorrigido !== undefined) return Number(p.valorCorrigido);
      if (p.origem === "MANUAL") return Number(p.valorManual ?? 0);
      return Number(p.preco?.valor ?? 0);
    })
    .filter((v) => v > 0);

  const mediaSelecionados =
    valoresSelecionados.length > 0
      ? valoresSelecionados.reduce((a, b) => a + b, 0) / valoresSelecionados.length
      : 0;

  const alertas = selecionados.filter((p) => {
    const v =
      p.valorCorrigido !== null && p.valorCorrigido !== undefined
        ? Number(p.valorCorrigido)
        : p.origem === "MANUAL"
        ? Number(p.valorManual ?? 0)
        : Number(p.preco?.valor ?? 0);
    return mediaSelecionados > 0 && Math.abs(v - mediaSelecionados) / mediaSelecionados > alertaPercentual / 100;
  }).length;

  // Resumo do item vem calculado do servidor (mesma lógica da página do item)

  async function handleSelecao(fd: FormData) {
    setLoading(true);
    const action = fd.get("acao") as string;
    try {
      const res = await fetch(`/api/cestas/${cestaId}/itens/${itemId}/selecao`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        setToast({ msg: "Seleção atualizada com sucesso", type: "success" });
        router.refresh();
      } else {
        const err = await res.json();
        setToast({ msg: err.error || "Erro ao atualizar seleção", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handlePrecoManual(fd: FormData) {
    setLoading(true);
    try {
      const res = await fetch(`/api/cestas/${cestaId}/itens/${itemId}/preco-manual`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        setToast({ msg: "Preço manual adicionado", type: "success" });
        router.refresh();
      } else {
        const err = await res.json();
        setToast({ msg: err.error || "Erro ao adicionar preço manual", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluirVinculo(vinculoId: number) {
    if (!confirm("Desvincular este preço?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cestas/${cestaId}/itens/${itemId}/vinculo/${vinculoId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setToast({ msg: "Preço desvinculado", type: "success" });
        router.refresh();
      } else {
        setToast({ msg: "Erro ao desvincular", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRevincularAcervo() {
    if (!confirm("Revincular preços do acervo? Isso adicionará preços recentes do catálogo.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cestas/${cestaId}/itens/${itemId}/revincular`, {
        method: "POST",
      });
      if (res.ok) {
        setToast({ msg: "Acervo revinculado", type: "success" });
        router.refresh();
      } else {
        setToast({ msg: "Erro ao revincular", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function buildFormData(base: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(base)) fd.append(k, v);
    return fd;
  }

  const visiveisIds = precosVisiveis.map((p) => p.id).join(",");

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cestaId}`}>#{cestaId}</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cestaId}/itens`}>Itens</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cestaId}/itens/${itemId}`}>Item {item.ordem}</Link>
        <span className="sep">/</span>
        <span>Pesquisar fontes</span>
      </div>

      <PageHead
        eyebrow={`Item ${item.ordem} · ${item.produto ? `cód. ${item.produto.codigoBr}` : "avulso"}`}
        title={item.descricao.length > 110 ? `${item.descricao.slice(0, 110)}…` : item.descricao}
        sub={
          <>
            {qtd(Number(item.quantidade))} {item.unidade} · {resumo.selecionados} selecionado(s) de {precos.length} total
            {item.apuracao ? ` · apurado em ${dateBR(item.apuracao.calculadoEm)}` : ""}
          </>
        }
        actions={
          <>
            <Link href={`/cestas/${cestaId}/itens/${itemId}`} className="btn btn-ghost">
              Voltar ao item
            </Link>
          </>
        }
      />

      {/* Resumo rápido */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Menor</div>
          <div className="stat-value" style={{ fontSize: 21 }}>{resumo.semPreco ? "—" : brl(resumo.estatisticas.menor, casas)}</div>
          <div className="stat-meta">{resumo.estatisticas.qtd} preço(s) na apuração</div>
        </div>
        <div className="stat">
          <div className="stat-label">Média</div>
          <div className="stat-value" style={{ fontSize: 21 }}>{resumo.semPreco ? "—" : brl(resumo.estatisticas.media, casas)}</div>
          <div className="stat-meta">desvio {brl(resumo.estatisticas.desvioPadrao, casas)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Mediana / Maior</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {resumo.semPreco ? "—" : brl(resumo.estatisticas.mediana, casas)}
            <span className="muted" style={{ fontSize: 13 }}>
              {" "}
              / {resumo.semPreco ? "—" : brl(resumo.estatisticas.maior, casas)}
            </span>
          </div>
          <div className="stat-meta">coef. {resumo.estatisticas.coeficiente.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total do item</div>
          <div className="stat-value" style={{ fontSize: 21 }}>{brl(resumo.total, 2)}</div>
          <div className="stat-meta">{qtd(resumo.quantidade)} {item.unidade} × {brl(resumo.valorUnitario, casas)}</div>
        </div>
      </div>

      {/* Alerta 18% */}
      {alertas > 0 && (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          <AlertTriangle />
          <div>
            <strong>{alertas} preço(s) fora da faixa de {alertaPercentual}%</strong>
            <div style={{ marginTop: 2 }}>Revise os preços destacados para evitar distorção na média.</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <Filter style={{ width: 18, height: 18 }} />
          <h3>Filtros</h3>
        </div>
        <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <label className="field">
              <span>Busca</span>
              <div className="input-wrap">
                <Search className="field-icon" />
                <input
                  className="input"
                  type="text"
                  placeholder="Órgão, município, fonte..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </label>
          </div>
          <div style={{ flex: "0 0 140px", minWidth: 0 }}>
            <label className="field">
              <span>Fonte</span>
              <select className="select" value={fonteFilter} onChange={(e) => setFonteFilter(e.target.value)}>
                <option value="TODAS">Todas as fontes</option>
                {fontes.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.sigla} — {f.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ flex: "0 0 100px", minWidth: 0 }}>
            <label className="field">
              <span>UF</span>
              <input
                className="input"
                type="text"
                placeholder="UF"
                maxLength={2}
                value={ufFilter}
                onChange={(e) => setUfFilter(e.target.value.toUpperCase())}
                style={{ textTransform: "uppercase" }}
              />
            </label>
          </div>
          <div style={{ flex: "0 0 140px", minWidth: 0 }}>
            <label className="field">
              <span>Últimos dias</span>
              <select className="select" value={diasFilter} onChange={(e) => setDiasFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
                <option value="270">270 dias (padrão)</option>
                <option value="365">1 ano</option>
              </select>
            </label>
          </div>
          <label className="field checkbox" style={{ flex: "0 0 auto" }}>
            <input
              type="checkbox"
              checked={incluirDispensas}
              onChange={(e) => setIncluirDispensas(e.target.checked)}
            />
            <span>Incluir dispensas</span>
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setUfFilter("");
              setDiasFilter("");
              setIncluirDispensas(false);
              setFonteFilter("TODAS");
              setBusca("");
            }}
          >
            <X style={{ width: 14, height: 14, marginRight: 6 }} />
            Limpar
          </button>
        </div>
      </div>

      {/* Abas por fonte */}
      <div className="card">
        <div className="card-head">
          <FileText style={{ width: 18, height: 18 }} />
          <h3>Preços por fonte</h3>
          <div className="card-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="tiny muted">{precosVisiveis.length} preço(s) visíveis</span>
            <button type="button" className="btn btn-sm" onClick={handleRevincularAcervo} disabled={loading}>
              <RotateCcw style={{ width: 14, height: 14, marginRight: 6 }} /> Revincular acervo
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setExpandedFonte("manual")}>
              <Plus style={{ width: 14, height: 14, marginRight: 6 }} /> Preço manual
            </button>
          </div>
        </div>

        {/* Formulário de preço manual (expansível) */}
        {expandedFonte === "manual" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.append("cestaId", String(cestaId));
              fd.append("itemId", String(itemId));
              handlePrecoManual(fd);
            }}
            className="card-body stack"
            style={{ gap: 12, paddingTop: 0, borderTop: "1px solid var(--border)", background: "var(--canvas)" }}
          >
            <h4 style={{ margin: 0, fontSize: 14 }}>Novo preço manual</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label className="field">
                  <span>Valor *</span>
                  <input type="text" name="valor" placeholder="0,00" required style={{ width: "100%" }} />
                </label>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label className="field">
                  <span>Órgão *</span>
                  <input type="text" name="orgao" placeholder="Pesquisa direta" required style={{ width: "100%" }} />
                </label>
              </div>
              <div style={{ flex: "0 0 80px" }}>
                <label className="field">
                  <span>UF</span>
                  <input type="text" name="uf" placeholder="UF" maxLength={2} style={{ width: "100%", textTransform: "uppercase" }} />
                </label>
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <label className="field">
                  <span>Data *</span>
                  <input type="date" name="data" required style={{ width: "100%" }} defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Check style={{ width: 14, height: 14, marginRight: 6 }} /> Adicionar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setExpandedFonte(null)}>
                  <X style={{ width: 14, height: 14, marginRight: 6 }} /> Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Abas */}
        <div className="tabs" role="tablist" style={{ borderBottom: "1px solid var(--border)" }}>
          {fontes
            .filter((f) => {
              const count = precosPorFonte.get(f.id)?.length ?? 0;
              return count > 0 || fonteFilter === "TODAS" || fonteFilter === String(f.id);
            })
            .map((f) => {
              const count = precosPorFonte.get(f.id)?.length ?? 0;
              const selecionadosFonte = precosPorFonte.get(f.id)?.filter((p) => p.selecionado).length ?? 0;
              const isActive = fonteFilter === "TODAS" || fonteFilter === String(f.id);
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`tab ${isActive ? "active" : ""}`}
                  onClick={() => setFonteFilter(fonteFilter === String(f.id) ? "TODAS" : String(f.id))}
                  style={{ padding: "8px 14px", fontSize: 13 }}
                >
                  {f.sigla} <span className="badge neutral">{count}</span>
                  {selecionadosFonte > 0 && <span className="badge success" style={{ marginLeft: 6 }}>{selecionadosFonte} sel.</span>}
                </button>
              );
            })}
        </div>

        {/* Conteúdo da aba ativa */}
        <div className="card-body" style={{ paddingTop: 16 }}>
          {precosVisiveis.length === 0 ? (
            <div className="empty" style={{ padding: "48px 16px", textAlign: "center" }}>
              <Search style={{ width: 48, height: 48, color: "var(--muted)", marginBottom: 12 }} />
              <h4>Nenhum preço encontrado</h4>
              <p className="muted">Ajuste os filtros ou revincule o acervo para buscar preços recentes.</p>
            </div>
          ) : (
            <>
              {/* Ações em lote */}
              <div className="batch-actions" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const fd = buildFormData({ cestaId: String(cestaId), itemId: String(itemId), acao: "todos", visiveis: visiveisIds });
                    handleSelecao(fd);
                  }}
                  disabled={loading}
                >
                  <CheckSquare style={{ width: 14, height: 14, marginRight: 6 }} /> Selecionar todos visíveis
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const fd = buildFormData({ cestaId: String(cestaId), itemId: String(itemId), acao: "nenhum", visiveis: visiveisIds });
                    handleSelecao(fd);
                  }}
                  disabled={loading}
                >
                  <Square style={{ width: 14, height: 14, marginRight: 6 }} /> Limpar seleção visível
                </button>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>Sel.</th>
                      <th>Situação</th>
                      <th>Fonte</th>
                      <th>Órgão / Município</th>
                      <th>UF</th>
                      <th>Data</th>
                      <th className="num">Valor</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {precosVisiveis.map((vinculo) => {
                      const valor =
                        vinculo.valorCorrigido !== null && vinculo.valorCorrigido !== undefined
                          ? Number(vinculo.valorCorrigido)
                          : vinculo.origem === "MANUAL"
                          ? Number(vinculo.valorManual ?? 0)
                          : Number(vinculo.preco?.valor ?? 0);
                      const isAlerta =
                        mediaSelecionados > 0 && Math.abs(valor - mediaSelecionados) / mediaSelecionados > alertaPercentual / 100;
                      return (
                        <tr key={vinculo.id} style={{ background: isAlerta ? "rgba(214,69,69,0.06)" : undefined }}>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={vinculo.selecionado}
                              onChange={() => {
                                const fd = buildFormData({
                                  cestaId: String(cestaId),
                                  itemId: String(itemId),
                                  acao: "salvar",
                                  visiveis: visiveisIds,
                                  selecionados: [...new Set([...precosVisiveis.filter((p) => p.selecionado).map((p) => p.id), vinculo.id])].join(","),
                                });
                                // Remove o desmarcado se necessário
                                if (!vinculo.selecionado) {
                                  fd.set("selecionados", [...new Set([...precosVisiveis.filter((p) => p.selecionado).map((p) => p.id), vinculo.id])].join(","));
                                } else {
                                  fd.set("selecionados", precosVisiveis.filter((p) => p.selecionado && p.id !== vinculo.id).map((p) => p.id).join(","));
                                }
                                handleSelecao(fd);
                              }}
                            />
                          </td>
                          <td>
                            {vinculo.selecionado ? (
                              <span className="badge success"><span className="dot" /> selecionado</span>
                            ) : (
                              <span className="badge neutral">fora da apuração</span>
                            )}
                          </td>
                          <td className="small">{vinculo.preco?.fonte.sigla ?? "MANUAL"}</td>
                          <td className="small" style={{ maxWidth: 300 }}>
                            <div className="truncate">{vinculo.preco?.orgao ?? vinculo.orgaoManual ?? "—"}</div>
                            {vinculo.preco?.municipio ? (
                              <div className="tiny muted">{vinculo.preco.municipio}</div>
                            ) : vinculo.origem === "MANUAL" ? (
                              <div className="tiny muted">Preço manual</div>
                            ) : null}
                          </td>
                          <td className="small">{vinculo.preco?.uf ?? vinculo.ufManual ?? "—"}</td>
                          <td className="small">
                            {vinculo.preco
                              ? dateBR(vinculo.preco.data)
                              : vinculo.dataManual
                              ? dateBR(vinculo.dataManual)
                              : "—"}
                          </td>
                          <td className="num strong" style={{ color: isAlerta ? "var(--danger)" : "inherit" }}>
                            {brl(valor, casas)}
                            {vinculo.valorCorrigido !== null && vinculo.valorCorrigido !== undefined && (
                              <span className="badge warn tiny" style={{ marginLeft: 6, fontSize: 10 }}>corrigido</span>
                            )}
                          </td>
                          <td>
                            {vinculo.origem !== "MANUAL" && vinculo.precoId && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleExcluirVinculo(vinculo.id);
                                }}
                              >
                                <button className="btn-icon" type="submit" title="Desvincular" aria-label="Desvincular preço" disabled={loading}>
                                  <X />
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.type}`}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            animation: "slideIn 0.2s ease",
          }}
          onAnimationEnd={() => setTimeout(() => setToast(null), 3000)}
        >
          {toast.type === "success" ? <Check style={{ width: 18, height: 18 }} /> : <AlertTriangle style={{ width: 18, height: 18 }} />}
          <span>{toast.msg}</span>
        </div>
      )}

      <style jsx>{`
        .batch-actions button {
          white-space: nowrap;
        }
        .table-wrap {
          overflow-x: auto;
        }
        .data td .badge {
          white-space: nowrap;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}