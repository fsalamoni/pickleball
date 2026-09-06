# PATCH P0-01 — Escalação de privilégio em `users/{uid}`

> **NÃO APLICADO.** Correção pronta, com plano de validação. Aplicar exige
> decisão do dono da plataforma e teste no emulador antes do deploy.

## O achado
`allow update: if isOwner(userId)` permite ao próprio usuário escrever
`role: 'platform_admin'` no seu documento, e `isPlatformAdmin()` lê
exatamente esse campo. Ver `01-AUDITORIA-ACHADOS.md` § P0-01.

## Estratégia em duas etapas

**Etapa 1 (agora, 10 minutos)** — fechar o buraco nas regras, sem mexer em
código nenhum da aplicação. Resolve 100% da exploração.

**Etapa 2 (depois, ~1 PR)** — migrar a autorização para **custom claims**,
que é onde ela deveria estar: um claim no token não pode ser escrito pelo
cliente, e ainda economiza um `get()` por avaliação de regra.

---

## Etapa 1 — Patch nas regras

### Diff proposto em `firestore.rules`

```diff
     match /users/{userId} {
       allow read: if isOwner(userId) || isPlatformAdmin();
-      allow create: if isOwner(userId);
+      // O usuário cria o próprio documento no primeiro login. Só pode
+      // nascer como 'user' — a única exceção é o dono da plataforma, que é
+      // reconhecido pelo e-mail VERIFICADO no token (não por um campo que
+      // ele mesmo escreve). Mantém o bootstrap de FirebaseAuthContext.
+      allow create: if isOwner(userId)
+        && (
+          request.resource.data.get('role', 'user') == 'user'
+          || isPlatformOwnerEmail()
+        )
+        && (
+          request.resource.data.get('can_create_pools', false) == false
+          || isPlatformOwnerEmail()
+        );
+
       // O dono edita o próprio doc. O platform_admin pode alterar SOMENTE os
       // campos de moderação (ocultar/reexibir atleta — flag athlete_moderation),
       // sem tocar em nenhum outro dado do usuário.
-      allow update: if isOwner(userId)
+      // ⚠ SEGURANÇA: o dono NÃO pode alterar os campos que definem PODER
+      // (role, can_create_pools) nem os de moderação (hidden*). Sem isso,
+      // qualquer usuário se promove a platform_admin escrevendo no próprio
+      // documento — e a autorização da plataforma inteira depende de 'role'.
+      allow update: if (isOwner(userId)
+          && request.resource.data.get('role', 'user')
+               == resource.data.get('role', 'user')
+          && request.resource.data.get('can_create_pools', false)
+               == resource.data.get('can_create_pools', false)
+          && !request.resource.data.diff(resource.data).affectedKeys()
+                .hasAny(['hidden', 'hidden_at', 'hidden_by']))
+        // Bootstrap do dono da plataforma: o e-mail vem do token de
+        // autenticação, não de dado gravável pelo usuário.
+        || (isOwner(userId) && isPlatformOwnerEmail())
         || (isPlatformAdmin()
             && request.resource.data.diff(resource.data).affectedKeys()
                  .hasOnly(['hidden', 'hidden_at', 'hidden_by', 'updated_at']));
       allow delete: if isPlatformAdmin();
     }
```

### Por que isto não quebra nada

| Fluxo atual | Continua funcionando? | Por quê |
|---|---|---|
| Primeiro login de usuário comum (`FirebaseAuthContext.jsx:170` grava `role: 'user'`, `can_create_pools: false`) | ✅ | `role == 'user'` e `can_create_pools == false` passam no `create` |
| Primeiro login do dono (`role: 'platform_admin'`, `can_create_pools: true`) | ✅ | `isPlatformOwnerEmail()` libera |
| Re-login do dono (`FirebaseAuthContext.jsx:134` re-grava `role: 'platform_admin'`) | ✅ | ramo `isOwner && isPlatformOwnerEmail()` |
| Re-login de usuário comum (grava só `last_login`, `updated_at`) | ✅ | `role` inalterado → comparação de igualdade passa |
| Usuário edita o perfil (`/perfil/editar`) | ✅ | não toca em `role`/`can_create_pools`/`hidden*` |
| `athleteService.js:243` (`setDoc(users/{uid}, meta, {merge:true})`) | ✅ | grava metadados, não `role` |
| `coachService.js:57` (marca `is_coach`) | ✅ | idem |
| `V2AdminOwnerRestore.jsx:68` (restaura o próprio doc do dono) | ✅ | é o dono, `isPlatformOwnerEmail()` |
| Admin oculta/reexibe atleta (`setAthleteHidden`) | ✅ | ramo `isPlatformAdmin() && hasOnly([...])` já existia |
| **Usuário se promove a admin** | ❌ **bloqueado** | é exatamente o objetivo |

