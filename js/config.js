// Endereço que aparece na imagem e no texto de compartilhamento.
export const SITE = 'areiasthiago.github.io/palavra-por-palavra';

// Contagem anônima agregada (Cloudflare Worker). Enquanto estiver vazio, nada é enviado.
export const CONTAGEM = {
  url: '',
};

// false na fase de testes de usabilidade: não envia nada para a contagem.
export const ENVIAR_CONTAGEM = false;
