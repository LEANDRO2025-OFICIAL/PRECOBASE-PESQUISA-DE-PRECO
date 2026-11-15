import { prisma } from "./db";
import { arredondar, estatisticas, valorCalculado } from "./calc";
import { valorDoVinculo } from "./queries";

/**
 * Recalcula a apuração (menor, média, mediana, maior) de um item a partir
 * dos preços marcados como selecionados. Remove a apuração quando o item
 * fica sem nenhum preço válido.
 */
export async function recalcularApuracao(itemId: number) {
  const item = await prisma.cestaItem.findUnique({
    where: { id: itemId },
    include: {
      cesta: true,
      precos: {
        where: { selecionado: true },
        include: { preco: true },
      },
    },
  });
  if (!item) return null;

  const valores = item.precos.map(valorDoVinculo).filter((v) => Number.isFinite(v) && v > 0);
  if (valores.length === 0) {
    await prisma.apuracao.deleteMany({ where: { itemId } });
    return null;
  }

  const e = estatisticas(valores);
  const casas = item.cesta.casasDecimais;
  const dados = {
    menor: arredondar(e.menor, casas),
    media: arredondar(e.media, casas),
    mediana: arredondar(e.mediana, casas),
    maior: arredondar(e.maior, casas),
    metodo: item.cesta.tipoCalculo,
    qtdPrecos: valores.length,
    calculadoEm: new Date(),
  };

  const apuracao = await prisma.apuracao.upsert({
    where: { itemId },
    create: { itemId, ...dados },
    update: dados,
  });
  return apuracao;
}

/** Valor unitário que será usado no mapa, conforme o tipo de cálculo da cesta. */
export function valorUnitarioDoItem(
  tipoCalculo: string,
  a: { menor: unknown; media: unknown; mediana: unknown; maior: unknown } | null,
): number {
  if (!a) return 0;
  return valorCalculado(
    {
      menor: Number(a.menor),
      media: Number(a.media),
      mediana: Number(a.mediana),
      maior: Number(a.maior),
      qtd: 1,
      desvioPadrao: 0,
      coeficiente: 0,
      amplitude: 0,
      p25: 0,
      p75: 0,
    },
    tipoCalculo,
  );
}
