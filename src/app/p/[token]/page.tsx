import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import PublicCestaClient from "./PublicCestaClient";

export const dynamic = "force-dynamic";

export default async function PublicCestaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 10) notFound();

  const cesta = await prisma.cesta.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      objeto: true,
      objetoDetalhado: true,
      secretaria: { select: { nome: true, sigla: true } },
      dataSolicitacao: true,
      prazoEnvioCotacoes: true,
      situacao: true,
      itens: {
        orderBy: { ordem: "asc" },
        select: {
          id: true,
          ordem: true,
          descricao: true,
          unidade: true,
          quantidade: true,
          produto: { select: { codigoBr: true } },
        },
      },
      documentos: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          nome: true,
          tipo: true,
          tamanho: true,
          createdAt: true,
        },
      },
    },
  });

  if (!cesta || !cesta.token) notFound();

  return <PublicCestaClient cesta={{ ...cesta, token: cesta.token }} />;
}
