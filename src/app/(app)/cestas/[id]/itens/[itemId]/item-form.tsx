"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { salvarItem, type ItemFormState } from "../actions";

export function ItemForm({
  cestaId,
  itemId,
  lotes,
  defaults,
}: {
  cestaId: number;
  itemId: number;
  lotes: Array<{ id: number; nome: string }>;
  defaults: {
    descricao: string;
    unidade: string;
    quantidade: string;
    loteId: string;
    observacao: string;
    justificativa: string;
  };
}) {
  const [estado, acao, pendente] = useActionState<ItemFormState, FormData>(salvarItem, {});

  return (
    <form action={acao} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="cestaId" value={cestaId} />
      <input type="hidden" name="itemId" value={itemId} />

      {estado.error ? (
        <div className="alert danger" role="alert">
          <AlertTriangle />
          <div>
            <strong>Não foi possível salvar</strong>
            <div style={{ marginTop: 2 }}>{estado.error}</div>
          </div>
        </div>
      ) : null}

      <div className="field">
        <label className="label" htmlFor="item-descricao">
          Descrição <span className="req">*</span>
        </label>
        <textarea
          id="item-descricao"
          name="descricao"
          className="textarea"
          defaultValue={defaults.descricao}
          required
        />
      </div>

      <div className="field-row-3">
        <div className="field">
          <label className="label" htmlFor="item-unidade">
            Unidade
          </label>
          <input id="item-unidade" name="unidade" className="input" defaultValue={defaults.unidade} maxLength={12} />
        </div>
        <div className="field">
          <label className="label" htmlFor="item-quantidade">
            Quantidade
          </label>
          <input
            id="item-quantidade"
            name="quantidade"
            type="number"
            min={0}
            step="0.0001"
            className="input"
            defaultValue={defaults.quantidade}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="item-lote">
            Lote
          </label>
          <select id="item-lote" name="loteId" className="select" defaultValue={defaults.loteId}>
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
        <label className="label" htmlFor="item-novo-lote">
          Ou mover para um novo lote
        </label>
        <input
          id="item-novo-lote"
          name="novoLote"
          className="input"
          placeholder="Ex.: ANEXO I - LOTE 002"
          maxLength={120}
        />
        <span className="hint">Se preenchido, cria o lote e move o item para ele.</span>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="item-observacao">
            Observação
          </label>
          <input id="item-observacao" name="observacao" className="input" defaultValue={defaults.observacao} />
        </div>
        <div className="field">
          <label className="label" htmlFor="item-justificativa">
            Justificativa do vínculo
          </label>
          <input
            id="item-justificativa"
            name="justificativa"
            className="input"
            defaultValue={defaults.justificativa}
          />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <Link href={`/cestas/${cestaId}/itens`} className="btn">
          Cancelar
        </Link>
        <button className="btn btn-primary" type="submit" disabled={pendente}>
          <Save /> {pendente ? "Salvando…" : "Salvar item"}
        </button>
      </div>
    </form>
  );
}
