import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();
    const uf = searchParams.get("uf")?.toUpperCase();
    const ativos = searchParams.get("ativos") !== "false";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));

    const where: any = {};
    if (ativos) where.ativo = true;
    if (uf) where.uf = uf;
    if (q) {
      const cnpjNum = parseCnpj(q);
      where.OR = [
        { cnpj: { contains: cnpjNum, mode: "insensitive" } },
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
      ];
    }

    const [fornecedores, total] = await Promise.all([
      prisma.fornecedor.findMany({
        where,
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
        orderBy: [{ ativo: "desc" }, { razaoSocial: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.fornecedor.count({ where }),
    ]);

    return NextResponse.json({ fornecedores, total });
  } catch (error) {
    console.error("Erro ao listar fornecedores:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
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
      where: { tenantId: session.tid, cnpj },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Já existe fornecedor com este CNPJ no seu tenant" }, { status: 409 });
    }

    const fornecedor = await prisma.fornecedor.create({
      data: {
        tenantId: session.tid,
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
      select: { id: true },
    });

    return NextResponse.json({ id: fornecedor.id });
  } catch (error) {
    console.error("Erro ao criar fornecedor:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}