# Changelog · PickleRush Gamification V2

## [1.0.0] · 2026-09-02 — Implementação completa

### Adicionado

#### Domínio (14 novos arquivos)
- `progressionV2.js` — XP multi-fonte com 40+ fontes, caps diário/semanal/burst
- `tiers.js` — 9 tiers (Calouro→Imortal) com curva progressiva
- `skillTrees.js` — 5 árvores paralelas (tournament/match/social/mentorship/consistency)
- `streakProtection.js` — grace day, freeze, vacation mode, comeback bonus, milestones
- `xpLedger.js` — event validation + anti-farming
- `missions.js` — gerador diário/semanal/mensal (25 templates, Mulberry32 PRNG)
- `referrals.js` — códigos 8-char, recompensas, anti-farm
- `kudos.js` — universal, 7 target types, spam detection
- `socialBonds.js` — rivals, crews, mentorship
- `seasons.js` — 4 seasons/ano, hall da fama sazonal
- `gamificationEvents.js` — 29 eventos em snake_case
- `achievementsV2.js` — 83 conquistas (5 famílias × 5 raridades)
- `progressionV2Schema.js` — Zod schemas para Firestore
- (telemetry já vem da V1)

#### Componentes (9 novos)
- `TierBadge` — badge com cor/ícone por tier + crown no Imortal
- `SkillTreeBars` — 5 barras paralelas com progresso
- `ProgressionCardV2` — card unificado (tier + nível + streak + skills + próximo)
- `MissionList` — missões com 3 sizes + bonus claim
- `ReferralCard` — código + share + recompensas
- `KudosButton` — universal, optimistic, 3 sizes
- `AchievementCardV2` — raridade glow + family color + share
- `AchievementUnlockToast` — slide+fade (já existia)
- `MissionCompleteToast` — slide+fade
- `StreakShieldBadge` — grace + freeze + vacation + comeback

#### Hooks (6 novos)
- `useAchievementsV2` — combina stats/rating/matchDates
- `useUserProgressionV2` — observa doc materializado
- `useUserMissionsV2` — auto-cria doc do dia
- `useUserAchievementsV2` — observa unlocked
- `useStreakMetaV2` — grace + freeze + vacation
- `useGamificationTracker` — gtag/firebase.analytics instrumentação
- `useSyncProgressionV2` — materializa doc a partir do V1
- `useHallOfFame` — top 50
- `useCelebrationListener` — dispara toasts em eventos

#### Services Firestore (4 novos)
- `progressionV2Service` — get/set/watch com validação
- `missionService` — getOrCreate + progress + claim
- `achievementsV2Service` — list + unlock + share + notified
- `streakMetaService` — getOrCreate + enable/disable vacation + consume/add freeze
- `hallOfFameService` — query top 50

#### Páginas V2 (3 novas, todas gated)
- `/conquistas` — V2Achievements (catálogo 83)
- `/gamification` — V2GamificationHome (hub unificado)
- `/hall-da-fama` — V2HallOfFame (podium + ranking top 50)

#### Persistência
- 4 coleções Firestore novas: `user_progression_v2`, `user_missions`, `user_achievements_v2`, `user_streak_meta`
- 4 match blocks aditivos no `firestore.rules` (todas com leitura por owner+admin, escrita por owner+admin)
- Schema versioning (`schemaVersion: 1`) em todos os docs

#### Integração
- V2Profile mostra `ProgressionCardV2` quando flag ON
- Telemetria: 29 eventos com prefix `gamification_*`
- Tailwind keyframes: `slide-in-right`, `slide-out-right`

### Garantias
- **Zero impacto em V1** (1922 testes V1 continuam passando)
- **Zero alteração em `users/{uid}`**
- **Bundle size**: lazy imports — só carrega se você acessar a rota
- **Feature flag única**: `GAMIFICATION_V2` controla tudo
- **27 commits atômicos** com mensagens descritivas
- **+447 testes** Vitest (1922→2369)

### Como ativar

```bash
# 1. Merge via PR
git push -u origin feature/gamification
gh pr create --base main --head feature/gamification

# 2. Após merge, no /admin/console:
#    Ativar flag: GAMIFICATION_V2 = true

# 3. Rotas ficam disponíveis:
#    /conquistas      → 83 conquistas
#    /gamification    → Hub (missões + tier + achievements + skill trees + referral)
#    /hall-da-fama    → Top 50 público
```

### Métricas
- **+447 testes** (1922 → 2369)
- **27 commits atômicos**
- **14 domínios novos**
- **9 componentes novos**
- **6 hooks novos**
- **5 services novos**
- **3 páginas V2 novas**
- **4 coleções Firestore novas (todas com regras aditivas)**
- **1 feature flag master**
- **0 alteração em V1**
- **0 alteração em `users/{uid}`**
- **Lint clean, build green**