⚠ **Ponto de atenção**: `get('role','user') == resource.data.get('role','user')`
compara com o valor **já gravado**. Documentos legados sem o campo `role`
usam o default `'user'` nos dois lados — passa. Confirmado que
`FirebaseAuthContext` sempre grava `role` na criação, então documentos sem
o campo só existiriam por carga manual.

### Validação obrigatória antes do deploy

```bash
# 1. sintaxe e compilação das regras
npx firebase deploy --only firestore:rules --project <id> --dry-run

# 2. emulador: as 12 asserções abaixo
npx firebase emulators:exec --only firestore \
  "npx vitest run tests/rules/users.rules.test.js"
```

Asserções mínimas:
1. usuário comum cria o próprio doc com `role:'user'` → **permitido**
2. usuário comum cria o próprio doc com `role:'platform_admin'` → **negado**
3. usuário comum cria com `can_create_pools:true` → **negado**
4. usuário comum atualiza `platform_name` → **permitido**
5. usuário comum atualiza `role` para `'platform_admin'` → **negado** ⭐
6. usuário comum atualiza `can_create_pools` → **negado**
7. usuário comum atualiza `hidden` → **negado**
8. usuário comum atualiza doc de outro → **negado**
9. dono (token com o e-mail) cria com `role:'platform_admin'` → **permitido**
10. dono re-grava `role:'platform_admin'` no próprio doc → **permitido**
11. admin altera só `hidden` de outro usuário → **permitido**
12. admin altera `phone` de outro usuário → **negado** (já era assim)

### Plano de rollback
A alteração é uma única regra. Rollback = redeploy do `firestore.rules`
anterior (`git revert` + `firebase deploy --only firestore:rules`), ~2 min.
Guardar a versão atual antes: `cp firestore.rules firestore.rules.bak`.

### Verificação pós-deploy (obrigatória)
1. Login com conta comum → perfil abre, editar perfil salva.
2. Login do dono → painel admin acessível.
3. No console do navegador, com conta comum, tentar
   `updateDoc(doc(db,'users',uid),{role:'platform_admin'})` → deve dar
   `permission-denied`.

---

## Etapa 1b — Verificar se alguém já explorou

**Antes** de aplicar o patch, listar quem tem `role == 'platform_admin'`
hoje. Se houver algum uid além do dono, é incidente e entra no fluxo de
`12-INCIDENTES.md`.

```js
// Cloud Shell / script com Admin SDK — NÃO rodar no cliente
const snap = await db.collection('users')
  .where('role', '==', 'platform_admin').get();
snap.forEach(d => console.log(d.id, d.data().email, d.data().created_at));
```

Cruzar com `audit_logs` para ver se houve ação administrativa não
reconhecida.

---

## Etapa 2 — Migrar para custom claims (1 PR, depois)

A Etapa 1 fecha o buraco. A Etapa 2 é o desenho correto.

1. Cloud Function `setPlatformRole` (`onCall`, só chamável por quem já tem
   o claim, com bootstrap manual do primeiro admin via Admin SDK):
   ```js
   await admin.auth().setCustomUserClaims(uid, { platform_admin: true });
   ```
2. Regras passam a ler o token, sem `get()`:
   ```javascript
   function isPlatformAdmin() {
     return isAuthed() && request.auth.token.get('platform_admin', false) == true;
   }
   ```
3. Manter, por um ciclo, o fallback ao campo `role` (as Functions já fazem
   isso — `functions/index.js:551-556`), depois remover.
4. `users.role` vira **espelho somente-leitura** para exibição, escrito só
   pela Function.

Ganhos: impossível de forjar pelo cliente; −1 leitura de documento em cada
avaliação de regra que use `isPlatformAdmin()` (dezenas por sessão); revogação
imediata via token; base pronta para papéis mais granulares
(`04-CONTROLE-DE-ACESSO.md`).
