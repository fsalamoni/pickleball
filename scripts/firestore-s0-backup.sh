#!/usr/bin/env bash
# Helper seguro para o S0 (PITR + backup + export + restore test).
#
# Ele NÃO grava dados no repositório. O export do Firestore deve ir para um
# bucket GCS privado, idealmente em projeto/conta separada.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-antonov-82411}"
DATABASE_ID="${DATABASE_ID:-pickleball}"
RESTORE_DATABASE_ID="${RESTORE_DATABASE_ID:-pickleball-restore-teste}"
BACKUP_RETENTION="${BACKUP_RETENTION:-14w}"
EXPORT_BUCKET="${EXPORT_BUCKET:-}"
APPLY="${APPLY:-0}"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/firestore-s0-backup.sh plan
  bash scripts/firestore-s0-backup.sh verify
  APPLY=1 bash scripts/firestore-s0-backup.sh enable-pitr
  APPLY=1 bash scripts/firestore-s0-backup.sh create-schedule
  EXPORT_BUCKET=gs://bucket-privado APPLY=1 bash scripts/firestore-s0-backup.sh export
  SOURCE_BACKUP=projects/.../backups/... APPLY=1 bash scripts/firestore-s0-backup.sh restore-test

Variáveis:
  PROJECT_ID              padrão: antonov-82411 (o projeto Firebase real; "picklerush" é o site)
  DATABASE_ID             padrão: pickleball
  RESTORE_DATABASE_ID     padrão: pickleball-restore-teste
  BACKUP_RETENTION        padrão: 14w
  EXPORT_BUCKET           obrigatório só para "export"
  SOURCE_BACKUP           obrigatório só para "restore-test"
  APPLY=1                 executa; sem APPLY, imprime o comando

Nunca exporte para dentro do repositório. Use bucket GCS privado.
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Erro: comando '$1' não encontrado." >&2
    exit 1
  }
}

run_or_print() {
  if [[ "$APPLY" == "1" ]]; then
    echo "+ $*"
    "$@"
  else
    printf '%q ' "$@"
    echo
  fi
}

cmd="${1:-plan}"

case "$cmd" in
  plan)
    cat <<EOF
Plano S0 para Firestore:
1. Verificar banco:
   gcloud firestore databases describe --database="$DATABASE_ID" --project="$PROJECT_ID"
2. Ativar PITR:
   APPLY=1 bash scripts/firestore-s0-backup.sh enable-pitr
3. Criar backup agendado:
   APPLY=1 bash scripts/firestore-s0-backup.sh create-schedule
4. Export alternativo para bucket privado:
   EXPORT_BUCKET=gs://SEU-BUCKET-PRIVADO APPLY=1 bash scripts/firestore-s0-backup.sh export
5. Restaurar teste em banco NOVO:
   SOURCE_BACKUP=projects/.../backups/... APPLY=1 bash scripts/firestore-s0-backup.sh restore-test
6. Apagar o banco de restore quando terminar a conferência, pelo Console/GCloud.

Sem APPLY=1, este helper só imprime comandos.
EOF
    ;;
  verify)
    require_cmd gcloud
    run_or_print gcloud firestore databases describe \
      --database="$DATABASE_ID" \
      --project="$PROJECT_ID"
    run_or_print gcloud firestore backups schedules list \
      --database="$DATABASE_ID" \
      --project="$PROJECT_ID"
    ;;
  enable-pitr)
    require_cmd gcloud
    run_or_print gcloud firestore databases update \
      --database="$DATABASE_ID" \
      --project="$PROJECT_ID" \
      --enable-pitr
    ;;
  create-schedule)
    require_cmd gcloud
    run_or_print gcloud firestore backups schedules create \
      --database="$DATABASE_ID" \
      --project="$PROJECT_ID" \
      --recurrence=daily \
      --retention="$BACKUP_RETENTION"
    ;;
  export)
    require_cmd gcloud
    if [[ -z "$EXPORT_BUCKET" ]]; then
      echo "Erro: informe EXPORT_BUCKET=gs://bucket-privado." >&2
      exit 1
    fi
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    run_or_print gcloud firestore export "${EXPORT_BUCKET%/}/firestore-${DATABASE_ID}-${stamp}" \
      --database="$DATABASE_ID" \
      --project="$PROJECT_ID"
    ;;
  restore-test)
    require_cmd gcloud
    if [[ -z "${SOURCE_BACKUP:-}" ]]; then
      echo "Erro: informe SOURCE_BACKUP=projects/.../backups/..." >&2
      exit 1
    fi
    run_or_print gcloud firestore databases restore \
      --source-backup="$SOURCE_BACKUP" \
      --destination-database="$RESTORE_DATABASE_ID" \
      --project="$PROJECT_ID"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
