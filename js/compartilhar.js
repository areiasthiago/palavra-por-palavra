import { SITE } from './config.js?v=2.8';

// Imagem de story (9:16) com a cara da tela de resultado: um cartão com uma coluna por candidato
// (retrato, nome, plano com barra cheia, entrevistas com barra listrada), na mesma ordem da tela.
// Leva sempre os dois, o número, a frequência e o lembrete: a imagem não pode virar "placar".
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
const LEMBRETE = 'Falar mais de um assunto não quer dizer ter proposta melhor. Confira os planos de governo e o contexto das falas.';

const fonte = (peso, tamanho, familia = '"Bricolage Grotesque"') => `${peso} ${tamanho}px ${familia}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const texto = (peso, tamanho) => fonte(peso, tamanho, 'system-ui');
const numero = (n, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const vezes = (n) => (n === 1 ? '1 vez' : `${numero(n)} vezes`);

function carregar(src) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = erro;
    img.src = src;
  });
}

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
function textoAjustado(ctx, conteudo, x, y, peso, tamanho, largura, fam = fonte) {
  let t = tamanho;
  ctx.font = fam(peso, t);
  while (ctx.measureText(conteudo).width > largura && t > 16) {
    t -= 2;
    ctx.font = fam(peso, t);
  }
  ctx.fillText(conteudo, x, y);
}

// Quebra o texto em linhas que caibam na largura, com a fonte já definida no contexto.
function quebrar(ctx, conteudo, largura) {
  const linhas = [''];
  for (const palavra of conteudo.split(' ')) {
    const tentativa = linhas.at(-1) ? `${linhas.at(-1)} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > largura && linhas.at(-1)) linhas.push(palavra);
    else linhas[linhas.length - 1] = tentativa;
  }
  return linhas;
}

// Barra como na tela: trilha clara, preenchimento roxo (cheio no plano, listrado nas entrevistas).
function barra(ctx, x, y, w, h, fracao, listrada) {
  bloco(ctx, x, y, w, h, h / 2, COR.trilha);
  const cheio = Math.max(0, Math.min(1, fracao)) * w;
  if (cheio > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(x, y, cheio, h);
    ctx.clip();
    ctx.fillStyle = listrada ? COR.roxoClaro : COR.roxo;
    ctx.fillRect(x, y, cheio, h);
    if (listrada) {
      ctx.strokeStyle = COR.roxo;
      ctx.lineWidth = 9;
      for (let i = -h; i < cheio + h; i += 18) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + h);
        ctx.lineTo(x + i + h, y);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = COR.tinta;
    ctx.lineWidth = TRACO;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.stroke();
  }
}

function retrato(ctx, img, cx, cy, raio) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = COR.papel;
  ctx.fill();
  ctx.clip();
  ctx.drawImage(img, cx - raio, cy - raio, raio * 2, raio * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.lineWidth = TRACO;
  ctx.strokeStyle = COR.tinta;
  ctx.stroke();
}

// Uma linha de contagem (plano ou entrevistas) dentro da coluna.
function conta(ctx, x, y, w, rotulo, r, maior, listrada) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.suave;
  ctx.font = texto(700, 27);
  ctx.fillText(rotulo, x, y);
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(800, 58);
  ctx.fillText(vezes(r.vezes), x, y + 64);
  barra(ctx, x, y + 88, w, 40, r.taxa / maior, listrada);
  ctx.fillStyle = COR.suave;
  ctx.font = texto(400, 27);
  ctx.fillText(`${numero(r.taxa, 1)} a cada 10 mil palavras`, x, y + 172);
}

