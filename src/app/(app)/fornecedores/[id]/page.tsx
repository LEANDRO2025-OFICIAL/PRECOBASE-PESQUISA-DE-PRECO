import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import FornecedorDetalheClient from "./FornecedorDetalheClient";

export default async function FornecedorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const fornecedorId = Number(id);

  if (!Number.isFinite(fornecedorId)) notFound();

  const fornecedor = await prisma.fornecedor.findFirst({
    where: { id: fornecedorId },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      email: true,
      telefone: true,
      municipio: true,
      uf: true,
      ramos: true,
      ativo: true,
      tenantId: true,
      createdAt: true,
      _count: { select: { cotacoes: true } },
    },
  });

  if (!fornecedor) notFound();

  return <FornecedorDetalheClient fornecedor={fornecedor} />;
}
