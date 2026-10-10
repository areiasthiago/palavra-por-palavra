#!/usr/bin/env bash
# Extrai o texto dos planos de governo (uma página por form feed) para data/fontes/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/fontes
pdftotext -enc UTF-8 refs/32ce89_programa_governo_lula_2026.pdf data/fontes/lula.txt
pdftotext -enc UTF-8 refs/FLAVIO-BOLSONARO-PARA-O-BRASIL-VENCER-O-ATRASO-1-1.pdf data/fontes/flavio.txt
# Depois: node scripts/montar.mjs
