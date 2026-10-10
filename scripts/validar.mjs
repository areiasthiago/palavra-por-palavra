// Confere as regras de isenção: banco de termos, equilíbrio da lista inicial, protocolo das
// entrevistas, palavras de disputa no texto do site e cores sem associação com os candidatos.
// Uso: node scripts/validar.mjs
import { readFileSync, existsSync } from 'node:fs';
import { preparar, familia, contar, semAcento } from '../js/busca.js';

const raiz = new URL('..', import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, raiz), 'utf8');

// Mesma lista de veículos aceitos do Teste Cego.
const VEICULOS = [
  'folha.uol.com.br', 'estadao.com.br', 'oglobo.globo.com', 'g1.globo.com', 'uol.com.br',
  'valor.globo.com', 'cnnbrasil.com.br', 'bbc.com', 'poder360.com.br', 'agenciabrasil.ebc.com.br',
  'reuters.com', 'jota.info', 'nexojornal.com.br', 'piaui.folha.uol.com.br', 'sbtnews.sbt.com.br',
  'congressoemfoco.com.br', 'terra.com.br', 'correiobraziliense.com.br', 'metropoles.com',
  'diariodonordeste.verdesmares.com.br', 'em.com.br', 'jornaldebrasilia.com.br',
];
const aceito = (url) => {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return VEICULOS.some((v) => host === v || host.endsWith(`.${v}`));
};

const erros = [];
const avisos = [];

// ---------- Banco de termos ----------
const { grupos, termos } = JSON.parse(ler('data/termos.json'));
const idsGrupo = new Set(grupos.map((g) => g.id));
if (idsGrupo.size !== grupos.length) erros.push('grupo com id repetido');
for (const g of grupos) if (typeof g.peso !== 'number' || g.peso <= 0) erros.push(`[${g.id}] peso inválido`);

const formaDe = new Map();
for (const t of termos) {
  const onde = `[${t.termo}]`;
  if (!idsGrupo.has(t.grupo)) erros.push(`${onde} grupo inexistente (${t.grupo})`);
  // Família é morfológica, não semântica: toda variante começa com as 4 primeiras letras do termo.
  const raizTermo = semAcento(t.termo).slice(0, 4);
  for (const v of t.variantes) {
    if (!semAcento(v).startsWith(raizTermo)) erros.push(`${onde} variante "${v}" não é da mesma família (vire termo próprio ou sigla)`);
  }
  for (const f of [t.termo, ...t.variantes, ...(t.siglas ?? [])]) {
    const chave = semAcento(f);
    if (formaDe.has(chave)) erros.push(`${onde} "${f}" já é contado em [${formaDe.get(chave)}]`);
    formaDe.set(chave, t.termo);
  }
}

// Um destaque por grupo, e ele é a palavra que dá nome ao grupo: a lista inicial não é escolhida a dedo.
for (const g of grupos) {
  const destaques = termos.filter((t) => t.grupo === g.id && t.destaque);
  if (destaques.length !== 1) erros.push(`[${g.id}] precisa de exatamente 1 destaque (tem ${destaques.length})`);
  else if (!semAcento(g.nome).includes(semAcento(destaques[0].termo))) erros.push(`[${g.id}] o destaque "${destaques[0].termo}" não está no nome do grupo`);
}

