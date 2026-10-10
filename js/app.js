import { preparar, familia, familiaDoGrupo, contar, trecho, semAcento } from './busca.js?v=1.9';
import * as medir from './contagem.js?v=1.9';
import { compartilhar } from './compartilhar.js?v=1.9';

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

// Campo de busca com sugestões da nossa lista de palavras (com o assunto de cada uma). A busca só
// aceita palavras da lista; com 3 letras ou mais sem nada que comece assim, avisa na hora.
function campoDeBusca(valor = '') {
  const lista = el('ul', { class: 'sugestoes', id: 'sugestoes', role: 'listbox', hidden: true });
  const erro = el('p', { class: 'erro-busca', role: 'alert', hidden: true });
  const entrada = el('input', {
    type: 'search', name: 'p', value: valor, placeholder: 'Ex.: saúde, emprego, família', autocomplete: 'off',
    enterkeyhint: 'search', 'aria-label': 'Palavra para contar', maxlength: '40',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': lista.id,
  });
  let opcoes = [];
  let ativa = -1;

  const fechar = () => {
    lista.hidden = true;
    entrada.setAttribute('aria-expanded', 'false');
    entrada.removeAttribute('aria-activedescendant');
    ativa = -1;
  };
  const marcar = (i) => {
    ativa = i;
    [...lista.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) entrada.setAttribute('aria-activedescendant', lista.children[i].id);
    else entrada.removeAttribute('aria-activedescendant');
  };
  const escolher = (opcao) => { fechar(); buscar(opcao.valor, 'sugestao'); };
  const atualizar = () => {
    const { itens, semNada } = sugerir(entrada.value);
    erro.hidden = !semNada;
    erro.textContent = semNada ? `“${entrada.value.trim()}” não está na nossa lista. Tente outra palavra ou escolha um assunto.` : '';
    entrada.setAttribute('aria-invalid', String(semNada));
    opcoes = itens;
    lista.replaceChildren(...itens.map((o, k) => el('li', {
      id: `sugestao-${k}`, role: 'option', 'aria-selected': 'false',
      onmousedown: (e) => e.preventDefault(), // não tira o foco do campo antes do clique
      onclick: () => escolher(o),
    }, el('span', {}, o.valor), el('small', {}, o.detalhe))));
    if (itens.length) { lista.hidden = false; entrada.setAttribute('aria-expanded', 'true'); marcar(-1); } else fechar();
  };

  entrada.addEventListener('input', atualizar);
  entrada.addEventListener('blur', fechar);
  entrada.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar((ativa + 1) % opcoes.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar((ativa - 1 + opcoes.length) % opcoes.length); }
    else if (e.key === 'Escape') fechar();
    else if (e.key === 'Enter' && ativa >= 0) { e.preventDefault(); escolher(opcoes[ativa]); }
  });

  const form = el('form', {
    class: 'busca', role: 'search',
    onsubmit: (e) => {
      e.preventDefault();
      if (!entrada.value.trim()) return;
      const { itens, exata } = sugerir(entrada.value);
      // Só busca palavra da lista: a exata, ou a única sugestão. Senão, pede para escolher.
      const termo = exata?.termo ?? (itens.length === 1 ? itens[0].valor : null);
      if (!termo) {
        atualizar();
        if (itens.length) { erro.hidden = false; erro.textContent = 'Escolha uma das palavras sugeridas.'; }
        entrada.focus();
        return;
      }
      fechar();
      buscar(termo, 'digitou');
    },
  }, el('div', { class: 'campo' }, entrada, lista), el('button', { class: 'botao principal', type: 'submit' }, 'Contar'));
  return el('div', { class: 'busca-caixa' }, form, erro);
}

// Sugestões só da nossa lista de palavras. semNada: 3 letras ou mais e nenhuma palavra da lista
// começa assim. exata: o termo da lista que corresponde ao que foi digitado, se houver.
function sugerir(texto) {
  const q = semAcento(texto.trim().replace(/\s+/g, ' '));
  if (!q) return { itens: [], semNada: false, exata: null };
  const formas = (t) => [t.termo, ...t.variantes, ...(t.siglas ?? [])].map(semAcento);
  const achados = dados.termos
    .filter((t) => formas(t).some((v) => v.startsWith(q)))
    .sort((a, b) => a.termo.length - b.termo.length);
  const exata = dados.termos.find((t) => formas(t).includes(q)) ?? null;
  return {
    itens: achados.slice(0, 8).map((t) => ({ valor: t.termo, detalhe: grupoDe(t).nome })),
    semNada: q.replace(/ /g, '').length >= 3 && !achados.length,
    exata,
  };
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
        el('button', { class: 'botao discreto ir-assunto', type: 'button', onclick: () => buscarAssunto(g.id, 'assunto') }, `Ver ${g.nome.toLowerCase()}: todas as palavras`),
        el('div', { class: 'chips' }, dados.termos.filter((t) => t.grupo === g.id).map((t) => chip(t, 'assunto'))))))),
    aviso(),
  ));
}

