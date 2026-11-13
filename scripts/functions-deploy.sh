#!/usr/bin/env bash
# Publica SÓ as Cloud Functions do PickleRush, pelo NOME, dentro do codebase
# próprio. Usado pelo deploy (push em main) e pela vigilância (watchdog).
#
# ⚠️ O projeto Firebase é COMPARTILHADO com outro aplicativo. Duas camadas
# impedem que um deploy apague as funções do outro:
#
#   1. CODEBASE PRÓPRIO ("picklerush", em firebase.json). A CLI rotula cada
#      função com `firebase-functions-codebase=<codebase>` e, num deploy, só
#      considera "removidas" as funções DO MESMO codebase. Isso protege nos
#      DOIS sentidos: nós nunca tocamos nas funções do outro app, e o deploy
#      do outro app (codebase "default") deixa de enxergar as nossas.
#   2. POR NOME (`functions:picklerush:<nome>`): mesmo dentro do nosso
#      codebase, só cria/atualiza o que está listado — nada é apagado.
#
# A lista sai das exportações de functions/index.js. Lista VAZIA não publica
# nada: `--only` vazio voltaria a significar "tudo".
# Há teste travando isto: src/core/guards/deployFunctions.test.js
set -uo pipefail

: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID não definido}"

CODEBASE=$(jq -r '.functions[0].codebase // empty' firebase.json)
if [ -z "$CODEBASE" ] || [ "$CODEBASE" = "default" ]; then
  echo "::error title=Codebase das Functions::firebase.json precisa de um codebase PRÓPRIO (não \"default\"): é o que impede o deploy de outro app do mesmo projeto de apagar as nossas funções."
  exit 1
fi

FUNCS=$(grep -oE '^exports\.[A-Za-z0-9_]+' functions/index.js | sed "s/^exports\./functions:${CODEBASE}:/" | paste -sd, -)
if [ -z "$FUNCS" ]; then
  echo "::warning title=Nenhuma função listada::A lista de funções saiu vazia; nada foi publicado (de propósito)."
  exit 0
fi

# 🐞 No deploy do #423 UMA função de 131 falhou ("Unable to set the invoker for
# the IAM policy", passageiro) e o deploy inteiro foi dado como perdido. A CLI
# lista as que falharam ("<TAB>picklerush:nome(região)"): só ELAS são tentadas
# de novo, até duas vezes. Erro sem essa lista é do deploy inteiro (credencial,
# build, troca de tipo de gatilho) e repetir não ajuda.
LOG=$(mktemp)
FALHAS=""
for TENTATIVA in 1 2 3; do
  echo "Publicando (codebase ${CODEBASE}, tentativa ${TENTATIVA}): $FUNCS"
  firebase deploy --only "$FUNCS" --project "$FIREBASE_PROJECT_ID" --non-interactive 2>&1 | tee "$LOG"
  RC=${PIPESTATUS[0]}
  [ "$RC" -eq 0 ] && exit 0
  FALHAS=$(bash scripts/functions-deploy-falhas.sh "$CODEBASE" < "$LOG")
  [ -z "$FALHAS" ] && break
  # Nunca vazio aqui: `--only` vazio voltaria a significar "tudo".
  FUNCS=$(echo "$FALHAS" | sed "s/[^,]*/functions:${CODEBASE}:&/g")
  [ "$TENTATIVA" -lt 3 ] && { echo "Não subiram: $FALHAS. Nova tentativa em 60 s, só com elas."; sleep 60; }
done
# Quem chama (o deploy) lê esta linha para dizer QUAIS ficaram para trás.
[ -n "$FALHAS" ] && echo "FUNCOES_COM_FALHA=$FALHAS"
exit "$RC"
