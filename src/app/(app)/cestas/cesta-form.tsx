"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Calculator,
  FileText,
  Landmark,
  Save,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { salvarCesta, type CestaFormState } from "./actions";

export type CestaFormDefaults = {
  id?: number;
  objeto: string;
  objetoDetalhado: string;
  secretariaId: string;
  categorias: number[];
  tipoContratacao: string;
  tipoCalculo: string;
  casasDecimais: string;
  dataSolicitacao: string;
  situacao: string;
  posse: string;
  prazoEnvioCotacoes: string;
  observacao: string;
  informacoesRodape: string;
  alertaPercentual: string;
  priorizarPrecosPraticadosDias: string;
  mapaVerticalizarColunas: string;
  corrigirAtivo: boolean;
  corrigirIncidirSobre: string;
  corrigirIndice: string;
  corrigirDataInicial: string;
  corrigirDataFinal: string;
};

const VAZIO: CestaFormDefaults = {
  objeto: "",
  objetoDetalhado: "",
  secretariaId: "",
  categorias: [],
  tipoContratacao: "LICITACAO",
  tipoCalculo: "MEDIA_ARITMETICA",
  casasDecimais: "2",
  dataSolicitacao: new Date().toISOString().slice(0, 10),
  situacao: "CLIENTE",
  posse: "CLIENTE",
  prazoEnvioCotacoes: "",
  observacao: "",
  informacoesRodape: "",
  alertaPercentual: "18",
  priorizarPrecosPraticadosDias: "270",
  mapaVerticalizarColunas: "12",
  corrigirAtivo: false,
  corrigirIncidirSobre: "VALOR",
  corrigirIndice: "",
  corrigirDataInicial: "",
  corrigirDataFinal: "",
};

