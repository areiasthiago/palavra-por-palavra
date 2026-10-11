// Gera data/textos.json a partir dos planos (data/fontes/*.txt) e das falas (data/falas/).
// Uso: node scripts/montar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { palavras } from '../js/busca.js';

const raiz = new URL('..', import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, raiz), 'utf8');

const candidatos = {
  lula: { nome: 'Lula', plano: 'refs/32ce89_programa_governo_lula_2026.pdf' },
  flavio: { nome: 'Flávio Bolsonaro', plano: 'refs/FLAVIO-BOLSONARO-PARA-O-BRASIL-VENCER-O-ATRASO-1-1.pdf' },
};

// Cabeçalho, rodapé e número de página se repetem em toda página e inflariam palavras
// como "governo". Sai toda linha curta que aparece em pelo menos 1/4 das páginas.
function limparPaginas(paginas) {
  const vezes = new Map();
  for (const pagina of paginas) {
    for (const linha of new Set(pagina.split('\n').map((l) => l.trim()).filter(Boolean))) {
      vezes.set(linha, (vezes.get(linha) ?? 0) + 1);
    }
  }
  const repetida = (l) => l.length < 80 && vezes.get(l) >= paginas.length / 4;
  const removidas = new Set();
  const limpas = paginas.map((pagina) => pagina
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      if (/^\d{1,3}$/.test(t) || repetida(t)) { if (t) removidas.add(t); return false; }
      return true;
    })
    .join('\n'));
  return { limpas, removidas };
}

const plano = [];
for (const [c, info] of Object.entries(candidatos)) {
  const paginas = ler(`data/fontes/${c}.txt`).split('\f');
  const { limpas, removidas } = limparPaginas(paginas);
  // Sumário repete os títulos do plano e contaria tudo duas vezes. Página com muito pontilhado é sumário.
  const sumario = limpas.map((t, i) => ((t.match(/\.{5}|…{2}/g) ?? []).length >= 50 ? i + 1 : 0)).filter(Boolean);
  console.log(`${c}: ${paginas.length} páginas; sumário fora: pág. ${sumario.join(', ') || 'nenhuma'}; linhas repetidas removidas: ${[...removidas].filter((l) => !/^\d+$/.test(l)).join(' | ') || 'nenhuma'}`);
  limpas.forEach((texto, i) => {
    if (texto.trim() && !sumario.includes(i + 1)) plano.push({ candidato: c, pagina: i + 1, texto: texto.trim() });
  });
  info.paginas = paginas.length;
}

const { eventos, inicio, protocolo } = JSON.parse(ler('data/falas/eventos.json'));
const falas = [];
// Na íntegra, cada fala começa com "Nome:". Parágrafo que abre só com aspas continua a fala anterior.
const FALANTE = /^([\p{Lu}][\p{L} ]{1,40}):\s/u;
for (const e of eventos) {
  const respostas = [];
  let falando = null;
  for (const linha of ler(`data/falas/${e.arquivo}`).split('\n').map((l) => l.trim())) {
    const quem = linha.match(FALANTE);
    if (quem) falando = `${quem[1]}:`;
    else if (!/^[“"]/.test(linha)) { falando = null; continue; }
    if (falando !== e.rotulo) continue;
    // Tira o nome de quem fala e as aspas de abertura e fechamento.
    respostas.push((quem ? linha.slice(quem[0].length) : linha).trim().replace(/^[“"]/, '').replace(/[”"]\.?$/, ''));
  }
  if (!respostas.length) throw new Error(`${e.arquivo}: nenhuma resposta com "${e.rotulo}"`);
  respostas.forEach((texto) => falas.push({ candidato: e.candidato, evento: e.evento, data: e.data, veiculo: e.veiculo, url: e.url, texto }));
}

const textos = {
  gerado: new Date().toISOString().slice(0, 10),
  candidatos,
  acervos: {
    plano: { nome: 'Plano de governo', pedacos: plano },
    falas: { nome: 'Entrevistas', inicio, protocolo, eventos: eventos.map(({ par, candidato, evento, data, veiculo, url }) => ({ par, candidato, evento, data, veiculo, url })), pedacos: falas },
  },
};
writeFileSync(new URL('data/textos.json', raiz), JSON.stringify(textos));
for (const [id, a] of Object.entries(textos.acervos)) {
  const total = {};
  for (const p of a.pedacos) total[p.candidato] = (total[p.candidato] ?? 0) + palavras(p.texto).length;
  console.log(`${id}: ${a.pedacos.length} pedaços, palavras: ${JSON.stringify(total)}`);
}
