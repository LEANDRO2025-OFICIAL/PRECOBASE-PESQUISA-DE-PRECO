"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Filter, X, Building2, ChevronLeft, ChevronRight, Trash2, Edit, Check, AlertTriangle } from "lucide-react";
import { PageHead } from "@/components/ui";

export default function FornecedoresPage() {
  const [busca, setBusca] = useState("");
  const [ufFilter, setUfFilter] = useState("");
  const [ativosOnly, setAtivosOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState<{
    fornecedores: Array<{
      id: number;
      cnpj: string;
      razaoSocial: string;
      nomeFantasia: string | null;
      email: string | null;
      telefone: string | null;
      municipio: string | null;
      uf: string | null;
      ramos: string[];
      ativo: boolean;
      tenantId: number | null;
      _count: { cotacoes: number };
    }>;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchFornecedores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: busca,
        uf: ufFilter,
        ativos: String(ativosOnly),
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/fornecedores?${params}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        setToast({ msg: "Erro ao carregar fornecedores", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [busca, ufFilter, ativosOnly, page, pageSize]);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este fornecedor? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: "Fornecedor excluído", type: "success" });
        fetchFornecedores();
      } else {
        setToast({ msg: "Erro ao excluir", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const formatCnpj = (cnpj: string) => {
    const nums = cnpj.replace(/\D/g, "");
    return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <>
      <div className="breadcrumb">
        <span>Catálogo de fornecedores</span>
      </div>

      <PageHead
        eyebrow="Catálogo"
        title="Catálogo de fornecedores"
        sub="Fornecedores ativos para uso em cotações. Inclui fornecedores globais (tenantId nulo) e do seu tenant."
        actions={
          <>
            <Link href="/fornecedores/novo" className="btn btn-primary">
              <Building2 style={{ width: 16, height: 16, marginRight: 6 }} /> Novo fornecedor
            </Link>
          </>
        }
      />

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <Filter style={{ width: 18, height: 18 }} />
          <h3>Filtros</h3>
        </div>
        <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <label className="field">
              <span>Busca (CNPJ, razão social, nome fantasia)</span>
              <div className="input-wrap">
                <Search className="field-icon" />
                <input
                  className="input"
                  type="text"
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setPage(1); }}
                  placeholder="Ex: 12.345.678/0001-90, EMPRESA LTDA..."
                />
              </div>
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
                onChange={(e) => { setUfFilter(e.target.value.toUpperCase()); setPage(1); }}
                style={{ textTransform: "uppercase" }}
              />
            </label>
          </div>
          <label className="field checkbox" style={{ flex: "0 0 auto" }}>
            <input type="checkbox" checked={ativosOnly} onChange={(e) => { setAtivosOnly(e.target.checked); setPage(1); }} />
            <span>Apenas ativos</span>
          </label>
          <button type="button" className="btn btn-ghost" onClick={() => { setBusca(""); setUfFilter(""); setAtivosOnly(true); setPage(1); }}>
            <X style={{ width: 14, height: 14, marginRight: 6 }} /> Limpar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="card-head">
          <Building2 style={{ width: 18, height: 18 }} />
          <h3>Fornecedores ({data?.total ?? 0})</h3>
        </div>
        {loading ? (
          <div className="card-body" style={{ textAlign: "center", padding: 48 }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto" }} />
          </div>
        ) : data?.fornecedores.length === 0 ? (
          <div className="empty" style={{ padding: "48px 16px", textAlign: "center" }}>
            <Building2 style={{ width: 48, height: 48, color: "var(--muted)", marginBottom: 12 }} />
            <h4>Nenhum fornecedor encontrado</h4>
            <p className="muted">Ajuste os filtros ou cadastre um novo fornecedor.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>CNPJ</th>
                    <th>Razão social</th>
                    <th>Nome fantasia</th>
                    <th>Município/UF</th>
                    <th>Ramos</th>
                    <th className="small">Cotações</th>
                    <th className="small">Status</th>
                    <th style={{ width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {data?.fornecedores.map((f, idx) => (
                    <tr key={f.id}>
                      <td className="num small">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="small mono">{formatCnpj(f.cnpj)}</td>
                      <td className="truncate" style={{ maxWidth: 280 }}>{f.razaoSocial}</td>
                      <td className="small">{f.nomeFantasia ?? <span className="muted">—</span>}</td>
                      <td className="small">
                        {f.municipio ? `${f.municipio}/${f.uf}` : f.uf ? f.uf : <span className="muted">—</span>}
                      </td>
                      <td className="small">
                        {f.ramos.length > 0 ? (
                          <span className="badge neutral" style={{ fontSize: 11 }}>{f.ramos.slice(0, 3).join(", ")}{f.ramos.length > 3 ? "…" : ""}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num small">{f._count.cotacoes}</td>
                      <td>
                        <span className={f.ativo ? "badge success" : "badge neutral"}>
                          {f.ativo ? "Ativo" : "Inativo"}
                        </span>
                        {f.tenantId === null && <span className="badge info tiny" style={{ marginLeft: 4, fontSize: 10 }}>Global</span>}
                        {f.tenantId !== null && <span className="badge neutral tiny" style={{ marginLeft: 4, fontSize: 10 }}>Tenant</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/fornecedores/${f.id}`} className="btn-icon" title="Ver detalhes">
                            <Edit style={{ width: 16, height: 16 }} />
                          </Link>
                          <button
                            className="btn-icon"
                            onClick={() => handleDelete(f.id)}
                            disabled={deletingId === f.id}
                            title="Excluir"
                            aria-label="Excluir fornecedor"
                          >
                            {deletingId === f.id ? (
                              <div className="spinner" style={{ width: 16, height: 16 }} />
                            ) : (
                              <Trash2 style={{ width: 16, height: 16, color: "var(--danger)" }} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ display: "flex", justifyContent: "center", gap: 8, padding: 16, borderTop: "1px solid var(--border)" }}>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft style={{ width: 16, height: 16 }} />
                </button>
                <span className="small muted" style={{ display: "flex", alignItems: "center" }}>
                  Página {page} de {totalPages}
                </span>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </button>
              </div>
            )}
          </>
        )}
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

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}