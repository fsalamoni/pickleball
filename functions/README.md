# Cloud Functions — recálculo automático do ranking

Contém a função `recomputeRankingOnTournamentChange`: um gatilho do Firestore
(v2) que recalcula o ranking ELO **no servidor** sempre que um torneio passa a
ser (ou deixa de ser) elegível para o ranking — **público e encerrado**. Assim,
o fluxo "último resultado lançado → torneio encerra → ranking atualiza" acontece
sem depender de nenhum cliente aberto.

- Base Firestore: `pickleball` (nomeada, não a default).
- Região: `southamerica-east1`.
- A lógica de ELO/elegibilidade/assinatura espelha o cliente
  (`src/modules/rating/...`), então servidor e cliente produzem o mesmo ranking.
  O caminho client-side permanece como fallback e coopera pela mesma assinatura.

## Deploy

O deploy roda no workflow `Deploy Firebase Hosting` (passo "Deploy Cloud
Functions", não-fatal). Cloud Functions v2 exigem, além do plano **Blaze**:

1. **APIs habilitadas** no projeto:
   `cloudfunctions`, `cloudbuild`, `artifactregistry`, `run`, `eventarc`,
   `pubsub`.
2. **IAM** para a service account de deploy
   (`firebase-adminsdk-fbsvc@<PROJETO>.iam.gserviceaccount.com`):
   - `roles/iam.serviceAccountUser` **na** SA de runtime
     (`<PROJETO>@appspot.gserviceaccount.com`) — permissão `iam.serviceAccounts.ActAs`;
   - `roles/cloudfunctions.admin` e `roles/artifactregistry.admin` no projeto.

Exemplo (gcloud, trocando `SEU_PROJETO`):

```bash
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com \
  pubsub.googleapis.com --project SEU_PROJETO

gcloud iam service-accounts add-iam-policy-binding \
  SEU_PROJETO@appspot.gserviceaccount.com \
  --member="serviceAccount:firebase-adminsdk-fbsvc@SEU_PROJETO.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" --project SEU_PROJETO
```

Enquanto o deploy da função não estiver concluído, o ranking continua sendo
recalculado automaticamente pelo cliente do admin da plataforma (fallback).
