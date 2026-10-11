import { preparar, familia, familiaDoGrupo, formasDoTermo, contar, trecho, semAcento } from './busca.js?v=3.9';
import * as medir from './contagem.js?v=3.9';
import { compartilhar } from './compartilhar.js?v=3.9';
import { numero, vezes, frequencia, maiorTaxa, LEMBRETE, PERGUNTA } from './formato.js?v=3.9';

const ORDEM = 'palavra:ordem';
const POR_VEZ = 5; // trechos mostrados de cada vez
const app = document.getElementById('app');

let dados; // { textos, termos, grupos, resumos, acervos, indice }
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

const mil = (n) => `${numero(n / 1000, 1)} mil`;
const nome = (c) => dados.textos.candidatos[c].nome;
const dataCurta = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const grupoPorId = (id) => dados.grupos.find((g) => g.id === id);
const grupoDe = (termo) => grupoPorId(termo.grupo);
const termosDoGrupo = (id) => dados.termos.filter((t) => t.grupo === id);

// Link para o plano ou para a entrevista, sempre em outra aba e contado na medição.
const linkFonte = (href, texto) => el('a', { href, target: '_blank', rel: 'noopener', onclick: medir.abriuFonte }, texto);
const paginaDoPlano = (c, n) => `${dados.textos.candidatos[c].plano}#page=${n}`;

