import { CONTAGEM, ENVIAR_CONTAGEM } from './config.js?v=0.1';

// Medição anônima: só totais por dia. Nada de nome, identificador, IP guardado ou cookie.
// Cada aparelho conta no máximo uma vez por evento (e por palavra, por dia), controlado aqui no aparelho.
const MEDIDO = 'palavra:medido';
const ORIGEM = 'palavra:origem';
const VISITA = 'palavra:visita';
const CANAIS = ['wa', 'wam', 'was', 'tw', 'ig', 'fb', 'tt', 'li', 'tg', 'th', 'bs', 'yt', 'em', 'busca', 'c', 'tc', 'direto', 'outro'];

const hoje = () => new Date().toISOString().slice(0, 10);

// Por qual canal a pessoa chegou: a etiqueta do link (?o=tw) ou, sem ela, o site de onde
// o navegador diz ter vindo. Aplicativos de mensagem não informam nada: contam como 'direto'.
function canalDeChegada() {
  const etiqueta = new URLSearchParams(location.search).get('o');
  if (CANAIS.includes(etiqueta)) return etiqueta;
  let de = '';
  try { de = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch { return 'direto'; }
  if (!de || de === location.hostname) return 'direto';
  const mapa = [
    [/(^|\.)testecego\.online$/, 'tc'],
    [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'tw'], [/(^|\.)instagram\.com$/, 'ig'], [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'fb'],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, 'wa'], [/(^|\.)tiktok\.com$/, 'tt'], [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'li'],
    [/(^|\.)(t\.me|telegram\.org)$/, 'tg'], [/(^|\.)threads\.(net|com)$/, 'th'], [/(^|\.)bsky\.app$/, 'bs'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'yt'], [/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com)$/, 'busca'],
  ];
  return (mapa.find(([padrao]) => padrao.test(de)) || [null, 'outro'])[1];
}

function ler(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
}

function enviar(corpo) {
  if (!ENVIAR_CONTAGEM || !CONTAGEM.url) return;
  try {
    fetch(`${CONTAGEM.url}/evento`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ ...corpo, canal: ler(ORIGEM, '') }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Falhar aqui nunca pode atrapalhar a busca.
  }
}

// Conta o evento uma vez só por aparelho (ou por dia, quando a chave inclui a data).
function umaVez(chave, corpo) {
  const feito = ler(MEDIDO, {});
  if (feito[chave]) return;
  feito[chave] = 1;
  // Sem armazenamento não dá para contar uma vez só; melhor não contar.
  if (gravar(MEDIDO, feito)) enviar(corpo);
}

// Primeira visita do aparelho: guarda o canal. Visita em outro dia: conta como retorno.
export function abriu() {
  const ultima = ler(VISITA, null);
  if (!ultima) {
    gravar(ORIGEM, canalDeChegada());
    umaVez('abriu', { evento: 'abriu' });
  } else if (ultima !== hoje()) {
    umaVez(`voltou:${hoje()}`, { evento: 'voltou' });
  }
  gravar(VISITA, hoje());
}

// Cada busca feita. O texto só vai junto se a palavra existe no vocabulário público
// (planos, entrevistas ou banco de termos); fora disso, conta só "sem resultado".
export function buscou({ termo, publico, origem, grupo }) {
  const feitas = ler(`${MEDIDO}:buscas`, 0) + 1;
  gravar(`${MEDIDO}:buscas`, feitas);
  if (feitas === 1) umaVez('buscou', { evento: 'buscou' });
  if (feitas === 2) umaVez('buscou_2', { evento: 'buscou_2' });
  if (feitas === 5) umaVez('buscou_5', { evento: 'buscou_5' });
  if (!publico) { umaVez(`sem:${hoje()}:${feitas}`, { evento: 'sem_resultado' }); return; }
  umaVez(`termo:${hoje()}:${termo}`, { evento: 'termo', termo, origem });
  if (grupo) umaVez(`grupo:${hoje()}:${grupo}`, { evento: 'grupo', termo: grupo });
}

export const viuTrechos = (termo) => umaVez(`trechos:${hoje()}:${termo}`, { evento: 'viu_trechos', termo });
export const abriuFonte = () => umaVez(`fonte:${hoje()}`, { evento: 'abriu_fonte' });
export const compartilhou = (tipo) => umaVez(`compartilhou:${hoje()}:${tipo}`, { evento: 'compartilhou', termo: tipo });
export const foiTesteCego = () => umaVez('foi_teste_cego', { evento: 'foi_teste_cego' });
export const erroCarga = () => enviar({ evento: 'erro_carga' });
