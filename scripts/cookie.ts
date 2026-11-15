import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = readFileSync(".env", "utf8");
const secret =
  /AUTH_SECRET="?([^"\r\n]+)"?/.exec(env)?.[1] ?? "precobase-dev-secret-change-me";

async function main() {
  const payload = {
    uid: 1,
    tid: 1,
    nome: "Leandro Santos da Silva",
    papel: "ADMIN",
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");

  const prisma = new PrismaClient();
  const cesta = await prisma.cesta.findFirst({ orderBy: { id: "asc" } });
  if (cesta && !cesta.token) {
    await prisma.cesta.update({ where: { id: cesta.id }, data: { token: "teste-publico" } });
  }
  await prisma.$disconnect();

  console.log(`${body}.${sig}`);
}

main();
