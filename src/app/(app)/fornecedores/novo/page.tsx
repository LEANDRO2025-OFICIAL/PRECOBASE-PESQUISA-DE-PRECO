"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Check, AlertTriangle } from "lucide-react";
import { PageHead } from "@/components/ui";

type FormState = {
  error?: string;
};

export default function FornecedorNovoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);

    try {
      const res = await fetch("/api/fornecedores", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setToast({ msg: "Fornecedor criado com sucesso", type: "success" });
        setTimeout(() => router.push(`/fornecedores/${data.id}`), 800);
      } else {
        const err = await res.json();
        setToast({ msg: err.error || "Erro ao criar fornecedor", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/fornecedores">Fornecedores</Link>
        <span className="sep">/</span>
        <span>Novo</span>
      </div>

      <PageHead
        eyebrow="Catálogo"
        title="Novo fornecedor"
        sub="Cadastre um fornecedor para uso em cotações. Fornecedores globais (sem tenant) ficam disponíveis para todos."
        actions={
          <Link href="/fornecedores" className="btn btn-ghost">
            <ArrowLeft style={{ width: 16, height: 16, marginRight: 6 }} /> Voltar
          </Link>
        }
      />

      <div className="card" style={{ maxWidth: 800 }}>
        <div className="card-head">
          <Building2 style={{ width: 20, height: 20 }} />
          <h3>Dados do fornecedor</h3>
        </div>
        <form onSubmit={handleSubmit} className="card-body stack" style={{ gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field">
                <span>CNPJ *</span>
                <input
                  type="text"
                  name="cnpj"
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
                <input type="text" name="razaoSocial" placeholder="EMPRESA LTDA" required style={{ width: "100%" }} />
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field">
                <span>Nome fantasia</span>
                <input type="text" name="nomeFantasia" placeholder="Nome comercial" style={{ width: "100%" }} />
              </label>
            </div>
            <div>
              <label className="field">
                <span>E-mail</span>
                <input type="email" name="email" placeholder="contato@empresa.com" style={{ width: "100%" }} />
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label className="field">
                <span>Telefone</span>
                <input type="text" name="telefone" placeholder="(11) 99999-9999" style={{ width: "100%" }} />
              </label>
            </div>
            <div>
              <label className="field">
                <span>Município</span>
                <input type="text" name="municipio" placeholder="São Paulo" style={{ width: "100%" }} />
              </label>
            </div>
            <div>
              <label className="field">
                <span>UF</span>
                <input type="text" name="uf" placeholder="SP" maxLength={2} style={{ width: "100%", textTransform: "uppercase" }} />
              </label>
            </div>
          </div>

          <div>
            <label className="field">
              <span>Ramos de atuação (separados por vírgula)</span>
              <textarea name="ramos" placeholder="INFORMATICA, MATERIAL DE ESCRITORIO, SERVIÇOS DE LIMPEZA" rows={3} style={{ width: "100%" }} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <> <Check style={{ width: 16, height: 16, marginRight: 6 }} /> Salvar fornecedor</>}
            </button>
            <Link href="/fornecedores" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
              Cancelar
            </Link>
          </div>
        </form>
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