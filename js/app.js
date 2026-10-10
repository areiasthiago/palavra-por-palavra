import { preparar, familia, contar, trecho } from './busca.js?v=0.9';
import * as medir from './contagem.js?v=0.9';
import { compartilhar } from './compartilhar.js?v=0.9';

const ORDEM = 'palavra:ordem';
const POR_VEZ = 5; // trechos mostrados de cada vez
const app = document.getElementById('app');

let dados; // { textos, termos, grupos, acervos }
let ordem; // os dois candidatos na ordem sorteada para este aparelho

const el = (tag, attrs = {}, ...filhos) => {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') no.className = v;
    else if (k.startsWith('on')) no.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) no.setAttribute(k, v === true ? '' : v);
  }
  no.append(...filhos.flat().filter((f) => f != null && f !== false));
  return no;
};

const numero = (n, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const mil = (n) => `${numero(n / 1000, 1)} mil`;
const vezes = (n) => (n === 1 ? '1 vez' : `${numero(n)} vezes`);
const nome = (c) => dados.textos.candidatos[c].nome;
const dataCurta = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

// Ordem sorteada uma vez por aparelho, para nenhum dos dois aparecer sempre primeiro.
function sortearOrdem() {
  try {
    const salva = JSON.parse(localStorage.getItem(ORDEM));
    if (Array.isArray(salva) && salva.length === 2) return salva;
  } catch { /* segue para o sorteio */ }
  const nova = Math.random() < 0.5 ? ['lula', 'flavio'] : ['flavio', 'lula'];
  try { localStorage.setItem(ORDEM, JSON.stringify(nova)); } catch { /* vale só nesta visita */ }
  return nova;
}

function grupoDe(termo) {
  return termo ? dados.grupos.find((g) => g.id === termo.grupo) : null;
}

// Termo curado clicável (lista de mais buscados ou de assuntos).
const chip = (termo, origem) => el('button', { class: 'chip', type: 'button', onclick: () => buscar(termo.termo, origem) }, termo.termo);

// ---------- Topo fixo da página: chamada e campo de busca ----------

function campoDeBusca(valor = '') {
  const entrada = el('input', {
    type: 'search', name: 'p', value: valor, placeholder: 'Ex.: saúde, emprego, família', autocomplete: 'off',
    enterkeyhint: 'search', 'aria-label': 'Palavra para contar', maxlength: '40',
  });
  return el('form', {
    class: 'busca', role: 'search',
    onsubmit: (e) => { e.preventDefault(); if (entrada.value.trim()) buscar(entrada.value, 'digitou'); },
  }, entrada, el('button', { class: 'botao principal', type: 'submit' }, 'Contar'));
}

function inicio() {
  const destaques = dados.termos.filter((t) => t.destaque)
    .sort((a, b) => grupoDe(b).peso - grupoDe(a).peso);
  const nomes = ordem.map(nome);
  app.replaceChildren(el('section', { class: 'tela inicio' },
    el('span', { class: 'selo' }, 'Eleições 2026 · 2º turno'),
    el('h1', {}, 'Quanto cada um ', el('span', { class: 'destaque' }, 'fala do que importa'), ' pra você?'),
    el('p', { class: 'chamada' }, `Escolha uma palavra e veja quantas vezes ${nomes[0]} e ${nomes[1]} usaram essa palavra no plano de governo e em entrevistas.`),
    campoDeBusca(),
    el('div', { class: 'bloco' },
      el('h2', { class: 'subtitulo' }, 'Mais buscados aqui'),
      el('div', { class: 'chips' }, destaques.map((t) => chip(t, 'quentes')))),
    el('div', { class: 'bloco' },
      el('h2', { class: 'subtitulo' }, 'Ou escolha por assunto'),
      el('div', { class: 'assuntos' }, dados.grupos.map((g) => el('details', { class: 'assunto' },
        el('summary', {}, g.nome),
        el('div', { class: 'chips' }, dados.termos.filter((t) => t.grupo === g.id).map((t) => chip(t, 'assunto'))))))),
    aviso(),
  ));
}

const aviso = () => el('p', { class: 'aviso-fixo' }, el('strong', {}, 'Lembre: '), 'falar mais de um assunto não quer dizer ter proposta melhor.');

// ---------- Resultado ----------

function buscar(consulta, origem, { historico = true } = {}) {
  const fam = familia(consulta, dados.termos);
  if (!fam) return;
  const res = contar(dados.acervos, fam, ordem);
  const total = Object.values(res).reduce((s, porCandidato) => s + ordem.reduce((t, c) => t + porCandidato[c].vezes, 0), 0);
  const grupo = grupoDe(fam.termo);
  medir.buscou({ termo: fam.rotulo.toLowerCase(), publico: Boolean(fam.termo) || total > 0, origem, grupo: grupo?.id });

  if (historico) {
    const url = new URL(location.href);
    url.searchParams.set('p', fam.rotulo);
    url.searchParams.delete('o');
    history.pushState({ p: fam.rotulo }, '', url);
  }
  document.title = `“${fam.rotulo}” · Palavra por Palavra`;

  const vizinhos = fam.termo ? dados.termos.filter((t) => t.grupo === fam.termo.grupo && t !== fam.termo) : [];
  const tela = el('section', { class: 'tela resultado' },
    el('button', { class: 'botao voltar', type: 'button', onclick: () => voltarAoInicio() }, '← Todas as palavras'),
    campoDeBusca(fam.rotulo),
    el('h1', { tabindex: '-1' }, `“${fam.rotulo}”`),
    el('p', { class: 'contamos' }, fam.formas.length > 1 ? `Contamos: ${fam.formas.join(', ')}.` : 'Contamos só a palavra inteira.',
      fam.excluir.length ? ` Não contamos expressões em que a palavra não fala do assunto: ${fam.excluir.join(', ')}.` : '',
      grupo ? ` Assunto: ${grupo.nome}.` : ''),
    quadro(fam, res, grupo, total),
    total > 0 && ondeUsou(fam, res),
    total > 0 && el('div', { class: 'par' },
      el('button', { class: 'botao principal', type: 'button', onclick: (e) => enviarImagem(e.currentTarget, fam, res) }, 'Compartilhar'),
      el('button', { class: 'botao discreto', type: 'button', onclick: () => { const i = app.querySelector('.busca input'); i.value = ''; i.focus(); } }, 'Buscar outra palavra')),
    vizinhos.length > 0 && el('div', { class: 'bloco' },
      el('h2', { class: 'subtitulo' }, `Mais palavras sobre ${grupo.nome.toLowerCase()}`),
      el('div', { class: 'chips' }, vizinhos.map((t) => chip(t, 'assunto')))),
  );
  app.replaceChildren(tela);
  window.scrollTo(0, 0);
  tela.querySelector('h1').focus({ preventScroll: true });
}

// Caixa única da contagem: uma coluna por candidato, com plano e entrevistas em linhas próprias.
// Os dois na mesma cor (quem é quem está escrito, não pintado); plano e entrevistas se distinguem
// pelo desenho da barra, com rótulo em cada linha. O retrato abre o resumo da IA na mesma caixa.
function quadro(fam, res, grupo, total) {
  const temResumo = grupo && ordem.every((c) => dados.resumos.grupos[grupo.id]?.[c]);
  const painel = el('div', { class: 'painel', id: 'resumo-ia', hidden: true });
  const maior = Object.fromEntries(Object.keys(dados.acervos).map((id) => [id, Math.max(...ordem.map((c) => res[id][c].taxa)) || 1]));
  let aberto = null;
  const colunas = ordem.map((c) => {
    const foto = el('img', { src: `img/${c}-serio.webp?v=0.9`, alt: '', width: '96', height: '96' });
    const rotulo = el('span', { class: 'ver-resumo' }, el('span', {}, 'Ver resumo'));
    // Retrato embaixo das contagens; com resumo, retrato e botão formam um único botão.
    const cabeca = temResumo
      ? el('button', { class: 'rosto', type: 'button', 'aria-pressed': 'false', 'aria-controls': painel.id, 'aria-label': `Ver resumo do plano de ${nome(c)}` }, foto, rotulo)
      : el('div', { class: 'rosto estatico' }, foto);
    if (temResumo) new Image().src = `img/${c}-alegre.webp?v=0.9`; // sem piscar na troca
    const contas = Object.keys(dados.acervos).map((id) => {
      const r = res[id][c];
      return el('div', { class: `conta ${id}` },
        el('span', { class: 'rotulo' }, id === 'plano' ? 'No plano' : 'Nas entrevistas'),
        el('strong', {}, vezes(r.vezes)),
        el('span', { class: 'trilha', 'aria-hidden': 'true' }, el('span', { class: `preenche ${id}`, style: `width:${(r.taxa / maior[id]) * 100}%` })),
        el('small', {}, `${numero(r.taxa, 1)} a cada 10 mil palavras`));
    });
    return { c, cabeca, foto, rotulo, coluna: el('div', { class: 'coluna' }, el('h3', { class: 'nome' }, nome(c)), contas) };
  });
  if (temResumo) {
    for (const { c, cabeca } of colunas) {
      cabeca.addEventListener('click', () => {
        aberto = aberto === c ? null : c;
        for (const col of colunas) {
          const ativo = col.c === aberto;
          col.cabeca.setAttribute('aria-pressed', String(ativo));
          col.foto.src = `img/${col.c}-${ativo ? 'alegre' : 'serio'}.webp?v=0.9`;
          col.rotulo.lastChild.textContent = ativo ? 'Fechar' : 'Ver resumo';
        }
        painel.hidden = !aberto;
        if (aberto) { painel.replaceChildren(...resumo(grupo, aberto)); medir.viuResumo(`${grupo.id}:${aberto}`); }
      });
    }
  }
  return el('section', { class: 'comparativo' },
    el('h2', {}, 'Quantas vezes cada um usou'),
    el('p', { class: 'legenda-barras' },
      el('span', {}, el('i', { class: 'amostra plano', 'aria-hidden': 'true' }), 'Plano de governo'),
      el('span', {}, el('i', { class: 'amostra falas', 'aria-hidden': 'true' }), 'Entrevistas')),
    total === 0 && el('p', { class: 'vazio' }, `Nenhum dos dois usou “${fam.rotulo}” no plano de governo nem nas entrevistas.`),
    el('div', { class: 'colunas' }, colunas.map((col) => col.coluna)),
    // Retratos numa linha própria, logo abaixo da chamada para o resumo.
    temResumo && el('p', { class: 'dica' }, iconeIA(), el('span', {}, 'Veja também um resumo, feito por IA, do que cada plano propõe sobre ', el('strong', {}, grupo.nome.toLowerCase()), '.')),
    el('div', { class: 'colunas rostos' }, colunas.map((col) => col.cabeca)),
    temResumo && painel,
    el('p', { class: 'legenda' }, 'A barra compara a frequência (a cada 10 mil palavras), porque os textos têm tamanhos diferentes. ', tamanhos()),
    aviso(),
  );
}

function tamanhos() {
  const { plano, falas } = dados.acervos;
  const lista = (a) => ordem.map((c) => `${nome(c)} ${mil(a.total[c])}`).join(', ');
  return `Tamanho dos textos, em palavras: no plano, ${lista(plano)}; nas entrevistas (${eventosDoAcervo(falas)}), ${lista(falas)}.`;
}

// Brilho de quatro pontas, o símbolo mais comum de conteúdo feito por IA.
function iconeIA() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path fill="currentColor" d="M10 2.5c.5 4.300 2.200 6 6.500 6.500-4.300.5-6 2.200-6.500 6.500-.5-4.300-2.200-6-6.500-6.500 4.300-.5 6-2.200 6.500-6.500z"/><path fill="currentColor" d="M18 13c.3 2.300 1.200 3.200 3.500 3.500-2.300.3-3.200 1.200-3.500 3.500-.3-2.300-1.200-3.200-3.500-3.500 2.300-.3 3.200-1.200 3.500-3.500z"/>';
  return svg;
}

