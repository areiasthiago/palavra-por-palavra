// Confere as regras de isenção: banco de termos, equilíbrio da lista inicial, resumos, palavras de
// disputa no texto do site e cores sem associação com os candidatos.
// Uso: node scripts/validar.mjs
import { readFileSync } from 'node:fs';
import { preparar, familia, contar, semAcento, formasPermitidas, formasDoTermo } from '../js/busca.js';

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

// ---------- Banco de termos ----------
const { grupos, termos } = JSON.parse(ler('data/termos.json'));
const idsGrupo = new Set(grupos.map((g) => g.id));
if (idsGrupo.size !== grupos.length) erros.push('grupo com id repetido');
for (const g of grupos) if (typeof g.peso !== 'number' || g.peso <= 0) erros.push(`[${g.id}] peso inválido`);

const formaDe = new Map();
for (const t of termos) {
  const onde = `[${t.termo}]`;
  if (!idsGrupo.has(t.grupo)) erros.push(`${onde} grupo inexistente (${t.grupo})`);
  // Só flexões da própria palavra (singular/plural, masculino/feminino). Derivada vira termo próprio.
  for (const v of t.variantes) {
    if (!formasPermitidas(t.termo, v)) erros.push(`${onde} "${v}" não é flexão de "${t.termo}" (se importa, vire termo próprio)`);
  }
  for (const f of formasDoTermo(t)) {
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

// ---------- Textos ----------
const textos = JSON.parse(ler('data/textos.json'));
const candidatos = Object.keys(textos.candidatos);
for (const c of candidatos) {
  if (!textos.acervos.plano.pedacos.some((p) => p.candidato === c)) erros.push(`[plano] sem texto de ${c}`);
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

// ---------- Resumos feitos por IA ----------
// Mesma estrutura para os dois, tamanhos parecidos, cada frase ancorada numa página do plano
// (a citação não aparece na tela; só prova que a página trata daquilo), sem citar o adversário.
const normalizar = (s) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// Páginas já limpas (sem número de página nem cabeçalho repetido): o mesmo texto que o site mostra.
const paginasPlano = Object.fromEntries(candidatos.map((c) => {
  const paginas = [];
  for (const p of textos.acervos.plano.pedacos) if (p.candidato === c) paginas[p.pagina - 1] = (paginas[p.pagina - 1] ?? '') + normalizar(p.texto);
  return [c, paginas];
}));
// O trecho começa na página indicada (pode terminar na seguinte).
function ancorado(c, numero, trecho) {
  const alvo = normalizar(trecho ?? '');
  const pagina = paginasPlano[c][numero - 1] ?? '';
  return alvo.length >= 10 && pagina.includes(alvo.slice(0, 10)) && (pagina + (paginasPlano[c][numero] ?? '')).includes(alvo);
}
const { grupos: resumos } = JSON.parse(ler('data/resumos.json'));
const NOMES = /(?<!\p{L})(Lula|Bolsonaro|Flávio|PT|PL|PSB|governo anterior|atual governo|atual gestão|esquerda|direita)(?!\p{L})/u;
const tamanho = (r) => [r.visao, ...r.propostas].reduce((s, x) => s + x.texto.length, 0);
for (const g of grupos) {
  const porCandidato = resumos[g.id];
  if (!porCandidato) { erros.push(`[resumo ${g.id}] falta o resumo do grupo`); continue; }
  for (const c of candidatos) {
    const r = porCandidato[c];
    const onde = `[resumo ${g.id} ${c}]`;
    if (!r?.visao || r.propostas?.length !== 3) { erros.push(`${onde} precisa de visão e exatamente 3 propostas`); continue; }
    for (const [i, item] of [r.visao, ...r.propostas].entries()) {
      const qual = i ? `proposta ${i}` : 'visão';
      if (item.texto.length > 130) erros.push(`${onde} ${qual} longa demais (${item.texto.length} caracteres; máx. 130)`);
      const nome = item.texto.match(NOMES) ?? item.texto.match(DISPUTA);
      if (nome) erros.push(`${onde} ${qual} cita "${nome[0]}"`);
      if (!ancorado(c, item.pagina, item.citacao)) erros.push(`${onde} ${qual}: trecho não encontrado na pág. ${item.pagina}`);
    }
  }
  const [a, b] = candidatos.map((c) => (porCandidato[c] ? tamanho(porCandidato[c]) : 0));
  if (a && b && Math.max(a, b) / Math.min(a, b) > 1.35) erros.push(`[resumo ${g.id}] tamanhos desiguais (${candidatos[0]} ${a} x ${candidatos[1]} ${b})`);
}

// ---------- Propostas (classificadas por IA) ----------
// Cada proposta é um compromisso do plano com o trecho literal e a página, num dos assuntos da lista.
// Meta, prazo, valor e "diz como" são marcas da IA; o validador só confere o que dá para conferir.
const { propostas } = JSON.parse(ler('data/propostas.json'));
const assuntos = new Set(grupos.map((g) => g.id));
const vistas = new Set();
for (const [i, p] of propostas.entries()) {
  const onde = `[proposta ${i + 1} ${p.candidato}]`;
  if (!candidatos.includes(p.candidato)) erros.push(`${onde} candidato desconhecido`);
  if (!assuntos.has(p.assunto)) erros.push(`${onde} assunto desconhecido: ${p.assunto}`);
  if (!p.texto || p.texto.length > 130) erros.push(`${onde} resumo vazio ou longo demais`);
  const nome = p.texto?.match(NOMES) ?? p.texto?.match(DISPUTA);
  if (nome) erros.push(`${onde} cita "${nome[0]}"`);
  if (!ancorado(p.candidato, p.pagina, p.trecho)) erros.push(`${onde} trecho não encontrado na pág. ${p.pagina}: ${p.trecho.slice(0, 60)}`);
  const chave = `${p.candidato}|${normalizar(p.trecho)}`;
  if (vistas.has(chave)) erros.push(`${onde} trecho repetido`);
  vistas.add(chave);
  if (p.valor && !/R\$|reais/.test(p.trecho)) erros.push(`${onde} marcada com valor, mas o trecho não tem valor em dinheiro`);
  if (p.meta && !/\d|milhão|milhões|dobrar|zerar|zero|univers|todas|todo o/i.test(p.trecho)) erros.push(`${onde} marcada com meta, mas o trecho não tem número`);
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

for (const e of erros) console.error(`ERRO: ${e}`);
console.log(`${termos.length} termos em ${grupos.length} grupos, ${propostas.length} propostas, ${erros.length} erro(s).`);
process.exit(erros.length ? 1 : 0);