// ---------- Textos e protocolo das entrevistas ----------
const textos = JSON.parse(ler('data/textos.json'));
const { eventos, inicio } = JSON.parse(ler('data/falas/eventos.json'));
const candidatos = Object.keys(textos.candidatos);
const hoje = new Date().toISOString().slice(0, 10);
const pares = new Map();
for (const e of eventos) {
  const onde = `[${e.arquivo}]`;
  if (!candidatos.includes(e.candidato)) erros.push(`${onde} candidato desconhecido`);
  if (!existsSync(new URL(`data/falas/${e.arquivo}`, raiz))) erros.push(`${onde} arquivo não existe`);
  if (!aceito(e.url)) erros.push(`${onde} veículo fora da lista (${e.url})`);
  if (!(e.data >= inicio && e.data <= hoje)) erros.push(`${onde} data fora da campanha (${e.data})`);
  pares.set(e.par, [...(pares.get(e.par) ?? []), e.candidato]);
}
for (const [par, quem] of pares) {
  if (quem.sort().join() !== [...candidatos].sort().join()) erros.push(`[${par}] o par precisa de um evento de cada candidato (tem: ${quem.join(', ')})`);
}
if (JSON.stringify(textos.acervos.falas.eventos.map((e) => e.url)) !== JSON.stringify(eventos.map((e) => e.url))) {
  erros.push('data/textos.json desatualizado: rode node scripts/montar.mjs');
}
for (const c of candidatos) {
  for (const [id, a] of Object.entries(textos.acervos)) {
    if (!a.pedacos.some((p) => p.candidato === c)) erros.push(`[${id}] sem texto de ${c}`);
  }
}

// ---------- Equilíbrio da lista inicial de mais buscados ----------
const acervos = preparar(textos);
const frente = Object.fromEntries(candidatos.map((c) => [c, []]));
for (const t of termos.filter((x) => x.destaque)) {
  const r = contar(acervos, familia(t.termo, termos), candidatos).plano;
  const [a, b] = candidatos;
  if (r[a].taxa > r[b].taxa) frente[a].push(t.termo);
  else if (r[b].taxa > r[a].taxa) frente[b].push(t.termo);
}
const [na, nb] = candidatos.map((c) => frente[c].length);
if (Math.abs(na - nb) > 1) erros.push(`lista inicial desequilibrada: ${candidatos.map((c) => `${c} fala mais em ${frente[c].length} (${frente[c].join(', ')})`).join('; ')}`);
console.log(`lista inicial: ${candidatos.map((c) => `${c} à frente em ${frente[c].length}`).join(', ')}`);

// ---------- Texto do site: nada de linguagem de disputa ----------
// Contar palavras não é jogo: "ganhou", "placar" e afins transformam frequência em vitória.
const DISPUTA = /(?<!\p{L})(ganh\p{L}*|venc\p{L}*|perde\p{L}*|perdeu|vitória\p{L}*|derrota\p{L}*|placar|goleada|lavada|humilh\p{L}*|patriota\p{L}*|campeã\p{L}*|campeão)(?!\p{L})/iu;
const textoVisivel = (arquivo) => {
  const bruto = ler(arquivo);
  if (arquivo.endsWith('.html')) return bruto.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  // Em JS, só os textos entre aspas.
  return (bruto.match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? []).join('\n');
};
for (const arquivo of ['index.html', 'sobre.html', 'js/app.js', 'js/compartilhar.js']) {
  const achado = textoVisivel(arquivo).match(DISPUTA);
  if (achado) erros.push(`${arquivo}: linguagem de disputa ("${achado[0]}")`);
}

// ---------- Cores: só grafite e roxo ----------
// Toda cor com saturação visível precisa estar na faixa do roxo (matiz 245 a 290).
function matiz(hex) {
  const h = hex.length === 4 ? hex.slice(1).split('').map((x) => x + x).join('') : hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d) hue = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { hue: (hue + 360) % 360, s };
}
for (const arquivo of ['css/style.css', 'js/compartilhar.js', 'img/icone.svg']) {
  for (const hex of ler(arquivo).match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []) {
    const { hue, s } = matiz(hex);
    if (s > 0.25 && (hue < 245 || hue > 290)) erros.push(`${arquivo}: cor ${hex} fora da paleta grafite + roxo (matiz ${Math.round(hue)})`);
  }
}

for (const a of avisos) console.warn(`aviso: ${a}`);
for (const e of erros) console.error(`ERRO: ${e}`);
console.log(`${termos.length} termos em ${grupos.length} grupos, ${eventos.length} entrevistas, ${erros.length} erro(s), ${avisos.length} aviso(s).`);
process.exit(erros.length ? 1 : 0);
