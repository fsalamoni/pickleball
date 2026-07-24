# CLAUDE.md — Guia-mestre do PickleRush para IAs e humanos

> **Você é uma IA? Leia isto primeiro.** Este documento é a porta de entrada
> única para entender e evoluir o PickleRush. Tudo o que você precisa está
> aqui ou a até 2 cliques daqui.
>
> **Você é humano?** Mesmo lugar. O fluxo é o mesmo.

---

## 0. TL;DR (30 segundos)

- **O que é**: PWA para pickleball amador BR — torneios, clubes, arenas, professores, comunidade.
- **Stack**: React 18 + Vite, Tailwind + shadcn/ui, Firebase (Firestore db `pickleball`), React Query, Vitest, Playwright.
- **Estado**: 19 módulos, 67 V2 pages, 92 coleções Firestore, 124 feature flags, **1334+ testes verdes**.
- **Live**: https://picklerush.web.app (Firebase site `picklerush`; `pickletour` é redirect-only).
- **Deploy**: push em `main` → GitHub Actions → Firebase Hosting + Rules + Cloud Function.
- **Repositório**: https://github.com/fsalamoni/pickleball
- **Admin**: `fsalamoni@gmail.com` (uid `Kx7CC0NVgogh8cCF4wIRmpOvo7r2`, role `platform_admin`).

Se você só tem 30 segundos, isso é o suficiente para não se perder.

---

## 1. Como usar este guia (para IAs)

**Fluxo obrigatório antes de fazer QUALQUER tarefa:**

```
┌────────────────────────────────────────────────────────────┐
│ 1. Leia §2 (princípios) e §3 (estrutura dos docs)         │
│ 2. Identifique o módulo/feature que vai tocar (§4)         │
│ 3. Leia o README do módulo (em src/modules/X/README.md)    │
│ 4. Leia o doc setorial (docs/01-AI-CONTEXT.md, DATA_MODEL,   │
│    MODULES, ARCHITECTURE, STANDARDS, WORKFLOW)             │
│ 5. Só então abra o código                                  │
│ 6. Planeje em 3 passos (§6)                                │
│ 7. Implemente respeitando os padrões (docs/02-STANDARDS)  │
│ 8. Teste, documente, commite, faça PR (§7-§8)             │
└────────────────────────────────────────────────────────────┘
```

**Tempo investido nos passos 1-4: 5-10 min.** Esse investimento se paga em
horas de implementação sem voltar atrás. **Não pule.**

Se você tem dúvida sobre **"onde está X"** → §4 (mapa rápido).
Se você tem dúvida sobre **"como faço Y"** → §5 (decisão rápida) + docs/02-STANDARDS.md.
Se você está **começando uma feature nova** → §6 (planejamento).
Se você está **terminando uma feature** → §7 (checklist de entrega).

---

## 2. Princípios não-negociáveis (leia antes de tocar em qualquer coisa)

Estes princípios vieram de bugs reais que custaram horas pra arrumar. São inegociáveis:

1. **Não prejudicar nada.** Calma, cautela, atenção. Antes de remover/renomear, **grep + bundle grep + runtime test** pra garantir zero impacto.
2. **Feature flags SEMPRE.** Toda nova feature nasce atrás de `FEATURE_FLAG.X` (default OFF). UI gated por `<FeatureFlagGuard flag=...>` ou `useFeatureFlag(key)`. Defaults em `platform_settings/feature_flags/{key}`. Veja `docs/02-STANDARDS.md` §3.
3. **UX/UI é prioridade.** Refinamentos visuais depois de cada sprint. Não aceito "funciona, tá pronto". Tem que funcionar **e** ser bonito.
4. **MERGES + DEPLOYS AUTOMÁTICOS.** Quando terminar um conjunto coerente de tarefas, fazer squash merge + push em main → deploy sai sozinho. Veja `docs/03-WORKFLOW.md`.
5. **Lógica pura em `domain/` com teste.** Service = I/O. Hook = React Query. Componente = UI. Regra de negócio NUNCA em componente. Sempre testada (Vitest).
6. **Auditoria em toda escrita.** `auditService.createAuditLog(...)` após mutações relevantes.
7. **Sem TypeScript, mas com JSDoc.** Typedefs em `core/domain/types.js`. `npm run typecheck` antes de commit.
8. **Sem `console.log` em services.** Use `core/lib/logger`.
9. **pt-BR em tudo.** UI, comentários, mensagens, audit_logs. Sem inglês solto.
10. **Backward-compat SEMPRE.** Aditividade: nova coleção? Regra nova no `firestore.rules` sem mexer nas existentes. Nova flag? Default OFF. Schema change? Campo novo opcional. Migração de dados → `migrateLegacyFlags` com bump de `FLAGS_MIGRATION_VERSION`.

