# 03-WORKFLOW — Git, deploy, GitHub, Firebase

> **Quando usar**: antes de criar branch, fazer commit, abrir PR, mergear,
> deployar, ou debugar problema de deploy. Se você não segue este fluxo,
> vai acabar deployando branch errada, perdendo trabalho, ou quebrando
> produção.
>
> Complementa `docs/02-STANDARDS.md` (como codar) e `CLAUDE.md` (visão
> geral).

---

## 1. Regra de ouro: 1 worktree por feature

**NUNCA** trabalhe direto em `main`. **NUNCA** use branch de long-lived
sem remover e recriar de `origin/main`.

### 1.1 Por quê

- Permite múltiplas features em paralelo (você + IAs paralelas)
- Permite squash merge limpo (branch nova = 1 feature)
- Permite rollback fácil (deletar branch = feature some)
- Evita conflito com `main` que pode ter mudado

### 1.2 Como criar

```bash
# SEMPRE partir de origin/main atualizado
cd /workspace/pickleball
git fetch origin
git checkout main
git pull origin main

# Criar worktree nova a partir de origin/main
git worktree add ../picklerush-feat-minha-feature -b feat/minha-feature origin/main

# Trabalhar lá
cd ../picklerush-feat-minha-feature
```

### 1.3 Quando terminar

```bash
# Antes de commitar: lint, build, test
npm run lint
npm run build
npm test

# Commitar
git add .
git commit -m "feat(X): descrição concisa (#PR)"

# Push da branch
git push -u origin feat/minha-feature

# Abrir PR no GitHub
gh pr create --base main --title "feat(X): descrição" --body "..."

# Após merge:
cd /workspace/pickleball
git worktree remove ../picklerush-feat-minha-feature
git branch -D feat/minha-feature
git fetch origin
```

### 1.4 Em ambiente com 1 só clone

