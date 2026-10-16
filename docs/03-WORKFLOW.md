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
npm run security:secrets     # nenhum segredo/chave/dump no Git
npm run docs:inventario      # regenera docs/46-INVENTARIO.md (e comite o resultado)
npm run lint                 # 0 errors esperado
npm test                     # tudo verde
npm run build && npm run build:budget   # build + orçamento do pacote inicial
npm run test:rules           # se tocou firestore.rules / storage.rules (precisa de Java)
```

Se algum falhou, **NÃO faça o commit**. Volte, arrume. A **documentação** do que
você mexeu entra no mesmo PR (`docs/02-STANDARDS.md` §15): o CI reprova sem ela.

---

## 3. Pull Requests

### 3.1 Estrutura de uma boa PR

**Título:** Conventional Commits, ex.: `feat(arenas): calendário com horas-quadra livres`.

**Descrição:** parta do template `.github/pull_request_template.md` (Resumo,
Validação, Segurança e dados, Observações) e acrescente o que o template não
cobre:

```markdown
## O que / Por que
[1-2 frases cada. Cite o pedido e o doc do assunto.]

## Como testar
1. [passo]  2. [passo]  3. [resultado esperado]

## Screenshots / vídeos
[se for UI, claro e escuro, celular e desktop]

## Checklist
- [x] security:secrets, lint, test, build, build:budget
- [x] test:rules (se tocou regras)
- [x] Flag criada/validada (default OFF) — ou "não aplicável"
- [x] Docs atualizadas: doc do assunto, README do módulo, CLAUDE.md se mudou o mapa,
      e `npm run docs:inventario` rodado
- [x] Texto novo em t()/tk() com en e es

Docs: não se aplica — <motivo>   ← SÓ se nada muda para quem lê a documentação
```

**Documentação no PR.** O job `docs-obrigatorios` do CI reprova o PR que muda
código de produto sem tocar em nenhum doc. A isenção é uma linha no CORPO do PR:
`Docs: não se aplica — <motivo>` (motivo obrigatório, com sentido: "refator
interno sem mudança de comportamento", não "n/a"). Detalhe em `docs/02-STANDARDS.md` §15.

### 3.2 Tamanho

- **Ideal**: < 500 linhas diff
- **Aceitável**: 500-1500 linhas
- **Grande**: > 1500 linhas — considerar quebrar em PRs

### 3.3 Review

- **Você mesmo revisa** (IA pode fazer self-review via `gh pr view` + tools)
- **Aprova** quando o CI está verde (secrets, inventário, lint, test, build, orçamento, regras, navegador, docs) + smoke + docs ok
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
  ├─ ci.yml (em paralelo): secrets · inventário · lint · test · build · orçamento · regras · navegador
  └─ deploy-firebase.yml  (concurrency "firebase-hosting", timeout 30 min)
       1. Validate required secrets
       2. Install dependencies + Firebase CLI (firebase-tools@13)
       3. Write service account credentials
       4. Ensure Firestore database "pickleball" exists (cria se faltar)
       5. Ensure Hosting sites exist (picklerush + pickletour)
       6. Build (vite build → dist/, VITE_PWA_ENABLED=true)
       7. Deploy Firestore rules   → --only firestore:rules,firestore:pickleball
          (falha se a CLI não disser "released rules")
       8. Deploy Firestore indexes → --only firestore:indexes,firestore:pickleball
          (sem --force: índice remoto não versionado é preservado e avisado)
       9. Install functions deps + Deploy Cloud Functions (não fatal)
          → scripts/functions-deploy.sh (codebase `picklerush`, por nome)
      10. Deploy Storage rules (não fatal)
      11. Deploy Hosting (picklerush e pickletour; pickletour é redirect-only).
          "An unexpected error has occurred" do Firebase ganha UMA segunda
          tentativa após 30 s (falha passageira, 2026-10-16)
      12. Conferir o site no ar: Playwright nas rotas públicas de
          https://picklerush.web.app (falha o job) + POST /api/erro → 204
          (monitoramento de erros; só avisa)
  ↓
✅ Site atualizado em https://picklerush.web.app
```

