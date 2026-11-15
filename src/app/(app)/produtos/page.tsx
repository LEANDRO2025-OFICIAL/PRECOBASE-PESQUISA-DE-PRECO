import Link from "next/link";
import { Package, Search, Filter, X, BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";

const PAGE_SIZE = 20;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const q = (first(sp.q) ?? "").trim();
  const grupo = first(sp.grupo) ?? "";
  const status = first(sp.status) ?? "ativos";
  const page = Math.max(1, Number(first(sp.page) ?? "1") || 1);
  const ativos = status !== "todos";

  const where: {
    ativo?: boolean;
    grupo?: string;
    OR?: Array<
      | { codigoBr: { contains: string; mode: "insensitive" } }
      | { descricao: { contains: string; mode: "insensitive" } }
      | { grupo: { contains: string; mode: "insensitive" } }
    >;
  } = {};

  if (ativos) where.ativo = true;
  if (grupo) where.grupo = grupo;
  if (q) {
    where.OR = [
      { codigoBr: { contains: q, mode: "insensitive" } },
      { descricao: { contains: q, mode: "insensitive" } },
      { grupo: { contains: q, mode: "insensitive" } },
    ];
  }

  const [produtos, total, gruposRaw] = await Promise.all([
    prisma.produto.findMany({
      where,
      select: {
        id: true,
        codigoBr: true,
        descricao: true,
        unidade: true,
        grupo: true,
        ativo: true,
        _count: { select: { precos: true } },
      },
      orderBy: [{ grupo: "asc" }, { codigoBr: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where: { ativo: true, grupo: { not: null } },
      select: { grupo: true },
      distinct: ["grupo"],
      orderBy: { grupo: "asc" },
    }),
  ]);

  const grupos = gruposRaw.map((g) => g.grupo).filter((g): g is string => !!g);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (grupo) params.set("grupo", grupo);
    if (!ativos) params.set("status", "todos");
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/produtos?${qs}` : "/produtos";
  };

  return (
    <>
      <div className="breadcrumb">
        <span>Catálogo de produtos</span>
      </div>

      <PageHead
        eyebrow="Catálogo"
        title="Catálogo de produtos"
        sub="Busca por código BR, descrição ou grupo. Catálogo ativo para uso em cestas de preços."
        actions={
          <Link href="/produtos/novo" className="btn btn-primary">
            <Package /> Novo produto
          </Link>
        }
      />

      <form method="get" action="/produtos" className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <Filter style={{ width: 18, height: 18 }} />
          <h3>Filtros</h3>
        </div>
        <div
          className="card-body"
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
        >
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <label className="field">
              <span>Busca (código, descrição, grupo)</span>
              <div className="input-wrap">
                <Search className="field-icon" />
                <input
                  className="input"
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Ex: 90101001, VEÍCULO, INFORMÁTICA..."
                />
              </div>
            </label>
          </div>

          <div style={{ flex: "0 0 200px", minWidth: 0 }}>
            <label className="field">
              <span>Grupo</span>
              <select className="select" name="grupo" defaultValue={grupo}>
                <option value="">Todos os grupos</option>
                {grupos.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ flex: "0 0 150px", minWidth: 0 }}>
            <label className="field">
              <span>Status</span>
              <select className="select" name="status" defaultValue={ativos ? "ativos" : "todos"}>
                <option value="ativos">Apenas ativos</option>
                <option value="todos">Todos</option>
              </select>
            </label>
          </div>

          <button type="submit" className="btn btn-primary">
            <Search /> Buscar
          </button>
          <Link href="/produtos" className="btn btn-ghost">
            <X /> Limpar
          </Link>
        </div>
      </form>

      <div className="card">
        <div className="card-head">
          <Package style={{ width: 18, height: 18 }} />
          <h3>Produtos ({total})</h3>
          <div className="card-actions">
            <span className="tiny muted">página {page} de {totalPages}</span>
          </div>
        </div>

        {produtos.length === 0 ? (
          <div className="empty" style={{ padding: "48px 16px", textAlign: "center" }}>
            <Package style={{ width: 48, height: 48, color: "var(--muted)", marginBottom: 12 }} />
            <h4>Nenhum produto encontrado</h4>
            <p className="muted">Ajuste os filtros ou cadastre um novo produto.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Código BR</th>
                    <th>Descrição</th>
                    <th>Grupo</th>
                    <th className="small">Un</th>
                    <th className="small">Preços</th>
                    <th className="small">Status</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p, idx) => (
                    <tr key={p.id}>
                      <td className="num small">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="small strong">{p.codigoBr}</td>
                      <td className="truncate" style={{ maxWidth: 350 }}>
                        {p.descricao}
                      </td>
                      <td className="small">{p.grupo ?? <span className="muted">-</span>}</td>
                      <td className="small">{p.unidade}</td>
                      <td className="num small">{p._count.precos}</td>
                      <td>
                        <span className={p.ativo ? "badge success" : "badge neutral"}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/produtos/${p.id}`}
                          className="btn-icon"
                          title="Ver detalhes"
                          aria-label="Ver detalhes"
                        >
                          <BarChart2 style={{ width: 16, height: 16 }} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {page > 1 ? (
                  <Link href={href(page - 1)} className="btn btn-sm btn-ghost">
                    <ChevronLeft /> Anterior
                  </Link>
                ) : (
                  <span className="btn btn-sm btn-ghost" aria-disabled="true">
                    <ChevronLeft /> Anterior
                  </span>
                )}
                <span className="small muted">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={href(page + 1)} className="btn btn-sm btn-ghost">
                    Próxima <ChevronRight />
                  </Link>
                ) : (
                  <span className="btn btn-sm btn-ghost" aria-disabled="true">
                    Próxima <ChevronRight />
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