Se não pode usar worktree (CI, container simples):

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b feat/minha-feature
# ... trabalhar ...
git push -u origin feat/minha-feature
# PR
# Após merge, deletar branch local e remoto:
git branch -D feat/minha-feature
git push origin --delete feat/minha-feature
```

---

## 2. Commits

### 2.1 Conventional Commits

```
<type>(<scope>): <description> (#PR)

<optional body>

<optional footer>
```

**Types:**
- `feat` — feature nova
- `fix` — bug fix
- `docs` — só documentação
- `refactor` — refactor sem mudança de comportamento
- `test` — só testes
- `chore` — manutenção (deps, config, scripts)
- `perf` — performance
- `style` — formatação (não deve aparecer se lint passa)

**Scopes comuns:**
- `arenas`, `tournament`, `coaches`, `clubs`, `notifications`, `admin`
- `v2-layout`, `v2-arena-detail`
- `flags`, `pwa`, `firestore-rules`
- `docs` (escopo geral de doc)

**Exemplos bons:**
```
feat(arenas): add V2DaySlotsDialog with reservation info (sw-v73.6)
fix(v2-arena-detail): import Calendar/Check/Copy from lucide (sw-v73.4)
docs(readme): update feature flags count to 124
refactor(coaches): extract clinic validation to domain
test(arenas): add court_assignment.test.js (8 tests)
chore(deps): bump firebase to 12.x
```

**Exemplos ruins:**
```
wip
fix bug
mudanças
atualização
```

### 2.2 Tamanho

- **1 commit por mudança lógica** (não amontoa)
- Mas também não exagere (1 fix de typo = 1 commit)
- Típico: 3-10 commits por feature
- Squash merge no PR → 1 commit em main

### 2.3 Mensagem do body (quando precisar)

```
feat(arenas): add V2DaySlotsDialog with reservation info

Resolve user request for better visibility of daily bookings.
- Show pending (amber badge) and confirmed (red badge) counts
- Tooltip rich per day
- Filter by court_id respects selected court

Refs: 13-arena-refino.md, 15-backlog-remanescente.md
```

### 2.4 Antes de commitar

```bash
npm run lint       # 0 errors esperado
npm run build      # sem warnings críticos
npm test           # tudo verde
```

Se algum falhou, **NÃO faça o commit**. Volte, arrume.

---

## 3. Pull Requests

### 3.1 Estrutura de uma boa PR

**Título:**
```
feat(arenas): V2DaySlotsDialog com info de reservas + badges (sw-v73.6)
```

**Descrição (use esse template):**

```markdown
## O que
[1-2 frases: o que essa PR faz]

## Por que
[1-2 frases: por que estamos fazendo, qual problema resolve]

Refs: #issue, docs/15-backlog-remanescente.md §X

## Como testar
1. [passo 1]
2. [passo 2]
3. [resultado esperado]

## Screenshots / vídeos
[anexe se for UI — use `gh pr attach` ou arraste no GitHub]

## Checklist
- [x] Lint passa
- [x] Build passa
- [x] Tests passam (+N novos)
- [x] Smoke test manual
- [x] Docs atualizadas (01-AI-CONTEXT, 05-DATA-MODEL, 06-MODULES, 15-backlog)
- [x] Feature flag criada/validada
- [x] Bundle grep (se importou lib nova)
```

### 3.2 Tamanho

- **Ideal**: < 500 linhas diff
- **Aceitável**: 500-1500 linhas
- **Grande**: > 1500 linhas — considerar quebrar em PRs

### 3.3 Review

- **Você mesmo revisa** (IA pode fazer self-review via `gh pr view` + tools)
- **Aprova** quando lint+build+test+smoke+docs ok
- **Squash merge** (botão do GitHub) — mantém main linear
- **Delete branch** após merge (botão do GitHub)

### 3.4 Convenção de merge

**SEMPRE squash merge.** Nunca "merge commit" ou "rebase merge" —
mantém main com 1 commit por feature.

### 3.5 Comandos úteis

```bash
# Criar PR (se gh CLI instalado)
gh pr create --base main --title "..." --body "..."

# Ver PRs abertas
gh pr list

# Ver checks de uma PR
gh pr checks <num>

# Aprovar e mergear
gh pr merge <num> --squash --delete-branch
```

---

## 4. Deploy

### 4.1 Fluxo automático (recomendado)

```
push em main
  ↓
GitHub Actions: .github/workflows/deploy-firebase.yml
  ↓
1. Validate required secrets
2. Install dependencies
3. Install Firebase CLI
4. Write service account credentials
5. Ensure Firestore database "pickleball" exists (cria se faltar)
6. Ensure Hosting sites exist (cria se faltar — picklerush + pickletour)
7. Build (vite build → dist/)
8. Deploy:
   - firebase deploy --only hosting,firestore:rules,firestore:indexes
   - firebase deploy --only functions (recomputeRankingOnTournamentChange)
  ↓
✅ Site atualizado em https://picklerush.web.app
```

**Tempo típico**: 2-4 minutos.

### 4.2 Verificar após deploy

```bash
# Ver último run
gh run list --workflow=deploy-firebase.yml --limit=1

# Ver detalhes de um run
gh run view <run-id>

# Ver logs
gh run view <run-id> --log
```

Ou no GitHub: **Actions** tab → último workflow → verificar verde.

### 4.3 Quando o deploy quebra

| Erro | Causa comum | Solução |
|---|---|---|
| `Missing secret: VITE_FIREBASE_*` | Secret não configurado | Adicionar em Settings → Secrets → Actions |
| `FIREBASE_SERVICE_ACCOUNT is not valid JSON` | Service account mal-formatado | Re-extrair do Firebase Console |
| `Service account project mismatch` | SA de outro projeto | Recriar SA no projeto correto |
| `Missing IAM permission for Firestore database create` | SA sem `Firebase Admin` role | Adicionar role OU criar DB manualmente |
| `Hosting site not found` | Site não existe | O workflow cria automaticamente, mas precisa de permissão |
| `Build failed` | Erro de import/sintaxe | Rodar `npm run build` local, ver erro |
| `Lint errors` | ESLint quebrou | Rodar `npm run lint`, ver warnings |
| `Tests failed` | Algum teste quebrou | Rodar `npm test`, ver qual |

### 4.4 Deploy manual (emergência)

**Use com cuidado.** Deploy manual pula o CI.

```bash
cd /workspace/pickleball
# Autenticar
firebase login
# Build
npm run build
# Deploy
firebase deploy --only hosting
# OU tudo:
firebase deploy
```

### 4.5 Rollback

Se um deploy quebrou produção:

**Opção A — Reverter o merge no GitHub (rápido):**
```
GitHub → PR do merge → "Revert" → cria PR de revert → merge → deploy sai
```

**Opção B — Reverter o commit manualmente:**
```bash
git checkout main
git pull
git revert <commit-sha>
git push origin main
# deploy sai
```

**Opção C — Firebase Hosting CLI (instantâneo):**
```bash
firebase hosting:clone picklerush:<versão-anterior> picklerush:live
```

### 4.6 PWA / Service Worker

Toda mudança de UI **DEVE** bumpar `sw-vN.js`:

```js
// src/core/pwa/registerPwa.js
const SW_VERSION = 'sw-v74.js';  // ⬅️ bumpar
```

**Auto-unregister de SWs stale**: sempre, independente de `PWA_ENABLED`.
Lógica em helper separado (não early-return).

**Reload deferido**: NUNCA `window.location.reload()` durante interação
do user. Track via sessionStorage + 5s janela de idle.

```js
const lastActivity = Number(sessionStorage.getItem('pwa-stale-last-activity') || '0');
const isInteracting = (Date.now() - lastActivity) < 5000;
if (isInteracting) {
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      window.location.reload();
    }
  }, 5000);
} else {
  setTimeout(() => { window.location.reload(); }, 50);
}
```

Track em: `keydown`, `mousedown`, `touchstart`, `pointerdown`, `scroll`, `input`, `change`.

---

## 5. Branches e tags

### 5.1 Branches

- `main` — produção. **Push direto NUNCA.** Sempre via PR + merge.
- `feat/X` — feature em desenvolvimento
- `fix/X` — bug fix
- `docs/X` — só docs
- `refactor/X` — refactor
- `test/X` — só testes
- `chore/X` — manutenção
- Branches devem ser **deletadas após merge** (botão do GitHub)

### 5.2 Tags

- Não estamos usando tags formais. `git log` é o histórico.
- Se precisar marcar release: `git tag v1.0.0 <sha> && git push --tags`

---

## 6. Hotfix de emergência (produção quebrada)

**Use SÓ em emergência real** (produção fora do ar, bug crítico visível).

```bash
# 1. Identificar
#    - usuário reportou
#    - monitoramento (Sentry, logs)
#    - smoke test próprio