export function CestaForm({
  defaults,
  secretarias,
  categorias,
  indices,
}: {
  defaults?: Partial<CestaFormDefaults>;
  secretarias: Array<{ id: number; nome: string; sigla: string | null }>;
  categorias: Array<{ id: number; codigo: number; nome: string; tipo: string }>;
  indices: Array<{ sigla: string; nome: string }>;
}) {
  const d = { ...VAZIO, ...defaults };
  const [estado, acao, pendente] = useActionState<CestaFormState, FormData>(salvarCesta, {});

  return (
    <form action={acao} className="stack" style={{ gap: 16 }}>
      {d.id ? <input type="hidden" name="id" value={d.id} /> : null}

      {estado.error ? (
        <div className="alert danger" role="alert">
          <AlertTriangle />
          <div>
            <strong>Não foi possível salvar</strong>
            <div style={{ marginTop: 2 }}>{estado.error}</div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <FileText style={{ width: 16, height: 16, color: "var(--muted)" }} />
          <h3>Identificação da cesta</h3>
        </div>
        <div className="card-body stack" style={{ gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="objeto">
              Objeto <span className="req">*</span>
            </label>
            <input
              id="objeto"
              name="objeto"
              className="input"
              defaultValue={d.objeto}
              placeholder="Ex.: Aquisição de veículos para a frota municipal"
              maxLength={240}
              required
            />
            <span className="hint">Resumo curto que aparece na lista de cestas e no mapa de apuração.</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="objetoDetalhado">
              Objeto detalhado
            </label>
            <textarea
              id="objetoDetalhado"
              name="objetoDetalhado"
              className="textarea"
              defaultValue={d.objetoDetalhado}
              placeholder="Especificações, quantidades e demais elementos que caracterizam o objeto."
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="secretariaId">
                Secretaria
              </label>
              <select id="secretariaId" name="secretariaId" className="select" defaultValue={d.secretariaId}>
                <option value="">Sem secretaria vinculada</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sigla ? `${s.sigla} — ` : ""}
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="dataSolicitacao">
                Data da solicitação
              </label>
              <input
                id="dataSolicitacao"
                name="dataSolicitacao"
                type="date"
                className="input"
                defaultValue={d.dataSolicitacao}
              />
            </div>
          </div>

          <div className="field">
            <span className="label">
              <Tag style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              Categorias de objetos
            </span>
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 8,
                maxHeight: 220,
                overflowY: "auto",
                padding: 12,
                border: "1px solid var(--line)",
                borderRadius: "var(--r-sm)",
                background: "var(--surface-2)",
              }}
            >
              {categorias.map((c) => (
                <label key={c.id} className="check" style={{ fontSize: 12 }}>
                  <input type="checkbox" name="categorias" value={c.id} defaultChecked={d.categorias.includes(c.id)} />
                  <span>
                    {c.nome}
                    <small>
                      código {c.codigo} · {c.tipo.toLowerCase()}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <Calculator style={{ width: 16, height: 16, color: "var(--muted)" }} />
          <h3>Contratação e critério de cálculo</h3>
        </div>
        <div className="card-body stack" style={{ gap: 16 }}>
          <div className="field-row-3">
            <div className="field">
              <label className="label" htmlFor="tipoContratacao">
                Tipo de contratação
              </label>
              <select id="tipoContratacao" name="tipoContratacao" className="select" defaultValue={d.tipoContratacao}>
                <option value="LICITACAO">Licitação</option>
                <option value="DISPENSA">Dispensa</option>
                <option value="INEXIGIBILIDADE">Inexigibilidade</option>
                <option value="ADESAO">Adesão a ata</option>
                <option value="CONTRATO">Contrato</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="tipoCalculo">
                Tipo de cálculo
              </label>
              <select id="tipoCalculo" name="tipoCalculo" className="select" defaultValue={d.tipoCalculo}>
                <option value="MEDIA_ARITMETICA">Média aritmética</option>
                <option value="MEDIANA">Mediana</option>
                <option value="MENOR">Menor preço</option>
                <option value="MAIOR">Maior preço</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="casasDecimais">
                Casas decimais
              </label>
              <select id="casasDecimais" name="casasDecimais" className="select" defaultValue={d.casasDecimais}>
                <option value="2">2 casas</option>
                <option value="3">3 casas</option>
                <option value="4">4 casas</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="situacao">
                Situação
              </label>
              <select id="situacao" name="situacao" className="select" defaultValue={d.situacao}>
                <option value="CLIENTE">Cliente</option>
                <option value="SUPORTE">Suporte</option>
              </select>
              <span className="hint">Define se a cesta é operada pelo cliente ou pelo suporte.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="prazoEnvioCotacoes">
                Prazo para envio de cotações
              </label>
              <input
                id="prazoEnvioCotacoes"
                name="prazoEnvioCotacoes"
                type="date"
                className="input"
                defaultValue={d.prazoEnvioCotacoes}
              />
            </div>
          </div>

          <label className="switch" style={{ alignSelf: "flex-start" }}>
            <input type="checkbox" name="posse" value="CLIENTE" defaultChecked={d.posse === "CLIENTE"} />
            <span className="switch-track" />
            <span>
              <span className="strong" style={{ fontSize: 13 }}>
                Posse do cliente
              </span>
              <span className="hint" style={{ display: "block" }}>
                Desligue para manter a cesta em posse do suporte.
              </span>
            </span>
          </label>
        </div>
      </div>

      <details className="card">
        <summary className="card-head" style={{ cursor: "pointer", listStyle: "none" }}>
          <SlidersHorizontal style={{ width: 16, height: 16, color: "var(--muted)" }} />
          <h3>Configurações do mapa e da pesquisa</h3>
          <div className="card-actions">
            <span className="tiny muted">alerta, janela de preços e colunas</span>
          </div>
        </summary>
        <div className="card-body stack" style={{ gap: 16 }}>
          <div className="field-row-3">
            <div className="field">
              <label className="label" htmlFor="alertaPercentual">
                Alerta de dispersão (%)
              </label>
              <input
                id="alertaPercentual"
                name="alertaPercentual"
                type="number"
                min={1}
                max={100}
                step={1}
                className="input"
                defaultValue={d.alertaPercentual}
              />
              <span className="hint">Preços acima deste desvio da média recebem destaque.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="priorizarPrecosPraticadosDias">
                Janela de preços praticados (dias)
              </label>
              <input
                id="priorizarPrecosPraticadosDias"
                name="priorizarPrecosPraticadosDias"
                type="number"
                min={0}
                max={3650}
                step={30}
                className="input"
                defaultValue={d.priorizarPrecosPraticadosDias}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="mapaVerticalizarColunas">
                Colunas verticalizadas no mapa
              </label>
              <input
                id="mapaVerticalizarColunas"
                name="mapaVerticalizarColunas"
                type="number"
                min={1}
                max={30}
                step={1}
                className="input"
                defaultValue={d.mapaVerticalizarColunas}
              />
            </div>
          </div>
        </div>
      </details>

      <details className="card" open={d.corrigirAtivo}>
        <summary className="card-head" style={{ cursor: "pointer", listStyle: "none" }}>
          <Landmark style={{ width: 16, height: 16, color: "var(--muted)" }} />
          <h3>Corrigir valores por índice</h3>
          <div className="card-actions">
            <span className="tiny muted">opcional</span>
          </div>
        </summary>
        <div className="card-body stack" style={{ gap: 16 }}>
          <label className="check">
            <input type="checkbox" name="corrigirAtivo" defaultChecked={d.corrigirAtivo} />
            <span>
              Aplicar correção monetária aos preços coletados
              <small>O fator é calculado pela variação acumulada do índice no período informado.</small>
            </span>
          </label>

          <div className="field-row-3">
            <div className="field">
              <label className="label" htmlFor="corrigirIncidirSobre">
                Incidir sobre
              </label>
              <select
                id="corrigirIncidirSobre"
                name="corrigirIncidirSobre"
                className="select"
                defaultValue={d.corrigirIncidirSobre}
              >
                <option value="VALOR">Valor do preço</option>
                <option value="DESCRICAO">Descrição do item</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="corrigirIndice">
                Índice
              </label>
              <select id="corrigirIndice" name="corrigirIndice" className="select" defaultValue={d.corrigirIndice}>
                <option value="">Selecione o índice</option>
                {indices.map((i) => (
                  <option key={i.sigla} value={i.sigla}>
                    {i.sigla} — {i.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="label">
                <CalendarDays style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                Período
              </span>
              <div className="row" style={{ gap: 6 }}>
                <input
                  aria-label="Data inicial da correção"
                  name="corrigirDataInicial"
                  type="date"
                  className="input"
                  defaultValue={d.corrigirDataInicial}
                />
                <span className="muted small">a</span>
                <input
                  aria-label="Data final da correção"
                  name="corrigirDataFinal"
                  type="date"
                  className="input"
                  defaultValue={d.corrigirDataFinal}
                />
              </div>
            </div>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            A correção é aplicada sobre cada preço vinculado aos itens e recalculada no mapa. Você pode refazer ou
            limpar a correção depois, na tela da cesta.
          </p>
        </div>
      </details>

      <div className="card">
        <div className="card-head">
          <FileText style={{ width: 16, height: 16, color: "var(--muted)" }} />
          <h3>Rodapé do mapa e observações</h3>
        </div>
        <div className="card-body stack" style={{ gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="informacoesRodape">
              Informações para rodapé do mapa
            </label>
            <textarea
              id="informacoesRodape"
              name="informacoesRodape"
              className="textarea"
              defaultValue={d.informacoesRodape}
              placeholder="Texto institucional, fonte dos preços, responsável técnico, data-base…"
            />
            <span className="hint">Esse texto é impresso no rodapé do mapa de apuração em PDF.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="observacao">
              Observações internas
            </label>
            <textarea
              id="observacao"
              name="observacao"
              className="textarea"
              defaultValue={d.observacao}
              placeholder="Anotações que não aparecem no mapa."
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8, position: "sticky", bottom: 12 }}>
        <Link href={d.id ? `/cestas/${d.id}` : "/cestas"} className="btn">
          Cancelar
        </Link>
        <button className="btn btn-primary btn-lg" type="submit" disabled={pendente}>
          <Save /> {pendente ? "Salvando…" : d.id ? "Salvar alterações" : "Criar cesta"}
        </button>
      </div>
    </form>
  );
}