function resumo(grupo, c) {
  const r = dados.resumos.grupos[grupo.id][c];
  const plano = dados.textos.candidatos[c].plano;
  const pagina = (n) => el('a', { href: `${plano}#page=${n}`, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, `pág. ${n}`);
  return [
    el('span', { class: 'selo-ia' }, iconeIA(), 'Resumo feito por IA'),
    el('h3', {}, nome(c)),
    el('p', { class: 'visao' }, r.visao.texto, ' ', pagina(r.visao.pagina)),
    el('ul', { class: 'propostas' }, r.propostas.map((p) => el('li', {}, p.texto, ' ', pagina(p.pagina)))),
    el('p', { class: 'nota-ia' }, dados.resumos.aviso, ' ',
      el('a', { href: plano, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, `Ler o plano completo de ${nome(c)}`), '.'),
  ];
}

function eventosDoAcervo(acervo) {
  const pares = [...new Set(acervo.eventos.map((e) => e.evento))];
  return `${pares.join('; ')}, de ${dataCurta(acervo.eventos[0].data)} a ${dataCurta(acervo.eventos.at(-1).data)}`;
}

// Abaixo da caixa: onde cada um usou a palavra, plano e entrevistas juntos, cada trecho com a fonte.
function ondeUsou(fam, res) {
  return el('section', { class: 'onde-usou' },
    el('h2', { class: 'subtitulo' }, 'Onde cada um usou a palavra'),
    ordem.map((c) => trechos(c, Object.keys(dados.acervos).flatMap((id) => res[id][c].achados.map((a) => ({ id, ...a }))), fam)));
}

// Lista de trechos, aberta sob demanda e mostrada aos poucos.
function trechos(c, achados, fam) {
  if (!achados.length) return el('p', { class: 'onde-nada' }, `${nome(c)} não usou essa palavra.`);
  const lista = el('ol', { class: 'trechos' });
  const mais = el('button', { class: 'botao discreto mais', type: 'button' }, 'Mostrar mais');
  let mostrados = 0;
  const mostrarMais = () => {
    for (const achado of achados.slice(mostrados, mostrados + POR_VEZ)) lista.append(itemDeTrecho(c, achado));
    mostrados = Math.min(achados.length, mostrados + POR_VEZ);
    mais.hidden = mostrados >= achados.length;
  };
  mais.addEventListener('click', mostrarMais);
  const caixa = el('details', { class: 'onde' },
    el('summary', {}, `Ver onde ${nome(c)} usou (${vezes(achados.length)})`), lista, mais);
  caixa.addEventListener('toggle', () => {
    if (caixa.open && !mostrados) { mostrarMais(); medir.viuTrechos(fam.rotulo.toLowerCase()); }
  });
  return caixa;
}

function itemDeTrecho(c, { id, pedaco, i, n }) {
  const t = trecho(pedaco.texto, pedaco.lista, { i, n });
  const fonte = id === 'plano'
    ? el('a', { href: `${dados.textos.candidatos[c].plano}#page=${pedaco.pagina}`, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, `Plano, pág. ${pedaco.pagina}`)
    : el('a', { href: pedaco.url, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, `Entrevista: ${pedaco.evento}, ${dataCurta(pedaco.data)}`);
  return el('li', {}, el('p', {}, t.antes, el('mark', {}, t.achado), t.depois), fonte);
}

async function enviarImagem(botao, fam, res) {
  botao.disabled = true;
  try {
    const tipo = await compartilhar({
      palavra: fam.rotulo,
      lados: ordem.map((c) => ({
        nome: nome(c),
        plano: res.plano[c],
        falas: res.falas[c],
      })),
    });
    if (tipo) medir.compartilhou(tipo);
  } finally {
    botao.disabled = false;
  }
}

function voltarAoInicio({ historico = true } = {}) {
  if (historico) history.pushState({}, '', location.pathname);
  document.title = 'Palavra por Palavra · Eleições 2026';
  inicio();
  window.scrollTo(0, 0);
}

function rota({ historico = false } = {}) {
  const p = new URLSearchParams(location.search).get('p');
  if (p) buscar(p, 'link', { historico });
  else voltarAoInicio({ historico });
}

async function iniciar() {
  try {
    const [textos, termos, resumos] = await Promise.all(
      ['data/textos.json?v=0.9', 'data/termos.json?v=0.9', 'data/resumos.json?v=0.9'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })),
    );
    dados = { textos, termos: termos.termos, grupos: termos.grupos, resumos, acervos: preparar(textos) };
  } catch {
    medir.erroCarga();
    app.replaceChildren(el('section', { class: 'tela' }, el('h1', {}, 'Não deu para carregar'), el('p', {}, 'Confira sua conexão e recarregue a página.')));
    return;
  }
  ordem = sortearOrdem();
  medir.abriu();
  rota();
  addEventListener('popstate', () => rota());
  document.querySelector('.rodape a[data-teste-cego]')?.addEventListener('click', medir.foiTesteCego);
}

iniciar();