# 2. Criar branch de hotfix
git fetch origin
git checkout main
git pull origin main
git checkout -b fix/emergencia-X

# 3. Fazer o fix MÍNIMO necessário
#    - 1 commit idealmente
#    - sem refactor
#    - sem feature extra

# 4. Validar
npm run lint
npm run build
npm test

# 5. PR
gh pr create --base main --title "fix: emergência X" --body "..."

# 6. Self-review + merge + deploy sai
```

**NÃO é hotfix**:
- Adicionar feature "porque tá em hotfix" — vai pra próxima sprint
- Refactor "enquanto tá com a mão na massa" — vai pra próxima PR
- Mudar config grande — vai pra sprint

---

## 7. Debug de produção

### 7.1 Ordem de diagnóstico

Quando user reporta "feature X não funciona":

```
1. Bundle deployed
   └─ curl -s https://picklerush.web.app/ | grep "index-" 
   └─ Tem o bundle novo? Se não, é cache do SW

2. Build local
   └─ npm run build
   └─ Funciona? Se não, é erro de import/sintaxe

3. Tests
   └─ npm test
   └─ Tudo verde? Se não, é regressão

4. Playwright (E2E)
   └─ npm run e2e
   └─ Algum falha? Se sim, é fluxo específico

5. Feature flag
   └─ Logar como admin → /admin/console
   └─ A flag tá ON? Default no Firestore? Migração rodou?

6. Firestore rule
   └─ Firebase Console → Firestore → Rules
   └─ Testar a regra no simulador
   └─ Verificar se há regra negando acesso

7. Service / Hook
   └─ Console do browser → network tab
   └─ Chamou Firestore? Voltou com dados? Erro 403/404?
```

### 7.2 Auth injetada (Playwright)

Bugs que só aparecem logado precisam de auth no E2E:

```js
// 1. Criar user via signUp REST
const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
  method: 'POST',
  body: JSON.stringify({ email: 'test@picklerush.com', password: 'Test123!', returnSecureToken: true }),
});

// 2. PATCH role via Firestore
await fetch(`https://firestore.googleapis.com/v1/projects/pickletour/databases/pickleball/documents/users/${uid}`, {
  method: 'PATCH',
  body: JSON.stringify({ fields: { role: { stringValue: 'platform_admin' } } }),
});

// 3. IndexedDB injection (NÃO `firebase:authUser:...`)
//    Injetar em `firebaseLocalStorageDb` que é o que o SDK lê
```

### 7.3 Investigar bug "já foi deployado mas não funciona"

```bash
# 1. Confirmar bundle deployed
curl -s https://picklerush.web.app/assets/index-XXX.js | head -c 200

# 2. Procurar o código novo no bundle
curl -s https://picklerush.web.app/assets/index-XXX.js | grep -c "novoCodigo"

# 3. Se não tem, é bundle antigo (cache de SW)
# 4. Se tem mas não funciona, é runtime (erro JS)
# 5. Abrir DevTools → console → network → ver o que tá acontecendo
```

---

## 8. Bundle verification

### 8.1 Antes de mergear

```bash
# 1. Build
npm run build

# 2. Ver tamanho do bundle
ls -la dist/assets/

# 3. Verificar que código novo está no bundle
grep -c "novoCodigo" dist/assets/index-*.js

