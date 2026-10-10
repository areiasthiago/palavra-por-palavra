// Troca o número da versão nos endereços de CSS, JS e dados (?v=), para o navegador
// não misturar arquivos novos com antigos em cache. Versão nunca lembra número de partido.
// Uso: node scripts/versao.mjs 0.2
import { readFileSync, writeFileSync } from 'node:fs';

const versao = process.argv[2];
if (!/^\d+\.\d+$/.test(versao ?? '')) {
  console.error('Uso: node scripts/versao.mjs 0.2');
  process.exit(1);
}
if (/(^|\D)(13|22)(\D|$)/.test(versao)) {
  console.error(`A versão ${versao} lembra número de partido; escolha outra.`);
  process.exit(1);
}
const raiz = new URL('..', import.meta.url);
for (const arquivo of ['index.html', 'sobre.html', 'js/app.js', 'js/contagem.js', 'js/compartilhar.js']) {
  const caminho = new URL(arquivo, raiz);
  writeFileSync(caminho, readFileSync(caminho, 'utf8').replace(/\?v=\d+\.\d+/g, `?v=${versao}`));
}
console.log(`versão ${versao}`);
