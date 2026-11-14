#!/usr/bin/env bash
# Apaga de PRODUÇÃO as Cloud Functions aposentadas, uma a uma, pelo NOME.
#
# O deploy por nome nunca apaga função: a que sai do código segue publicada na
# versão antiga e o painel "Funções no ar" a lista como "função antiga no ar".
# Apagar é decisão do DONO — cada nome da lista abaixo tem o OK dele, com a
# data. Nome novo só entra aqui com um OK novo.
#
# ⚠️ O projeto Firebase é COMPARTILHADO com outro aplicativo. Por isso uma
# função só é apagada quando as QUATRO condições valem:
#   1. o nome está na lista fechada abaixo;
#   2. o código NÃO a exporta (esperadas.txt) — se voltou ao código, não apaga;
#   3. ela está em sobrando.txt, que a vigilância monta só com funções da NOSSA
#      região e com o rótulo do NOSSO codebase;
#   4. o comando leva o nome e a região — nunca um apagar amplo.
#
# Rodar de novo não faz nada: quem já saiu não está mais em sobrando.txt.
# Nunca falha o job: o que não deu para apagar vira aviso e segue listado.
#
# ⚠️ O código de saída da CLI NÃO diz se apagou: `firebase functions:delete`
# imprime o erro e sai com 0. Só vale a linha "Successful delete operation" da
# própria função. 🐞 Na primeira execução (2026-11-14) a função agendada
# expireStaleNotifications ficou no ar e este script disse que tinha saído: a
# CLI apaga antes a tarefa agendada, que já não existia (404), e desiste da
# função. Nesse caso — e só nesse — a função sai direto pela API
# (scripts/functions-apagar-direto.cjs, que precisa de functions/node_modules).
#
# Uso (functions-watchdog.yml): bash scripts/functions-apagar-aposentadas.sh esperadas.txt sobrando.txt [publicadas.txt]
# Teste: src/core/guards/funcoesNoAr.test.js
set -uo pipefail

: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID não definido}"
: "${FUNCTIONS_REGION:?FUNCTIONS_REGION não definido}"
ESPERADAS="${1:?esperadas.txt}"
SOBRANDO="${2:?sobrando.txt}"
PUBLICADAS="${3:-}"

# OK do dono em 2026-11-13 (as duas já estavam paradas):
#  - expireStaleNotifications: aposentada em 2026-10-10; a tarefa agendada foi
#    apagada e a exportação saiu do código em 2026-11-05.
#  - federationDocumentsSync: trocada por uma função de nome novo no #322 (o
#    Firebase não deixa mudar o tipo de gatilho mantendo o nome).
APOSENTADAS="expireStaleNotifications federationDocumentsSync"
LOG=$(mktemp)

for NOME in $APOSENTADAS; do
  if grep -qxF "$NOME" "$ESPERADAS"; then
    echo "::warning title=Função aposentada voltou ao código::$NOME está exportada em functions/index.js; não foi apagada. Tire-a da lista de scripts/functions-apagar-aposentadas.sh."
    continue
  fi
  grep -qxF "$NOME" "$SOBRANDO" || continue
  echo "Apagando a função aposentada $NOME ($FUNCTIONS_REGION)..."
  firebase functions:delete "$NOME" --region "$FUNCTIONS_REGION" --project "$FIREBASE_PROJECT_ID" --force 2>&1 | tee "$LOG"
  LIMPO=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG")
  SAIU=""
  if echo "$LIMPO" | grep -qE "functions\[[A-Za-z0-9_-]+:${NOME}\(${FUNCTIONS_REGION}\)\] Successful delete operation"; then
    SAIU=1
  elif echo "$LIMPO" | grep -qE "cloudscheduler\.googleapis\.com/.*/jobs/firebase-schedule-${NOME}-.*HTTP Error: 404"; then
    echo "A tarefa agendada de $NOME já não existe e a CLI desistiu da função; apagando direto pela API."
    node scripts/functions-apagar-direto.cjs "$NOME" && SAIU=1
  fi
  if [ -n "$SAIU" ]; then
    # Sai das listas desta conferência, para o painel já mostrar a conta certa.
    sed -i "/^${NOME}\$/d" "$SOBRANDO"
    [ -n "$PUBLICADAS" ] && sed -i "/^${NOME}\$/d" "$PUBLICADAS"
    echo "::notice title=Função aposentada apagada::$NOME saiu de produção."
  else
    echo "::warning title=Não deu para apagar a função aposentada::$NOME segue publicada (veja o log); a próxima conferência tenta de novo."
  fi
done
exit 0