# 4. Se importou lib nova, ela tá no bundle?
grep -c "nomeDaLib" dist/assets/index-*.js
```

### 8.2 Code splitting

- Componentes > 30KB devem ser `lazy(() => import(...))`
- Routes são auto-lazy via React Router
- Componentes auxiliares: lazy quando fizer sentido

### 8.3 Tree shaking

- Imports **explícitos** com `import { X } from 'lib'`
- **NÃO** `import * as X from 'lib'` (perde tree-shake)
- **NÃO** `import X from 'lib/X'` direto se X tem mais exports (importa tudo)

---

## 9. Firebase specifics

### 9.1 Database ID

**SEMPRE `pickleball`** (named database, não `(default)`).

```js
import { getFirestore } from 'firebase/firestore';
import { app } from './config/firebase';

export const db = getFirestore(app, 'pickleball');
```

### 9.2 Region

**Cloud Functions: `southamerica-east1`** (São Paulo).

```js
// functions/index.js
exports.recomputeRankingOnTournamentChange = functions
  .region('southamerica-east1')
  .firestore.document('tournaments/{id}')
  .onWrite(async (change, context) => { /* ... */ });
```

### 9.3 Hosting sites

- `picklerush` — site ativo (`picklerush.web.app` e domínio custom)
- `pickletour` — legacy, redirect-only 301 → picklerush

### 9.4 Storage

- Bucket: `picklerush.appspot.com` (default)
- Upload via `storageService.js`
- Regras em `storage.rules`

### 9.5 Cloud Functions deploy

O workflow `.github/workflows/deploy-firebase.yml` faz deploy automático
em todo push em main. **NÃO** faça `firebase deploy --only functions` local
em produção (vai deployar com a sua config, não a do CI).

### 9.6 Emulators (dev local)

```bash
# Inicia Firestore + Auth + Functions emuladores
firebase emulators:start

# UI em http://localhost:4000
```

Útil pra testar regras sem deploy.

### 9.7 Backup e restore

Não temos backup automatizado. Firestore tem export manual via Console.

---

## 10. GitHub Actions secrets

Para o workflow de deploy funcionar, estes secrets DEVEM estar configurados
em **Settings → Secrets and variables → Actions**:

| Secret | Origem | Obrigatório |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project settings | Sim |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Console | Sim |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Console | Sim |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Console | Sim |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | Sim |
| `VITE_FIREBASE_APP_ID` | Firebase Console | Sim |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Console | Não (analytics) |
| `FIREBASE_SERVICE_ACCOUNT` | Service Account JSON completo | Sim |
| `FIREBASE_PROJECT_ID` | Id do projeto Firebase | Sim |

**Adicionar/rotacionar secret**:
1. Firebase Console → Project settings → Service accounts → Generate new private key
2. Copiar JSON inteiro
3. GitHub repo → Settings → Secrets and variables → Actions → New repository secret
4. Name: `FIREBASE_SERVICE_ACCOUNT`, Value: colar o JSON

---

## 11. Comandos úteis (cola)

```bash
# === Git ===
git status
git diff
git log --oneline -10
git fetch origin
git pull origin main
git checkout -b feat/X
git add .
git commit -m "feat(X): descrição"
git push -u origin feat/X
git worktree add ../path -b branch origin/main
git worktree remove ../path

# === Build / test ===
npm run dev          # dev server (5173)
npm run build        # build prod
npm test             # vitest
npm run lint         # eslint --quiet
npm run typecheck    # JSDoc check
npm run e2e          # playwright
npm run e2e:install  # primeira vez

# === Firebase ===
firebase login
firebase deploy
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase emulators:start

# === Diagnóstico ===
curl -s https://picklerush.web.app/ | grep "index-"
curl -s https://picklerush.web.app/assets/index-XXX.js | grep -c "novoCodigo"
gh run list --workflow=deploy-firebase.yml --limit=5
gh pr list
gh pr checks <num>
```

---

## 12. Resumo (cola rápida)

```
WORKTREE  1 worktree por feature, remove após merge
BRANCH    feat/X, fix/X, docs/X, refactor/X
COMMIT    conventional commits (feat/fix/docs/refactor)
PR        self-review + squash merge + delete branch
DEPLOY    push main → GitHub Actions → firebase hosting
VERIFY    smoke test manual + bundle grep
HOTFIX    fix/X → PR → merge (mesmo que feature)
DEBUG     bundle → build → test → e2e → flag → rule → service
PWA       bump sw-vN.js; auto-unregister; reload deferido
SECRETS   FIREBASE_SERVICE_ACCOUNT + VITE_FIREBASE_* no GitHub
```

> **Última atualização**: 2026-07-24. Mudou o fluxo? Atualize este doc
> **e** o `CLAUDE.md` §6-§7 e a memory do agente.
