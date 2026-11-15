import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const tenantId = Number(id);

    if (!Number.isFinite(tenantId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        nome: true,
        cnpj: true,
        municipio: true,
        uf: true,
        logoUrl: true,
        plano: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Erro ao buscar tenant:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const tenantId = Number(id);

    if (!Number.isFinite(tenantId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { nome, cnpj, municipio, uf, logoUrl } = body;

    if (!nome || nome.trim().length < 2) {
      return NextResponse.json({ error: "Nome da instituição é obrigatório" }, { status: 400 });
    }
    if (cnpj && cnpj.length !== 14) {
      return NextResponse.json({ error: "CNPJ deve ter 14 dígitos" }, { status: 400 });
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        nome: nome.trim(),
        cnpj: cnpj || null,
        municipio: municipio?.trim() || null,
        uf: uf?.trim().toUpperCase() || null,
        logoUrl: logoUrl?.trim() || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar tenant:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}