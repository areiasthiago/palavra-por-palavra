import { preparar, familia, contar, trecho } from './busca.js?v=0.2';
import * as medir from './contagem.js?v=0.2';
import { compartilhar } from './compartilhar.js?v=0.2';

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

const aviso = () => el('p', { class: 'aviso-fixo' }, el('strong', {}, 'Lembre: '), 'falar mais de um assunto não quer dizer ter proposta melhor. Veja os trechos para saber como cada um usou a palavra.');

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
      grupo ? ` Assunto: ${grupo.nome}.` : ''),
    total === 0
      ? el('p', { class: 'vazio' }, `Nenhum dos dois usou “${fam.rotulo}” no plano de governo nem nas entrevistas. Tente outra palavra, ou uma parecida.`)
      : Object.entries(dados.acervos).map(([id, acervo]) => comparativo(id, acervo, res[id], fam)),
    aviso(),
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

// Um acervo (plano ou entrevistas): uma linha por candidato, com o número e a frequência.
// Os dois na mesma cor: quem é quem está escrito, não pintado.
function comparativo(id, acervo, porCandidato, fam) {
  const maior = Math.max(...ordem.map((c) => porCandidato[c].taxa)) || 1;
  const titulo = id === 'plano' ? 'No plano de governo' : 'Nas entrevistas';
  const tamanhos = ordem.map((c) => `${nome(c)}: ${mil(acervo.total[c])} palavras`).join(' · ');
  return el('section', { class: 'comparativo' },
    el('h2', {}, titulo),
    el('p', { class: 'tamanho' }, id === 'falas' ? `${eventosDoAcervo(acervo)}. ${tamanhos}.` : `${tamanhos}.`),
    el('ul', { class: 'linhas' }, ordem.map((c) => {
      const r = porCandidato[c];
      return el('li', { class: 'linha' },
        el('span', { class: 'quem' }, nome(c)),
        el('span', { class: 'trilha', 'aria-hidden': 'true' }, el('span', { class: 'preenche', style: `width:${(r.taxa / maior) * 100}%` })),
        el('span', { class: 'valor' }, el('strong', {}, vezes(r.vezes)), el('small', {}, `${numero(r.taxa, 1)} a cada 10 mil palavras`)));
    })),
    el('p', { class: 'legenda' }, 'A barra compara a frequência (a cada 10 mil palavras), porque os textos têm tamanhos diferentes.'),
    ordem.map((c) => trechos(id, c, porCandidato[c], fam)),
  );
}

function eventosDoAcervo(acervo) {
  const pares = [...new Set(acervo.eventos.map((e) => e.evento))];
  return `${pares.join('; ')}, de ${dataCurta(acervo.eventos[0].data)} a ${dataCurta(acervo.eventos.at(-1).data)}`;
}

// Lista de trechos onde a palavra aparece, aberta sob demanda e mostrada aos poucos.
function trechos(id, c, r, fam) {
  if (!r.vezes) return null;
  const lista = el('ol', { class: 'trechos' });
  const mais = el('button', { class: 'botao discreto mais', type: 'button' }, 'Mostrar mais');
  let mostrados = 0;
  const mostrarMais = () => {
    for (const achado of r.achados.slice(mostrados, mostrados + POR_VEZ)) lista.append(itemDeTrecho(id, c, achado));
    mostrados = Math.min(r.achados.length, mostrados + POR_VEZ);
    mais.hidden = mostrados >= r.achados.length;
  };
  mais.addEventListener('click', mostrarMais);
  const caixa = el('details', { class: 'onde' },
    el('summary', {}, `Ver onde ${nome(c)} usou (${vezes(r.vezes)})`), lista, mais);
  caixa.addEventListener('toggle', () => {
    if (caixa.open && !mostrados) { mostrarMais(); medir.viuTrechos(fam.rotulo.toLowerCase()); }
  });
  return caixa;
}

function itemDeTrecho(id, c, { pedaco, i, n }) {
  const t = trecho(pedaco.texto, pedaco.lista, { i, n });
  const fonte = id === 'plano'
    ? el('a', { href: `${dados.textos.candidatos[c].plano}#page=${pedaco.pagina}`, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, `Plano, pág. ${pedaco.pagina}`)
    : el('a', { href: pedaco.url, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, `${pedaco.evento}, ${dataCurta(pedaco.data)}`);
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
    const [textos, termos] = await Promise.all(
      ['data/textos.json?v=0.2', 'data/termos.json?v=0.2'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })),
    );
    dados = { textos, termos: termos.termos, grupos: termos.grupos, acervos: preparar(textos) };
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
