import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const counts: Record<string, number> = {
    tenants: await p.tenant.count(),
    users: await p.user.count(),
    secretarias: await p.secretaria.count(),
    categorias: await p.categoriaObjeto.count(),
    produtos: await p.produto.count(),
    fornecedores: await p.fornecedor.count(),
    fontes: await p.fonte.count(),
    precos: await p.preco.count(),
    cestas: await p.cesta.count(),
    itens: await p.cestaItem.count(),
    itemPrecos: await p.itemPreco.count(),
    apuracoes: await p.apuracao.count(),
    informativos: await p.informativo.count(),
    indices: await p.indice.count(),
    documentos: await p.documento.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
  const cestas = await p.cesta.findMany({
    select: { id: true, objeto: true, status: true, _count: { select: { itens: true } } },
  });
  console.log(JSON.stringify(cestas, null, 2));
  await p.$disconnect();
})();
