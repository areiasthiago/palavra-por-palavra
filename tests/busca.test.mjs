import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palavras, flexoes, familia, ocorrencias, porDezMil, preparar, contar, trecho } from '../js/busca.js';

const conta = (texto, consulta, termos = []) => ocorrencias(palavras(texto), familia(consulta, termos)).length;

test('conta só a palavra inteira', () => {
  assert.equal(conta('Cultura e agricultura familiar.', 'cultura'), 1);
  assert.equal(conta('O crime e a criminalística.', 'crime'), 1);
});

test('singular e plural contam juntos', () => {
  assert.equal(conta('Uma escola, duas escolas.', 'escola'), 2);
  assert.equal(conta('Uma eleição, duas eleições.', 'eleições'), 2);
  assert.equal(conta('Nível nacional, metas nacionais.', 'nacional'), 2);
  assert.equal(conta('Um trabalhador, dois trabalhadores.', 'trabalhador'), 2);
  assert.ok(flexoes('jovem').includes('jovens'));
});

test('sem acento vale qualquer grafia; com acento, só aquela', () => {
  assert.equal(conta('Educação para todos.', 'educacao'), 1);
  assert.equal(conta('O país e os pais.', 'país'), 1);
  assert.equal(conta('O país e os pais.', 'pais'), 2);
});

test('maiúsculas não importam', () => {
  assert.equal(conta('SAÚDE, Saúde e saúde.', 'saúde'), 3);
});

test('expressão conta só a sequência exata', () => {
  assert.equal(conta('Os Estados Unidos e os estados unidos do norte. Estados do sul.', 'estados unidos'), 2);
});

test('termo do banco usa as variantes declaradas e as siglas', () => {
  const termos = [
    { termo: 'educação', variantes: ['educacional'] },
    { termo: 'Estados Unidos', variantes: [], siglas: ['EUA'] },
  ];
  assert.equal(conta('Educação e ensino educacional.', 'educacional', termos), 2);
  assert.equal(conta('Acordo com os EUA e os Estados Unidos.', 'estados unidos', termos), 2);
  assert.equal(familia('educacional', termos).rotulo, 'educação');
});

test('frequência a cada 10 mil palavras', () => {
  assert.equal(porDezMil(5, 10000), 5);
  assert.equal(porDezMil(1, 20000), 0.5);
  assert.equal(porDezMil(3, 0), 0);
});

test('contar separa por acervo e candidato e calcula a taxa pelo tamanho de cada texto', () => {
  const acervos = preparar({
    acervos: {
      plano: { pedacos: [
        { candidato: 'a', texto: 'saúde saúde escola escola' },
        { candidato: 'b', texto: 'saúde escola' },
      ] },
    },
  });
  const r = contar(acervos, familia('saúde'), ['a', 'b']).plano;
  assert.equal(r.a.vezes, 2);
  assert.equal(r.b.vezes, 1);
  assert.equal(r.a.taxa, 5000);
  assert.equal(r.b.taxa, 5000);
});

test('trecho marca a palavra achada e corta com reticências', () => {
  const texto = Array.from({ length: 40 }, (_, i) => `p${i}`).join(' ').replace('p20', 'saúde');
  const lista = palavras(texto);
  const [achado] = ocorrencias(lista, familia('saúde'));
  const t = trecho(texto, lista, achado, 3);
  assert.equal(t.achado, 'saúde');
  assert.equal(t.antes, '…p17 p18 p19 ');
  assert.equal(t.depois, ' p21 p22 p23…');
});
