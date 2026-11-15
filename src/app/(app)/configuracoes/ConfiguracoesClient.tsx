"use client";

import { useState, useEffect } from "react";
import { User, Building2, Shield, Database, Bell, Palette, Key, Save, AlertTriangle, Check, Loader2 } from "lucide-react";
import { PageHead } from "@/components/ui";

type ConfigState = {
  // Tenant
  nome: string;
  cnpj: string;
  municipio: string;
  uf: string;
  logoUrl: string;
  plano: string;
  // Usuário
  userNome: string;
  userEmail: string;
  userCpf: string;
  userPapel: string;
  // Sistema
  alertaPercentual: number;
  priorizarPrecosPraticadosDias: number;
  mapaVerticalizarColunas: number;
  arredondamentoAbnt: boolean;
  // Notificações
  emailNotificacoes: boolean;
  pushNotificacoes: boolean;
};

const initialConfig: ConfigState = {
  nome: "",
  cnpj: "",
  municipio: "",
  uf: "",
  logoUrl: "",
  plano: "PROFISSIONAL",
  userNome: "",
  userEmail: "",
  userCpf: "",
  userPapel: "OPERADOR",
  alertaPercentual: 18,
  priorizarPrecosPraticadosDias: 270,
  mapaVerticalizarColunas: 12,
  arredondamentoAbnt: true,
  emailNotificacoes: true,
  pushNotificacoes: false,
};