**Se uma tarefa pedir para violar qualquer um desses, PARE e pergunte.**

---

## 3. Estrutura dos docs (mapa completo)

```
/workspace/pickleball/
├── CLAUDE.md                       ⭐ ESTE ARQUIVO (guia-mestre)
├── AGENTS.md                       🔁 alias (alguns agentes leem este nome)
├── README.md                       👤 usuário final (como rodar/usar)
│
├── docs/
│   ├── 00-INDEX.md                 📚 mapa de navegação detalhado
│   ├── 01-AI-CONTEXT.md            🧠 panorama da plataforma
│   ├── 02-STANDARDS.md             📐 padrões de código (como codar)
│   ├── 03-WORKFLOW.md              🔄 git, deploy, GitHub, Firebase
│   ├── 04-ARCHITECTURE.md          🏗️ camadas, design system, testes
│   ├── 05-DATA-MODEL.md            💾 92 coleções Firestore + regras
│   ├── 06-MODULES.md               📦 19 módulos + fluxos + rotas
│   ├── 07-DESIGN-STANDARD.md       🎨 paleta/tipografia/componentes
│   ├── 08-ARENA-ROADMAP.md         🏟️ sprints de arena (status)
│   ├── 09-UX-ANALYSIS/             🔍 auditorias UX/UI por persona
│   │   ├── README.md
│   │   ├── 01-fundacao-design-system.md
│   │   ├── ... 12 docs de auditoria ...
│   │   ├── 13-arena-refino.md
│   │   ├── 14-professor-implementacao.md
│   │   └── 15-backlog-remanescente.md   ⭐ comece por aqui pra novas features
│   ├── 10-ARENA-V3/                🏟️ docs específicos Arena V3
│   │   ├── 00-INDEX.md
│   │   ├── 26-ARENA-V3-COMPLETE-REFERENCE.md  ⭐ status atual
│   │   └── ... sprints 1-10 ...
│   └── 11-REFERENCE/               📖 cheatsheet, glossário, FAQ
│       ├── cheatsheet.md
│       ├── glossary.md
│       └── faq.md
│
├── src/
│   ├── App.jsx                     # roteamento
│   ├── core/                       # ⭐ auth, firebase, logger, feature flags
│   ├── modules/                    # ⭐ BASE DE DOMÍNIO (19 módulos)
│   │   ├── tournament/README.md
│   │   ├── arenas/README.md
│   │   ├── coaches/README.md
│   │   ├── clubs/README.md
│   │   └── ... (15 mais)
│   ├── v2/                         # ⭐ APP ATIVO (Athleisure Premium)
│   │   ├── pages/                  # 67 páginas V2
│   │   ├── components/             # V2Layout, FeatureFlagGuard, ...
│   │   └── ui/primitives.jsx       # V2Button, V2Card, V2Badge, ...
│   ├── pages/                      # V1 legado (em desuso)
│   └── components/                 # shadcn/ui primitives
│
├── firestore.rules                 # ⭐ regras de segurança (92 coleções)
├── firestore.indexes.json          # índices compostos
├── firebase.json                   # config hosting
├── functions/                      # Cloud Functions (region SP)
├── public/                         # assets, PWA
└── .github/workflows/
    ├── deploy-firebase.yml         # ⭐ push em main → deploy
    ├── ci.yml                      # lint + test em PR
    └── deploy-pages.yml            # legado
```

**Ordem de leitura sugerida (se você tem 1 hora):**
1. `docs/01-AI-CONTEXT.md` (15 min) — panorama condensado
2. `src/modules/<módulo>/README.md` do módulo que você vai tocar (5 min)
3. `docs/02-STANDARDS.md` (10 min) — como codar
4. `docs/03-WORKFLOW.md` (5 min) — git/deploy
5. `docs/06-MODULES.md` § relevante (5 min) — mapa do módulo
6. `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` (5 min) — o que ainda falta
7. Código (5-10 min) — localizar arquivos

**Ordem de leitura sugerida (se você tem 5 minutos):**
1. §0 TL;DR deste arquivo
2. `docs/01-AI-CONTEXT.md` §1-3 (o que é, stack, arquitetura)
3. `docs/06-MODULES.md` § módulo que vai tocar

---

## 4. Mapa rápido "onde está X"

