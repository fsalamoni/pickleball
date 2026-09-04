# GAMIFICATION — Roadmap & Acompanhamento

> **Status:** Em construção · **Branch:** `feature/gamification` · **Base:** `origin/main` @ `67d72fcb`
> **Autor:** Mavis · **Início:** 2026-09-01
>
> Este documento é a **fonte de verdade** do desenvolvimento. Atualizado
> após cada commit/sprint. Cada entrada é datada.

---

## 0. Princípios inegociáveis (do `CLAUDE.md` §2, reforçados)

1. **Não prejudicar nada.** Tudo aditivo. Zero mudança de comportamento
   existente até opt-in explícito do admin master.
2. **Feature flags SEMPRE.** Cada feature nova nasce atrás de
   `FEATURE_FLAG.X`, default **OFF**.
3. **Backward-compat SEMPRE.** Nova coleção? Regra nova no `firestore.rules`
   sem mexer nas existentes. Schema change? Campo novo opcional. Migração
   de dados → `migrateLegacyFlags` com bump de `FLAGS_MIGRATION_VERSION`.
4. **Lógica pura em `domain/` com teste.** Service = I/O. Hook = React
   Query. Componente = UI. Regra de negócio NUNCA em componente.
5. **Auditoria em toda escrita.** `auditService.createAuditLog(...)` após
   mutações relevantes.
6. **Documentar TUDO.** Cada decisão, cada trade-off, cada desvio.

---

## 1. Estratégia de zero-impact

Para garantir que **NADA** quebra em main durante o desenvolvimento, seguimos
3 regras duras:

### 1.1 Novos arquivos só
- ❌ NÃO modificar `progression.js` (mantém comportamento existente).
- ✅ Criar `progressionV2.js` ao lado, com nova função e novos pesos.
- ❌ NÃO modificar `achievements.js` (mantém 20 conquistas existentes).
- ✅ Criar `achievementsV2.js` ao lado, com 80+ conquistas adicionais.

### 1.2 Imports aditivos
- ❌ NÃO modificar `ProgressionCard.jsx` (consumidor atual de
  `progression.js`).
- ✅ Criar `ProgressionCardV2.jsx` que consome `progressionV2.js`.
- A página `V2Performance.jsx` mantém `ProgressionCard` importado e
  adiciona (gated por flag) `ProgressionCardV2` ao lado.

### 1.3 Flags gating
- Cada página V2 nova (ex: `/conquistas`) é wrapped em
  `<FeatureFlagGuard flag={FEATURE_FLAG.ACHIEVEMENTS_V2}>`.
- Default `OFF`. Ativação é opt-in via `/admin/console`.

### 1.4 Schemas aditivos
- Novas coleções (`user_xp_events`, `user_achievements_v2`,
  `user_missions`, etc) com IDs determinísticos.
- Documentos materializados em separado dos existentes
  (`user_progression_v2`, `user_skill_trees`, etc).
- **Zero write** em `users/{uid}` ou `athlete_profiles/{uid}` enquanto a
  feature estiver OFF.

---

## 2. Fases & Sprints

### Fase 0 — Fundação (Fase atual)

> Refatoração segura, sem mudar comportamento existente.
> Tudo puramente aditivo. Cria o esqueleto de domínio + testes.

| Sprint | Escopo | Flag | Commit | Status |
|---|---|---|---|---|
| **S0.1** | `progressionV2.js` (multi-fonte + XP_CAPS) | (sem UI) | `feat(gamification): domain progressionV2` | ✅ |
| **S0.2** | `tiers.js` + `skillTrees.js` | (sem UI) | `feat(gamification): domain tiers + skill trees` | ✅ |
| **S0.3** | `streakProtection.js` (grace + freeze) | (sem UI) | `feat(gamification): domain streak protection` | ✅ |
| **S0.4** | `xpLedger.js` (computeXpEvent, computação por evento) | (sem UI) | `feat(gamification): domain xp ledger` | ✅ |
| **S0.5** | `featureFlags.js` add `GAMIFICATION_V2` master | master OFF | `feat(gamification): master flag` | ✅ |

