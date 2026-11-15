import Link from "next/link";
import { ChevronRight, Wifi, ShieldAlert, Database, RefreshCw } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

type Conector = {
  nome: string;
  sigla: string;
  tipo: "PUBLICA" | "CONVENIO" | "INTERNA";
  descricao: string;
};

const CONECTORES: Conector[] = [
  {
    nome: "Portal Nacional de Contratações Públicas",
    sigla: "PNCP",
    tipo: "PUBLICA",
    descricao: "Consulta pública de contratações publicadas no PNCP (API aberta, sem credencial).",
  },
  {
    nome: "Catálogo de Materiais (CATMAT)",
    sigla: "CATMAT",
    tipo: "PUBLICA",
    descricao: "Catálogo de materiais do Compras.gov.br (API aberta, paginado).",
  },
  {
    nome: "Catálogo de Serviços (CATSER)",
    sigla: "CATSER",
    tipo: "PUBLICA",
    descricao: "Catálogo de serviços do Compras.gov.br (API aberta, paginado).",
  },
  {
    nome: "Banco de Preços BLL",
    sigla: "BLL",
    tipo: "CONVENIO",
    descricao: "Requer convênio/token. Não acessível publicamente; importação manual.",
  },
  {
    nome: "Banco Nacional de Compras",
    sigla: "BNC",
    tipo: "CONVENIO",
    descricao: "Requer convênio/token. Não acessível publicamente; importação manual.",
  },
  {
    nome: "CGU - Nota Fiscal Eletrônica",
    sigla: "CGU NFE",
    tipo: "CONVENIO",
    descricao: "Requer convênio/token. Não acessível publicamente; importação manual.",
  },
];

async function testarConector(sigla: string): Promise<{ online: boolean; erro?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let url: string;
    if (sigla === "PNCP") {
      url = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?pagina=1&tamanhoPagina=1";
    } else if (sigla === "CATMAT") {
      url = "https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial?pagina=1&tamanhoPagina=1";
    } else if (sigla === "CATSER") {
      url = "https://dadosabertos.compras.gov.br/modulo-servico/6_consultarItemServico?pagina=1&tamanhoPagina=1";
    } else {
      return { online: false, erro: "não testável publicamente" };
    }
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "precobase-status/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { online: res.ok };
  } catch (e: any) {
    return { online: false, erro: e?.message ?? String(e) };
  }
}

export default async function StatusPage() {
  const session = await requireSession();
  const resultados = await Promise.all(
    CONECTORES.map(async (c) => {
      const r =
        c.tipo === "CONVENIO"
          ? { online: null, erro: "requer credencial" }
          : await testarConector(c.sigla);
      return { ...c, ...r };
    }),
  );

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Painel</Link>
        <span className="sep">/</span>
        <span>Status dos conectores</span>
      </div>

      <PageHead
        eyebrow="Sistema"
        title="Status dos conectores"
        sub="Verifique a conectividade com os portais de preços públicos e catálogos externos."
        actions={
          <Link href="/configuracoes" className="btn btn-ghost">
            Configurações
          </Link>
        }
      />

      <div className="card">
        <div className="card-head">
          <Database style={{ width: 18, height: 18, color: "var(--muted)" }} />
          <h3>Conectores de preços</h3>
          <div className="card-actions">
            <button type="button" className="btn btn-sm btn-ghost">
              <RefreshCw style={{ width: 14, height: 14, marginRight: 6 }} /> Atualizar
            </button>
          </div>
        </div>
        <div className="card-body stack" style={{ gap: 10 }}>
          {resultados.map((c) => {
            const online = c.online === true;
            const requerCredencial = c.tipo === "CONVENIO";
            return (
              <div
                key={c.sigla}
                className="row between"
                style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", alignItems: "center" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {requerCredencial ? (
                    <ShieldAlert style={{ width: 16, height: 16, color: "var(--muted)" }} />
                  ) : online ? (
                    <Wifi style={{ width: 16, height: 16, color: "var(--brand-teal)" }} />
                  ) : (
                    <Wifi style={{ width: 16, height: 16, color: "var(--danger)" }} />
                  )}
                  <div>
                    <div className="strong small">{c.nome}</div>
                    <div className="tiny muted">{c.sigla} · {c.descricao}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {requerCredencial ? (
                    <span className="badge neutral">Configurar</span>
                  ) : online ? (
                    <span className="badge success">Online</span>
                  ) : (
                    <span className="badge warn">Offline</span>
                  )}
                  <Link
                    href={`/cestas/nova?q=${encodeURIComponent(c.sigla)}`}
                    className="btn btn-sm btn-ghost"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    <ChevronRight style={{ width: 12, height: 12, marginRight: 4 }} /> Usar em cesta
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <ShieldAlert style={{ width: 18, height: 18, color: "var(--muted)" }} />
          <h3>Limites de fontes com convênio</h3>
        </div>
        <div className="card-body">
          <p className="small">
            BLL, BNC e CGU NFE dependem de convênio/token junto ao órgão responsável. Como não há credenciais
            configuradas neste clone, elas são tratadas como <strong>fontes importáveis/manuais</strong>: o usuário
            pode cadastrar preços avulsos ou importar por arquivo, mas a consulta automática não está disponível.
          </p>
          <ul className="small muted" style={{ margin: 8, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>CATMAT e CATSER: consulta automática via dadosabertos.compras.gov.br (paginado, tamanhoPagina ≥ 10).</li>
            <li>PNCP: consulta automática via pncp.gov.br/api/consulta/v1 (mínimo 10 por página).</li>
            <li>BLL / BNC / CGU NFE: sem acesso público; uso manual com origem registrada.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