// Ordem sorteada uma vez por aparelho, para nenhum dos dois aparecer sempre primeiro.
function sortearOrdem() {
  const salva = medir.ler(ORDEM, null);
  if (Array.isArray(salva) && salva.length === 2) return salva;
  const nova = Math.random() < 0.5 ? ['lula', 'flavio'] : ['flavio', 'lula'];
  medir.gravar(ORDEM, nova);
  return nova;
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
    const itens = lista.querySelectorAll('[role="option"]');
    itens.forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) { entrada.setAttribute('aria-activedescendant', itens[i].id); itens[i].scrollIntoView({ block: 'nearest' }); }
    else entrada.removeAttribute('aria-activedescendant');
  };
  const escolher = (opcao) => {
    fechar();
    if (opcao.tipo === 'assunto') buscarAssunto(opcao.grupo, 'sugestao');
    else buscar(opcao.valor, 'sugestao');
  };
  const atualizar = () => {
    const { itens, semNada } = sugerir(entrada.value);
    erro.hidden = !semNada;
    erro.textContent = semNada ? `“${entrada.value.trim()}” não está na nossa lista. Tente outra palavra ou escolha um assunto.` : '';
    entrada.setAttribute('aria-invalid', String(semNada));
    opcoes = itens;
    // Duas seções: palavras e assuntos. Os títulos das seções não são opções.
    const opcao = (o, k) => el('li', {
      id: `sugestao-${k}`, role: 'option', 'aria-selected': 'false', class: `opcao-${o.tipo}`,
      onmousedown: (e) => e.preventDefault(), // não tira o foco do campo antes do clique
      onclick: () => escolher(o),
    }, el('span', {}, o.valor), el('small', {}, o.detalhe));
    const secao = (titulo, tipo) => {
      const daSecao = itens.filter((o) => o.tipo === tipo);
      return daSecao.length ? [el('li', { class: 'secao', role: 'presentation' }, titulo), ...daSecao.map((o) => opcao(o, itens.indexOf(o)))] : [];
    };
    lista.replaceChildren(...secao('Palavras', 'palavra'), ...secao('Assuntos', 'assunto'));
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
      const { itens, palavras, exata } = sugerir(entrada.value);
      // Só busca palavra da lista: a exata, ou a única palavra sugerida. Senão, pede para escolher.
      const termo = exata?.termo ?? (palavras.length === 1 ? palavras[0].valor : null);
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

// Formas de cada termo e nome de cada assunto já sem acento, preparados uma vez para as sugestões.
function montarIndice() {
  return {
    termos: dados.termos.map((t) => ({ t, formas: formasDoTermo(t).map(semAcento) })),
    grupos: dados.grupos.map((g) => ({ g, palavras: semAcento(g.nome).split(/\s+/) })),
  };
}

// Sugestões só da nossa lista de palavras. semNada: 3 letras ou mais e nenhuma palavra da lista
// começa assim. exata: o termo da lista que corresponde ao que foi digitado, se houver.
function sugerir(texto) {
  const q = semAcento(texto.trim().replace(/\s+/g, ' '));
  if (!q) return { itens: [], palavras: [], semNada: false, exata: null };
  const achados = dados.indice.termos.filter(({ formas }) => formas.some((v) => v.startsWith(q)))
    .map(({ t }) => t)
    .sort((a, b) => a.termo.length - b.termo.length);
  const exata = dados.indice.termos.find(({ formas }) => formas.includes(q))?.t ?? null;
  // Assuntos: os das palavras achadas e os que têm alguma palavra no nome começando assim.
  const grupos = [...new Set([
    ...achados.map((t) => t.grupo),
    ...dados.indice.grupos.filter(({ palavras }) => palavras.some((w) => w.startsWith(q))).map(({ g }) => g.id),
  ])];
  const palavras = achados.slice(0, 6).map((t) => ({ tipo: 'palavra', valor: t.termo, detalhe: grupoDe(t).nome }));
  const assuntos = grupos.slice(0, 3).map((id) => ({ tipo: 'assunto', grupo: id, valor: grupoPorId(id).nome, detalhe: `${termosDoGrupo(id).length} palavras` }));
  return {
    itens: [...palavras, ...assuntos],
    palavras,
    semNada: q.replace(/ /g, '').length >= 3 && !palavras.length && !assuntos.length,
    exata,
  };
}

function inicio() {
  const destaques = dados.termos.filter((t) => t.destaque)
    .sort((a, b) => grupoDe(b).peso - grupoDe(a).peso);
  const nomes = ordem.map(nome);
  // Começa com os destaques das pesquisas; se o contador responder, troca pela lista viva.
  const quentes = el('div', { class: 'chips' }, destaques.map((t) => chip(t, 'quentes')));
  medir.quentes().then((lista) => {
    const vivos = (lista ?? []).map((termo) => dados.termos.find((t) => t.termo === termo)).filter(Boolean);
    if (vivos.length) quentes.replaceChildren(...vivos.map((t) => chip(t, 'quentes')));
  });
  app.replaceChildren(el('section', { class: 'tela inicio' },
    el('span', { class: 'selo' }, 'Eleições 2026 · 2º turno'),
    el('h1', {}, 'Quanto cada candidato ', el('span', { class: 'destaque' }, 'fala do que importa'), ' pra você?'),
    el('p', { class: 'chamada' }, `Escolha uma palavra e veja quantas vezes ${nomes[0]} e ${nomes[1]} usaram essa palavra no plano de governo e em entrevistas.`),
    campoDeBusca(),
    el('div', { class: 'bloco' },
      el('h2', { class: 'subtitulo' }, 'Mais buscados aqui'),
      quentes),
    el('div', { class: 'bloco' },
      el('h2', { class: 'subtitulo' }, 'Ou escolha por assunto'),
      el('div', { class: 'assuntos' }, dados.grupos.map((g) => el('details', { class: 'assunto' },
        // Aberto, o título ganha à direita a pílula que leva ao assunto todo (chave ligada).
        el('summary', {}, el('span', {}, g.nome),
          el('button', { class: 'pilula-assunto', type: 'button', 'aria-label': `${g.nome}: todas as palavras`,
            onclick: (e) => { e.preventDefault(); e.stopPropagation(); buscarAssunto(g.id, 'assunto'); } }, 'todas as palavras')),
        el('div', { class: 'chips' }, termosDoGrupo(g.id).map((t) => chip(t, 'assunto'))))))),
    aviso(),
  ));
}

const aviso = () => el('p', { class: 'aviso-fixo' }, el('strong', {}, 'Lembre: '), LEMBRETE);

// ---------- Resultado ----------

// Abre o assunto pelo seu destaque, com a chave "assunto todo" já ligada.
function buscarAssunto(id, origem, opcoes = {}) {
  const destaque = dados.termos.find((t) => t.grupo === id && t.destaque);
  if (destaque) buscar(destaque.termo, origem, { ...opcoes, modo: 'assunto' });
}

// Total de ocorrências dos dois candidatos em todos os acervos.
function somar(res) {
  return Object.values(res).reduce((s, porCandidato) => s + ordem.reduce((t, c) => t + porCandidato[c].vezes, 0), 0);
}

// As duas formas de ver uma busca: a palavra e o assunto todo. Cada uma traz o que a tela, o link,
// a imagem e a medição precisam; a do assunto só é contada quando alguém liga a chave.
function vistas(fam, grupo) {
  const preguicosa = (vista, contarFam) => {
    let res;
    return Object.defineProperty(vista, 'res', { get: () => (res ??= contar(dados.acervos, contarFam(), ordem)) });
  };
  return {
    palavra: preguicosa({
      modo: 'palavra', fam, aspas: true, rotulo: fam.rotulo, cabecalho: `“${fam.rotulo}”`,
      titulo: PERGUNTA.palavra, link: `?p=${encodeURIComponent(fam.rotulo)}`, metrica: fam.rotulo.toLowerCase(),
      vazio: `Nenhum dos dois usou “${fam.rotulo}” no plano de governo nem nas entrevistas.`,
      onde: 'Onde cada candidato usou a palavra', nada: 'essa palavra',
    }, () => fam),
    assunto: preguicosa({
      modo: 'assunto', aspas: false, rotulo: grupo.nome, cabecalho: grupo.nome,
      titulo: `${PERGUNTA.assunto} ${grupo.nome.toLowerCase()}`, link: `?a=${grupo.id}`, metrica: grupo.id,
      vazio: 'Nenhum dos dois usou as palavras deste assunto no plano de governo nem nas entrevistas.',
      onde: `Onde cada candidato falou sobre ${grupo.nome.toLowerCase()}`, nada: 'essas palavras',
    }, () => familiaDoGrupo(grupo, dados.termos)),
  };
}

// Só chega aqui palavra da lista (busca, sugestões, chips e links filtram antes), então sempre há um assunto.
function buscar(consulta, origem, { historico = true, modo = 'palavra' } = {}) {
  const fam = familia(consulta, dados.termos);
  if (!fam?.termo) return;
  const grupo = grupoDe(fam.termo);
  const visoes = vistas(fam, grupo);
  let vista = visoes[modo];
  medir.buscou({ termo: fam.rotulo.toLowerCase(), publico: true, origem, grupo: grupo.id });

  // O link guarda a escolha: ?p=palavra ou ?a=assunto (chave ligada).
  const naUrl = () => {
    const url = new URL(location.href);
    url.search = vista.link;
    return url;
  };
  if (historico) history.pushState({}, '', naUrl());

  const h1 = el('h1', { tabindex: '-1' });
  const contamos = el('p', { class: 'contamos' }, fam.formas.length > 1 ? `Contamos: ${fam.formas.join(', ')}.` : 'Contamos só a palavra inteira.',
    fam.excluir.length ? ` Não contamos expressões em que a palavra não fala do assunto: ${fam.excluir.join(', ')}.` : '',
    ` Assunto: ${grupo.nome}.`);
  const onde = el('div', { class: 'onde-slot' });
  // Título, "o que contamos" e trechos acompanham a chave.
  const desenhar = () => {
    h1.textContent = vista.cabecalho;
    document.title = `${vista.cabecalho} · Palavra por Palavra`;
    contamos.hidden = vista.modo === 'assunto';
    onde.replaceChildren(...(somar(vista.res) > 0 ? [ondeUsou(vista)] : []));
  };
  desenhar();

  const vizinhos = termosDoGrupo(grupo.id).filter((t) => t !== fam.termo);
  const tela = el('section', { class: 'tela resultado' },
    el('button', { class: 'botao voltar', type: 'button', onclick: () => voltarAoInicio() }, '← Todas as palavras'),
    campoDeBusca(fam.rotulo),
    h1,
    contamos,
    quadro(grupo, visoes, vista, (nova) => { vista = nova; desenhar(); history.replaceState({}, '', naUrl()); }),
    onde,
    convite(),
    el('div', { class: 'par' },
      el('button', { class: 'botao discreto', type: 'button', onclick: () => { const i = app.querySelector('.busca input'); i.value = ''; i.focus(); } }, 'Buscar outra palavra')),
    vizinhos.length > 0 && el('div', { class: 'bloco' },
      el('h2', { class: 'subtitulo' }, `Mais palavras sobre ${grupo.nome.toLowerCase()}`),
      el('div', { class: 'chips' }, vizinhos.map((t) => chip(t, 'assunto')))),
  );
  app.replaceChildren(tela);
  window.scrollTo(0, 0);
  h1.focus({ preventScroll: true });
}

// Convite para o site irmão: comparar propostas sem saber de quem são.
const convite = () => el('a', { class: 'convite', href: 'https://testecego.online/?o=pp', target: '_blank', rel: 'noopener', onclick: medir.foiTesteCego },
  el('span', { class: 'convite-selo' }, 'Teste Cego'),
  el('strong', {}, 'Ainda indeciso? Faça o Teste Cego'),
  el('span', {}, 'Compare propostas dos dois candidatos sem saber de quem é cada uma. No fim, veja com quem você concorda mais.'),
  el('span', { class: 'convite-acao' }, 'Fazer o teste →'));

// Caixa única da contagem: uma coluna por candidato, com plano e entrevistas em linhas próprias.
// Os dois na mesma cor (quem é quem está escrito, não pintado); plano e entrevistas se distinguem
// pelo desenho da barra, com rótulo em cada linha. O retrato abre o resumo da IA na mesma caixa.
function quadro(grupo, visoes, inicial, aoTrocar) {
  const temResumo = ordem.every((c) => dados.resumos.grupos[grupo.id]?.[c]);
  const painel = el('div', { class: 'painel', id: 'resumo-ia', hidden: true });
  const palavrasDoAssunto = termosDoGrupo(grupo.id);
  const listaDoAssunto = palavrasDoAssunto.map((t) => t.termo).join(', ');
  let vista = inicial;
  let aberto = null;

  const colunas = ordem.map((c) => {
    const foto = el('img', { src: `img/${c}-serio.webp?v=3.9`, alt: '', width: '96', height: '96' });
    const rotulo = el('span', { class: 'ver-resumo' }, 'Ver resumo');
    // Retrato embaixo das contagens; com resumo, retrato e botão formam um único botão.
    const cabeca = temResumo
      ? el('button', { class: 'rosto', type: 'button', 'aria-pressed': 'false', 'aria-controls': painel.id, 'aria-label': `Ver resumo do plano de ${nome(c)}`, onclick: () => abrirResumo(c) }, foto, rotulo)
      : el('div', { class: 'rosto' }, foto);
    if (temResumo) new Image().src = `img/${c}-alegre.webp?v=3.9`; // sem piscar na troca
    return { c, cabeca, foto, rotulo, coluna: el('div', { class: 'coluna' }) };
  });
  function abrirResumo(c) {
    aberto = aberto === c ? null : c;
    for (const col of colunas) {
      const ativo = col.c === aberto;
      col.cabeca.setAttribute('aria-pressed', String(ativo));
      col.foto.src = `img/${col.c}-${ativo ? 'alegre' : 'serio'}.webp?v=3.9`;
      col.rotulo.textContent = ativo ? 'Fechar' : 'Ver resumo';
    }
    painel.hidden = !aberto;
    if (aberto) { painel.replaceChildren(...resumo(grupo, aberto)); medir.viuResumo(`${grupo.id}:${aberto}`); }
  }

  // Chave "palavra / assunto todo": a soma de todas as palavras do assunto compara quem fala do
  // mesmo tema com vocabulário diferente ("casa" de um, "moradia" do outro).
  const titulo = el('h2', {});
  const vazio = el('p', { class: 'vazio' });
  const explicacao = el('p', { class: 'legenda' });
  const botaoCompartilhar = el('button', { class: 'botao principal compartilhar', type: 'button', onclick: (e) => enviarImagem(e.currentTarget, vista) }, 'Compartilhar');
  const mostrar = () => {
    const temAlgo = somar(vista.res) > 0;
    titulo.textContent = vista.titulo;
    vazio.hidden = temAlgo;
    vazio.textContent = vista.vazio;
    botaoCompartilhar.hidden = !temAlgo;
    explicacao.textContent = vista.modo === 'assunto'
      ? `Somando as ${palavrasDoAssunto.length} palavras do assunto: ${listaDoAssunto}. Nada conta duas vezes.`
      : `Palavras do assunto ${grupo.nome.toLowerCase()}: ${listaDoAssunto}. Ligue a chave para somar todas.`;
    colunas.forEach((col) => col.coluna.replaceChildren(el('h3', { class: 'nome' }, nome(col.c)), ...contas(vista.res, col.c)));
  };
  const chave = el('button', {
    class: 'chave', type: 'button', role: 'switch', 'aria-checked': String(vista.modo === 'assunto'),
    onclick: () => {
      const ligada = chave.getAttribute('aria-checked') !== 'true';
      chave.setAttribute('aria-checked', String(ligada));
      vista = ligada ? visoes.assunto : visoes.palavra;
      mostrar();
      aoTrocar(vista);
      if (ligada) medir.ligouAssunto(grupo.id);
    },
  },
  el('span', { class: 'trilho', 'aria-hidden': 'true' }, el('span', { class: 'bolinha' })),
  el('span', {}, `Contar o assunto todo: ${grupo.nome.toLowerCase()} (${palavrasDoAssunto.length} palavras)`));
  mostrar();

  return el('section', { class: 'comparativo' },
    titulo,
    chave,
    el('p', { class: 'legenda-barras' },
      el('span', {}, el('i', { class: 'amostra plano', 'aria-hidden': 'true' }), 'Plano de governo'),
      el('span', {}, el('i', { class: 'amostra falas', 'aria-hidden': 'true' }), 'Entrevistas')),
    vazio,
    el('div', { class: 'colunas' }, colunas.map((col) => col.coluna)),
    botaoCompartilhar,
    // Retratos numa linha própria, logo abaixo da chamada para o resumo.
    temResumo && el('p', { class: 'dica' }, iconeIA(), el('span', {}, 'Veja também um resumo, feito por IA, do que cada plano propõe sobre ', el('strong', {}, grupo.nome.toLowerCase()), '.')),
    el('div', { class: 'colunas rostos' }, colunas.map((col) => col.cabeca)),
    temResumo && painel,
    explicacao,
    aviso(),
  );
}

// Plano e entrevistas de um candidato: número, barra (comparada ao outro candidato) e frequência.
function contas(res, c) {
  return Object.keys(dados.acervos).map((id) => {
    const r = res[id][c];
    return el('div', { class: `conta ${id}` },
      el('span', { class: 'rotulo' }, id === 'plano' ? 'No plano' : 'Nas entrevistas'),
      el('strong', {}, vezes(r.vezes)),
      el('span', { class: 'trilha', 'aria-hidden': 'true' }, el('span', { class: `preenche ${id}`, style: `width:${(r.taxa / maiorTaxa(res[id])) * 100}%` })),
      el('small', {}, frequencia(r.taxa)));
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
  const pagina = (n) => linkFonte(paginaDoPlano(c, n), `pág. ${n}`);
  return [
    el('span', { class: 'selo-ia' }, iconeIA(), 'Resumo feito por IA'),
    el('h3', {}, nome(c)),
    el('p', { class: 'visao' }, r.visao.texto, ' ', pagina(r.visao.pagina)),
    el('ul', { class: 'propostas' }, r.propostas.map((p) => el('li', {}, p.texto, ' ', pagina(p.pagina)))),
    el('p', { class: 'nota-ia' }, dados.resumos.aviso, ' ', linkFonte(dados.textos.candidatos[c].plano, `Ler o plano completo de ${nome(c)}`), '.'),
  ];
}

function eventosDoAcervo(acervo) {
  const pares = [...new Set(acervo.eventos.map((e) => e.evento))];
  return `${pares.join('; ')}, de ${dataCurta(acervo.eventos[0].data)} a ${dataCurta(acervo.eventos.at(-1).data)}`;
}

// Abaixo da caixa: onde cada um usou a palavra (ou o assunto), plano e entrevistas juntos, cada trecho com a fonte.
function ondeUsou(vista) {
  return el('section', { class: 'onde-usou' },
    el('h2', { class: 'subtitulo' }, vista.onde),
    ordem.map((c) => trechos(c, Object.keys(dados.acervos).flatMap((id) => vista.res[id][c].achados.map((a) => ({ id, ...a }))), vista)));
}

// Lista de trechos, aberta sob demanda e mostrada aos poucos.
function trechos(c, achados, vista) {
  if (!achados.length) return el('p', { class: 'onde-nada' }, `${nome(c)} não usou ${vista.nada}.`);
  const lista = el('ol', { class: 'trechos' });
  let mostrados = 0;
  const mostrarMais = () => {
    for (const achado of achados.slice(mostrados, mostrados + POR_VEZ)) lista.append(itemDeTrecho(c, achado));
    mostrados = Math.min(achados.length, mostrados + POR_VEZ);
    mais.hidden = mostrados >= achados.length;
  };
  const mais = el('button', { class: 'botao discreto mais', type: 'button', onclick: mostrarMais }, 'Mostrar mais');
  const caixa = el('details', { class: 'onde' },
    el('summary', {}, `Ver onde ${nome(c)} usou (${vezes(achados.length)})`), lista, mais);
  caixa.addEventListener('toggle', () => {
    if (caixa.open && !mostrados) { mostrarMais(); medir.viuTrechos(vista.metrica); }
  });
  return caixa;
}

function itemDeTrecho(c, { id, pedaco, i, n }) {
  const t = trecho(pedaco.texto, pedaco.lista, { i, n });
  const fonte = id === 'plano'
    ? linkFonte(paginaDoPlano(c, pedaco.pagina), `Plano, pág. ${pedaco.pagina}`)
    : linkFonte(pedaco.url, `Entrevista: ${pedaco.evento}, ${dataCurta(pedaco.data)}`);
  return el('li', {}, el('p', {}, t.antes, el('mark', {}, t.achado), t.depois), fonte);
}

async function enviarImagem(botao, vista) {
  botao.disabled = true;
  try {
    const tipo = await compartilhar({
      palavra: vista.rotulo,
      aspas: vista.aspas,
      link: vista.link,
      lados: ordem.map((c) => ({
        nome: nome(c),
        imagem: `img/${c}-neutro.webp?v=3.9`,
        plano: vista.res.plano[c],
        falas: vista.res.falas[c],
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
  if (assunto && grupoPorId(assunto)) buscarAssunto(assunto, 'link', { historico });
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
      ['data/textos.json?v=3.9', 'data/termos.json?v=3.9', 'data/resumos.json?v=3.9'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })),
    );
    dados = { textos, termos: termos.termos, grupos: termos.grupos, resumos, acervos: preparar(textos) };
    dados.indice = montarIndice();
  } catch {
    medir.erroCarga();
    app.replaceChildren(el('section', { class: 'tela' }, el('h1', {}, 'Não deu para carregar'), el('p', {}, 'Confira sua conexão e recarregue a página.')));
    return;
  }
  ordem = sortearOrdem();
  // Nota de método no rodapé (o lugar já existe no HTML), em todas as telas.
  const metodo = document.querySelector('.rodape .metodo');
  if (metodo) {
    metodo.textContent = `A barra compara a frequência (a cada 10 mil palavras), porque os textos têm tamanhos diferentes. ${tamanhos()}`;
    metodo.hidden = false;
  }
  medir.abriu();
  rota();
  addEventListener('popstate', () => rota());
  document.querySelector('.rodape a[data-teste-cego]')?.addEventListener('click', medir.foiTesteCego);
}

iniciar();