export function ConfiguracoesClient({ session }: { session: { tid: number; uid: number; nome: string; papel: string } }) {
  const [config, setConfig] = useState<ConfigState>(initialConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"tenant" | "usuario" | "sistema" | "notificacoes">("tenant");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const [tenantRes, userRes, systemRes] = await Promise.all([
        fetch(`/api/tenant/${session.tid}`),
        fetch(`/api/users/${session.uid}`),
        fetch(`/api/config/sistema`),
      ]);
      if (tenantRes.ok) {
        const data = await tenantRes.json();
        setConfig((c) => ({ ...c, ...data.tenant }));
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setConfig((c) => ({ ...c, userNome: data.user.nome, userEmail: data.user.email, userCpf: data.user.cpf || "", userPapel: data.user.papel }));
      }
      if (systemRes.ok) {
        const data = await systemRes.json();
        setConfig((c) => ({ ...c, ...data.config }));
      }
    } catch {
      setToast({ msg: "Erro ao carregar configurações", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates = [
        fetch(`/api/tenant/${session.tid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: config.nome,
            cnpj: config.cnpj.replace(/\D/g, ""),
            municipio: config.municipio,
            uf: config.uf.toUpperCase(),
            logoUrl: config.logoUrl || null,
          }),
        }),
        fetch(`/api/users/${session.uid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: config.userNome,
            cpf: config.userCpf.replace(/\D/g, "") || null,
            papel: config.userPapel,
          }),
        }),
        fetch(`/api/config/sistema`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alertaPercentual: config.alertaPercentual,
            priorizarPrecosPraticadosDias: config.priorizarPrecosPraticadosDias,
            mapaVerticalizarColunas: config.mapaVerticalizarColunas,
            arredondamentoAbnt: config.arredondamentoAbnt,
          }),
        }),
      ];
      const results = await Promise.all(updates);
      if (results.every((r) => r.ok)) {
        setToast({ msg: "Configurações salvas com sucesso", type: "success" });
      } else {
        setToast({ msg: "Erro ao salvar algumas configurações", type: "error" });
      }
    } catch {
      setToast({ msg: "Erro de rede", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof ConfigState>(field: K, value: ConfigState[K]) {
    setConfig((c) => ({ ...c, [field]: value }));
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Loader2 className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const tabs = [
    { id: "tenant", label: "Instituição", icon: Building2 },
    { id: "usuario", label: "Meu usuário", icon: User },
    { id: "sistema", label: "Sistema", icon: Shield },
    { id: "notificacoes", label: "Notificações", icon: Bell },
  ];

  return (
    <>
      <div className="breadcrumb">
        <span>Configurações</span>
      </div>

      <PageHead
        eyebrow="Sistema"
        title="Configurações"
        sub="Gerencie as configurações da instituição, seu usuário, parâmetros do sistema e notificações."
        actions={
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="spinner" style={{ width: 16, height: 16, marginRight: 6 }} /> : <> <Save style={{ width: 16, height: 16, marginRight: 6 }} /> Salvar tudo</>}
          </button>
        }
      />

      {/* Abas */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="tabs" role="tablist" style={{ borderBottom: "1px solid var(--border)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px" }}
            >
              <tab.icon style={{ width: 16, height: 16 }} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="card">
        <div className="card-body stack" style={{ gap: 24, paddingTop: 0 }}>

          {/* Aba Instituição */}
          {activeTab === "tenant" && (
            <div className="stack" style={{ gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Dados da instituição</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="field">
                    <span>Nome da instituição *</span>
                    <input
                      type="text"
                      value={config.nome}
                      onChange={(e) => updateField("nome", e.target.value)}
                      placeholder="Prefeitura Municipal de Exemplo"
                      required
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>CNPJ *</span>
                    <input
                      type="text"
                      value={config.cnpj}
                      onChange={(e) => updateField("cnpj", e.target.value.replace(/\D/g, "").slice(0, 14))}
                      placeholder="00.000.000/0000-00"
                      required
                      maxLength={18}
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label className="field">
                    <span>Município</span>
                    <input
                      type="text"
                      value={config.municipio}
                      onChange={(e) => updateField("municipio", e.target.value)}
                      placeholder="São Paulo"
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>UF</span>
                    <input
                      type="text"
                      value={config.uf}
                      onChange={(e) => updateField("uf", e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="SP"
                      maxLength={2}
                      style={{ width: "100%", textTransform: "uppercase" }}
                    />
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>Plano</span>
                    <select value={config.plano} onChange={(e) => updateField("plano", e.target.value)} style={{ width: "100%" }} disabled>
                      <option value="BASICO">Básico</option>
                      <option value="PROFISSIONAL">Profissional</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </label>
                </div>
              </div>
              <div>
                <label className="field">
                  <span>URL do logo (opcional)</span>
                  <input
                    type="url"
                    value={config.logoUrl}
                    onChange={(e) => updateField("logoUrl", e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Aba Meu Usuário */}
          {activeTab === "usuario" && (
            <div className="stack" style={{ gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Meu perfil</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="field">
                    <span>Nome *</span>
                    <input
                      type="text"
                      value={config.userNome}
                      onChange={(e) => updateField("userNome", e.target.value)}
                      required
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>E-mail *</span>
                    <input
                      type="email"
                      value={config.userEmail}
                      onChange={(e) => updateField("userEmail", e.target.value)}
                      required
                      disabled
                      style={{ width: "100%", background: "var(--canvas)" }}
                    />
                    <span className="tiny muted">O e-mail não pode ser alterado aqui</span>
                  </label>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label className="field">
                    <span>CPF</span>
                    <input
                      type="text"
                      value={config.userCpf}
                      onChange={(e) => updateField("userCpf", e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>Papel</span>
                    <select value={config.userPapel} onChange={(e) => updateField("userPapel", e.target.value)} style={{ width: "100%" }}>
                      <option value="ADMIN">Administrador</option>
                      <option value="GESTOR">Gestor</option>
                      <option value="OPERADOR">Operador</option>
                    </select>
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>Alterar senha</span>
                    <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start" }}>
                      <Key style={{ width: 16, height: 16, marginRight: 6 }} /> Redefinir senha
                    </button>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Aba Sistema */}
          {activeTab === "sistema" && (
            <div className="stack" style={{ gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Parâmetros do sistema</h3>

              <div className="alert info" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Alterações aqui afetam todas as cestas novas.</strong>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    Valores padrão são usados ao criar cestas. Cestas existentes mantêm seus próprios valores.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label className="field">
                    <span>Alerta de desvio (%) *</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={config.alertaPercentual}
                      onChange={(e) => updateField("alertaPercentual", Number(e.target.value) || 18)}
                      style={{ width: "100%" }}
                    />
                    <span className="tiny muted">Preços fora desta faixa da média são destacados</span>
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>Priorizar preços praticados (dias) *</span>
                    <input
                      type="number"
                      min="0"
                      max="730"
                      value={config.priorizarPrecosPraticadosDias}
                      onChange={(e) => updateField("priorizarPrecosPraticadosDias", Number(e.target.value) || 270)}
                      style={{ width: "100%" }}
                    />
                    <span className="tiny muted">Janela para buscar preços recentes do acervo</span>
                  </label>
                </div>
                <div>
                  <label className="field">
                    <span>Verticalizar colunas no mapa *</span>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={config.mapaVerticalizarColunas}
                      onChange={(e) => updateField("mapaVerticalizarColunas", Number(e.target.value) || 12)}
                      style={{ width: "100%" }}
                    />
                    <span className="tiny muted">Número de colunas de preços no mapa de apuração</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="field checkbox">
                  <input
                    type="checkbox"
                    checked={config.arredondamentoAbnt}
                    onChange={(e) => updateField("arredondamentoAbnt", e.target.checked)}
                  />
                  <span>Arredondamento ABNT (banker's rounding)</span>
                </label>
              </div>
            </div>
          )}

          {/* Aba Notificações */}
          {activeTab === "notificacoes" && (
            <div className="stack" style={{ gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Preferências de notificação</h3>
              <div className="stack" style={{ gap: 12 }}>
                <label className="field checkbox">
                  <input
                    type="checkbox"
                    checked={config.emailNotificacoes}
                    onChange={(e) => updateField("emailNotificacoes", e.target.checked)}
                  />
                  <span>
                    <strong>Notificações por e-mail</strong>
                    <div className="tiny muted">Receber avisos sobre cotações, prazos e status de cestas</div>
                  </span>
                </label>
                <label className="field checkbox">
                  <input
                    type="checkbox"
                    checked={config.pushNotificacoes}
                    onChange={(e) => updateField("pushNotificacoes", e.target.checked)}
                  />
                  <span>
                    <strong>Notificações push (navegador)</strong>
                    <div className="tiny muted">Alertas em tempo real no navegador</div>
                  </span>
                </label>
              </div>
            </div>
          )}

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

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}