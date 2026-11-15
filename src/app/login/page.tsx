import Link from "next/link";
import { CheckCircle2, ShieldCheck, FileSearch, Calculator } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/cestas");

  const tenants = await prisma.tenant.findMany({
    select: { id: true, nome: true, municipio: true, uf: true },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="login-wrap">
      <aside className="login-aside">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <div className="brand-name">PreçoBase</div>
            <div className="brand-tag">Gestão de pesquisa de preços</div>
          </div>
        </div>

        <h1>
          O preço de referência que <em>defende</em> o seu processo.
        </h1>
        <p>
          Pesquise em bases públicas e no histórico do órgão, apure média, mediana e outliers e
          gere o mapa de apuração pronto para a fase preparatória da contratação.
        </p>

        <div className="login-points">
          <div className="login-point">
            <FileSearch />
            <span>Preços de PNCP, Compras.gov.br, CGU, TCEs e do seu próprio histórico.</span>
          </div>
          <div className="login-point">
            <Calculator />
            <span>Apuração por média, mediana ou menor preço, com alerta de dispersão de 18%.</span>
          </div>
          <div className="login-point">
            <ShieldCheck />
            <span>Trilha de auditoria: cada preço guarda órgão, data, fonte e documento.</span>
          </div>
          <div className="login-point">
            <CheckCircle2 />
            <span>Mapa de apuração em PDF e planilha XLS, com QR Code de comprovação.</span>
          </div>
        </div>

        <div className="login-foot">
          <span>Lei nº 14.133/2021 · art. 23</span>
          <span>Versão 1.0</span>
        </div>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div className="eyebrow">Acesso restrito</div>
          <h2>Entrar na plataforma</h2>
          <p className="page-sub">
            Selecione a instituição e informe suas credenciais. O acesso é registrado para
            auditoria.
          </p>

          <LoginForm tenants={tenants} />

          <div className="login-demo">
            <strong>Ambiente de demonstração</strong>
            <br />
            Usuário: <span className="mono">leandro@precobase.local</span>
            <br />
            Senha: <span className="mono">precobase123</span>
          </div>

          <p className="small muted" style={{ marginTop: 20 }}>
            Ao entrar você concorda com o registro de acesso e com a política de uso da
            instituição. <Link href="/login">Precisa de ajuda?</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
