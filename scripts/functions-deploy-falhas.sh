#!/usr/bin/env bash
# Lê o log de um `firebase deploy` (stdin) e devolve, separadas por vírgula, as
# funções do codebase que NÃO subiram. Dois modos:
#
# 1) Só o codebase: as que a CLI listou como falhas.
#
#      Functions deploy had errors with the following functions:
#      <TAB>picklerush:tournamentScheduleWorker(southamerica-east1)
#
#    Vazio = a CLI não apontou função nenhuma (o erro é do deploy inteiro).
#
# 2) Codebase + as funções PEDIDAS (a,b,c): as pedidas que ficaram sem a linha
#    de confirmação ("Successful create/update operation" ou "Skipped"). É para
#    o deploy que a CLI dá como certo (código 0) sem ter terminado.
#    Vazio = todas confirmadas, OU nenhuma linha de confirmação no log inteiro
#    (o formato da CLI mudou: sem como conferir, vale o código de saída).
#
# Uso: bash scripts/functions-deploy-falhas.sh <codebase> [pedidas] < log
# Teste: src/core/guards/funcoesNoAr.test.js
set -u
CODEBASE="${1:?codebase}"
PEDIDAS="${2:-}"
LIMPO=$(sed 's/\x1b\[[0-9;]*m//g')

if [ -n "$PEDIDAS" ]; then
  OK=$(echo "$LIMPO" \
    | grep -oE "functions\[${CODEBASE}:[A-Za-z0-9_]+\([a-z0-9-]+\)\] (Successful (create|update) operation|Skipped)" \
    | sed -E "s/^functions\[${CODEBASE}://; s/\(.*//" \
    | sort -u)
  [ -z "$OK" ] && exit 0
  comm -23 <(echo "$PEDIDAS" | tr ',' '\n' | sort -u) <(echo "$OK") | paste -sd, -
  exit 0
fi

echo "$LIMPO" \
  | grep -oE "^[[:space:]]+${CODEBASE}:[A-Za-z0-9_]+\(" \
  | grep -oE '[A-Za-z0-9_]+\($' \
  | tr -d '(' \
  | sort -u \
  | paste -sd, -
exit 0