**"Onde está o SCHEMA do Firestore?"** → `docs/05-DATA-MODEL.md` + `firestore.rules`
**"Onde estão as FLAGS?"** → `src/core/featureFlags.js` (124) + `featureFlagGroups.js` (agrupadas)
**"Onde está a TELA X?"** → `src/v2/pages/V2Xxx.jsx` (R2 → module/pages)
**"Onde está o COMPONENTE X?"** → `src/v2/components/Xxx.jsx` ou `src/v2/ui/primitives.jsx`
**"Onde está a REGRA DE NEGÓCIO X?"** → `src/modules/X/domain/*.js` (sempre com `.test.js` ao lado)
**"Onde está o SERVICE do Firestore?"** → `src/modules/X/services/*.js`
**"Onde está o HOOK React Query?"** → `src/modules/X/hooks/*.js`
**"Onde está a RULE de segurança X?"** → `firestore.rules` (match /<coleção>/)
**"Onde está o CLOUD FUNCTION X?"** → `functions/index.js`
**"Onde está o TESTE X?"** → `*.test.js` ao lado do arquivo; `*.runtime.test.jsx` em `src/v2/pages/` para componentes críticos
**"Onde está a FEATURE que não existe mas devia?"** → `docs/09-UX-ANALYSIS/15-backlog-remanescente.md`

**Para encontrar QUALQUER arquivo rápido:**
```bash
# por nome
find src -name "V2Arena*" -type f
# por conteúdo (procurar string)
grep -rn "useArenaBookings" src/
# por export
grep -rn "export function\|export const" src/modules/arenas/ | head
# por rota
grep -rn "path=\"/arenas" src/v2/V2App.jsx
```

---

## 5. Decisão rápida: "como faço Y?"

| Preciso... | Onde olhar | Como fazer |
|---|---|---|
| Adicionar uma feature nova | `docs/02-STANDARDS.md` §3 | Flag nova, default OFF, `<FeatureFlagGuard>`, git worktree, PR, smoke test, squash merge |
| Adicionar uma página V2 nova | `docs/02-STANDARDS.md` §4 | `src/v2/pages/V2Xxx.jsx` (lazy), rota em `src/v2/V2App.jsx`, `useFeatureFlag` se for nova, `ProtectedRoute` se for autenticada |
| Adicionar uma coleção Firestore | `docs/02-STANDARDS.md` §5 | Schema em `docs/05-DATA-MODEL.md` + `match /<col>/{id}` em `firestore.rules` (aditivo) + service + hook + UI |
| Adicionar um campo em coleção existente | `docs/02-STANDARDS.md` §5 | Campo OPCIONAL, regra atualizada (aditiva), service lê com default se faltar |
| Adicionar lógica de negócio | `docs/02-STANDARDS.md` §6 | `src/modules/X/domain/novo.js` + `novo.test.js` (sempre!), puro, sem React/Firebase |
| Mudar algo em produção | `docs/03-WORKFLOW.md` | Worktree, branch, PR, smoke test, **squash merge + delete branch** → deploy sai |
| Corrigir um bug em produção | `docs/03-WORKFLOW.md` §5 | Branch `fix/X`, PR, smoke test, deploy via merge. **NUNCA hotfix direto em main** |
| Fazer deploy manual | `docs/03-WORKFLOW.md` §6 | Use `firebase deploy` local OU push em main. **Não pule smoke test** |
| Adicionar dependência | `docs/02-STANDARDS.md` §7 | Verificar se já existe similar no `package.json`; preferir libs leves e mantidas |
| Trocar tema/paleta | `docs/07-DESIGN-STANDARD.md` | Tokens em `tailwind.config.js` + `src/v2/ui/primitives.jsx` |
| Investigar bug "feature X não funciona" | `docs/11-REFERENCE/cheatsheet.md` § "Diagnóstico" | (1) bundle deployed, (2) build, (3) tests, (4) Playwright, (5) feature flag, (6) firestore rule |
| Ver o que ainda falta fazer | `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` | Lista consolidada, com status ✅/🟡/⏳ |
| Ver status atual do Arena V3 | `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md` | Métricas, sprint, gotchas |

---

## 6. Como planejar uma feature nova (3 passos)

Antes de tocar em código, **responda por escrito** (em chat, comentário, ou no PR):

### Passo 1 — O QUÊ
- **Qual problema** estou resolvendo? (citando user story ou bug)
- **Quem** se beneficia? (persona: atleta, organizador, dono de arena, professor, admin)
- **Critério de aceite**: como sei que está pronto?
- **Já existe algo similar?** (checar `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` — talvez seja um item lá)