// palavra: o termo (ou o assunto, sem aspas). lados: [{ nome, imagem, plano, falas }] na ordem da tela.
export async function gerarImagem({ palavra, aspas = true, lados }) {
  const [imagens] = await Promise.all([
    Promise.all(lados.map((l) => carregar(l.imagem))),
    document.fonts?.load(fonte(800, 100)).catch(() => {}),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, L, A);
  ctx.textBaseline = 'alphabetic';

  // Selo
  ctx.textAlign = 'center';
  ctx.font = fonte(800, 32);
  const selo = 'PALAVRA POR PALAVRA · ELEIÇÕES 2026';
  const larguraSelo = ctx.measureText(selo).width + 70;
  bloco(ctx, (L - larguraSelo) / 2, 120, larguraSelo, 72, 36, COR.roxo);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(selo, L / 2, 168);

  // Pergunta e palavra, com marca-texto
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(700, 46);
  ctx.fillText(aspas ? 'Quantas vezes cada um usou' : 'Quanto cada um falou de', L / 2, 290);
  const titulo = aspas ? `“${palavra}”` : palavra;
  let t = 104;
  ctx.font = fonte(800, t);
  while (ctx.measureText(titulo).width > L - 140 && t > 40) { t -= 4; ctx.font = fonte(800, t); }
  const largura = ctx.measureText(titulo).width;
  ctx.fillStyle = COR.marcaTexto;
  ctx.fillRect((L - largura) / 2 - 12, 395 - t * 0.42, largura + 24, t * 0.42);
  ctx.fillStyle = COR.tinta;
  ctx.fillText(titulo, L / 2, 395);

  // Cartão com as duas colunas
  const topo = 470;
  bloco(ctx, 50, topo, L - 100, 960, 44, COR.papel, 14);
  // Legenda das barras
  const legenda = [['Plano de governo', false], ['Entrevistas', true]];
  ctx.font = texto(400, 28);
  let lx = 100;
  for (const [nomeLegenda, listrada] of legenda) {
    barra(ctx, lx, topo + 48, 56, 26, 1, listrada);
    ctx.fillStyle = COR.suave;
    ctx.textAlign = 'left';
    ctx.fillText(nomeLegenda, lx + 72, topo + 71);
    lx += 72 + ctx.measureText(nomeLegenda).width + 48;
  }
  const maior = {
    plano: Math.max(...lados.map((l) => l.plano.taxa)) || 1,
    falas: Math.max(...lados.map((l) => l.falas.taxa)) || 1,
  };
  const largCol = 400;
  lados.forEach((lado, i) => {
    const x = i === 0 ? 100 : 580;
    retrato(ctx, imagens[i], x + largCol / 2, topo + 225, 100);
    ctx.fillStyle = COR.tinta;
    ctx.textAlign = 'left';
    textoAjustado(ctx, lado.nome, x, topo + 395, 800, 44, largCol);
    conta(ctx, x, topo + 470, largCol, 'NO PLANO', lado.plano, maior.plano, false);
    conta(ctx, x, topo + 700, largCol, 'NAS ENTREVISTAS', lado.falas, maior.falas, true);
  });

  // Lembrete, o mesmo da tela
  ctx.font = texto(400, 33);
  const linhas = quebrar(ctx, LEMBRETE, L - 200);
  const topoLembrete = topo + 1000;
  const alturaLembrete = 50 + linhas.length * 46;
  bloco(ctx, 50, topoLembrete, L - 100, alturaLembrete, 28, COR.roxoClaro);
  ctx.fillStyle = COR.roxo;
  ctx.fillRect(50 + TRACO / 2, topoLembrete + TRACO / 2, 12, alturaLembrete - TRACO);
  ctx.fillStyle = COR.tinta;
  ctx.textAlign = 'left';
  linhas.forEach((linha, i) => {
    ctx.font = i === 0 ? texto(400, 33) : texto(400, 33);
    ctx.fillText(linha, 100, topoLembrete + 62 + i * 46);
  });

  // Chamada
  ctx.textAlign = 'center';
  ctx.fillStyle = COR.tinta;
  const chamadaY = topoLembrete + alturaLembrete + 105;
  ctx.font = fonte(800, 50);
  ctx.fillText(aspas ? 'Busque a sua palavra:' : 'Veja o seu assunto:', L / 2, chamadaY);
  textoAjustado(ctx, SITE, L / 2, chamadaY + 62, 700, 38, L - 120);

  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

// Devolve como foi compartilhado ('imagem', 'link' ou 'download'), ou null se a pessoa desistiu.
export async function compartilhar(dados) {
  const blob = await gerarImagem(dados);
  const arquivo = new File([blob], 'palavra-por-palavra.png', { type: 'image/png' });
  const url = `https://${SITE}/${dados.link}&o=c`;
  const mensagem = dados.aspas
    ? `Quantas vezes cada candidato usou “${dados.palavra}” no plano de governo e em entrevistas? Busque a sua palavra: ${url}`
    : `Quanto cada candidato falou de ${dados.palavra.toLowerCase()} no plano de governo e em entrevistas? Veja: ${url}`;

  try {
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: mensagem });
      return 'imagem';
    }
    if (navigator.share) {
      await navigator.share({ text: mensagem });
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
