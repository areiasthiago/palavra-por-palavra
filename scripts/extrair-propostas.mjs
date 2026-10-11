// Acha nos dois planos as frases de compromisso (verbos no futuro) e marca, por regra, pistas de meta com
// número, prazo e valor. As pistas são só ponto de partida: a classificação (feita por IA) confirma se o
// número é do compromisso ou de um balanço do passado. Saída: data/propostas-brutas.json.
// Uso: node scripts/extrair-propostas.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const textos = JSON.parse(readFileSync(new URL('data/textos.json', raiz), 'utf8'));

// Compromisso: 1ª pessoa do plural no futuro (criaremos, vamos criar), "o (novo) governo vai/irá" ou futuro na voz passiva
// ("o Brasil terá", "os agressores serão monitorados").
const COMPROMISSO = /(?<!\p{L})(vamos|iremos|\p{L}{3,}remos|(?:nosso|novo) governo(?: do brasil)? (?:vai|irá)|terá|terão|será|serão|haverá)(?!\p{L})/giu;
// Palavras que terminam em "-remos" mas não são compromisso de governo.
const FALSOS = new Set(['queremos', 'quisermos', 'tivermos', 'estivermos', 'fizermos', 'pudermos', 'soubermos']);
const compromisso = (f) => [...f.matchAll(COMPROMISSO)].some((m) => !FALSOS.has(m[1].toLowerCase()));

const NUMERO = String.raw`(?:\d[\d.,]*|um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|cem|mil|meio)`;
// Prazo: um ano de 2026 a 2040, "em X anos/meses", "no primeiro dia/ano", "até o fim do mandato".
const PRAZO = new RegExp(String.raw`(?<!\d)20(2[6-9]|3\d|40)(?!\d)|\bem\s+${NUMERO}\s+(anos|meses)\b|\b(no|desde o)\s+primeiro\s+(dia|ano)\b|\baté o (fim|final) do mandato\b|\bao longo do mandato\b`, 'iu');
// Valor: R$ ou "X bilhões de reais".
const VALOR = /R\$\s?\d|\b\d[\d.,]*\s*(bilh(ão|ões)|milh(ão|ões)|trilh(ão|ões))\s+de\s+reais\b/iu;
// Meta: quantidade com número (até 3 palavras antes do que é contado), percentual, ou verbo de meta mensurável.
const META = new RegExp(String.raw`(?<!\p{L})${NUMERO}\s+(mil\s+|milh(ão|ões)\s+(de\s+)?|bilh(ão|ões)\s+(de\s+)?)?(\p{L}+\s+){0,3}?(vagas|moradias|residências|casas|escolas|creches|presídios|unidades|campi|institutos|IFs|leitos|ônibus|pontos|câmeras|km|quilômetros|hectares|centrais|hospitais|policiais|professores|médicos|empregos|famílias|pessoas|cisternas)(?!\p{L})|\d\s?%|\bpor cento\b|(?<!\p{L})(dobrar|triplicar|zerar|universalizar|erradicar)(?!\p{L})`, 'iu');

// Junta as páginas de cada candidato, para a frase que atravessa a quebra de página não ficar cortada.
// Cada frase guarda a página em que começa.
function frasesDoPlano(c) {
  const paginas = textos.acervos.plano.pedacos.filter((p) => p.candidato === c);
  let texto = '';
  const marcos = [];
  for (const p of paginas) {
    marcos.push({ inicio: texto.length, pagina: p.pagina });
    texto += `${p.texto.replace(/\s+/g, ' ')} `;
  }
  const saida = [];
  for (const m of texto.matchAll(/[^.!?;•]+[.!?;]?/g)) {
    const frase = m[0].trim();
    if (frase.length < 30) continue;
    const inicio = m.index + m[0].length - m[0].trimStart().length;
    const { pagina } = [...marcos].reverse().find((k) => k.inicio <= inicio);
    saida.push({ frase, pagina });
  }
  return saida;
}

const saida = [];
for (const c of Object.keys(textos.candidatos)) {
  let n = 0;
  for (const { frase, pagina } of frasesDoPlano(c)) {
    if (!compromisso(frase)) continue;
    n += 1;
    saida.push({ id: `${c}-${String(n).padStart(3, '0')}`, candidato: c, pagina, frase, pistas: { meta: META.test(frase), prazo: PRAZO.test(frase), valor: VALOR.test(frase) } });
  }
}
writeFileSync(new URL('data/propostas-brutas.json', raiz), JSON.stringify(saida, null, 1));
for (const c of Object.keys(textos.candidatos)) {
  const doC = saida.filter((s) => s.candidato === c);
  console.log(`${c}: ${doC.length} frases de compromisso; pistas de meta ${doC.filter((s) => s.pistas.meta).length}, prazo ${doC.filter((s) => s.pistas.prazo).length}, valor ${doC.filter((s) => s.pistas.valor).length}`);
}
