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
    const userId = Number(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        nome: true,
        email: true,
        cpf: true,
        papel: true,
        nivel: true,
        ativo: true,
        ultimoAcesso: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
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
    const userId = Number(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { nome, cpf, papel } = body;

    if (!nome || nome.trim().length < 2) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    if (cpf && cpf.length !== 11) {
      return NextResponse.json({ error: "CPF deve ter 11 dígitos" }, { status: 400 });
    }
    if (papel && !["ADMIN", "GESTOR", "OPERADOR"].includes(papel)) {
      return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        nome: nome.trim(),
        cpf: cpf || null,
        papel: papel || "OPERADOR",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}