### Passo 2 — COMO
- **Qual módulo** vai receber? (ver §4 + `docs/06-MODULES.md`)
- **Qual camada**: novo `domain/` (lógica), `services/` (I/O), `hooks/` (queries), `pages/` (UI)?
- **Qual flag?** (definir em `src/core/featureFlags.js` + agrupar em `featureFlagGroups.js`)
- **Qual schema?** (novas coleções ou campos aditivos)
- **Qual UI?** (qual página V2, qual componente)
- **Quais testes?** (domain test + runtime test se for page crítica)
- **Quais docs atualizar?** (este guia → `01-AI-CONTEXT` + `05-DATA-MODEL` + `06-MODULES` + `15-backlog-remanescente` + memória do agente se for lição nova)

### Passo 3 — RISCOS
- **Backward-compat**: estou quebrando algo? (verificar `firestore.rules`, schema, refs)
- **Bundle size**: a feature adiciona muito peso? (lazy load se > 30KB)
- **PWA/SW**: precisa bumpar `sw-vN.js`? (ver `docs/03-WORKFLOW.md` §7)
- **Feature flag migration**: precisa `migrateLegacyFlags`? (sim, se for flag nova com default que afeta comportamento existente)
- **Auditoria**: ações que precisam de `audit_logs`?
- **Notificações**: ações que disparam notificação?
- **i18n**: tudo em pt-BR? termos consistentes com o resto?

**Só então comece a codar.**

---

## 7. Checklist de entrega (antes de pedir review)

Toda feature/task completa deve passar por este checklist:

```
PRÉ-COMMIT
[ ] Lint passa (npm run lint) — esperado 0 errors
[ ] Build passa (npm run build) — sem warnings
[ ] Tests passam (npm test) — adicionar testes novos se relevante
[ ] Smoke test manual — abrir a feature no dev, fazer o fluxo happy-path
[ ] Bundle grep — se importou lib nova, ela tá no bundle? (ver docs/03-WORKFLOW §8)
[ ] i18n pt-BR — todos os textos visíveis

DOCS (atualizar ANTES do PR, não depois)
[ ] docs/01-AI-CONTEXT.md — se afeta panorama (rotas, coleções, etc)
[ ] docs/05-DATA-MODEL.md — se afeta schema
[ ] docs/06-MODULES.md — se afeta módulo/rota
[ ] src/modules/X/README.md — se afeta o módulo
[ ] docs/09-UX-ANALYSIS/15-backlog-remanescente.md — marcar como ✅ implementado
[ ] Memory topic (se lição nova crítica) — via mavis memory tool

PR
[ ] Branch nomeado: feat/X / fix/X / docs/X / refactor/X
[ ] Commit message descritivo (Conventional Commits)
[ ] PR com descrição clara: o que, por que, como testar
[ ] Squash merge → delete branch
[ ] Push em main → GitHub Actions → deploy sai

PÓS-DEPLOY
[ ] Conferir o run do workflow (deve passar)
[ ] Abrir o site em produção, verificar
[ ] Se feature flag nova: ativar no /admin/console pra validar
[ ] Se flag ON por default: verificar que user que não é admin não vê
[ ] Reportar no chat
```

**Se um item falhou: NÃO faça o PR.** Volte, arrume, depois submeta.

---

## 8. Atalhos por papel (persona)

### Atleta (jogador)
- Quer: ver torneios, se inscrever, jogar, ver ranking, encontrar parceiros
- Toca: `tournament/`, `rating/`, `clubs/`, `chat/`, `social/`
- Lê: `docs/06-MODULES.md` (esses 5)

### Organizador de torneio
- Quer: criar torneio, gerenciar inscrições, sortear, agendar quadras, ver resultados
- Toca: `tournament/`, `coaches/` (se for arena)
- Lê: `docs/06-MODULES.md` § tournament + `docs/01-AI-CONTEXT.md` §5 (rotas)

### Dono de arena
- Quer: criar arena, gerenciar quadras/preços, receber reservas, ver métricas, PDV
- Toca: `arenas/`, `coaches/` (parcerias), `notifications/`
- Lê: `docs/06-MODULES.md` § arenas + `docs/08-ARENA-ROADMAP.md` + `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md`

### Professor
- Quer: perfil público, agenda de aulas, roster de alunos, pacotes, clínicas
- Toca: `coaches/`, `arenas/` (parcerias), `leveling/`
- Lê: `docs/06-MODULES.md` § coaches + `docs/09-UX-ANALYSIS/14-professor-implementacao.md`

### Platform admin
- Quer: visão geral, métricas, ativar flags, gerenciar todos os recursos
- Toca: tudo (precisa conhecer tudo)
- Lê: TUDO (este guia + 01-AI-CONTEXT + 05-DATA-MODEL + 06-MODULES + 15-backlog + 26-ARENA-V3-REF)

