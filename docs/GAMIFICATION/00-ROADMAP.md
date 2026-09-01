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
| **S0.1** | `progressionV2.js` (multi-fonte + XP_CAPS) | (sem UI) | `feat(gamification): domain progressionV2` | ⏳ |
| **S0.2** | `tiers.js` + `skillTrees.js` | (sem UI) | `feat(gamification): domain tiers + skill trees` | ⏳ |
| **S0.3** | `streakProtection.js` (grace + freeze) | (sem UI) | `feat(gamification): domain streak protection` | ⏳ |
| **S0.4** | `xpLedger.js` (computeXpEvent, computação por evento) | (sem UI) | `feat(gamification): domain xp ledger` | ⏳ |
| **S0.5** | `featureFlags.js` add `GAMIFICATION_V2` master | master OFF | `feat(gamification): master flag` | ⏳ |

### Fase 1 — Achievements V2 (catálogo)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S1.1** | `achievementsV2.js` (5 famílias, 5 raridades, ~80 conquistas) | (sob master) | ⏳ |
| **S1.2** | `AchievementCardV2.jsx` (componente presentational) | (sob master) | ⏳ |
| **S1.3** | `AchievementUnlockToast.jsx` (animação) | (sob master) | ⏳ |
| **S1.4** | `V2Achievements.jsx` página pública `/conquistas` | `ACHIEVEMENTS_V2` OFF | ⏳ |
| **S1.5** | Hook `useAchievementsV2` (lê + calcula unlocked/pending) | (sob master) | ⏳ |

### Fase 2 — Níveis com nome + Skill Trees (UI)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S2.1** | `TierBadge.jsx` (visual) | `TIERS_NAMED` OFF | ⏳ |
| **S2.2** | `SkillTreeBars.jsx` (5 barras) | `SKILL_TREES` OFF | ⏳ |
| **S2.3** | `ProgressionCardV2.jsx` (substitui v1 quando flag ON) | (sob master) | ⏳ |

### Fase 3 — Streak com proteção (UI)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S3.1** | `StreakShieldBadge.jsx` (🛡️ quando usou grace) | `STREAK_PROTECTION` OFF | ⏳ |
| **S3.2** | `VacationModeToggle.jsx` (modo férias 7 dias) | (mesma) | ⏳ |

### Fase 4 — Missões (catálogo + UI)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S4.1** | `missions.js` (gerador de missões) | (sob master) | ⏳ |
| **S4.2** | `MissionList.jsx` (UI) | `MISSIONS_V2` OFF | ⏳ |
| **S4.3** | `MissionCompleteToast.jsx` (celebração) | (mesma) | ⏳ |

### Fase 5 — Referral (viralidade)

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S5.1** | `referrals.js` domain (gerar code, validar) | (sob master) | ⏳ |
| **S5.2** | `ReferralCard.jsx` (share card) | `REFERRAL_V2` OFF | ⏳ |
| **S5.3** | `/r/:code` landing page | (mesma) | ⏳ |

### Fase 6 — Kudos & Match Reviews

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S6.1** | `kudos.js` domain (count cap, anti-abuse) | (sob master) | ⏳ |
| **S6.2** | `KudosButton.jsx` (universal) | `KUDOS` OFF | ⏳ |
| **S6.3** | `MatchReviewDialog.jsx` (pós-jogo) | `MATCH_REVIEWS` OFF | ⏳ |

### Fase 7 — Rivals, Crews, Mentoria

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S7.1** | `rivals.js` + `crews.js` + `mentorships.js` domain | (sob master) | ⏳ |
| **S7.2** | UI de Rivals (card com H2H) | `RIVALS` OFF | ⏳ |
| **S7.3** | UI de Crews (dashboard) | `CREWS` OFF | ⏳ |
| **S7.4** | UI de Mentoria (mentor + aprendiz) | `MENTORSHIP` OFF | ⏳ |

### Fase 8 — Temporadas + Hall da Fama

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S8.1** | `seasons.js` domain (modelo de estação) | (sob master) | ⏳ |
| **S8.2** | UI de Temporada (banner + ladder) | `SEASONS` OFF | ⏳ |
| **S8.3** | `/hall-da-fama` (página pública) | `HALL_OF_FAME` OFF | ⏳ |

### Fase 9 — Telemetria mínima

| Sprint | Escopo | Flag | Status |
|---|---|---|---|
| **S9.1** | `telemetry/events.js` (15 eventos) | (sem flag) | ⏳ |
| **S9.2** | Instrumentar XP gained + achievement unlocked | (sob master) | ⏳ |

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
| 2026-09-01 | setup | Worktree criado, baseline validado, roadmap escrito | — |

---

## 7. Anexos

- `01-domain-reference.md` — referência técnica do domínio
- `02-test-strategy.md` — estratégia de testes
- `03-firestore-schema.md` — schema das novas coleções
- `04-component-catalog.md` — biblioteca de componentes
- `05-rollout-plan.md` — plano de ativação gradual