⚠️ O deploy **não espera** o CI: os dois disparam no mesmo push. Por isso o
merge só acontece com o CI do PR verde (§3.3) — o `main` é sempre implantável.
Os passos de Functions e Storage são não fatais de propósito (Hosting e
Firestore já saíram); falha de Functions é refeita pela vigilância (§4.7).

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
| `An unexpected error has occurred` no passo do **Hosting** | Falha passageira do Firebase ao publicar o site | O workflow tenta de novo uma vez, 30 s depois (passo 11). Falhou duas vezes: reexecute o job; nesta sessão sem permissão de reexecutar, um PR mergeado publica de novo. Não confundir com a linha dos índices, abaixo |
| `Pass the --force flag` ao publicar índices | Existe índice remoto que não está em `firestore.indexes.json` | **Não use `--force` às cegas**: ele apagaria o índice remoto. O workflow preserva o índice e continua; importe o índice para o JSON antes de voltar a tratar índices como bloqueantes. A divergência de 2026-09-28 (`tournament_matches`: `modality_id`, `stage_index`, `round` — criado pelo link de erro, é o que serve a lista de jogos da fase) foi importada em 2026-09-30. |
| `An unexpected error has occurred` logo depois de "deploying indexes…", ou o passo de regras verde **sem** "released rules" | O `--only` não nomeia o banco. O `firebase.json` declara o banco nomeado em LISTA, e a firebase-tools 13 só o enxerga quando o alvo o nomeia: `firestore:rules` sozinho resolve **zero** bancos (verde sem publicar nada) e `firestore:indexes` sozinho quebra | Use sempre o PAR `firestore:<parte>,firestore:pickleball`. 🐞 Foi o que segurou os deploys de 29/09 (PRs #175–#178): o site parou no #174 e as regras de segurança novas nunca foram publicadas, com o passo de regras verde. Guarda em `src/core/guards/deployFirebaseWorkflow.test.js` |

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

O PWA é ligado no build de produção (`VITE_PWA_ENABLED=true` em
`deploy-firebase.yml`); desligado, nenhum SW é registrado e qualquer registro
anterior é removido. A versão do cache está em `public/sw.js`
(`const VERSION = 'v8'` → cache `picklerush-v8`). **Bumpe `VERSION` quando o
conjunto de assets mudar**: a próxima ativação apaga os caches antigos
(`activate`), e `skipWaiting` + `clients.claim` evitam atualização presa.

`src/core/pwa/registerPwa.js` registra `sw.js`, procura versão nova a cada
carregamento e, **só quando já havia um SW controlando a página**, recarrega
uma vez na troca de controlador. Ícones do app (claro/escuro pelo tema do
celular) e instalação: `docs/04-ARCHITECTURE.md` §7.1–§7.2. Push usa `public/firebase-messaging-sw.js`.
Cache HTTP em `firebase.json`: `index.html` e `sw.js` sem cache, manifestos por 1 h;
assets com hash, `immutable` por 1 ano.

Depois de um deploy, quem está com a aba aberta pode pedir um pedaço de código
que já não existe: a tela mostra "Uma versão nova foi publicada — Recarregar"
(`isChunkLoadError`, `docs/28-ERRO-NAO-DERRUBA-O-APP.md`). Não é bug.

### 4.7 Workflows do repositório (`.github/workflows/`)

| Workflow | Quando roda | O que faz |
|---|---|---|
| `ci.yml` | push em `main`/`copilot/**` e PR para `main` | Job `build-and-test`: `security:secrets`, `docs:inventario:check`, lint, `npm test`, build (variáveis fictícias), `build:budget`. Job `firestore-rules`: `test:rules` no emulador (Java). Job `e2e`: `npm run e2e` — testes de navegador no build do PR com Auth e Firestore nos emuladores (relatório do Playwright como artefato quando falha). Job `dependencias`: `npm audit`, **informativo**. Job `docs-obrigatorios` (só PR): `scripts/check-docs-updated.mjs`. Cancela run anterior do mesmo ref |
| `deploy-firebase.yml` | push em `main` + manual | Deploy completo (§4.1) |
| `functions-watchdog.yml` | a cada 30 min (`7,37 * * * *`) + manual | Confere se todas as funções exportadas existem em `southamerica-east1` com o rótulo `picklerush`; recria o que sumiu pelo mesmo script e **falha o job de propósito** para avisar por e-mail (§9.1) |
| `firestore-manual-export.yml` | manual (`confirm = EXPORTAR`) | Exporta o Firestore para o GCS, conferindo banco e privacidade do bucket; aceita prefixo e instante de snapshot |
| `privacy-legacy-email-cleanup.yml` | manual | Limpeza de e-mails legados em etapas (`report` por padrão = dry-run; `apply` exige texto de confirmação) |
| `deploy-pages.yml` | push em `main` + manual | **Legado**: publica o build no GitHub Pages (não é a produção) |

Guardas de fonte dos workflows: `deployFirebaseWorkflow.test.js`,
`deployFunctions.test.js`, `firestoreBackupWorkflow.test.js`,
`legacyEmailCleanupWorkflow.test.js`. Mexeu num workflow? Rode-os.

### 4.8 Checagem de documentação no CI

Dois pontos, ambos em `ci.yml`:

1. **Inventário em dia** (todo push/PR): `npm run docs:inventario:check` compara
   `docs/46-INVENTARIO.md` com o que `scripts/gen-inventario.mjs` gera do código
   (rotas, coleções, regras, índices, funções, flags, módulos). Reprovou? Rode
   `npm run docs:inventario` e comite o arquivo — nunca edite à mão.
2. **Docs obrigatórios** (só PR): `BASE_REF=origin/main PR_BODY=… node
   scripts/check-docs-updated.mjs`. Código de produto no diff sem nenhum doc
   (`docs/`, `CLAUDE.md`, `AGENTS.md`, `README.md`, README de módulo,
   `functions/README.md`) ⇒ falha, a menos que o corpo do PR tenha a linha
   `Docs: não se aplica — <motivo>`.

Para rodar localmente antes do PR:
`BASE_REF=origin/main PR_BODY="$(cat corpo.md)" node scripts/check-docs-updated.mjs`.

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
0. Erros em produção (§7.4)
   └─ Painel admin → Sistema → Diagnóstico → "Erros em produção"
   └─ O erro já está lá, com pilha, rota, versão e quantas pessoas?

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
   └─ npm run e2e            (build deste código + emuladores)
   └─ npm run e2e:producao   (só as rotas públicas, no site no ar)
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

### 7.2 Testes de navegador (Playwright)

`npm run e2e` (`scripts/e2e.sh`) monta o build deste código apontando para os
**emuladores** (projeto `demo-picklerush`, nada toca produção), serve com
`vite preview` e roda `tests/e2e/` em Chromium de computador e de celular
(Pixel 5). É o mesmo comando do job `e2e` do CI. Precisa de Java e do
Chromium do Playwright (`npm run e2e:install`).

| Arquivo | O que prova |
|---|---|
| `public-routes.spec.js` | o site abre, `/login` tem o formulário, rota fechada leva ao login. Também roda no **site no ar** depois de cada deploy |
| `acessibilidade.spec.js` | axe (WCAG 2.1 AA) em `/` e `/login`: violação séria ou crítica reprova |
| `logado.spec.js` (`@emuladores`) | cria uma conta no emulador (Auth REST + `users/{uid}` completo, para o assistente de cadastro não abrir), entra pelo formulário e abre as telas principais: cada uma tem de mostrar o título, sem a tela de erro e sem exceção na página |

Teste que precisa dos emuladores leva `@emuladores` no nome: o
`npm run e2e:producao` (`E2E_BASE_URL=https://picklerush.web.app`) os pula.
Dois cuidados: o Firestore mantém conexão aberta, então **nunca** espere
`networkidle` (espere o elemento); e o axe roda depois que o spinner de
inicialização some e as animações terminam, senão mede a cor no meio do
desvanecer.

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

### 7.4 Erros em produção (monitoramento)

Todo erro que acontece no aparelho de alguém chega ao **Google Cloud Error
Reporting** do projeto `pickletour`: Painel admin → Sistema → Diagnóstico →
"Erros em produção" (ou `https://console.cloud.google.com/errors?project=pickletour`).
Lá cada erro aparece agrupado, com quantas vezes, desde quando, a pilha, a
rota, a versão (o commit do deploy, `VITE_RELEASE`) e o navegador. Para ser
avisado por e-mail de erro **novo**: na página do Error Reporting, "Configure
notifications".

Caminho: navegador → `POST /api/erro` → função `clientErrorReport` → log →
Error Reporting (`docs/47-BACKEND-CLOUD-FUNCTIONS.md` §7.1). O que entra: os
erros que derrubam uma tela (boundaries), exceções soltas, promessas
rejeitadas sem `catch`, falha da inicialização e a tela que não abriu (script
de segurança do `index.html`). Ruído do navegador e de extensões fica de fora.

---

## 8. Bundle verification

### 8.1 Antes de mergear

```bash
npm run build && npm run build:budget   # orçamento do pacote inicial (gzip)
ls -la dist/assets/
grep -c "novoCodigo" dist/assets/*.js    # o código novo está no bundle?
```

`build:budget` (`scripts/check-bundle-size.mjs`) soma o JS/CSS que o
`index.html` carrega e reprova acima de 440 kB gzip (`BUNDLE_BUDGET_KB`). O teto
só desce; estourou? divida o que acrescentou com `lazy` ou tire do caminho crítico.

### 8.2 Code splitting

- Componentes > 30KB devem ser `lazy(() => import(...))`
- Toda página é `React.lazy` (`App.jsx`, `V2App.jsx`); mapa de cidades, semente do treino e catálogos de idioma entram só por import dinâmico
- Libs pesadas e isoladas têm chunk próprio em `manualChunks` (`vite.config.js`)
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

**Cloud Functions: `southamerica-east1`** (São Paulo) — constante `REGION` em
`functions/index.js`, e é nessa região que a vigilância procura as funções.
O banco `pickleball` também fica em `southamerica-east1`.

### 9.3 Hosting sites

- `picklerush` — site ativo (`picklerush.web.app` e domínio custom)
- `pickletour` — redirect-only para o `picklerush`

Ambos são publicados pelo `deploy-firebase.yml` (`HOSTING_SITE_IDS`).

### 9.4 Storage

- Bucket: o padrão do projeto (compartilhado com outro app — §9.1)
- Upload via `storageService.js`
- Regras em `storage.rules`

### 9.5 Cloud Functions deploy

O workflow `.github/workflows/deploy-firebase.yml` faz deploy automático
em todo push em main. **NÃO** faça `firebase deploy --only functions` local
em produção (vai deployar com a sua config, não a do CI).

**Runtime: Node.js 22** (`engines.node` em `functions/package.json`, e o
mesmo valor no `package-lock.json`). A CLI publica em `nodejs<N>`, e o Google
aposenta cada versão em data fixa:

| Runtime | Descontinuado | Desligado (deploy recusado) |
|---|---|---|
| Node.js 20 | 2026-04-30 | **2026-10-31** |
| Node.js 22 (atual) | 2027-04-30 | **2027-10-31** |

Saímos do 20 em 2026-10-02. Depois do desligamento nenhum deploy passa — nem
o da vigilância, que recria função apagada —, então a troca tem de vir antes.
O teto é a CLI fixada nos workflows: a `firebase-tools@13` vai até o Node.js
22. Para ir ao 24 é preciso subir a CLI junto (e conferir de novo o
`--only` do Firestore, §4.3), num PR próprio. Os testes de `functions/` rodam
no runtime de produção com `npx vitest run functions` num Node.js 22. Guarda em
`src/core/guards/deployFunctions.test.js` ("runtime das Cloud Functions").

### 9.6 Emulators (dev local)

```bash
# Inicia Firestore + Auth + Functions emuladores
firebase emulators:start

# UI em http://localhost:4000
```

Útil pra testar regras sem deploy.

### 9.7 Backup e restore

Backup sob demanda: workflow **Backup manual do Firestore**
(`firestore-manual-export.yml`, `workflow_dispatch`, exige digitar `EXPORTAR`) —
exporta o banco `pickleball` para o GCS depois de conferir banco e privacidade do
bucket. Para PITR, backup agendado e teste de restauração há o helper local `scripts/firestore-s0-backup.sh` (não grava nada no repositório). Antes de qualquer
migração destrutiva, tenha PITR/backup testado.

---

## 9.1 ⚠️ Cloud Functions: o projeto Firebase é COMPARTILHADO

**Incidente de 2026-09-24.** O projeto Firebase deste app também hospeda as
Cloud Functions de OUTRO aplicativo (em `us-central1`: `api`, `getMe`,
`listConversas`, `getLLMConfig`, `painCheck`, `weeklySummary`…). Os dois usavam
o codebase `default`, e o deploy daqui rodava
`firebase deploy --only functions --force`: a CLI trata toda função do projeto
que não está no código local como "removida" e a APAGA.

- Entre 22/09 e 24/09, o deploy do OUTRO app apagou **todas** as funções do
  PickleRush (ranking automático, push, fila de espera, ranking de clube).
- Em 24/09, o deploy do PickleRush (merge do #136) as recriou — e apagou
  **~40 funções do outro app**.

**Conserto deste lado — três camadas** (Onda BK, 2026-09-24):

1. **Codebase próprio: `"codebase": "picklerush"`** em `firebase.json`. A CLI
   rotula cada função com `firebase-functions-codebase=picklerush` e, num
   deploy, só considera "removidas" as funções **do mesmo codebase** (conferido
   no código da CLI: `groupEndpointsByCodebase`). Protege nos DOIS sentidos:
   nós nunca enxergamos as funções do outro app, e o deploy dele (codebase
   `default`) deixa de enxergar as nossas. A migração é o próprio deploy: as
   funções existentes são ATUALIZADAS (casam pelo nome e região) e ganham o
   rótulo novo — nada é apagado nem recriado.
2. **Deploy por nome, num script só** — `scripts/functions-deploy.sh` publica
   `functions:picklerush:<nome>` para cada exportação de `functions/index.js`.
   Recusa codebase ausente ou `default`; lista vazia não publica nada (`--only`
   vazio voltaria a ser "tudo"). Não usa `--force`: se a CLI algum dia detectar
   remoção inesperada, o deploy falha em vez de confirmar apagamento.
3. **Vigilância** — `.github/workflows/functions-watchdog.yml`, a cada 30 min:
   lista as funções do projeto, confere se TODAS as nossas existem em
   `southamerica-east1` e se carregam o rótulo `picklerush`. Faltou alguma?
   Publica de novo pelo mesmo script e **falha o job de propósito** (o dono do
   repositório recebe o e-mail do GitHub). Ela não toca no banco; e os
   resultados publicados enquanto as funções estiveram fora são recuperados
   pelo `catchUpPlatformRankings` (`docs/18-RANKINGS.md` §3).

Guarda: `src/core/guards/deployFunctions.test.js`.

**O que continua fora do alcance deste repositório** (projeto compartilhado):
1. **O outro app pode apagar à mão** (`firebase functions:delete`) ou com uma
   CLI anterior a codebases (v10.7, 2022). A vigilância recria em até 30 min.
2. **Mesma conta de serviço, mesmo projeto**: tudo o que o outro app faz com
   privilégio de administrador (Admin SDK) alcança o banco `pickleball`. Regra
   do Firestore não se aplica ao Admin SDK.
3. **Storage**: o bucket padrão é um só. Quem publicar `storage.rules` por último
   vence — se o outro app usa Storage, as regras de um sobrescrevem as do outro.
4. **Authentication**: as contas de login são as MESMAS nos dois aplicativos.
   Excluir um cadastro aqui (`adminDeleteAccounts`) apaga o login da pessoa no
   outro app também.
5. **Isolamento completo só com um projeto Firebase por aplicativo** — é
   migração de dados (Firestore `pickleball`, contas de login, arquivos do
   Storage, segredos e domínios) e precisa ser planejada como tal.

Depois de qualquer deploy, confira no log do passo *Deploy Cloud Functions*
que não há linha `Successful delete operation` de função que não é daqui.

## 10. GitHub Actions secrets e variáveis

Em **Settings → Secrets and variables → Actions** (só os NOMES; nunca cole
valores em doc, issue ou PR):

| Nome | Tipo | Usado por | Obrigatório |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | secret (Pages: também variável) | deploy, Pages | Sim |
| `VITE_FIREBASE_AUTH_DOMAIN` | secret | deploy, Pages | Sim |
| `VITE_FIREBASE_PROJECT_ID` | secret | deploy, watchdog, backup, limpeza (vira `FIREBASE_PROJECT_ID`) | Sim |
| `VITE_FIREBASE_STORAGE_BUCKET` | secret | deploy, Pages | Sim |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | secret | deploy, Pages | Sim |
| `VITE_FIREBASE_APP_ID` | secret | deploy, Pages | Sim |
| `VITE_FIREBASE_MEASUREMENT_ID` | secret | deploy, Pages | Não (analytics) |
| `FIREBASE_SERVICE_ACCOUNT` | secret (JSON da service account) | deploy, watchdog, backup, limpeza | Sim |
| `VITE_FIRESTORE_DATABASE_ID` | secret/variável (Pages; o deploy fixa `pickleball`) | Pages | Não |
| `VITE_ENABLE_FIREBASE_ANALYTICS`, `VITE_ENABLE_FIREBASE_PERFORMANCE` | variável (Pages; o deploy fixa `false`) | Pages | Não |

O `ci.yml` **não usa segredo**: o build do CI roda com variáveis fictícias
(e o job `e2e`, com o projeto de demonstração dos emuladores).
O `deploy-firebase.yml` fixa `VITE_FIRESTORE_DATABASE_ID=pickleball`,
`VITE_PWA_ENABLED=true`, `VITE_BASE_PATH=/` e `VITE_RELEASE=<commit>` (a
versão que o monitoramento de erros anota).

**Adicionar/rotacionar a service account**:
1. Firebase Console → Project settings → Service accounts → Generate new private key
2. Copiar o JSON inteiro
3. GitHub repo → Settings → Secrets and variables → Actions → `FIREBASE_SERVICE_ACCOUNT`
4. Papéis necessários: Firebase Admin (regras, índices, Storage, Hosting) e, para
   Functions, Cloud Functions Admin + Service Account User (§4.3)

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
npm run build:budget # orçamento do pacote inicial
npm run test:rules   # regras no emulador (Java)
npm run docs:inventario        # regenera docs/46-INVENTARIO.md
npm run docs:inventario:check  # verifica sem gravar
npm run security:secrets       # nada de segredo no Git
npm test             # vitest
npm run lint         # eslint --quiet
npm run typecheck    # sintaxe e resolução (checkJs desligado: tipos JSDoc não são verificados)
npm run e2e          # playwright: build deste código + emuladores (o mesmo do CI)
npm run e2e:producao # só as rotas públicas, no site no ar
npm run e2e:install  # primeira vez

# === Firebase ===
firebase login
firebase deploy
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:pickleball   # o banco nomeado PRECISA estar no alvo
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
DEPLOY    push main → deploy-firebase.yml (regras → índices → funções por nome → storage → hosting)
DOCS      toda mudança de código leva doc; npm run docs:inventario; CI reprova sem (ou 'Docs: não se aplica — motivo')
VERIFY    smoke test manual + bundle grep
HOTFIX    fix/X → PR → merge (mesmo que feature)
DEBUG     erros em produção → bundle → build → test → e2e → flag → rule → service
PWA       bump VERSION em public/sw.js quando os assets mudam
SECRETS   FIREBASE_SERVICE_ACCOUNT + VITE_FIREBASE_* no GitHub
```

> **Última atualização**: 2026-10-15. Mudou o fluxo? Atualize este doc
> **e** o `CLAUDE.md` §6-§7 e a memory do agente.