const aviso = () => el('p', { class: 'aviso-fixo' }, el('strong', {}, 'Lembre: '), 'falar mais de um assunto não quer dizer ter proposta melhor. Confira os planos de governo e o contexto das falas.');

// ---------- Resultado ----------

// Abre o assunto pelo seu destaque, com a chave "assunto todo" já ligada.
function buscarAssunto(id, origem, opcoes = {}) {
  const destaque = dados.termos.find((t) => t.grupo === id && t.destaque);
  if (destaque) buscar(destaque.termo, origem, { ...opcoes, modo: 'assunto' });
}

function buscar(consulta, origem, { historico = true, modo: modoInicial = 'palavra' } = {}) {
  const fam = familia(consulta, dados.termos);
  if (!fam) return;
  const res = contar(dados.acervos, fam, ordem);
  const total = somar(res);
  const grupo = grupoDe(fam.termo);
  medir.buscou({ termo: fam.rotulo.toLowerCase(), publico: Boolean(fam.termo) || total > 0, origem, grupo: grupo?.id });

  // O link guarda a escolha: ?p=palavra ou ?a=assunto (chave ligada).
  const naUrl = (m) => {
    const url = new URL(location.href);
    url.search = '';
    if (m === 'assunto') url.searchParams.set('a', grupo.id);
    else url.searchParams.set('p', fam.rotulo);
    return url;
  };
  if (historico) history.pushState({}, '', naUrl(grupo ? modoInicial : 'palavra'));

  const vizinhos = fam.termo ? dados.termos.filter((t) => t.grupo === fam.termo.grupo && t !== fam.termo) : [];
  // A chave troca entre a palavra e o assunto todo: contagens, trechos, link e imagem seguem a escolha.
  const famAssunto = grupo ? { ...familiaDoGrupo(grupo.id, dados.termos), rotulo: grupo.nome } : null;
  const resAssunto = famAssunto ? contar(dados.acervos, famAssunto, ordem) : null;
  let modo = grupo ? modoInicial : 'palavra';
  const onde = el('div', { class: 'onde-slot' });
  const desenharOnde = () => {
    const [f, r] = modo === 'assunto' ? [famAssunto, resAssunto] : [fam, res];
    onde.replaceChildren(...(somar(r) > 0 ? [ondeUsou(f, r, modo === 'assunto')] : []));
  };
  // Título e "o que contamos" acompanham a chave.
  const h1 = el('h1', { tabindex: '-1' });
  const contamos = el('p', { class: 'contamos' }, fam.formas.length > 1 ? `Contamos: ${fam.formas.join(', ')}.` : 'Contamos só a palavra inteira.',
    fam.excluir.length ? ` Não contamos expressões em que a palavra não fala do assunto: ${fam.excluir.join(', ')}.` : '',
    grupo ? ` Assunto: ${grupo.nome}.` : '');
  const cabecalho = () => {
    h1.textContent = modo === 'assunto' ? grupo.nome : `“${fam.rotulo}”`;
    contamos.hidden = modo === 'assunto';
    document.title = `${modo === 'assunto' ? grupo.nome : `“${fam.rotulo}”`} · Palavra por Palavra`;
  };
  desenharOnde();
  cabecalho();
  const tela = el('section', { class: 'tela resultado' },
    el('button', { class: 'botao voltar', type: 'button', onclick: () => voltarAoInicio() }, '← Todas as palavras'),
    campoDeBusca(fam.rotulo),
    h1,
    contamos,
    quadro(fam, res, grupo, {
      resAssunto, modo,
      compartilhar: (total > 0 || (resAssunto && somar(resAssunto) > 0)) && el('button', { class: 'botao principal compartilhar', type: 'button', onclick: (e) => enviarImagem(e.currentTarget, modo === 'assunto' ? { rotulo: grupo.nome, aspas: false, res: resAssunto } : { rotulo: fam.rotulo, aspas: true, res }) }, 'Compartilhar'),
      aoTrocar: (m) => { modo = m; desenharOnde(); cabecalho(); history.replaceState({}, '', naUrl(m)); },
    }),
    onde,
    el('div', { class: 'par' },
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
// Total de ocorrências dos dois candidatos em todos os acervos.
function somar(res) {
  return Object.values(res).reduce((s, porCandidato) => s + ordem.reduce((t, c) => t + porCandidato[c].vezes, 0), 0);
}

function quadro(fam, res, grupo, { resAssunto, modo: modoInicial, aoTrocar, compartilhar: botaoCompartilhar }) {
  const temResumo = grupo && ordem.every((c) => dados.resumos.grupos[grupo.id]?.[c]);
  const painel = el('div', { class: 'painel', id: 'resumo-ia', hidden: true });
  const palavrasDoAssunto = grupo ? dados.termos.filter((t) => t.grupo === grupo.id) : [];
  let aberto = null;
  const colunas = ordem.map((c) => {
    const foto = el('img', { src: `img/${c}-serio.webp?v=1.9`, alt: '', width: '96', height: '96' });
    const rotulo = el('span', { class: 'ver-resumo' }, el('span', {}, 'Ver resumo'));
    // Retrato embaixo das contagens; com resumo, retrato e botão formam um único botão.
    const cabeca = temResumo
      ? el('button', { class: 'rosto', type: 'button', 'aria-pressed': 'false', 'aria-controls': painel.id, 'aria-label': `Ver resumo do plano de ${nome(c)}` }, foto, rotulo)
      : el('div', { class: 'rosto estatico' }, foto);
    if (temResumo) new Image().src = `img/${c}-alegre.webp?v=1.9`; // sem piscar na troca
    return {
      c, cabeca, foto, rotulo,
      coluna: el('div', { class: 'coluna' }),
    };
  });
  if (temResumo) {
    for (const { c, cabeca } of colunas) {
      cabeca.addEventListener('click', () => {
        aberto = aberto === c ? null : c;
        for (const col of colunas) {
          const ativo = col.c === aberto;
          col.cabeca.setAttribute('aria-pressed', String(ativo));
          col.foto.src = `img/${col.c}-${ativo ? 'alegre' : 'serio'}.webp?v=1.9`;
          col.rotulo.lastChild.textContent = ativo ? 'Fechar' : 'Ver resumo';
        }
        painel.hidden = !aberto;
        if (aberto) { painel.replaceChildren(...resumo(grupo, aberto)); medir.viuResumo(`${grupo.id}:${aberto}`); }
      });
    }
  }
  // Chave "palavra / assunto todo": a soma de todas as palavras do assunto compara quem fala do
  // mesmo tema com vocabulário diferente ("casa" de um, "moradia" do outro).
  const titulo = el('h2', {});
  const vazio = el('p', { class: 'vazio' });
  const explicacao = el('p', { class: 'legenda', hidden: true },
    `Somando as ${palavrasDoAssunto.length} palavras do assunto: ${palavrasDoAssunto.map((t) => t.termo).join(', ')}. Nada conta duas vezes.`);
  const mostrar = (m) => {
    const r = m === 'assunto' ? resAssunto : res;
    titulo.textContent = m === 'assunto' ? `Quanto cada um falou de ${grupo.nome.toLowerCase()}` : 'Quantas vezes cada um usou';
    vazio.hidden = somar(r) > 0;
    vazio.textContent = m === 'assunto'
      ? 'Nenhum dos dois usou as palavras deste assunto no plano de governo nem nas entrevistas.'
      : `Nenhum dos dois usou “${fam.rotulo}” no plano de governo nem nas entrevistas.`;
    explicacao.hidden = m !== 'assunto';
    colunas.forEach((col) => col.coluna.replaceChildren(el('h3', { class: 'nome' }, nome(col.c)), ...contas(r, col.c)));
  };
  const chave = resAssunto && el('button', { class: 'chave', type: 'button', role: 'switch', 'aria-checked': String(modoInicial === 'assunto') },
    el('span', { class: 'trilho', 'aria-hidden': 'true' }, el('span', { class: 'bolinha' })),
    el('span', {}, `Contar o assunto todo: ${grupo.nome.toLowerCase()}`));
  chave?.addEventListener('click', () => {
    const ligada = chave.getAttribute('aria-checked') !== 'true';
    chave.setAttribute('aria-checked', String(ligada));
    mostrar(ligada ? 'assunto' : 'palavra');
    aoTrocar(ligada ? 'assunto' : 'palavra');
    if (ligada) medir.ligouAssunto(grupo.id);
  });
  mostrar(resAssunto ? modoInicial : 'palavra');
  return el('section', { class: 'comparativo' },
    titulo,
    chave,
    el('p', { class: 'legenda-barras' },
      el('span', {}, el('i', { class: 'amostra plano', 'aria-hidden': 'true' }), 'Plano de governo'),
      el('span', {}, el('i', { class: 'amostra falas', 'aria-hidden': 'true' }), 'Entrevistas')),
    vazio,
    explicacao,
    el('div', { class: 'colunas' }, colunas.map((col) => col.coluna)),
    // Retratos numa linha própria, logo abaixo da chamada para o resumo.
    temResumo && el('p', { class: 'dica' }, iconeIA(), el('span', {}, 'Veja também um resumo, feito por IA, do que cada plano propõe sobre ', el('strong', {}, grupo.nome.toLowerCase()), '.')),
    el('div', { class: 'colunas rostos' }, colunas.map((col) => col.cabeca)),
    temResumo && painel,
    botaoCompartilhar,
    aviso(),
  );
}

// Plano e entrevistas de um candidato: número, barra (comparada ao outro candidato) e frequência.
function contas(res, c) {
  return Object.keys(dados.acervos).map((id) => {
    const r = res[id][c];
    const maior = Math.max(...ordem.map((x) => res[id][x].taxa)) || 1;
    return el('div', { class: `conta ${id}` },
      el('span', { class: 'rotulo' }, id === 'plano' ? 'No plano' : 'Nas entrevistas'),
      el('strong', {}, vezes(r.vezes)),
      el('span', { class: 'trilha', 'aria-hidden': 'true' }, el('span', { class: `preenche ${id}`, style: `width:${(r.taxa / maior) * 100}%` })),
      el('small', {}, `${numero(r.taxa, 1)} a cada 10 mil palavras`));
  });
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
function ondeUsou(fam, res, assunto = false) {
  return el('section', { class: 'onde-usou' },
    el('h2', { class: 'subtitulo' }, assunto ? `Onde cada um falou de ${fam.rotulo.toLowerCase()}` : 'Onde cada um usou a palavra'),
    ordem.map((c) => trechos(c, Object.keys(dados.acervos).flatMap((id) => res[id][c].achados.map((a) => ({ id, ...a }))), fam, assunto)));
}

// Lista de trechos, aberta sob demanda e mostrada aos poucos.
function trechos(c, achados, fam, assunto) {
  if (!achados.length) return el('p', { class: 'onde-nada' }, `${nome(c)} não usou ${assunto ? 'essas palavras' : 'essa palavra'}.`);
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

async function enviarImagem(botao, { rotulo, aspas, res }) {
  botao.disabled = true;
  try {
    const tipo = await compartilhar({
      palavra: rotulo,
      aspas,
      link: aspas ? `?p=${encodeURIComponent(rotulo)}` : `?a=${encodeURIComponent(dados.grupos.find((g) => g.nome === rotulo).id)}`,
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
  const params = new URLSearchParams(location.search);
  const assunto = params.get('a');
  if (assunto && dados.grupos.some((g) => g.id === assunto)) buscarAssunto(assunto, 'link', { historico });
  // Só abre palavra da lista; link com outra palavra volta para o início.
  else if (params.get('p') && familia(params.get('p'), dados.termos)?.termo) buscar(params.get('p'), 'link', { historico });
  else {
    if (location.search) history.replaceState({}, '', location.pathname);
    voltarAoInicio({ historico: false });
  }
}

async function iniciar() {
  try {
    const [textos, termos, resumos] = await Promise.all(
      ['data/textos.json?v=1.9', 'data/termos.json?v=1.9', 'data/resumos.json?v=1.9'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })),
    );
    dados = { textos, termos: termos.termos, grupos: termos.grupos, resumos, acervos: preparar(textos) };
  } catch {
    medir.erroCarga();
    app.replaceChildren(el('section', { class: 'tela' }, el('h1', {}, 'Não deu para carregar'), el('p', {}, 'Confira sua conexão e recarregue a página.')));
    return;
  }
  ordem = sortearOrdem();
  // Nota de método no rodapé, em todas as telas.
  document.querySelector('.rodape')?.prepend(el('p', { class: 'metodo' },
    'A barra compara a frequência (a cada 10 mil palavras), porque os textos têm tamanhos diferentes. ', tamanhos()));
  medir.abriu();
  rota();
  addEventListener('popstate', () => rota());
  document.querySelector('.rodape a[data-teste-cego]')?.addEventListener('click', medir.foiTesteCego);
}

iniciar();
