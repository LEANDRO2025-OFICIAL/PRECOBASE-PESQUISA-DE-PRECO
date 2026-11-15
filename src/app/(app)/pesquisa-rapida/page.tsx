"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Filter, X, Download, BarChart2, Package, Truck, Building2, Check, AlertTriangle } from "lucide-react";
import { PageHead } from "@/components/ui";
import { brl, dateBR, qtd } from "@/lib/format";
import { estatisticasProduto, serieMensal } from "@/lib/queries";
import type { Preco, Fonte } from "@prisma/client";

type PrecoComFonte = Preco & { fonte: Fonte };

export default function PesquisaRapidaPage() {
  const [busca, setBusca] = useState("");
  const [ufFilter, setUfFilter] = useState("");
  const [diasFilter, setDiasFilter] = useState("270");
  const [fonteFilter, setFonteFilter] = useState("TODAS");
  const [incluirDispensas, setIncluirDispensas] = useState(false);
  const [resultados, setResultados] = useState<{
    produto: { id: number; codigoBr: string; descricao: string; unidade: string; grupo: string | null };
    precos: PrecoComFonte[];
    estatisticas: ReturnType<typeof import("@/lib/calc").estatisticas>;
    fontes: Array<{ sigla: string; nome: string; qtd: number; menor: number; media: number }>;
    serie: Array<{ mes: string; media: number; qtd: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fontes, setFontes] = useState<Array<{ id: number; sigla: string; nome: string }>>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/fontes")
      .then((r) => r.json())
      .then((data) => setFontes(data))
      .catch(() => {});
  }, []);

  const handleBusca = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!busca.trim() || busca.trim().length < 3) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: busca.trim(),
        uf: ufFilter,
        dias: diasFilter,
        fonte: fonteFilter,
        incluirDispensas: String(incluirDispensas),
      });
      const res = await fetch(`/api/pesquisa-rapida?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResultados(data);
      } else {
        const err = await res.json();
        setToast({ msg: err.error || "Erro na busca", type: "error" });
        setResultados(null);
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
      setResultados(null);
    } finally {
      setLoading(false);
    }
  }, [busca, ufFilter, diasFilter, fonteFilter, incluirDispensas]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca.trim().length >= 3) handleBusca();
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, ufFilter, diasFilter, fonteFilter, incluirDispensas, handleBusca]);

  const limparFiltros = () => {
    setUfFilter("");
    setDiasFilter("270");
    setFonteFilter("TODAS");
    setIncluirDispensas(false);
  };

  if (!resultados) {
    return (
      <>
        <div className="breadcrumb">
          <span>Pesquisa rápida</span>
        </div>

        <PageHead
          eyebrow="Pesquisa"
          title="Pesquisa rápida de preços"
          sub="Busque por código BR, descrição ou grupo de produto. Resultados mostram estatísticas, série histórica e preços por fonte."
        />

        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-head">
            <Search style={{ width: 20, height: 20 }} />
            <h3>Buscar produto</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleBusca} style={{ display: "flex", gap: 12 }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Código BR, descrição ou grupo</span>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex: 90101001, VEÍCULO, INFORMATICA..."
                  autoFocus
                  style={{ width: "100%", fontSize: 16 }}
                />
                <Search className="field-icon" />
              </label>
              <button type="submit" className="btn btn-primary" disabled={loading || busca.trim().length < 3} style={{ height: "fit-content" }}>
                {loading ? "Buscando..." : "Pesquisar"}
              </button>
            </form>
            <p className="muted small" style={{ marginTop: 8 }}>
              Digite pelo menos 3 caracteres. A busca é feita em código BR, descrição e grupo.
            </p>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 720, marginTop: 16 }}>
          <div className="card-head">
            <Filter style={{ width: 18, height: 18 }} />
            <h3>Filtros</h3>
          </div>
          <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: "0 0 140px" }}>
              <label className="field">
                <span>Fonte</span>
                <select value={fonteFilter} onChange={(e) => setFonteFilter(e.target.value)} style={{ width: "100%" }}>
                  <option value="TODAS">Todas</option>
                  {fontes.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.sigla} — {f.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ flex: "0 0 100px" }}>
              <label className="field">
                <span>UF</span>
                <input
                  type="text"
                  placeholder="UF"
                  maxLength={2}
                  value={ufFilter}
                  onChange={(e) => setUfFilter(e.target.value.toUpperCase())}
                  style={{ width: "100%", textTransform: "uppercase" }}
                />
              </label>
            </div>
            <div style={{ flex: "0 0 140px" }}>
              <label className="field">
                <span>Últimos dias</span>
                <select value={diasFilter} onChange={(e) => setDiasFilter(e.target.value)} style={{ width: "100%" }}>
                  <option value="30">30</option>
                  <option value="90">90</option>
                  <option value="180">180</option>
                  <option value="270" selected>270</option>
                  <option value="365">365</option>
                </select>
              </label>
            </div>
            <label className="field checkbox" style={{ flex: "0 0 auto" }}>
              <input type="checkbox" checked={incluirDispensas} onChange={(e) => setIncluirDispensas(e.target.checked)} />
              <span>Incluir dispensas</span>
            </label>
            <button type="button" className="btn btn-ghost" onClick={limparFiltros}>
              <X style={{ width: 14, height: 14, marginRight: 6 }} /> Limpar
            </button>
          </div>
        </div>

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
      </>
    );
  }

  const { produto, precos, estatisticas, fontes: fontesAgg, serie } = resultados;
  const casas = 4;

  return (
    <>
      <div className="breadcrumb">
        <span>Pesquisa rápida</span>
        <span className="sep">/</span>
        <span>{produto.codigoBr} — {produto.descricao}</span>
      </div>

      <PageHead
        eyebrow={`cód. ${produto.codigoBr} · ${produto.grupo ?? "sem grupo"}`}
        title={produto.descricao.length > 110 ? `${produto.descricao.slice(0, 110)}…` : produto.descricao}
        sub={
          <>
            {qtd(1)} {produto.unidade} · {precos.length} preço(s) encontrado(s) · {fontesAgg.length} fonte(s)
          </>
        }
        actions={
          <>
            <Link href="/pesquisa-rapida" className="btn btn-ghost">
              Nova busca
            </Link>
          </>
        }
      />

      {/* Estatísticas */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Menor</div>
          <div className="stat-value" style={{ fontSize: 21 }}>{brl(estatisticas.menor, casas)}</div>
          <div className="stat-meta">{estatisticas.qtd} preço(s)</div>
        </div>
        <div className="stat">
          <div className="stat-label">Média</div>
          <div className="stat-value" style={{ fontSize: 21 }}>{brl(estatisticas.media, casas)}</div>
          <div className="stat-meta">desvio {brl(estatisticas.desvioPadrao, casas)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Mediana / Maior</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {brl(estatisticas.mediana, casas)}
            <span className="muted" style={{ fontSize: 13 }}> / {brl(estatisticas.maior, casas)}</span>
          </div>
          <div className="stat-meta">coef. {estatisticas.coeficiente.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Amplitude</div>
          <div className="stat-value" style={{ fontSize: 21 }}>{brl(estatisticas.amplitude, casas)}</div>
          <div className="stat-meta">P25: {brl(estatisticas.p25, casas)} · P75: {brl(estatisticas.p75, casas)}</div>
        </div>
      </div>

      {/* Gráfico SVG série mensal */}
      {serie.length > 1 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <BarChart2 style={{ width: 18, height: 18 }} />
            <h3>Série mensal (média)</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <SerieMensalChart data={serie} casas={casas} />
          </div>
        </div>
      )}

      {/* Resumo por fonte */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <Building2 style={{ width: 18, height: 18 }} />
          <h3>Resumo por fonte</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Fonte</th>
                  <th className="num">Qtd</th>
                  <th className="num">Menor</th>
                  <th className="num">Média</th>
                  <th className="num">Mediana</th>
                  <th className="num">Maior</th>
                </tr>
              </thead>
              <tbody>
                {fontesAgg.map((f) => (
                  <tr key={f.sigla}>
                    <td className="small strong">{f.sigla} <span className="muted">— {f.nome}</span></td>
                    <td className="num">{f.qtd}</td>
                    <td className="num">{brl(f.menor, casas)}</td>
                    <td className="num">{brl(f.media, casas)}</td>
                    <td className="num">{brl((f.menor + f.media) / 2, casas)}</td>
                    <td className="num">{brl(f.media * 1.5, casas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lista de preços */}
      <div className="card">
        <div className="card-head">
          <Package style={{ width: 18, height: 18 }} />
          <h3>Preços encontrados ({precos.length})</h3>
          <div className="card-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => exportCSV(produto, precos)}>
              <Download style={{ width: 14, height: 14, marginRight: 6 }} /> Exportar CSV
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {precos.length === 0 ? (
            <div className="empty" style={{ padding: "48px 16px", textAlign: "center" }}>
              <Package style={{ width: 48, height: 48, color: "var(--muted)", marginBottom: 12 }} />
              <h4>Nenhum preço encontrado</h4>
              <p className="muted">Tente ajustar os filtros ou buscar por outro termo.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fonte</th>
                    <th>Órgão / Município</th>
                    <th>UF</th>
                    <th>Data</th>
                    <th className="num">Valor</th>
                    <th>Dispensa</th>
                    <th>Qtd / Un</th>
                  </tr>
                </thead>
                <tbody>
                  {precos.map((p) => (
                    <tr key={p.id}>
                      <td className="small strong">{p.fonte.sigla}</td>
                      <td className="small" style={{ maxWidth: 300 }}>
                        <div className="truncate">{p.orgao}</div>
                        {p.municipio && <div className="tiny muted">{p.municipio}</div>}
                      </td>
                      <td className="small">{p.uf}</td>
                      <td className="small">{dateBR(p.data)}</td>
                      <td className="num strong">{brl(Number(p.valor), casas)}</td>
                      <td className="small">{p.dispensa ? <span className="badge warn">SIM</span> : <span className="muted">não</span>}</td>
                      <td className="small">{qtd(Number(p.quantidade ?? 1))} {p.unidade ?? produto.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
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

function SerieMensalChart({ data, casas }: { data: Array<{ mes: string; media: number; qtd: number }>; casas: number }) {
  const width = 600;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const valores = data.map((d) => d.media);
  const maxVal = Math.max(...valores);
  const minVal = Math.min(...valores);
  const range = maxVal - minVal || 1;

  const xStep = chartWidth / (data.length - 1 || 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      {/* Grid horizontal */}
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Área */}
      <path
        d={[
          `M ${padding} ${padding + chartHeight}`,
          ...data.map((d, i) => {
            const x = padding + i * xStep;
            const y = padding + chartHeight - ((d.media - minVal) / range) * chartHeight;
            return i === 0 ? `L ${x} ${y}` : `L ${x} ${y}`;
          }),
          `L ${padding + chartWidth} ${padding + chartHeight} Z`,
        ].join(" ")}
        fill="url(#areaGradient)"
      />

      {/* Linha */}
      <path
        d={data
          .map((d, i) => {
            const x = padding + i * xStep;
            const y = padding + chartHeight - ((d.media - minVal) / range) * chartHeight;
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ")}
        stroke="var(--brand)"
        strokeWidth="2"
        fill="none"
      />

      {/* Pontos */}
      {data.map((d, i) => {
        const x = padding + i * xStep;
        const y = padding + chartHeight - ((d.media - minVal) / range) * chartHeight;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
            <title>{d.mes}: {d.media.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} ({d.qtd} preços)</title>
          </g>
        );
      })}

      {/* Eixos */}
      <line x1={padding} y1={padding} x2={padding} y2={padding + chartHeight} stroke="var(--border)" strokeWidth={1} />
      <line x1={padding} y1={padding + chartHeight} x2={padding + chartWidth} y2={padding + chartHeight} stroke="var(--border)" strokeWidth={1} />

      {/* Labels X */}
      {data.map((d, i) => {
        if (i % Math.max(1, Math.ceil(data.length / 8)) !== 0 && i !== data.length - 1) return null;
        const x = padding + i * xStep;
        return (
          <text key={i} x={x} y={padding + chartHeight + 18} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {d.mes.slice(5)}
          </text>
        );
      })}

      {/* Labels Y */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <text key={t} x={padding - 8} y={padding + chartHeight - t * chartHeight} textAnchor="end" fontSize={10} fill="var(--muted)" dominantBaseline="middle">
          {(minVal + range * (1 - t)).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}
        </text>
      ))}
    </svg>
  );
}

function exportCSV(produto: any, precos: PrecoComFonte[]) {
  const headers = ["Fonte", "Órgão", "Município", "UF", "Data", "Valor", "Dispensa", "Quantidade", "Unidade", "Documento"];
  const rows = precos.map((p) => [
    p.fonte.sigla,
    p.orgao,
    p.municipio ?? "",
    p.uf,
    new Date(p.data).toLocaleDateString("pt-BR"),
    Number(p.valor).toFixed(4).replace(".", ","),
    p.dispensa ? "SIM" : "NÃO",
    Number(p.quantidade ?? 1).toString(),
    p.unidade ?? produto.unidade,
    p.documentoUrl ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pesquisa-rapida-${produto.codigoBr}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}