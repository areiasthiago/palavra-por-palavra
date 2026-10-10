import { SITE } from './config.js?v=1.7';

// Imagem de story (9:16) no estilo do site. Leva sempre os dois candidatos, o número,
// a frequência e o aviso: a imagem não pode virar "placar" fora de contexto.
const L = 1080;
const A = 1920;
const COR = {
  fundo: '#f5f5f6',
  papel: '#ffffff',
  tinta: '#1c1a1f',
  suave: '#5d5b63',
  roxo: '#7c4dff',
  roxoClaro: '#e9e1ff',
  marcaTexto: '#d3c4ff',
  trilha: '#e6e4ea',
};
const TRACO = 6;

const fonte = (peso, tamanho) => `${peso} ${tamanho}px "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const numero = (n, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const vezes = (n) => (n === 1 ? '1 vez' : `${numero(n)} vezes`);

function bloco(ctx, x, y, w, h, raio, cor, sombra = 0) {
  if (sombra) {
    ctx.fillStyle = COR.tinta;
    ctx.beginPath();
    ctx.roundRect(x + sombra, y + sombra, w, h, raio);
    ctx.fill();
  }
  ctx.fillStyle = cor;
  ctx.strokeStyle = COR.tinta;
  ctx.lineWidth = TRACO;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, raio);
  ctx.fill();
  ctx.stroke();
}

// Escreve o texto no maior tamanho que couber na largura.
function textoAjustado(ctx, texto, x, y, peso, tamanho, largura) {
  let t = tamanho;
  ctx.font = fonte(peso, t);
  while (ctx.measureText(texto).width > largura && t > 16) {
    t -= 2;
    ctx.font = fonte(peso, t);
  }
  ctx.fillText(texto, x, y);
}

// Quebra o texto em linhas que caibam na largura, com a fonte já definida no contexto.
function quebrar(ctx, texto, largura) {
  const linhas = [''];
  for (const palavra of texto.split(' ')) {
    const tentativa = linhas.at(-1) ? `${linhas.at(-1)} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > largura && linhas.at(-1)) linhas.push(palavra);
    else linhas[linhas.length - 1] = tentativa;
  }
  return linhas;
}

// Um acervo: nome, barra de frequência (mesma cor para os dois) e os números.
function secao(ctx, titulo, lados, chave, y) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(800, 48);
  ctx.fillText(titulo, 90, y);
  const maior = Math.max(...lados.map((l) => l[chave].taxa)) || 1;
  lados.forEach((lado, i) => {
    const yl = y + 80 + i * 165;
    ctx.fillStyle = COR.tinta;
    ctx.textAlign = 'left';
    textoAjustado(ctx, lado.nome, 90, yl, 700, 40, 420);
    ctx.textAlign = 'right';
    ctx.font = fonte(800, 40);
    ctx.fillText(vezes(lado[chave].vezes), L - 90, yl);
    bloco(ctx, 90, yl + 22, L - 180, 40, 20, COR.trilha);
    const w = ((L - 180) * lado[chave].taxa) / maior;
    if (w > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(90, yl + 22, L - 180, 40, 20);
      ctx.clip();
      ctx.fillStyle = COR.roxo;
      ctx.fillRect(90, yl + 22, w, 40);
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(90, yl + 22, L - 180, 40, 20);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = COR.suave;
    ctx.font = fonte(400, 30);
    ctx.fillText(`${numero(lado[chave].taxa, 1)} a cada 10 mil palavras`, 90, yl + 100);
  });
}

// palavra: o termo buscado. lados: [{ nome, plano: {vezes, taxa}, falas: {vezes, taxa} }] na ordem da tela.
export async function gerarImagem({ palavra, aspas = true, lados }) {
  await document.fonts?.load(fonte(800, 100)).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, L, A);
  ctx.textBaseline = 'alphabetic';

  // Selo
  ctx.textAlign = 'center';
  ctx.font = fonte(800, 34);
  const selo = 'PALAVRA POR PALAVRA · ELEIÇÕES 2026';
  const larguraSelo = ctx.measureText(selo).width + 72;
  bloco(ctx, (L - larguraSelo) / 2, 200, larguraSelo, 76, 38, COR.roxo);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(selo, L / 2, 250);

  // Palavra, com marca-texto
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(700, 46);
  ctx.fillText(aspas ? 'Quantas vezes cada um usou' : 'Quanto cada um falou de', L / 2, 380);
  ctx.font = fonte(800, 110);
  let t = 110;
  const texto = aspas ? `“${palavra}”` : palavra;
  while (ctx.measureText(texto).width > L - 140 && t > 40) { t -= 4; ctx.font = fonte(800, t); }
  const largura = ctx.measureText(texto).width;
  ctx.fillStyle = COR.marcaTexto;
  ctx.fillRect((L - largura) / 2 - 12, 470, largura + 24, t * 0.42);
  ctx.fillStyle = COR.tinta;
  ctx.fillText(texto, L / 2, 510);

  // Os dois acervos num cartão
  bloco(ctx, 50, 590, L - 100, 865, 44, COR.papel);
  secao(ctx, 'No plano de governo', lados, 'plano', 680);
  secao(ctx, 'Nas entrevistas', lados, 'falas', 1090);

  // Aviso, o mesmo lembrete da tela
  ctx.font = fonte(700, 36);
  const linhas = quebrar(ctx, 'Falar mais de um assunto não quer dizer ter proposta melhor. Confira os planos de governo e o contexto das falas.', L - 180);
  bloco(ctx, 50, 1480, L - 100, 52 + linhas.length * 48, 36, COR.roxoClaro);
  ctx.textAlign = 'center';
  ctx.fillStyle = COR.tinta;
  linhas.forEach((linha, i) => ctx.fillText(linha, L / 2, 1540 + i * 48));

  // Chamada
  ctx.font = fonte(800, 50);
  ctx.fillText('Busque a sua palavra:', L / 2, 1775);
  ctx.fillStyle = COR.tinta;
  textoAjustado(ctx, SITE, L / 2, 1834, 700, 38, L - 120);

  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

// Devolve como foi compartilhado ('imagem', 'link' ou 'download'), ou null se a pessoa desistiu.
export async function compartilhar(dados) {
  const blob = await gerarImagem(dados);
  const arquivo = new File([blob], 'palavra-por-palavra.png', { type: 'image/png' });
  const url = `https://${SITE}/${dados.link}&o=c`;
  const texto = dados.aspas
    ? `Quantas vezes cada candidato usou “${dados.palavra}” no plano de governo e em entrevistas? Busque a sua palavra: ${url}`
    : `Quanto cada candidato falou de ${dados.palavra.toLowerCase()} no plano de governo e em entrevistas? Veja: ${url}`;

  try {
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: texto });
      return 'imagem';
    }
    if (navigator.share) {
      await navigator.share({ text: texto });
      return 'link';
    }
  } catch (e) {
    if (e.name === 'AbortError') return null;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = arquivo.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return 'download';
}
