#!/usr/bin/env bash
# Lê o log de um `firebase deploy` (stdin) e devolve, separadas por vírgula, as
# funções do codebase que a CLI listou como falhas:
#
#   Functions deploy had errors with the following functions:
#   <TAB>picklerush:tournamentScheduleWorker(southamerica-east1)
#
# Vazio = a CLI não apontou função nenhuma (o erro é do deploy inteiro).
# Uso: bash scripts/functions-deploy-falhas.sh <codebase> < log
# Teste: src/core/guards/funcoesNoAr.test.js
set -u
CODEBASE="${1:?codebase}"
sed 's/\x1b\[[0-9;]*m//g' \
  | grep -oE "^[[:space:]]+${CODEBASE}:[A-Za-z0-9_]+\(" \
  | grep -oE '[A-Za-z0-9_]+\($' \
  | tr -d '(' \
  | sort -u \
  | paste -sd, -
exit 0
