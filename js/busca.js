// Núcleo da contagem: o mesmo código roda no site, nos scripts e nos testes.
// Regra principal: conta palavra inteira, nunca pedaço ("cultura" não conta "agricultura").

const LETRA = /[\p{L}\p{N}]+/gu;

export const minusculo = (s) => s.normalize('NFC').toLowerCase();
const tirarAcento = (minusc) => (/[^\x00-\x7f]/.test(minusc) ? minusc.normalize('NFD').replace(/\p{M}/gu, '') : minusc);
export const semAcento = (s) => tirarAcento(minusculo(s));
const temAcento = (s) => semAcento(s) !== minusculo(s);

// Quebra um texto em palavras, guardando onde cada uma começa e termina (para os trechos).
export function palavras(texto) {
  const lista = [];
  for (const m of texto.matchAll(LETRA)) {
    const forma = minusculo(m[0]);
    lista.push({ forma, dobrada: tirarAcento(forma), inicio: m.index, fim: m.index + m[0].length });
  }
  return lista;
}

// Singular e plural da mesma palavra, pelas regras comuns do português.
// Não junta palavras diferentes: "crime" conta "crimes", mas não "criminoso".
export function flexoes(palavra) {
  const p = minusculo(palavra);
  const formas = new Set([p]);
  if (/ão$/.test(p)) ['ões', 'ães', 'ãos'].forEach((f) => formas.add(p.replace(/ão$/, f)));
  else if (/ões$|ães$|ãos$/.test(p)) formas.add(p.replace(/(ões|ães|ãos)$/, 'ão'));
  else if (/[aeiouáéíóúâêô]$/.test(p)) formas.add(`${p}s`);
  else if (/[aeiouáéíóúâêô]s$/.test(p) && p.length > 3) formas.add(p.slice(0, -1));
  if (/[rz]$/.test(p)) formas.add(`${p}es`);
  if (/[rz]es$/.test(p)) formas.add(p.slice(0, -2));
  if (/m$/.test(p)) formas.add(p.replace(/m$/, 'ns'));
  if (/ns$/.test(p)) formas.add(p.replace(/ns$/, 'm'));
  // -al → -ais; -el/-ol oxítonas ganham acento (papel → papéis, anzol → anzóis); com acento antes, não (nível → níveis).
  const tonica = /[áéíóúâêô]/.test(p.slice(0, -2));
  if (/al$/.test(p) || (tonica && /[eo]l$/.test(p))) formas.add(p.replace(/l$/, 'is'));
  else if (/el$/.test(p)) formas.add(p.replace(/el$/, 'éis'));
  else if (/ol$/.test(p)) formas.add(p.replace(/ol$/, 'óis'));
  if (/[aeo]is$/.test(p)) formas.add(p.replace(/is$/, 'l'));
  if (/éis$/.test(p)) formas.add(p.replace(/éis$/, 'el'));
  if (/óis$/.test(p)) formas.add(p.replace(/óis$/, 'ol'));
  return [...formas];
}

// Variante aceita no banco de termos: só flexão da mesma palavra (singular/plural, masculino/feminino),
// palavra por palavra nas expressões. Derivada ("familiares" de "família") pode ter outro sentido e fica de fora.
export function formasPermitidas(termo, variante) {
  const genero = (p) => {
    const formas = new Set(flexoes(p));
    if (/o$/.test(p)) ['a', 'os', 'as'].forEach((f) => formas.add(p.slice(0, -1) + f));
    if (/or$/.test(p)) ['ora', 'oras', 'ores'].forEach((f) => formas.add(p.slice(0, -2) + f));
    return formas;
  };
  const a = minusculo(termo).split(' ');
  const b = minusculo(variante).split(' ');
  return a.length === b.length && a.every((p, i) => genero(p).has(b[i]));
}

// Todas as grafias que um termo do banco conta: o termo, as variantes e as siglas.
export const formasDoTermo = (t) => [t.termo, ...t.variantes, ...(t.siglas ?? [])];

// O que vai ser contado para uma busca. Termos do banco usam as variantes declaradas;
// qualquer outra palavra conta singular e plural; expressões contam só a sequência exata.
export function familia(consulta, termos = []) {
  const alvo = semAcento(consulta.trim().replace(/\s+/g, ' '));
  if (!alvo) return null;
  const curado = termos.find((t) => formasDoTermo(t).some((v) => semAcento(v) === alvo));
  if (curado) return { rotulo: curado.termo, termo: curado, formas: formasDoTermo(curado), exato: true, excluir: curado.excluir ?? [] };
  const partes = [...consulta.matchAll(LETRA)].map((m) => m[0]);
  if (!partes.length) return null;
  const formas = partes.length === 1 ? flexoes(partes[0]) : [partes.join(' ')];
  // Quem digita com acento quer aquela grafia ("país" não é "pais"); sem acento, vale qualquer uma.
  return { rotulo: partes.join(' '), termo: null, formas, exato: temAcento(consulta), excluir: [] };
}

