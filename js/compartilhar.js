import { SITE } from './config.js?v=5.5';
import { vezes, frequencia, maiorTaxa, PERGUNTA } from './formato.js?v=5.5';

// Imagem de story (9:16) com a cara da tela de resultado: um cartão com uma coluna por candidato,
// na mesma ordem da tela. Dois tipos: a contagem de uma palavra (número, barra e frequência) e as
// propostas de um assunto (quantas e quantas dizem como vão fazer, com o mesmo peso).
// Leva sempre os dois: a imagem não pode virar disputa.
const L = 1080;
const A = 1920;
// Faixa segura: o WhatsApp mostra na conversa só o meio da imagem (altura ≈ 1,4 × largura) e o story
// cobre topo e base com a interface do aplicativo. Tudo fica dentro dela; fora, só o fundo.
const SEGURO = { topo: (A - L * 1.4) / 2, base: (A + L * 1.4) / 2 };
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

const fonte = (peso, tamanho, familia = '"Bricolage Grotesque"') => `${peso} ${tamanho}px ${familia}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const texto = (peso, tamanho) => fonte(peso, tamanho, 'system-ui');

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

// Barra como na tela: trilha clara, preenchimento roxo.
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

// A contagem do candidato no plano, dentro da coluna.
function conta(ctx, x, y, w, rotulo, r, maior, listrada) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.suave;
  ctx.font = texto(700, 30);
  ctx.fillText(rotulo, x, y);
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(800, 80);
  ctx.fillText(vezes(r.vezes), x, y + 90);
  barra(ctx, x, y + 118, w, 54, r.taxa / maior, listrada);
  ctx.fillStyle = COR.suave;
  ctx.font = texto(400, 31);
  ctx.fillText(frequencia(r.taxa), x, y + 214);
}

// Nome ao lado do retrato; quebra em duas linhas se não couber.
function nomeAoLado(ctx, nome, x, yMeio, largura) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(800, 46);
  if (ctx.measureText(nome).width <= largura || !nome.includes(' ')) {
    textoAjustado(ctx, nome, x, yMeio + 16, 800, 46, largura);
    return;
  }
  const [primeiro, ...resto] = nome.split(' ');
  textoAjustado(ctx, primeiro, x, yMeio - 8, 800, 46, largura);
  textoAjustado(ctx, resto.join(' '), x, yMeio + 44, 800, 46, largura);
}

// Uma medida da coluna de propostas: rótulo, número grande, barra e detalhe.
function medida(ctx, x, y, w, rotulo, valor, fracao, detalhe) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.suave;
  ctx.font = texto(700, 30);
  ctx.fillText(rotulo, x, y);
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(800, 80);
  ctx.fillText(valor, x, y + 86);
  barra(ctx, x, y + 110, w, 50, fracao, false);
  if (detalhe) {
    ctx.fillStyle = COR.suave;
    ctx.font = texto(400, 31);
    ctx.fillText(detalhe, x, y + 202);
  }
}

// Selo, pergunta e título com marca-texto. Devolve o topo do cartão.
function cabecalho(ctx, y0, pergunta, titulo) {
  ctx.textAlign = 'center';
  ctx.font = fonte(800, 32);
  const selo = 'PALAVRA POR PALAVRA · ELEIÇÕES 2026';
  const larguraSelo = ctx.measureText(selo).width + 68;
  bloco(ctx, (L - larguraSelo) / 2, y0, larguraSelo, 70, 35, COR.roxo);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(selo, L / 2, y0 + 47);

  ctx.fillStyle = COR.tinta;
  textoAjustado(ctx, pergunta, L / 2, y0 + 160, 700, 48, L - 100);
  let t = 112;
  ctx.font = fonte(800, t);
  while (ctx.measureText(titulo).width > L - 120 && t > 40) { t -= 4; ctx.font = fonte(800, t); }
  const largura = ctx.measureText(titulo).width;
  const yTitulo = y0 + 282;
  ctx.fillStyle = COR.marcaTexto;
  ctx.fillRect((L - largura) / 2 - 12, yTitulo - t * 0.42, largura + 24, t * 0.42);
  ctx.fillStyle = COR.tinta;
  ctx.fillText(titulo, L / 2, yTitulo);
  return y0 + 340;
}

// tipo 'palavra': palavra é o termo (ou o assunto, sem aspas); lados: [{ nome, imagem, plano }].
// tipo 'propostas': palavra é o assunto; lados: [{ nome, imagem, n, como }]. Sempre na ordem da tela.
export async function gerarImagem({ tipo = 'palavra', palavra, aspas = true, lados }) {
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
  // Conteúdo centralizado na faixa segura (o cartão das propostas é mais alto que o da palavra).
  if (tipo === 'propostas') return propostas(ctx, canvas, SEGURO.topo + 138, palavra, lados, imagens);
  const y0 = SEGURO.topo + 158;

  const topo = cabecalho(ctx, y0, aspas ? PERGUNTA.palavra : PERGUNTA.assunto, aspas ? `“${palavra}”` : palavra);

  // Cartão com as duas colunas
  bloco(ctx, 40, topo, L - 80, 712, 44, COR.papel, 12);
  const maior = maiorTaxa(lados.map((l) => l.plano));
  const largCol = 420;
  lados.forEach((lado, i) => {
    const x = i === 0 ? 88 : 572;
    retrato(ctx, imagens[i], x + 115, topo + 165, 115);
    ctx.textAlign = 'left';
    ctx.fillStyle = COR.tinta;
    textoAjustado(ctx, lado.nome, x, topo + 345, 800, 48, largCol);
    conta(ctx, x, topo + 425, largCol, 'NO PLANO DE GOVERNO', lado.plano, maior, false);
  });

  // Chamada com o endereço
  const fim = topo + 712;
  ctx.textAlign = 'center';
  ctx.fillStyle = COR.tinta;
  ctx.font = fonte(800, 46);
  ctx.fillText(aspas ? 'Busque a sua palavra em' : 'Veja o seu assunto em', L / 2, fim + 80);
  textoAjustado(ctx, SITE, L / 2, fim + 138, 700, 42, L - 120);

  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

// Propostas de um assunto: quantas e quantas dizem como vão fazer, com o mesmo desenho e tamanho.
function propostas(ctx, canvas, y0, assunto, lados, imagens) {
  const topo = cabecalho(ctx, y0, 'O que cada plano propõe sobre', assunto);
  bloco(ctx, 40, topo, L - 80, 830, 44, COR.papel, 12);
  const maior = Math.max(...lados.map((l) => l.n)) || 1;
  const largCol = 420;
  lados.forEach((lado, i) => {
    const x = i === 0 ? 88 : 572;
    retrato(ctx, imagens[i], x + 80, topo + 112, 80);
    ctx.textAlign = 'left';
    ctx.fillStyle = COR.tinta;
    textoAjustado(ctx, lado.nome, x, topo + 258, 800, 46, largCol);
    medida(ctx, x, topo + 325, largCol, 'PROPOSTAS', String(lado.n), lado.n / maior);
    const pct = lado.n ? Math.round((100 * lado.como) / lado.n) : 0;
    medida(ctx, x, topo + 522, largCol, 'DIZ COMO VAI FAZER', `${pct}%`, lado.n ? lado.como / lado.n : 0, `${lado.como} de ${lado.n}`);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = COR.suave;
  ctx.font = texto(400, 28);
  ctx.fillText('✦ Propostas separadas e classificadas por IA a partir dos planos', L / 2, topo + 792);

  // Chamada com o endereço
  ctx.fillStyle = COR.tinta;
  ctx.textAlign = 'center';
  textoAjustado(ctx, `Veja em ${SITE}`, L / 2, topo + 830 + 100, 800, 46, L - 120);
  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

// Devolve como foi compartilhado ('imagem', 'link' ou 'download'), ou null se a pessoa desistiu.
export async function compartilhar(dados) {
  const blob = await gerarImagem(dados);
  const arquivo = new File([blob], 'palavra-por-palavra.png', { type: 'image/png' });
  const url = `https://${SITE}/${dados.link}&o=c`;
  const mensagem = dados.tipo === 'propostas'
    ? `O que cada plano de governo propõe sobre ${dados.palavra.toLowerCase()}? Quantas propostas e quantas dizem como vão ser feitas: ${url}`
    : dados.aspas
    ? `Quantas vezes cada candidato usou “${dados.palavra}” no plano de governo? Busque a sua palavra: ${url}`
    : `Quanto cada candidato falou sobre ${dados.palavra.toLowerCase()} no plano de governo? Veja: ${url}`;

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
