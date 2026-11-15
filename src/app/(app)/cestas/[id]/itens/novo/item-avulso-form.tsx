"use client";

import { useActionState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { adicionarItemAvulso, type ItemFormState } from "../actions";

export function ItemAvulsoForm({
  cestaId,
  lotes,
}: {
  cestaId: number;
  lotes: Array<{ id: number; nome: string }>;
}) {
  const [estado, acao, pendente] = useActionState<ItemFormState, FormData>(adicionarItemAvulso, {});

  return (
    <form action={acao} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="cestaId" value={cestaId} />

      {estado.error ? (
        <div className="alert danger" role="alert">
          <AlertTriangle />
          <div>
            <strong>Não foi possível adicionar</strong>
            <div style={{ marginTop: 2 }}>{estado.error}</div>
          </div>
        </div>
      ) : null}

      <div className="field">
        <label className="label" htmlFor="avulso-descricao">
          Descrição do item <span className="req">*</span>
        </label>
        <textarea
          id="avulso-descricao"
          name="descricao"
          className="textarea"
          placeholder="Descreva o item com as especificações necessárias para a pesquisa de preços."
          required
        />
      </div>

      <div className="field-row-3">
        <div className="field">
          <label className="label" htmlFor="avulso-unidade">
            Unidade
          </label>
          <input id="avulso-unidade" name="unidade" className="input" defaultValue="UN" maxLength={12} />
        </div>
        <div className="field">
          <label className="label" htmlFor="avulso-quantidade">
            Quantidade
          </label>
          <input
            id="avulso-quantidade"
            name="quantidade"
            type="number"
            min={0}
            step="0.0001"
            className="input"
            defaultValue="1"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="avulso-lote">
            Lote
          </label>
          <select id="avulso-lote" name="loteId" className="select" defaultValue="">
            <option value="">Sem lote</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="avulso-novo-lote">
          Ou criar um novo lote
        </label>
        <input
          id="avulso-novo-lote"
          name="novoLote"
          className="input"
          placeholder="Ex.: ANEXO I - LOTE 002"
          maxLength={120}
        />
        <span className="hint">Se preenchido, o item entra no novo lote e o seletor acima é ignorado.</span>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="avulso-observacao">
            Observação
          </label>
          <input id="avulso-observacao" name="observacao" className="input" placeholder="Opcional" />
        </div>
        <div className="field">
          <label className="label" htmlFor="avulso-justificativa">
            Justificativa do vínculo
          </label>
          <input id="avulso-justificativa" name="justificativa" className="input" placeholder="Opcional" />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" type="submit" disabled={pendente}>
          <Plus /> {pendente ? "Adicionando…" : "Adicionar item avulso"}
        </button>
      </div>
    </form>
  );
}
