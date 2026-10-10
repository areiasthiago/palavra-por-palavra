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
  // Também o selo ao lado da logo, usado na fase de testes.
  const texto = readFileSync(caminho, 'utf8')
    .replace(/\?v=\d+\.\d+/g, `?v=${versao}`)
    .replace(/(<span class="versao">)v\d+\.\d+/, `$1v${versao}`);
  writeFileSync(caminho, texto);
}
console.log(`versão ${versao}`);
