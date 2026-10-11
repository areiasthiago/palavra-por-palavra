// Contador anônimo do Palavra por Palavra. Só soma totais por dia; não guarda IP, cookie,
// identificador nem horário exato. Aceita pedidos só do site e só o que está na lista abaixo.
import { termos, grupos } from '../../data/termos.json';

const CANAIS = new Set(['wa', 'wam', 'was', 'tw', 'ig', 'fb', 'tt', 'li', 'tg', 'th', 'bs', 'yt', 'em', 'busca', 'c', 'tc', 'direto', 'outro']);
const ORIGENS_BUSCA = new Set(['digitou', 'sugestao', 'quentes', 'assunto', 'planos', 'link']);
const PALAVRAS = new Set(termos.map((t) => t.termo.toLowerCase()));
const ASSUNTOS = new Set(grupos.map((g) => g.id));
const CANDIDATOS = ['lula', 'flavio'];
const TIPOS_COMPARTILHAMENTO = new Set(['imagem', 'link', 'download']);

// O que cada evento aceita no campo "termo". Fora disso, o evento é descartado.
const TERMO_ACEITO = {
  abriu: (t) => t === '',
  voltou: (t) => t === '',
  buscou: (t) => t === '',
  buscou_2: (t) => t === '',
  buscou_5: (t) => t === '',
  sem_resultado: (t) => t === '',
  abriu_fonte: (t) => t === '',
  foi_teste_cego: (t) => t === '',
  erro_carga: (t) => t === '',
  termo: (t) => PALAVRAS.has(t),
  grupo: (t) => ASSUNTOS.has(t),
  ligou_assunto: (t) => ASSUNTOS.has(t),
  viu_trechos: (t) => PALAVRAS.has(t) || ASSUNTOS.has(t),
  viu_resumo: (t) => { const [g, c] = t.split(':'); return ASSUNTOS.has(g) && CANDIDATOS.includes(c); },
  viu_propostas: (t) => { const [g, c] = t.split(':'); return ASSUNTOS.has(g) && CANDIDATOS.includes(c); },
  compartilhou: (t) => TIPOS_COMPARTILHAMENTO.has(t),
};

// Quantas vezes por hora cada evento (por palavra) pode subir. Acima disso, não conta.
const TETO_POR_HORA = { termo: 300, grupo: 300, viu_trechos: 300, viu_resumo: 300, viu_propostas: 300, ligou_assunto: 300 };
const TETO_PADRAO = 5000;

// Dia em Brasília, para os totais diários baterem com o calendário do público.
const diaBrasilia = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const horaUtc = () => new Date().toISOString().slice(0, 13);

function cabecalhos(origem, extra = {}) {
  return { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', Vary: 'Origin', ...extra };
}

async function registrar(env, corpo) {
  const evento = String(corpo.evento ?? '');
  const termo = String(corpo.termo ?? '').toLowerCase();
  const canal = CANAIS.has(corpo.canal) ? corpo.canal : '';
  const origem = evento === 'termo' && ORIGENS_BUSCA.has(corpo.origem) ? corpo.origem : '';
  if (!TERMO_ACEITO[evento]?.(termo)) return;

  const teto = TETO_POR_HORA[evento] ?? TETO_PADRAO;
  const usado = await env.DB.prepare(
    'INSERT INTO limite (hora, chave, n) VALUES (?1, ?2, 1) ON CONFLICT (hora, chave) DO UPDATE SET n = n + 1 RETURNING n',
  ).bind(horaUtc(), `${evento}|${termo}`).first('n');
  if (usado > teto) return;

  await env.DB.prepare(
    `INSERT INTO contagem (dia, evento, termo, canal, origem, n) VALUES (?1, ?2, ?3, ?4, ?5, 1)
     ON CONFLICT (dia, evento, termo, canal, origem) DO UPDATE SET n = n + 1`,
  ).bind(diaBrasilia(), evento, termo, canal, origem).run();
}

// Mais buscados: mistura o peso das pesquisas (destaques dos assuntos) com a fatia das buscas dos
// últimos 7 dias. No começo vale a pesquisa; com o uso, quem decide são as buscas.
async function quentes(env) {
  const desde = new Date(Date.now() - 3 * 3600e3 - 6 * 86400e3).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(
    "SELECT termo, SUM(n) AS n FROM contagem WHERE evento = 'termo' AND dia >= ?1 GROUP BY termo",
  ).bind(desde).all();
  const buscas = Object.fromEntries(results.map((r) => [r.termo, r.n]));
  const total = results.reduce((s, r) => s + r.n, 0);
  const alfa = 200 / (200 + total);
  const peso = Object.fromEntries(grupos.map((g) => [g.id, g.peso]));
  const destaques = termos.filter((t) => t.destaque);
  const somaPesos = destaques.reduce((s, t) => s + peso[t.grupo], 0);
  const nota = (t) => alfa * (t.destaque ? peso[t.grupo] / somaPesos : 0) + (1 - alfa) * ((buscas[t.termo.toLowerCase()] ?? 0) / (total || 1));
  const lista = termos.map((t) => ({ termo: t.termo, nota: nota(t) }))
    .filter((t) => t.nota > 0)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, 12)
    .map((t) => t.termo);
  return { termos: lista, buscas7dias: total };
}

export default {
  async fetch(request, env, ctx) {
    const permitidas = env.ORIGENS.split(',');
    const origem = request.headers.get('Origin') ?? '';
    const url = new URL(request.url);
    if (!permitidas.includes(origem)) return new Response('origem não permitida', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecalhos(origem) });

    if (request.method === 'POST' && url.pathname === '/evento') {
      const texto = await request.text();
      if (texto.length > 500) return new Response(null, { status: 413, headers: cabecalhos(origem) });
      let corpo;
      try { corpo = JSON.parse(texto); } catch { return new Response(null, { status: 400, headers: cabecalhos(origem) }); }
      ctx.waitUntil(registrar(env, corpo ?? {}));
      // De vez em quando, apaga os tetos de horas que já passaram.
      if (Math.random() < 0.01) ctx.waitUntil(env.DB.prepare('DELETE FROM limite WHERE hora < ?1').bind(new Date(Date.now() - 2 * 3600e3).toISOString().slice(0, 13)).run());
      return new Response(null, { status: 204, headers: cabecalhos(origem) });
    }

    if (request.method === 'GET' && url.pathname === '/quentes') {
      const cache = caches.default;
      const chave = new Request(`${url.origin}/quentes`);
      let resposta = await cache.match(chave);
      if (!resposta) {
        resposta = new Response(JSON.stringify(await quentes(env)), { headers: { 'content-type': 'application/json', 'Cache-Control': 'public, max-age=600' } });
        ctx.waitUntil(cache.put(chave, resposta.clone()));
      }
      return new Response(resposta.body, { headers: cabecalhos(origem, { 'content-type': 'application/json', 'Cache-Control': 'public, max-age=600' }) });
    }

    return new Response('não encontrado', { status: 404, headers: cabecalhos(origem) });
  },
};
