# PATCH P0-02 — E-mail e gênero dos inscritos, públicos sem login

> **NÃO APLICADO.** Este é o patch mais delicado dos dois: envolve migração
> de dados existentes. Leia inteiro antes de executar qualquer passo.

## O achado
`tournament_registrations` é `allow read: if true` e guarda
`player_a_email`, `player_a_email_lc`, `player_b_email`, `player_b_email_lc`
e `competition_gender`. Ver `01-AUDITORIA-ACHADOS.md` § P0-02.

## Por que a coleção é pública (e precisa continuar sendo)

O comentário na própria regra explica, e o motivo é legítimo:

> `listMyRegistrations` faz 3 queries paralelas com
> `where(user_id | player_a_user_id | player_b_user_id)` — cada doc
> disparava `isTournamentVisibleByTid` e batia o limite de 20 lookups/query
> → `permission-denied`.

Além disso o **quadro do torneio é público por design** (espectador vê a
chave sem login). Fechar a leitura quebraria as duas coisas.

**Portanto: a solução não é fechar a coleção. É tirar o dado pessoal de
dentro dela.**

## Para que serve cada campo de e-mail (não remover às cegas)

`registrationService.js` usa os e-mails para o fluxo de **inscrição
provisória**: o organizador inscreve alguém que ainda não tem conta, pelo
e-mail; quando a pessoa se cadastra, `claimProvisionalRegistrationsForUser`
(chamado no login, `FirebaseAuthContext.jsx:143`) casa o e-mail e vincula a
inscrição ao uid.

- `player_a_email` / `player_b_email` — e-mail informado
- `player_a_email_lc` / `player_b_email_lc` — mesma coisa, para busca
  case-insensitive no *claim*
- `player_a_provisional` — booleano derivado

O *claim* roda **no cliente, com o usuário já autenticado**, comparando com
o próprio e-mail. Ou seja: **não precisa de leitura pública** — precisa de
leitura autenticada com uma query por e-mail.

## Solução em 3 partes

### Parte 1 — Subcoleção privada para o contato

```
tournament_registrations/{rid}                    ← público (quadro), SEM e-mail
tournament_registrations/{rid}/private/contact    ← restrito
```

`private/contact`:
```js
{ player_a_email, player_a_email_lc,
  player_b_email, player_b_email_lc,
  updated_at }
```

Regra nova (aditiva):
```javascript
match /tournament_registrations/{rid} {
  allow read: if true;          // inalterado — quadro público
  // ... create/update/delete inalterados ...

  match /private/{docId} {
    // Só quem tem relação com a inscrição, o organizador ou o admin.
    allow read: if isAuthed() && (
      isPlatformAdmin()
      || isTournamentAdmin(get(/databases/$(database)/documents/
           tournament_registrations/$(rid)).data.tournament_id)
      || get(/databases/$(database)/documents/
           tournament_registrations/$(rid)).data.player_a_user_id == request.auth.uid
      || get(/databases/$(database)/documents/
           tournament_registrations/$(rid)).data.player_b_user_id == request.auth.uid
      || get(/databases/$(database)/documents/
           tournament_registrations/$(rid)).data.created_by == request.auth.uid
    );
    allow write: if isAuthed() && (
      isPlatformAdmin()
      || isTournamentAdmin(get(/databases/$(database)/documents/
           tournament_registrations/$(rid)).data.tournament_id)
    );
  }
}
```

### Parte 2 — Coleção de índice para o *claim* provisório

O *claim* precisa achar inscrições **por e-mail**, e o usuário que faz o
claim ainda não está vinculado à inscrição — então não pode ler a
subcoleção privada. Coleção dedicada, com leitura restrita ao **próprio
e-mail do token**:

```
provisional_claims/{emailHash}_{rid}
{ email_lc, email_hash, registration_id, tournament_id,
  slot: 'a'|'b', claimed: false, claimed_by: null, created_at }
```

```javascript
match /provisional_claims/{claimId} {
  // O usuário só enxerga as entradas do PRÓPRIO e-mail (do token, não de
  // um campo gravável). Sem varredura da base.
  allow read: if isAuthed()
    && resource.data.email_lc == request.auth.token.email.lower();
  allow create, update: if isAuthed() && (
    isPlatformAdmin()
    || isTournamentAdmin(request.resource.data.tournament_id));
  // O titular marca como reivindicada ao vincular.
  allow update: if isAuthed()
    && resource.data.email_lc == request.auth.token.email.lower()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['claimed','claimed_by','claimed_at']);
  allow delete: if isPlatformAdmin();
}
```

Índice novo: `provisional_claims: [email_lc ASC, claimed ASC]`.

> ⚠ `request.auth.token.email` só existe quando o provedor fornece e-mail.
> Para login por telefone ou provedor sem e-mail, o claim não se aplica —
> o comportamento é o mesmo de hoje (a inscrição fica provisória). Validar
> no emulador com um token **sem** e-mail para garantir que não quebra.

### Parte 3 — Migração dos documentos existentes

**Este é o passo com risco. Executar em janela de baixo tráfego, com
backup feito.**

```
0. PRÉ-REQUISITO: PITR habilitado + export completo do Firestore (P2-03).
   Sem backup, não executar.

1. Cloud Function/script (Admin SDK), em modo DRY-RUN primeiro:
   para cada tournament_registrations:
     a) se tem player_a_email ou player_b_email:
        - cria {rid}/private/contact com os 4 campos
        - se provisional, cria provisional_claims/{hash}_{rid}
     b) NÃO apaga nada ainda
   → relatório: quantos docs, quantos e-mails, quantos provisórios

2. Rodar de verdade (idempotente: reexecutar não duplica).

3. Deploy do código que LÊ do novo lugar, mantendo fallback ao campo antigo.
   Rodar 7 dias. Monitorar erro de permissão e falha de claim.

4. Só então: segundo script apaga os 4 campos de e-mail dos documentos
   públicos (FieldValue.delete()), em lotes de 400, com log.

5. Deploy do código sem o fallback.
```

**Nunca fazer 3 e 4 no mesmo deploy.** Se o passo 4 vier antes de o código
novo estar em produção e estável, o fluxo de inscrição provisória quebra
para todo mundo.

### Parte 4 — `competition_gender`

Diferente do e-mail: o gênero **é usado no quadro público** (modalidades
masculina/feminina são filtradas por ele). Remover quebraria o sorteio.

**Decisão recomendada**: manter no documento público, porque (a) já é
público na modalidade em que a pessoa se inscreveu — inscrever-se em
"Dupla Masculina" já revela a categoria; (b) é categoria **competitiva**,
não identidade de gênero declarada.
**Mas**: documentar isso na Política de Privacidade (`07-DOCUMENTOS-LEGAIS.md`)
como dado publicado por decorrência da inscrição, e não coletar identidade
de gênero separada da categoria competitiva.

## Custo/benefício

| | Sem o patch | Com o patch |
|---|---|---|
| Quadro público do torneio | funciona | funciona (inalterado) |
| `listMyRegistrations` | funciona | funciona (inalterado) |
| Inscrição provisória | funciona | funciona (1 query a mais, indexada) |
| E-mails expostos na internet | **todos** | nenhum |
| Esforço | — | ~1 PR + 1 migração cuidadosa |

## Mitigação imediata (se o patch completo demorar)

Enquanto a migração não acontece, uma medida de 5 minutos reduz muito a
exposição **de dados novos**: parar de gravar o e-mail no documento público
para inscrições **novas**, escrevendo só na subcoleção privada. Os
documentos antigos continuam expostos até o passo 4, mas o vazamento para
de crescer.
