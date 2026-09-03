# `progression/` — Progressão do atleta

Curvas de progressão, níveis, metas e (desde a Onda R) todo o sistema de
**Gamificação V2**. Reusado por `performance/` e `profile/`.

## Status
- **Domain**: `progression.js` (V1), `progressionV2.js`, `tiers.js`,
  `skillTrees.js`, `streakProtection.js`, `missions.js`, `missionDay.js`,
  `kudos.js`, `referrals.js`, `socialBonds.js`, `seasons.js`,
  `xpLedger.js`, `gamificationEvents.js`, schemas (`progressionV2Schema.js`,
  `gamificationV2Schema2.js`)
- **Services**: `progressionV2Service`, `missionService`, `kudoService`,
  `referralService`, `socialBondService`, `streakMetaService`,
  `seasonRankingService`, `hallOfFameService`, `goalService`
- **Hooks**: `useProgression` (V1), `useUserProgressionV2`,
  `useSyncProgressionV2`, `useUserMissionsV2`, `useStreakMetaV2`,
  `useKudoActions`, `useUserSocialBonds`, `useUserSeasonRanking`,
  `useUserReferralCode`, `useHallOfFame`, `useCelebrationListener`,
  `useGamificationTracker`
- **Components**: `TierBadge`, `SkillTreeBars`, `ProgressionCardV2`,
  `MissionList`, `MissionCompleteToast`, `StreakShieldBadge`,
  `KudosButton`, `ReferralCard`, `SeasonBanner`

## Feature flag
- `GAMIFICATION_V2` (`gamification_v2`) — master, **default OFF**.
  Desligada, nada da V2 monta e nenhuma coleção V2 recebe request.

## Regras que não podem ser quebradas

1. **Vocabulário tem uma fonte só.** Os nomes de tier vivem em
   `tiers.js` (`TIER_NAMES`); as 5 trilhas vivem em `skillTrees.js`
   (`SKILL_TREE_KEYS`). O schema Zod e o `firestore.rules` derivam daí.
   Redigitar essas listas já causou o bug em que nenhum atleta acima de
   12.000 XP conseguia salvar a progressão.
   O teste `domain/gamificationRulesSync.test.js` guarda essa sincronia e
   roda na CI.

2. **Mapa vs lista de trilhas.** O domínio calcula um MAPA
   (`buildSkillTrees().trees`); o Firestore guarda uma LISTA. A ponte é
   `toSkillTreeSnapshots` / `fromSkillTreeSnapshots` — não converta na mão.

3. **A curva de nível não muda.** `levelFromXpV2` é numericamente idêntica
   a `levelFromXp` (V1) e não tem teto. `MAX_LEVEL_V2` é só um limite de
   sanidade da persistência.

4. **O dia é o dia de Brasília.** Missões, cap diário de kudos e mês de
   indicação usam `missionDay.js`, nunca `toISOString()` (que é UTC e
   virava o dia às 21h para o usuário brasileiro).

5. **Transação do Firestore lê tudo antes de escrever.** Um `tx.get` depois
   de um `tx.set`/`tx.delete` derruba a transação inteira.

6. **Escrita cruzada é estreita.** Dar kudo mexe no índice de quem recebe e
   registrar indicação mexe no código do indicador — as regras permitem
   apenas +1 por vez, nos campos daquele fluxo.

## Regras do Firestore
Testadas de verdade contra o emulador em
`tests/rules/gamification.rules.emulator.mjs` (51 asserções). Não roda no
`npm test` — precisa de Java + o .jar do emulador; o cabeçalho do arquivo
tem o comando.

## Onde achar mais
- `docs/06-MODULES.md` § progression
- `docs/05-DATA-MODEL.md` § Gamificação V2 (13 coleções)
- `docs/GAMIFICATION/00-ROADMAP.md`
