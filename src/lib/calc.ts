export type Estatisticas = {
  menor: number;
  media: number;
  mediana: number;
  maior: number;
  qtd: number;
  desvioPadrao: number;
  coeficiente: number;
  amplitude: number;
  p25: number;
  p75: number;
};

export function arredondar(valor: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

export function estatisticas(valores: number[]): Estatisticas {
  const limpos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (limpos.length === 0) {
    return { menor: 0, media: 0, mediana: 0, maior: 0, qtd: 0, desvioPadrao: 0, coeficiente: 0, amplitude: 0, p25: 0, p75: 0 };
  }
  const n = limpos.length;
  const soma = limpos.reduce((a, b) => a + b, 0);
  const media = soma / n;
  const meio = Math.floor(n / 2);
  const mediana = n % 2 === 1 ? limpos[meio] : (limpos[meio - 1] + limpos[meio]) / 2;
  const variancia = limpos.reduce((acc, v) => acc + (v - media) ** 2, 0) / n;
  const desvioPadrao = Math.sqrt(variancia);

  // Percentis
  const p25Index = Math.floor((n - 1) * 0.25);
  const p75Index = Math.floor((n - 1) * 0.75);
  const p25 = limpos[p25Index];
  const p75 = limpos[p75Index];

  return {
    menor: limpos[0],
    media,
    mediana,
    maior: limpos[n - 1],
    qtd: n,
    desvioPadrao,
    coeficiente: media > 0 ? desvioPadrao / media : 0,
    amplitude: limpos[n - 1] - limpos[0],
    p25,
    p75,
  };
}

export function valorCalculado(
  e: Estatisticas,
  metodo: string
): number {
  switch (metodo) {
    case "MEDIANA":
      return e.mediana;
    case "MENOR":
      return e.menor;
    case "MAIOR":
      return e.maior;
    default:
      return e.media;
  }
}

/** Um preço é sinalizado quando se afasta mais que `percentual` da média. */
export function desviaDoAlerta(valor: number, media: number, percentual = 18): boolean {
  if (media <= 0) return false;
  return Math.abs(valor - media) / media > percentual / 100;
}

export function variacao(valor: number, referencia: number): number {
  if (referencia <= 0) return 0;
  return ((valor - referencia) / referencia) * 100;
}

export function totalItem(valorUnitario: number, quantidade: number): number {
  return arredondar(valorUnitario * quantidade, 2);
}

/** Distribui valores em N colunas para o mapa verticalizado. */
export function verticalizar<T>(itens: T[], colunas: number): T[][] {
  const n = Math.max(1, Math.min(colunas, itens.length || 1));
  const porColuna = Math.ceil(itens.length / n) || 1;
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += porColuna) out.push(itens.slice(i, i + porColuna));
  return out.length ? out : [[]];
}
