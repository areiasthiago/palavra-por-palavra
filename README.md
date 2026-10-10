# Palavra por Palavra · Eleições 2026

Escolha uma palavra e veja quantas vezes cada candidato do 2º turno presidencial usou essa palavra no plano de governo e em entrevistas, com os trechos para conferir. Site estático, sem build e sem dependências: HTML, CSS e JS puros, servidos pelo GitHub Pages.

## Rodar localmente

```
python -m http.server 8000
```

## Dados

- Planos: `refs/*.pdf` → `data/fontes/*.txt` (`bash scripts/extrair.sh`, precisa de pdftotext).
- Entrevistas: íntegras salvas localmente em `data/falas/*.txt` (fora do git, por serem texto dos jornais), descritas em `data/falas/eventos.json`. Só entram pares: o mesmo formato e veículo para os dois candidatos. Conta-se só a fala do candidato.
- Banco de termos: `data/termos.json` (grupos com peso vindo das pesquisas, variantes da mesma família).

```
npm run montar     # gera data/textos.json (tira sumário, cabeçalho e número de página)
npm run validar    # regras de isenção: famílias, equilíbrio da lista inicial, pares, linguagem, cores
npm test           # testes da contagem
node scripts/versao.mjs 0.2   # troca o ?v= para furar cache a cada publicação
```

## Medição

Fase 1 (atual): desligada (`ENVIAR_CONTAGEM = false` em `js/config.js`). Na fase 2, totais anônimos por dia num Cloudflare Worker + D1, sem cookies nem identificadores.
