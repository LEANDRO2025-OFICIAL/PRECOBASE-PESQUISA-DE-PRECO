"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Filter, X, FileText, ChevronLeft, ChevronRight, Calendar, Check, AlertTriangle } from "lucide-react";
import { PageHead } from "@/components/ui";
import { dateBR, rotuloCategoria } from "@/lib/format";

type Informativo = {
  id: number;
  titulo: string;
  resumo: string | null;
  corpo: string;
  categoria: string;
  publicadoEm: Date;
  tenantId: number | null;
};

export default function InformativosPage() {
  const [busca, setBusca] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [data, setData] = useState<{
    informativos: Informativo[];
    total: number;
    categorias: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchInformativos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: busca,
        categoria: categoriaFilter,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/informativos?${params}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        setToast({ msg: "Erro ao carregar informativos", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [busca, categoriaFilter, page, pageSize]);

  useEffect(() => {
    fetchInformativos();
  }, [fetchInformativos]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <>
      <div className="breadcrumb">
        <span>Informativos</span>
      </div>

      <PageHead
        eyebrow="Comunicação"
        title="Informativos"
        sub="Comunicados, notícias e avisos do sistema. Informativos globais (sem tenant) são visíveis para todos."
      />

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <Filter style={{ width: 18, height: 18 }} />
          <h3>Filtros</h3>
        </div>
        <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label className="field">
              <span>Busca (título, resumo, conteúdo)</span>
              <input
                type="text"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPage(1); }}
                placeholder="Buscar informativos..."
                style={{ width: "100%" }}
              />
              <Search className="field-icon" />
            </label>
          </div>
          <div style={{ flex: "0 0 200px" }}>
            <label className="field">
              <span>Categoria</span>
              <select value={categoriaFilter} onChange={(e) => { setCategoriaFilter(e.target.value); setPage(1); }} style={{ width: "100%" }}>
                <option value="">Todas</option>
                {data?.categorias.map((c) => <option key={c} value={c}>{rotuloCategoria(c)}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => { setBusca(""); setCategoriaFilter(""); setPage(1); }}>
            <X style={{ width: 14, height: 14, marginRight: 6 }} /> Limpar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card-head">
          <FileText style={{ width: 18, height: 18 }} />
          <h3>Informativos ({data?.total ?? 0})</h3>
        </div>
        {loading ? (
          <div className="card-body" style={{ textAlign: "center", padding: 48 }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto" }} />
          </div>
        ) : data?.informativos.length === 0 ? (
          <div className="empty" style={{ padding: "48px 16px", textAlign: "center" }}>
            <FileText style={{ width: 48, height: 48, color: "var(--muted)", marginBottom: 12 }} />
            <h4>Nenhum informativo encontrado</h4>
            <p className="muted">Ajuste os filtros.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Título</th>
                    <th>Categoria</th>
                    <th className="small">Publicado em</th>
                    <th className="small">Âmbito</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {data?.informativos.map((i, idx) => (
                    <tr key={i.id}>
                      <td className="num small">{(page - 1) * pageSize + idx + 1}</td>
                      <td>
                        <Link href={`/informativos/${i.id}`} className="link">
                          {i.titulo.length > 80 ? `${i.titulo.slice(0, 80)}…` : i.titulo}
                        </Link>
                        {i.resumo && <div className="small muted truncate" style={{ maxWidth: 400 }}>{i.resumo}</div>}
                      </td>
                      <td className="small">
                        <span className="badge neutral">{rotuloCategoria(i.categoria)}</span>
                      </td>
                      <td className="small">
                        <Calendar style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                        {dateBR(i.publicadoEm)}
                      </td>
                      <td className="small">
                        {i.tenantId === null ? (
                          <span className="badge info">Global</span>
                        ) : (
                          <span className="badge neutral">Tenant</span>
                        )}
                      </td>
                      <td>
                        <Link href={`/informativos/${i.id}`} className="btn-icon" title="Ver detalhes">
                          <ChevronRight style={{ width: 16, height: 16 }} />
                        </Link>
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