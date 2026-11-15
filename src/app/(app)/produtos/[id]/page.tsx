import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { estatisticasProduto, serieMensal } from "@/lib/queries";
import ProdutoDetalheClient from "./ProdutoDetalheClient";

export default async function ProdutoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const produtoId = Number(id);

  if (!Number.isFinite(produtoId)) notFound();

  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { id: true, codigoBr: true, descricao: true, unidade: true, grupo: true, ativo: true },
  });

  if (!produto) notFound();

  const precos = await prisma.preco.findMany({
    where: { produtoId },
    include: { fonte: true },
    orderBy: { data: "desc" },
  });

  const { estatisticas, fontes } = await estatisticasProduto(produtoId);
  const serie = serieMensal(precos.map((p) => ({ data: p.data, valor: p.valor })));

  return (
    <ProdutoDetalheClient
      produto={produto}
      precos={precos}
      estatisticas={estatisticas}
      fontes={fontes}
      serie={serie}
    />
  );
}
