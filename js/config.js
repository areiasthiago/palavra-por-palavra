// Endereço que aparece na imagem e no texto de compartilhamento.
export const SITE = 'areiasthiago.github.io/palavra-por-palavra';

// Contador anônimo agregado (Cloudflare Worker + D1). Rodando localmente, usa o banco de teste,
// para nada de teste se misturar aos números reais.
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
export const CONTAGEM = {
  url: LOCAL ? 'https://palavra-contagem-teste.thiagoareias.workers.dev' : 'https://palavra-contagem.thiagoareias.workers.dev',
};

// false desliga todo envio (o site funciona igual, só não conta nada).
export const ENVIAR_CONTAGEM = true;
