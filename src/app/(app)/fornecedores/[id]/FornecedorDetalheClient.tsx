"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Edit, Trash2, Mail, Phone, MapPin, Check, AlertTriangle, X } from "lucide-react";
import { PageHead } from "@/components/ui";

type Fornecedor = {
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
  createdAt: Date;
  _count: { cotacoes: number };
};

export default function FornecedorDetalheClient({ fornecedor }: { fornecedor: Fornecedor }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    cnpj: fornecedor.cnpj,
    razaoSocial: fornecedor.razaoSocial,
    nomeFantasia: fornecedor.nomeFantasia ?? "",
    email: fornecedor.email ?? "",
    telefone: fornecedor.telefone ?? "",
    municipio: fornecedor.municipio ?? "",
    uf: fornecedor.uf ?? "",
    ramos: fornecedor.ramos.join(", "),
    ativo: fornecedor.ativo,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const formatCnpj = (cnpj: string) => {
    const nums = cnpj.replace(/\D/g, "");
    return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append("ramos", formData.ramos.split(",").map((s) => s.trim()).filter(Boolean).join(","));

      const res = await fetch(`/api/fornecedores/${fornecedor.id}`, { method: "PUT", body: fd });
      if (res.ok) {
        setToast({ msg: "Fornecedor atualizado", type: "success" });
        setEditing(false);
        router.refresh();
      } else {
        const err = await res.json();
        setToast({ msg: err.error || "Erro ao atualizar", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este fornecedor? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/fornecedores/${fornecedor.id}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: "Fornecedor excluído", type: "success" });
        setTimeout(() => router.push("/fornecedores"), 1000);
      } else {
        setToast({ msg: "Erro ao excluir", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/fornecedores">Fornecedores</Link>
        <span className="sep">/</span>
        <span>{formatCnpj(fornecedor.cnpj)} — {fornecedor.razaoSocial}</span>
      </div>

      <PageHead
        eyebrow={fornecedor.tenantId === null ? "Fornecedor global" : "Fornecedor do tenant"}
        title={fornecedor.razaoSocial.length > 110 ? `${fornecedor.razaoSocial.slice(0, 110)}…` : fornecedor.razaoSocial}
        sub={
          <>
            {formatCnpj(fornecedor.cnpj)} · {fornecedor._count.cotacoes} cotação(ões) ·{" "}
            <span className={fornecedor.ativo ? "badge success" : "badge neutral"}>
              {fornecedor.ativo ? "Ativo" : "Inativo"}
            </span>
          </>
        }
        actions={
          <>
            {!editing && (
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>
                <Edit style={{ width: 16, height: 16, marginRight: 6 }} /> Editar
              </button>
            )}
            <Link href="/fornecedores" className="btn btn-ghost">
              <ArrowLeft style={{ width: 16, height: 16, marginRight: 6 }} /> Voltar
            </Link>
          </>
        }
      />

      {editing ? (
        <div className="card" style={{ maxWidth: 800 }}>
          <div className="card-head">
            <Edit style={{ width: 20, height: 20 }} />
            <h3>Editar fornecedor</h3>
          </div>
          <form onSubmit={handleSave} className="card-body stack" style={{ gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="field">
                  <span>CNPJ *</span>
                  <input
                    type="text"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    required
                    maxLength={18}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div>
                <label className="field">
                  <span>Razão social *</span>
                  <input
                    type="text"
                    value={formData.razaoSocial}
                    onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                    required
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="field">
                  <span>Nome fantasia</span>
                  <input
                    type="text"
                    value={formData.nomeFantasia}
                    onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div>
                <label className="field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label className="field">
                  <span>Telefone</span>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div>
                <label className="field">
                  <span>Município</span>
                  <input
                    type="text"
                    value={formData.municipio}
                    onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div>
                <label className="field">
                  <span>UF</span>
                  <input
                    type="text"
                    value={formData.uf}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                    maxLength={2}
                    style={{ width: "100%", textTransform: "uppercase" }}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="field">
                <span>Ramos de atuação (separados por vírgula)</span>
                <textarea
                  value={formData.ramos}
                  onChange={(e) => setFormData({ ...formData, ramos: e.target.value })}
                  rows={3}
                  style={{ width: "100%" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <label className="field checkbox" style={{ flex: "0 0 auto", alignSelf: "center" }}>
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                />
                <span>Ativo</span>
              </label>
              <div style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <> <Check style={{ width: 16, height: 16, marginRight: 6 }} /> Salvar</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={loading}>
                <X style={{ width: 16, height: 16, marginRight: 6 }} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginBottom: 20, gap: 20 }}>
            <div className="card">
              <div className="card-head">
                <Building2 style={{ width: 18, height: 18 }} />
                <h3>Identificação</h3>
              </div>
              <div className="card-body">
                <dl className="kv" style={{ gridTemplateColumns: "140px minmax(0,1fr)" }}>
                  <dt>CNPJ</dt>
                  <dd className="mono strong">{formatCnpj(fornecedor.cnpj)}</dd>
                  <dt>Razão social</dt>
                  <dd>{fornecedor.razaoSocial}</dd>
                  <dt>Nome fantasia</dt>
                  <dd>{fornecedor.nomeFantasia ?? <span className="muted">—</span>}</dd>
                  <dt>Status</dt>
                  <dd>
                    <span className={fornecedor.ativo ? "badge success" : "badge neutral"}>
                      {fornecedor.ativo ? "Ativo" : "Inativo"}
                    </span>
                    {fornecedor.tenantId === null && <span className="badge info" style={{ marginLeft: 8 }}>Global</span>}
                    {fornecedor.tenantId !== null && <span className="badge neutral" style={{ marginLeft: 8 }}>Tenant</span>}
                  </dd>
                  <dt>Cadastrado em</dt>
                  <dd>{new Date(fornecedor.createdAt).toLocaleDateString("pt-BR")}</dd>
                </dl>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <MapPin style={{ width: 18, height: 18 }} />
                <h3>Contato e localização</h3>
              </div>
              <div className="card-body">
                <dl className="kv" style={{ gridTemplateColumns: "140px minmax(0,1fr)" }}>
                  <dt>E-mail</dt>
                  <dd>{fornecedor.email ? <a href={`mailto:${fornecedor.email}`}>{fornecedor.email}</a> : <span className="muted">—</span>}</dd>
                  <dt>Telefone</dt>
                  <dd>{fornecedor.telefone ? <a href={`tel:${fornecedor.telefone.replace(/\D/g, "")}`}>{fornecedor.telefone}</a> : <span className="muted">—</span>}</dd>
                  <dt>Município</dt>
                  <dd>{fornecedor.municipio ?? <span className="muted">—</span>}</dd>
                  <dt>UF</dt>
                  <dd>{fornecedor.uf ?? <span className="muted">—</span>}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-head">
              <Edit style={{ width: 18, height: 18 }} />
              <h3>Ramos de atuação</h3>
            </div>
            <div className="card-body">
              {fornecedor.ramos.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {fornecedor.ramos.map((r, i) => (
                    <span key={i} className="badge neutral">{r}</span>
                  ))}
                </div>
              ) : (
                <span className="muted">Nenhum ramo cadastrado</span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Trash2 style={{ width: 18, height: 18, color: "var(--danger)" }} />
              <h3 style={{ color: "var(--danger)" }}>Zona de risco</h3>
            </div>
            <div className="card-body">
              <p className="small muted" style={{ marginBottom: 12 }}>
                Excluir o fornecedor remove seu vínculo com cotações futuras. Cotações já respondidas mantêm o histórico.
              </p>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {deleting ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <> <Trash2 style={{ width: 16, height: 16, marginRight: 6 }} /> Excluir fornecedor</>}
              </button>
            </div>
          </div>
        </>
      )}

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