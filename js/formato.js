// Números e textos que a tela e a imagem de compartilhar mostram igual.

export const numero = (n, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const vezes = (n) => (n === 1 ? '1 vez' : `${numero(n)} vezes`);
export const frequencia = (taxa) => `${numero(taxa, 1)} a cada 10 mil palavras`;

// A maior frequência entre os candidatos, para a barra de cada um ser comparada à do outro.
export const maiorTaxa = (porCandidato) => Math.max(...Object.values(porCandidato).map((r) => r.taxa)) || 1;

export const LEMBRETE = 'falar mais de um assunto não quer dizer ter proposta melhor. Confira os planos de governo e o contexto das falas.';
export const PERGUNTA = { palavra: 'Quantas vezes cada candidato usou', assunto: 'Quanto cada candidato falou sobre' };