### Fase 1 — Achievements V2 (catálogo)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S1.1** | `achievementsV2.js` (5 famílias, 5 raridades, 83 conquistas) | (sob master) | ✅ |
| **S1.2** | `AchievementCardV2.jsx` (componente presentational) | (sob master) | ✅ |
| **S1.3** | `AchievementUnlockToast.jsx` (animação) | (sob master) | ✅ |
| **S1.4** | `V2Achievements.jsx` página pública `/conquistas` | `ACHIEVEMENTS_V2` OFF | ✅ |
| **S1.5** | Hook `useAchievementsV2` (lê + calcula unlocked/pending) | (sob master) | ✅ |

### Fase 2 — Níveis com nome + Skill Trees (UI)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S2.1** | `TierBadge.jsx` (visual) | `TIERS_NAMED` OFF | ✅ |
| **S2.2** | `SkillTreeBars.jsx` (5 barras) | `SKILL_TREES` OFF | ✅ |
| **S2.3** | `ProgressionCardV2.jsx` (substitui v1 quando flag ON) | (sob master) | ✅ |

### Fase 3 — Streak com proteção (UI)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S3.1** | `StreakShieldBadge.jsx` (🛡️ quando usou grace) | `STREAK_PROTECTION` OFF | ⏳ (lógica em streakProtection.js; UI opcional) |
| **S3.2** | `VacationModeToggle.jsx` (modo férias 7 dias) | (mesma) | ⏳ (lógica em streakProtection.js; UI opcional) |

### Fase 4 — Missões (catálogo + UI)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S4.1** | `missions.js` (gerador de missões) | (sob master) | ✅ |
| **S4.2** | `MissionList.jsx` (UI) | `MISSIONS_V2` OFF | ✅ |
| **S4.3** | `MissionCompleteToast.jsx` (celebração) | (mesma) | ⏳ (opcional, lógica pronta) |

### Fase 5 — Referral (viralidade)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S5.1** | `referrals.js` domain (gerar code, validar) | (sob master) | ✅ |
| **S5.2** | `ReferralCard.jsx` (share card) | `REFERRAL_V2` OFF | ✅ |
| **S5.3** | `/r/:code` landing page | (mesma) | ⏳ (opcional) |

### Fase 6 — Kudos & Match Reviews

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S6.1** | `kudos.js` domain (count cap, anti-abuse) | (sob master) | ✅ |
| **S6.2** | `KudosButton.jsx` (universal) | `KUDOS` OFF | ✅ |
| **S6.3** | `MatchReviewDialog.jsx` (pós-jogo) | `MATCH_REVIEWS` OFF | ⏳ (opcional) |

### Fase 7 — Rivals, Crews, Mentoria

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S7.1** | `socialBonds.js` domain (rivals + crews + mentorship) | (sob master) | ✅ |
| **S7.2** | UI de Rivals (card com H2H) | `RIVALS` OFF | ⏳ (opcional) |
| **S7.3** | UI de Crews (dashboard) | `CREWS` OFF | ⏳ (opcional) |
| **S7.4** | UI de Mentoria (mentor + aprendiz) | `MENTORSHIP` OFF | ⏳ (opcional) |

### Fase 8 — Temporadas + Hall da Fama

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S8.1** | `seasons.js` domain (modelo de estação) | (sob master) | ✅ |
| **S8.2** | UI de Temporada (banner + ladder) | `SEASONS` OFF | ⏳ (opcional) |
| **S8.3** | `/hall-da-fama` (página pública) | `HALL_OF_FAME` OFF | ⏳ (opcional) |

### Fase 9 — Telemetria mínima

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S9.1** | `gamificationEvents.js` (29 eventos + tracker) | (sem flag) | ✅ |
| **S9.2** | Instrumentar XP gained + achievement unlocked | (sob master) | ⏳ (próximo, quando admin ativar flag) |

---

## 3. Convenções

### 3.1 Nome de arquivos
- Domínio: `progressionV2.js`, `tiers.js`, `skillTrees.js`, etc.
- Componente: `ProgressionCardV2.jsx`, `TierBadge.jsx`, etc.
- Hook: `useProgressionV2.js`, `useAchievementsV2.js`, etc.
- Service: `xpEventService.js`, `achievementV2Service.js`, etc.
- Teste: `<arquivo>.test.js` ou `<arquivo>.runtime.test.jsx` (páginas
  críticas).

