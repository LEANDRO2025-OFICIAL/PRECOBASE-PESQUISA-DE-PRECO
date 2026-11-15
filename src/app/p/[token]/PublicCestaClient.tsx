"use client";

import { useState } from "react";
import { FileText, Upload, CheckCircle, AlertCircle, X, Building2, Calendar, Clock, Package, Loader2 } from "lucide-react";
import { PageHead } from "@/components/ui";
import { brl, dateBR, qtd } from "@/lib/format";

type CestaPublica = {
  id: number;
  token: string;
  objeto: string;
  objetoDetalhado: string | null;
  secretaria: { nome: string; sigla: string | null } | null;
  dataSolicitacao: Date;
  prazoEnvioCotacoes: Date | null;
  situacao: string;
  itens: Array<{
    id: number;
    ordem: number;
    descricao: string;
    unidade: string;
    quantidade: unknown;
    produto: { codigoBr: string } | null;
  }>;
  documentos: Array<{
    id: number;
    nome: string;
    tipo: string;
    tamanho: number;
    createdAt: Date;
  }>;
};

export default function PublicCestaClient({ cesta }: { cesta: CestaPublica }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      selectedFiles.forEach((f) => fd.append("files", f));
      fd.append("cestaId", String(cesta.id));

      const res = await fetch(`/api/public/cestas/${cesta.token}/documentos`, {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        setToast({ msg: `${selectedFiles.length} documento(s) enviado(s) com sucesso`, type: "success" });
        setSelectedFiles([]);
        // Recarrega a página para mostrar os novos documentos
        window.location.reload();
      } else {
        const err = await res.json();
        setToast({ msg: err.error || "Erro ao enviar documentos", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="public-layout">
        <header className="public-header">
          <div className="public-header-content">
            <div className="public-brand">
              <Building2 style={{ width: 32, height: 32, color: "var(--brand)" }} />
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>PreçoBase</h1>
                <span className="small muted">Portal do Fornecedor</span>
              </div>
            </div>
            <div className="public-badge">
              <span className="badge info">Cesta #{cesta.id}</span>
            </div>
          </div>
        </header>

        <main className="public-main">
          <div className="public-card">
            <div className="public-card-header">
              <Package style={{ width: 24, height: 24 }} />
              <h2 style={{ margin: 0, fontSize: 18 }}>{cesta.objeto}</h2>
            </div>
            {cesta.objetoDetalhado && (
              <div className="public-card-body muted" style={{ marginBottom: 16 }}>
                {cesta.objetoDetalhado}
              </div>
            )}

            <dl className="kv" style={{ gridTemplateColumns: "160px minmax(0,1fr)", marginBottom: 24, fontSize: 14 }}>
              <dt>Secretaria</dt>
              <dd>{cesta.secretaria?.nome ?? "—"} {cesta.secretaria?.sigla ? `(${cesta.secretaria.sigla})` : ""}</dd>
              <dt>Situação</dt>
              <dd>
                <span className={cesta.situacao === "CLIENTE" ? "badge success" : "badge neutral"}>
                  {cesta.situacao === "CLIENTE" ? "Cliente" : "Suporte"}
                </span>
              </dd>
              <dt>Data da solicitação</dt>
              <dd>
                <Calendar style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
                {dateBR(cesta.dataSolicitacao)}
              </dd>
              {cesta.prazoEnvioCotacoes && (
                <>
                  <dt>Prazo para envio</dt>
                  <dd>
                    <Clock style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
                    {dateBR(cesta.prazoEnvioCotacoes)}
                    {new Date(cesta.prazoEnvioCotacoes) < new Date() && (
                      <span className="badge warn" style={{ marginLeft: 8 }}>Vencido</span>
                    )}
                  </dd>
                </>
              )}
            </dl>

            {/* Itens da cesta */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Itens para cotação</h3>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>Descrição</th>
                      <th className="small">Un</th>
                      <th className="small">Qtd</th>
                      <th className="small">Código BR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cesta.itens.map((item) => (
                      <tr key={item.id}>
                        <td className="num small">{item.ordem}</td>
                        <td className="truncate" style={{ maxWidth: 400 }}>{item.descricao}</td>
                        <td className="small">{item.unidade}</td>
                        <td className="num small">{qtd(Number(item.quantidade))}</td>
                        <td className="small mono">{item.produto?.codigoBr ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upload de documentos */}
            <div className="upload-section" style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>
                <Upload style={{ width: 20, height: 20, display: "inline-block", verticalAlign: "middle", marginRight: 8 }} />
                Enviar documentos da pesquisa
              </h3>
              <p className="small muted" style={{ marginBottom: 16 }}>
                Anexe os comprovantes de preços pesquisados (PDF, imagens, planilhas). Máximo 10MB por arquivo.
              </p>

              <div
                className={`drop-zone ${dragActive ? "active" : ""} ${selectedFiles.length > 0 ? "has-files" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: 32,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: dragActive ? "var(--brand-bg)" : "var(--canvas)",
                  borderColor: dragActive ? "var(--brand)" : selectedFiles.length > 0 ? "var(--success)" : "var(--border)",
                }}
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {selectedFiles.length === 0 ? (
                  <>
                    <Upload style={{ width: 48, height: 48, color: "var(--muted)", marginBottom: 12 }} />
                    <p style={{ margin: "0 0 8px", fontSize: 16 }}>Clique ou arraste arquivos aqui</p>
                    <p className="small muted">PDF, imagens, planilhas, documentos (max 10MB cada)</p>
                  </>
                ) : (
                  <>
                    <CheckCircle style={{ width: 48, height: 48, color: "var(--success)", marginBottom: 12 }} />
                    <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 500 }}>{selectedFiles.length} arquivo(s) selecionado(s)</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflow: "auto" }}>
                      {selectedFiles.map((file, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface)", borderRadius: 8, fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FileText style={{ width: 18, height: 18, color: "var(--muted)" }} />
                            <span className="truncate" style={{ maxWidth: 300 }}>{file.name}</span>
                          </div>
                          <span className="small muted">{formatSize(file.size)}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="btn-icon" style={{ color: "var(--danger)" }}>
                            <X style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedFiles.length > 0 && (
                <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center" }}>
                  <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} style={{ minWidth: 200 }}>
                    {uploading ? <Loader2 className="spinner" style={{ width: 18, height: 18, marginRight: 6 }} /> : <> <Upload style={{ width: 16, height: 16, marginRight: 6 }} /> Enviar {selectedFiles.length} documento(s)</>}
                  </button>
                </div>
              )}
            </div>

            {/* Documentos já enviados */}
            {cesta.documentos.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Documentos já enviados ({cesta.documentos.length})</h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th className="small">Tipo</th>
                        <th className="small">Tamanho</th>
                        <th className="small">Enviado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cesta.documentos.map((doc) => (
                        <tr key={doc.id}>
                          <td className="truncate" style={{ maxWidth: 300 }}>{doc.nome}</td>
                          <td className="small">{doc.tipo}</td>
                          <td className="small">{formatSize(doc.tamanho)}</td>
                          <td className="small">{dateBR(doc.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="public-footer">
          <p className="small muted">PreçoBase — Gestão de Pesquisa de Preços</p>
          <p className="tiny muted">Este link é exclusivo para envio de documentos da cesta #{cesta.id}</p>
        </footer>
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
          {toast.type === "success" ? <CheckCircle style={{ width: 18, height: 18 }} /> : <AlertCircle style={{ width: 18, height: 18 }} />}
          <span>{toast.msg}</span>
        </div>
      )}

      <style jsx>{`
        .public-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--canvas);
        }
        .public-header {
          background: var(--surface);
          border-bottom: 1px solid var(--line);
          padding: 16px 24px;
        }
        .public-header-content {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .public-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .public-main {
          flex: 1;
          padding: 32px 24px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }
        .public-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }
        .public-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .public-card-body {
          line-height: 1.6;
        }
        .upload-section {
          margin-top: 24px;
        }
        .drop-zone {
          transition: all 0.2s;
        }
        .drop-zone.active {
          background: var(--brand-soft);
          border-color: var(--brand) !important;
        }
        .drop-zone.has-files {
          border-color: var(--success) !important;
          background: var(--surface);
        }
        .drop-zone:hover {
          border-color: var(--brand);
        }
        .public-footer {
          padding: 24px;
          text-align: center;
          border-top: 1px solid var(--line);
          background: var(--surface);
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 640px) {
          .public-header { padding: 14px 16px; }
          .public-main { padding: 20px 14px; }
          .public-card { padding: 16px; border-radius: 12px; }
          .public-header-content { flex-wrap: wrap; }
        }
      `}</style>
    </>
  );
}