---

## 9. Convenções de commit e branch

**Branches:**
- `feat/descrição-curta` — feature nova
- `fix/descrição-curta` — bug fix
- `docs/descrição-curta` — só docs
- `refactor/descrição-curta` — refactor sem mudança de comportamento
- `test/descrição-curta` — só testes
- `chore/descrição-curta` — manutenção (deps, config)

**Commits (Conventional Commits):**
```
feat(arenas): add waitlist for booked slots (#66)
fix(v2-arena-detail): import Calendar/Check/Copy from lucide (#65)
docs(readme): update feature flags count to 124
refactor(coaches): extract clinic validation to domain
test(arenas): add court_assignment.test.js (8 tests)
chore(deps): bump firebase to 12.x
```

**PRs:**
- 1 feature = 1 PR (ou 1 sprint atômico = 1 PR)
- Squash merge (botão do GitHub) — mantém main linear
- Delete branch após merge
- **NUNCA** merge direto sem PR (perde rastreabilidade)
- **NUNCA** force push em main

---

## 10. Métricas atuais (snapshot 2026-07-24)

> Última atualização: 2026-07-24, main em `539faba` (após docs sync).

| Métrica | Valor | Delta do início do agente |
|---|---|---|
| **Testes Vitest** | 1334+ passing | +926 (era 408) |
| **Lint errors** | 0 | era 30+ |
| **Módulos** | 19 | +2 (coaches, circuits) |
| **V2 pages** | 67 | +43 |
| **Coleções Firestore** | 92 | +53 |
| **Feature flags** | 124 (51 ARENA_MODULE_*) | +94 |
| **PRs mergeados** | 27 totais (Sprints 0-10) | — |
| **Origin/main** | `539faba` | — |
| **Bundle deployed** | `index-CJmY5B8O.js` (PR #67) | — |
| **Live URL** | https://picklerush.web.app | — |

Quando você for commitar, atualize esta seção se os números mudarem.

---

## 11. Onde pedir ajuda / reportar problema

- **Bug em produção?** → Reproduzir em dev → fix/X branch → PR → squash merge → deploy.
- **Bug "feature flag X não funciona"?** → Checar `01-AI-CONTEXT` §9 + `featureFlagGroups.js`.
- **Build quebrou?** → Rodar `npm run build` local, ver erro. Geralmente import faltando (lição sw-v72.5, sw-v73.4).
- **Tests quebraram?** → Rodar `npx vitest run <arquivo>` pra ver qual falhou.
- **Deploy quebrou?** → Verificar logs em GitHub Actions (`.github/workflows/deploy-firebase.yml`).
- **Firestore rule rejeitou?** → Testar no console do Firebase com simulador.
- **Não sabe por onde começar?** → Volte ao §3 (mapa) ou §5 (decisão rápida).

---

## 12. Resumo de 1 página (cola)

```
PLATAFORMA   PickleRush (picklerush.web.app)
STACK        React+Vite, Tailwind+shadcn, Firebase (db 'pickleball'), React Query, Vitest
MODELO       19 módulos em src/modules/X/{domain,services,hooks,pages,components}/
UI ATIVA     src/v2/ (67 pages, 2-level nav, dark ink/acid/paper)
FEATURES     124 flags em src/core/featureFlags.js (default OFF)
SCHEMA       92 coleções top-level em firestore.rules
TESTES       1334+ vitest (domain obrigatório)
DEPLOY       push main → GitHub Actions → firebase hosting (sites picklerush+pickletour)
SEGURANÇA    firestore.rules (aditivas), audit_logs em mutações
PWA          VITE_PWA_ENABLED=true; sw-vN.js versionado; auto-unregister; reload deferido
WORKTREE     SEMPRE 1 worktree por feature, remover após merge
LINT         0 errors (npm run lint --quiet)
TIPOS        JSDoc + core/domain/types.js
I18N         pt-BR em tudo
ADMIN        fsalamoni@gmail.com (platform_admin, uid Kx7CC0NVgogh8cCF4wIRmpOvo7r2)
```

---

> **Última atualização**: 2026-07-24 (origin/main @ `539faba`).
> Ao mudar arquitetura, coleção, módulo, rota, fluxo de deploy, padrão de
> código ou processo → atualizar este arquivo + 01-AI-CONTEXT + o doc
> específico. Manter a estrutura: §0 TL;DR + §1 como usar + §2 princípios +
> §3 docs + §4 onde está + §5 como faço + §6 planejar + §7 checklist + §8 personas.