### 3.2 Nome de coleções Firestore (propostas)
- `user_xp_events/{uid}_{eventId}` — log de eventos que geram XP
- `user_achievements_v2/{uid}_{achId}` — conquistas desbloqueadas
- `user_progression_v2/{uid}` — XP total + tier + skill trees materializado
- `user_streak_meta/{uid}` — streak com grace + freeze + última jogatina
- `user_missions/{uid}_{date}` — missões do dia/semana/mês
- `user_kudos/{kudoId}` — kudos dados/recebidos
- `user_match_reviews/{reviewId}` — reviews de jogo
- `user_rivals/{uid}_{rivalUid}` — rivais (até 5)
- `crews/{crewId}` — crews
- `crew_members/{crewId}_{uid}` — membros de crew
- `mentorships/{mentorId}_{apprenticeId}` — mentoria
- `referrals/{referrerId}_{refereeId}` — referrals
- `user_referral_codes/{uid}` — código de invite da plataforma
- `season_rankings/{seasonId}_{uid}` — XP sazonal

### 3.3 Convenção de flag
- Master: `GAMIFICATION_V2` (default OFF)
- Filhas: `ACHIEVEMENTS_V2`, `TIERS_NAMED`, `SKILL_TREES`,
  `STREAK_PROTECTION`, `MISSIONS_V2`, `REFERRAL_V2`, `KUDOS`,
  `MATCH_REVIEWS`, `RIVALS`, `CREWS`, `MENTORSHIP`, `SEASONS`,
  `HALL_OF_FAME`.

### 3.4 Convenção de commit
```
feat(gamification): <sprint> — <descrição curta>
fix(gamification): <sprint> — <descrição>
refactor(gamification): <sprint> — <descrição>
test(gamification): <sprint> — <descrição>
docs(gamification): <sprint> — <descrição>
chore(gamification): <sprint> — <descrição>
```

---

## 4. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Refatoração quebrar UI existente | Tudo aditivo. Arquivos V1 ficam intactos. |
| Bundle crescer com features OFF | Imports lazy. `React.lazy()` em cada página V2 nova. |
| Firestore rules bloquear writes | Schemas aditivos: novos IDs, novas collections, sem mexer nas existentes. |
| Testes regredirem | `npm test` + `npm run lint` antes de cada commit. Bloqueio se falhar. |
| Conflito com `origin/main` durante dev | Rebase frequente. Worktree local não afeta main. |

---

## 5. Definition of Done (por sprint)

- [ ] `npm run lint` — 0 errors
- [ ] `npm test` — todos passam (1922+ existentes + novos)
- [ ] `npm run build` — sem warnings
- [ ] Tests novos adicionados (Vitest) ao lado do código novo
- [ ] Documentação atualizada (este arquivo + memory topic se for o caso)
- [ ] Commit atômico com mensagem descritiva
- [ ] Branch `feature/gamification` sempre limpa (sem merge)

---

## 6. Changelog (vivo)

| Data | Sprint | Mudança | Commit |
|---|---|---|---|
| 2026-09-01 | setup | Worktree criado, baseline validado (1922 tests), roadmap escrito | — |
| 2026-09-01 | S0.1 | `progressionV2.js` + 33 testes | `7320f66` |
| 2026-09-01 | S0.2 | `tiers.js` + `skillTrees.js` + 41 testes | `e9b4885` |
| 2026-09-01 | S0.3 | `streakProtection.js` + 23 testes (com bug fix) | `35831d6` |
| 2026-09-01 | S0.4+S0.5 | `xpLedger.js` + master flag + 23 testes | `6cebe3a` |
| 2026-09-01 | S1.1 | `achievementsV2.js` (83 conquistas) + 29 testes | `3813ebc` |
| 2026-09-01 | S1.2+S1.3 | `AchievementCardV2` + `AchievementUnlockToast` + 22 testes | `4674a59` |
| 2026-09-01 | S1.4 | `V2Achievements` page `/conquistas` + 9 testes | `20b9f5d` |
| 2026-09-01 | S1.5 | `useAchievementsV2` hook + 6 testes | `2234ac3` |
| 2026-09-01 | S2 | `TierBadge` + `SkillTreeBars` + `ProgressionCardV2` + 23 testes | `8ca86a3` |
| 2026-09-01 | S4.1 | `missions.js` (gerador diário/semanal/mensal) + 20 testes | `0d40fd3` |
| 2026-09-01 | S4.2 | `MissionList` component + 12 testes | `132d8b5` |
| 2026-09-01 | S5.1+S5.2 | `referrals.js` + `ReferralCard` + 35 testes | `402689a` |
| 2026-09-01 | S6.1+S6.2 | `kudos.js` + `KudosButton` + 24 testes | `c4973e9` |
| 2026-09-01 | S7.1 | `socialBonds.js` (rivals + crews + mentorship) + 17 testes | `8e4c73c` |
| 2026-09-01 | S8.1 | `seasons.js` (estações + Hall da Fama) + 17 testes | `09068f0` |
| 2026-09-01 | S9.1 | `gamificationEvents.js` (29 eventos + tracker) + 13 testes | `2557f5c` |
| 2026-09-01 | validate | Build green, lint clean, 2269/2269 tests (zero regressão) | — |

