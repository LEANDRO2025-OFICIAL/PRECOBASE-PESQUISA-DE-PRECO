"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

type TenantOption = {
  id: number;
  nome: string;
  municipio: string | null;
  uf: string | null;
};

export function LoginForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [mostrar, setMostrar] = useState(false);

  return (
    <form action={formAction}>
      {state.error ? <div className="login-error">{state.error}</div> : null}

      <div className="field">
        <label className="label" htmlFor="tenantId">
          Instituição
        </label>
        <select id="tenantId" name="tenantId" className="select" defaultValue={tenants[0]?.id ?? ""}>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
              {t.municipio ? ` — ${t.municipio}/${t.uf}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="email">
          E-mail institucional
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="username"
          defaultValue="leandro@precobase.local"
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="senha">
          Senha
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="senha"
            name="senha"
            type={mostrar ? "text" : "password"}
            className="input"
            autoComplete="current-password"
            defaultValue="precobase123"
            required
            style={{ paddingRight: 42 }}
          />
          <button
            type="button"
            className="btn-icon"
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            title={mostrar ? "Ocultar senha" : "Mostrar senha"}
            style={{ position: "absolute", right: 3, top: 2 }}
          >
            {mostrar ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </div>

      <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
        <LogIn />
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
