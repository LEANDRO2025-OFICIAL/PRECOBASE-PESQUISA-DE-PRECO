import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const u = await p.user.findFirst({ where: { email: "leandro@precobase.local" } });
  const c = await p.cesta.findFirst({ orderBy: { id: "asc" }, select: { id: true, token: true, objeto: true } });
  console.log(JSON.stringify({ user: u && { id: u.id, tid: u.tenantId, nome: u.nome, papel: u.papel }, cesta: c }, null, 2));
}

main().finally(() => p.$disconnect());