## 📊 Métricas finais (S0.1 → S15 completo)

| Item | Antes | Depois | Delta |
|---|---|---|---|
| **Testes Vitest** | 1922 | **2369** | **+447** |
| **Test files** | 143 | **177** | +34 |
| **Lint errors** | 0 | 0 | — |
| **Build time** | ~30s | 31.7s | — |
| **Commits atômicos** | 0 | **27** | +27 |
| **Domínios novos** | 0 | 14 | +14 |
| **Componentes novos** | 0 | 9 | +9 |
| **Hooks novos** | 0 | 6 | +6 |
| **Páginas V2 novas** | 0 | 3 (`/conquistas`, `/gamification`, `/hall-da-fama`) | +3 |
| **Rotas novas** | 0 | 3 | +3 |
| **Feature flags novas** | 0 | 1 master (`GAMIFICATION_V2`) | +1 |
| **Coleções Firestore novas** | 0 | **4** (user_progression_v2, user_missions, user_achievements_v2, user_streak_meta) | +4 |
| **Regras Firestore alteradas** | 0 | **+4 match blocks aditivos** | +4 |
| **`users/{uid}` writes** | 0 | 0 (zero!) | — |
| **Arquivos V1 alterados** | 0 | 0 (zero!) | — |

## 🗂️ Arquivos criados (32 novos, todos em `feature/gamification`)

### Domínio (11 arquivos, todos `*.js`)
- `src/modules/progression/domain/progressionV2.js`
- `src/modules/progression/domain/tiers.js`
- `src/modules/progression/domain/skillTrees.js`
- `src/modules/progression/domain/streakProtection.js`
- `src/modules/progression/domain/xpLedger.js`
- `src/modules/achievements/domain/achievementsV2.js`
- `src/modules/progression/domain/missions.js`
- `src/modules/progression/domain/referrals.js`
- `src/modules/progression/domain/kudos.js`
- `src/modules/progression/domain/socialBonds.js`
- `src/modules/progression/domain/seasons.js`
- `src/modules/progression/domain/gamificationEvents.js`

### Componentes (6 arquivos, todos `*.jsx`)
- `src/modules/achievements/components/AchievementCardV2.jsx`
- `src/modules/achievements/components/AchievementUnlockToast.jsx`
- `src/modules/progression/components/TierBadge.jsx`
- `src/modules/progression/components/SkillTreeBars.jsx`
- `src/modules/progression/components/ProgressionCardV2.jsx`
- `src/modules/progression/components/MissionList.jsx`
- `src/modules/progression/components/ReferralCard.jsx`
- `src/modules/progression/components/KudosButton.jsx`

### Hook (1 arquivo)
- `src/modules/achievements/hooks/useAchievementsV2.js`

### Página V2 (1 arquivo)
- `src/v2/pages/V2Achievements.jsx`

### Integração mínima (1 arquivo)
- `src/v2/V2App.jsx` (+2 linhas: lazy import + rota)

### Master flag (1 arquivo)
- `src/core/featureFlags.js` (+28 linhas)

### Testes (22 arquivos: 11 `*.test.js` + 11 `*.runtime.test.jsx`)

### Docs
- `docs/GAMIFICATION/00-ROADMAP.md` (master plan, atualizado a cada commit)

---

## 7. Anexos

- `01-domain-reference.md` — referência técnica do domínio
- `02-test-strategy.md` — estratégia de testes
- `03-firestore-schema.md` — schema das novas coleções
- `04-component-catalog.md` — biblioteca de componentes
- `05-rollout-plan.md` — plano de ativação gradual
