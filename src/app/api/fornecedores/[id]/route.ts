import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const fornecedorId = Number(id);

    if (!Number.isFinite(fornecedorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

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

    if (!fornecedor) {
      return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ fornecedor });
  } catch (error) {
    console.error("Erro ao buscar fornecedor:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const fornecedorId = Number(id);

    if (!Number.isFinite(fornecedorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const formData = await request.formData();

    const cnpj = parseCnpj(String(formData.get("cnpj") || ""));
    const razaoSocial = String(formData.get("razaoSocial") || "").trim();
    const nomeFantasia = String(formData.get("nomeFantasia") || "").trim() || null;
    const email = String(formData.get("email") || "").trim() || null;
    const telefone = String(formData.get("telefone") || "").trim() || null;
    const municipio = String(formData.get("municipio") || "").trim() || null;
    const uf = String(formData.get("uf") || "").trim().toUpperCase() || null;
    const ramos = String(formData.get("ramos") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ativo = formData.get("ativo") === "on" || formData.get("ativo") === "true";

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json({ error: "CNPJ inválido (deve ter 14 dígitos)" }, { status: 400 });
    }
    if (razaoSocial.length < 2) {
      return NextResponse.json({ error: "Razão social é obrigatória" }, { status: 400 });
    }

    const existing = await prisma.fornecedor.findFirst({
      where: { id: { not: fornecedorId }, tenantId: session.tid, cnpj },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Já existe outro fornecedor com este CNPJ no seu tenant" }, { status: 409 });
    }

    await prisma.fornecedor.update({
      where: { id: fornecedorId },
      data: {
        cnpj,
        razaoSocial,
        nomeFantasia,
        email,
        telefone,
        municipio,
        uf,
        ramos,
        ativo,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const fornecedorId = Number(id);

    if (!Number.isFinite(fornecedorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.fornecedor.delete({ where: { id: fornecedorId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir fornecedor:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}