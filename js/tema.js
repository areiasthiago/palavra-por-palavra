// Botão claro/escuro. O tema inicial é definido por um script no <head> para não piscar.
const CHAVE = 'palavra:tema';
const raiz = document.documentElement;
const botao = document.querySelector('.tema');

function aplicar(tema) {
  raiz.dataset.theme = tema;
  botao.setAttribute('aria-label', tema === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#141316' : '#f5f5f6');
}

aplicar(raiz.dataset.theme === 'dark' ? 'dark' : 'light');
botao.addEventListener('click', () => {
  const tema = raiz.dataset.theme === 'dark' ? 'light' : 'dark';
  aplicar(tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem armazenamento, a escolha vale só até recarregar.
  }
});