// Formas já quebradas em palavras e agrupadas pela 1ª palavra (as mais longas primeiro), preparadas
// uma vez por lista de formas: cada palavra do texto custa só uma consulta ao mapa.
const preparadas = new WeakMap();
function indice(formas, exato) {
  const chave = exato ? 'forma' : 'dobrada';
  let porLista = preparadas.get(formas);
  if (!porLista) preparadas.set(formas, (porLista = {}));
  if (!porLista[chave]) {
    const mapa = new Map();
    for (const f of formas) {
      const alvo = palavras(f).map((p) => p[chave]);
      if (alvo.length) mapa.set(alvo[0], [...(mapa.get(alvo[0]) ?? []), alvo]);
    }
    for (const alvos of mapa.values()) alvos.sort((a, b) => b.length - a.length);
    porLista[chave] = mapa;
  }
  return { mapa: porLista[chave], chave };
}

// Posições onde alguma das sequências aparece. Devolve o índice da 1ª palavra e o tamanho.
// A expressão mais longa vence e nada conta duas vezes: "Minha Casa Minha Vida" é uma ocorrência, não três.
function sequencias(lista, formas, exato) {
  const { mapa, chave } = indice(formas, exato);
  const achados = [];
  for (let i = 0; i < lista.length; i += 1) {
    const alvo = mapa.get(lista[i][chave])?.find((x) => x.every((a, k) => lista[i + k]?.[chave] === a));
    if (alvo) {
      achados.push({ i, n: alvo.length });
      i += alvo.length - 1;
    }
  }
  return achados;
}

// Família do assunto inteiro: todas as palavras do grupo somadas, para comparar quem fala do tema
// com vocabulário diferente ("casa própria" de um, "moradia" e "MCMV" do outro).
export function familiaDoGrupo(grupo, termos) {
  const doGrupo = termos.filter((t) => t.grupo === grupo.id);
  return {
    rotulo: grupo.nome,
    formas: doGrupo.flatMap(formasDoTermo),
    exato: true,
    excluir: doGrupo.flatMap((t) => t.excluir ?? []),
  };
}

// Encontra as ocorrências de uma família numa lista de palavras. Ocorrência que cai dentro de uma
// expressão excluída do termo ("em casa", "santas casas") não conta: ali a palavra não fala do assunto.
export function ocorrencias(lista, fam) {
  const achados = sequencias(lista, fam.formas, fam.exato);
  if (!fam.excluir?.length || !achados.length) return achados;
  const fora = new Set();
  for (const { i, n } of sequencias(lista, fam.excluir, false)) for (let k = i; k < i + n; k += 1) fora.add(k);
  return achados.filter(({ i, n }) => ![...Array(n).keys()].some((k) => fora.has(i + k)));
}

// Taxa justa para comparar textos de tamanhos diferentes.
export const porDezMil = (vezes, total) => (total ? (vezes / total) * 10000 : 0);

// Trecho em volta da ocorrência: algumas palavras antes e depois, com a parte achada marcada.
export function trecho(texto, lista, { i, n }, folga = 14) {
  const ini = lista[Math.max(0, i - folga)].inicio;
  const fim = lista[Math.min(lista.length - 1, i + n - 1 + folga)].fim;
  const a = lista[i].inicio;
  const b = lista[i + n - 1].fim;
  const limpo = (s) => s.replace(/\s+/g, ' ');
  return {
    antes: (ini > 0 ? '…' : '') + limpo(texto.slice(ini, a)),
    achado: limpo(texto.slice(a, b)),
    depois: limpo(texto.slice(b, fim)) + (fim < texto.length ? '…' : ''),
  };
}

// Prepara os acervos uma vez só: cada pedaço de texto já quebrado em palavras, com o total por candidato.
export function preparar(textos) {
  const acervos = {};
  for (const [id, acervo] of Object.entries(textos.acervos)) {
    const pedacos = acervo.pedacos.map((p) => ({ ...p, lista: palavras(p.texto) }));
    const total = {};
    for (const p of pedacos) total[p.candidato] = (total[p.candidato] ?? 0) + p.lista.length;
    acervos[id] = { ...acervo, pedacos, total };
  }
  return acervos;
}

// Resultado de uma busca: por acervo e por candidato, quantas vezes, a taxa e onde.
export function contar(acervos, fam, candidatos) {
  const resultado = {};
  for (const [id, acervo] of Object.entries(acervos)) {
    resultado[id] = {};
    for (const c of candidatos) {
      const achados = [];
      for (const p of acervo.pedacos) {
        if (p.candidato !== c) continue;
        for (const o of ocorrencias(p.lista, fam)) achados.push({ pedaco: p, ...o });
      }
      resultado[id][c] = { vezes: achados.length, taxa: porDezMil(achados.length, acervo.total[c]), total: acervo.total[c] ?? 0, achados };
    }
  }
  return resultado;
}
