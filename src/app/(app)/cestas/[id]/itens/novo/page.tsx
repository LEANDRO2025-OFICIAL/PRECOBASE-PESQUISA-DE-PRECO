import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackagePlus, PackageSearch, Plus, Search, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brl, dateBR, qtd } from "@/lib/format";
import { buscarCatalogoUnificado } from "@/lib/catalogo";
import { PageHead } from "@/components/ui";
import { adicionarItemCatalogo, adicionarItemCatalogoExterno } from "../actions";
import { ItemAvulsoForm } from "./item-avulso-form";

export const dynamic = "force-dynamic";

export default async function NovoItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { q } = await searchParams;
  const cestaId = Number(id);
  if (!Number.isFinite(cestaId)) notFound();

  const cesta = await prisma.cesta.findFirst({
    where: { id: cestaId, tenantId: session.tid },
    include: { lotes: { orderBy: { ordem: "asc" } }, _count: { select: { itens: true } } },
  });
  if (!cesta) notFound();

  const termo = (q ?? "").trim();
  let resultados: Array<{
    id: number;
    origem: string;
    codigo: string;
    descricao: string;
    grupo: string | null;
    classe: string | null;
    unidade: string | null;
    ncm: string | null;
    statusItem: boolean;
    tipo: string;
    label: string;
    precoCount?: number;
    ultimoValor?: number;
    ultimoData?: Date;
  }> = [];

  if (termo) {
    resultados = await buscarCatalogoUnificado({ q: termo, origem: "TODAS", take: 100 });
  } else {
    // Sem termo: lista produtos BDS com mais preços no acervo (comportamento padrão da página)
    const produtosBDS = await prisma.produto.findMany({
      where: { ativo: true },
      include: {
        _count: { select: { precos: true } },
        precos: { orderBy: { data: "desc" }, take: 1, select: { valor: true, data: true } },
      },
      orderBy: { precos: { _count: "desc" } },
      take: 24,
    });
    resultados = produtosBDS.map((p) => ({
      id: p.id,
      origem: "BDS",
      codigo: p.codigoBr,
      descricao: p.descricao,
      grupo: p.grupo ?? null,
      classe: null,
      unidade: p.unidade ?? "UN",
      ncm: null,
      statusItem: p.ativo,
      tipo: "BDS",
      label: `${p.codigoBr} — ${p.descricao}`,
      precoCount: p._count.precos,
      ultimoValor: p.precos[0]?.valor ? Number(p.precos[0].valor) : undefined,
      ultimoData: p.precos[0]?.data,
    }));
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/cestas">Cestas de preços</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cesta.id}`}>#{cesta.id}</Link>
        <span className="sep">/</span>
        <Link href={`/cestas/${cesta.id}/itens`}>Itens</Link>
        <span className="sep">/</span>
        <span>Novo item</span>
      </div>

      <PageHead
        eyebrow={`Cesta #${cesta.id}`}
        title="Adicionar item"
        sub="Escolha um produto do catálogo para vincular automaticamente os preços do acervo, ou cadastre um item avulso."
        actions={
          <Link href={`/cestas/${cesta.id}/itens`} className="btn btn-ghost">
            <ChevronLeft /> Voltar aos itens
          </Link>
        }
      />

      <div className="grid grid-side">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <PackageSearch style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Catálogo de produtos</h3>
              <div className="card-actions">
                <span className="tiny muted">CATMAT / CATSER e descrições próprias</span>
              </div>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <form method="get" className="toolbar" style={{ margin: 0 }}>
                <div className="searchbox" style={{ flex: 1 }}>
                  <Search />
                  <input
                    className="input"
                    type="search"
                    name="q"
                    defaultValue={termo}
                    placeholder="Digite a descrição, o código BR ou o grupo do produto…"
                    aria-label="Buscar produto no catálogo"
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  <Search /> Buscar
                </button>
              </form>

              {resultados.length === 0 ? (
                <div className="empty" style={{ padding: "36px 16px" }}>
                  <PackageSearch />
                  <h4>Nenhum produto encontrado</h4>
                  <p>
                    {termo
                      ? `Não encontramos produtos para “${termo}” em CATMAT, CATSER ou no catálogo próprio. Tente outro termo ou cadastre o item como avulso.`
                      : "Digite um termo para pesquisar no catálogo (CATMAT, CATSER e produtos próprios)."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="tiny muted">
                    {termo
                      ? `${resultados.length} resultado(s) para “${termo}”`
                      : "Itens mais relevantes — digite para refinar"}
                  </div>
                  <div className="table-wrap">
                    <table className="data compact">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Origem</th>
                          <th style={{ width: 110 }}>Código</th>
                          <th>Produto / Serviço</th>
                          <th className="muted" style={{ width: 150 }}>Grupo / Classe</th>
                          <th className="muted" style={{ width: 70 }}>Un.</th>
                          <th style={{ width: 320 }}>Adicionar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultados.map((r) => {
                          const externo = r.origem !== "BDS";
                          const isBds = r.origem === "BDS";
                          return (
                            <tr key={`${r.origem}:${r.codigo}`}>
                              <td className="tiny">
                                <span className={`badge ${isBds ? "neutral" : "info"} small`}>
                                  {r.origem}
                                </span>
                              </td>
                              <td className="mono tiny">{r.codigo}</td>
                              <td style={{ maxWidth: 460 }}>
                                <div className="strong small">
                                  {r.descricao.length > 140 ? `${r.descricao.slice(0, 140)}…` : r.descricao}
                                </div>
                                {r.classe ? <div className="tiny muted">{r.classe}</div> : null}
                                {!isBds && r.ncm ? <div className="tiny muted">NCM {r.ncm}</div> : null}
                              </td>
                              <td className="muted small">{r.grupo ?? "—"}</td>
                              <td className="muted">{r.unidade ?? "UN"}</td>
                              <td>
                                <form
                                  action={isBds ? adicionarItemCatalogo : adicionarItemCatalogoExterno}
                                  className="row"
                                  style={{ gap: 6 }}
                                >
                                  <input type="hidden" name="cestaId" value={cesta.id} />
                                  {isBds ? (
                                    <input type="hidden" name="produtoId" value={String(r.id)} />
                                  ) : (
                                    <>
                                      <input type="hidden" name="origem" value={r.origem} />
                                      <input type="hidden" name="codigo" value={r.codigo} />
                                    </>
                                  )}
                                  <input
                                    name="quantidade"
                                    type="number"
                                    min={0}
                                    step="0.0001"
                                    defaultValue="1"
                                    className="input"
                                    style={{ width: 76 }}
                                    aria-label={`Quantidade de ${r.descricao}`}
                                  />
                                  <select
                                    name="loteId"
                                    className="select"
                                    style={{ width: 128 }}
                                    defaultValue={cesta.lotes[0]?.id ?? ""}
                                    aria-label="Lote de destino"
                                  >
                                    <option value="">Sem lote</option>
                                    {cesta.lotes.map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.nome}
                                      </option>
                                    ))}
                                  </select>
                                  <button className="btn btn-sm btn-primary" type="submit">
                                    <Plus /> Incluir
                                  </button>
                                </form>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <p className="hint" style={{ margin: 0 }}>
                Ao incluir um produto, vinculamos os preços do acervo dentro da janela de{" "}
                {cesta.priorizarPrecosPraticadosDias} dias configurada na cesta. Você pode revisar a seleção em{" "}
                <strong>Pesquisar fontes</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <PackagePlus style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Item avulso</h3>
            </div>
            <div className="card-body">
              <ItemAvulsoForm cestaId={cesta.id} lotes={cesta.lotes.map((l) => ({ id: l.id, nome: l.nome }))} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Sparkles style={{ width: 16, height: 16, color: "var(--muted)" }} />
              <h3>Como funciona</h3>
            </div>
            <div className="card-body">
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Produtos do catálogo já vêm com unidade e código BR.</li>
                <li>Os preços do acervo são vinculados e marcados para apuração.</li>
                <li>Itens avulsos não têm vínculo com o catálogo; os preços são incluídos manualmente.</li>
                <li>O lote agrupa itens no mapa de apuração (ex.: ANEXO I — LOTE 001).</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-body tight">
              <div className="row between small">
                <span className="muted">Itens na cesta</span>
                <span className="strong">{cesta._count.itens}</span>
              </div>
              <div className="row between small" style={{ marginTop: 8 }}>
                <span className="muted">Lotes</span>
                <span className="strong">{cesta.lotes.length}</span>
              </div>
              <div className="row between small" style={{ marginTop: 8 }}>
                <span className="muted">Quantidade padrão</span>
                <span className="strong">{qtd(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
