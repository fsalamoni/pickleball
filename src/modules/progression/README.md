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
  `KudosButton`, `ReferralCard`, `SeasonBanner`, `RivalsList`,
  `CrewsPanel`, `MentorshipsPanel`

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

7. **Missão NÃO é auto-declaração.** O progresso vem de `missionMetrics.js`,
   derivado da atividade real (datas de partida, torneios, contadores de
   kudos e indicação). Existia um botão "+1" na lista de missões que deixava
   qualquer um concluir "Jogue 3 partidas" sem entrar em quadra — e receber o
   XP. `MissionList` é somente leitura.

8. **Só existe missão para métrica mensurável.** `isMeasurableMetric(metric,
   scope)` filtra o sorteio. Isso reduz o pool hoje (4 mensais em vez de 10);
   conforme outros módulos exponham seus contadores, some a métrica em
   `MEASURABLE_MISSION_METRICS` e as missões voltam sozinhas.

9. **Progresso de missão nunca regride.** Se um resultado é corrigido depois,
   a missão concluída continua concluída — tirar do usuário algo que ele já
   viu conquistado é pior que a imprecisão.

## De onde vem o XP

`xpTotal` = **atividade** + **bônus das conquistas registradas** + **XP das
missões concluídas** (`domain/xpTotal.js`).

Nenhuma parcela é um contador que a UI incrementa: cada uma é derivada de um
fato que existe uma vez só (estatística real, documento de conquista
idempotente, documento de missão do dia). Por isso recalcular do zero sempre
dá o mesmo número — e por isso não há como farmar. Há teste de idempotência.

Antes disso o XP vinha só das cinco estatísticas de torneio: os 42.100 XP em
bônus do catálogo de conquistas e todo o XP de missão eram decorativos.

## Vínculos sociais (`/vinculos`)

- **Rivais** são DERIVADOS de `useHeadToHead` (confrontos reais). A coleção
  `user_rivals` existe no backend mas nada a preenche — derivar do histórico
  dá dado verdadeiro desde o primeiro jogo e sem nada para sincronizar.
- **Crews** e **mentorias** usam as coleções próprias (`crews`,
  `crew_members`, `mentorships`), com as escritas cruzadas estreitas descritas
  acima.
- Iniciar mentoria não tem botão: é convite entre duas pessoas e o fluxo de
  convite ainda não existe. Um botão unilateral criaria vínculo sem o outro
  lado aceitar.

## Fluxo da indicação (referral)

1. O atleta vê o próprio código em `/gamification` (`ReferralCard`), lido de
   `user_referral_codes/{uid}` — **nunca gerado no render**.
2. Compartilha `/r/CODIGO` (`buildReferralUrl`).
3. O convidado abre `V2ReferralLanding`, que guarda o código em
   `localStorage` (`referralCapture.js`) — ele precisa sobreviver ao desvio
   pelo login social.
4. No **primeiro** login da conta nova, `FirebaseAuthContext` chama
   `creditPendingReferral` → `claimReferralForNewUser`, que resolve o dono do
   código e grava `user_referrals/{refereeUid}`, creditando +1 no indicador.

Tudo best-effort: falha de indicação nunca atrapalha a criação da conta.
Com a flag OFF, o passo 3 não guarda nada, então o passo 4 é no-op.

## Regras do Firestore
Testadas de verdade contra o emulador em
`tests/rules/gamification.rules.emulator.mjs` (51 asserções). Não roda no
`npm test` — precisa de Java + o .jar do emulador; o cabeçalho do arquivo
tem o comando.

## Onde achar mais
- `docs/06-MODULES.md` § progression
- `docs/05-DATA-MODEL.md` § Gamificação V2 (13 coleções)
- `docs/GAMIFICATION/00-ROADMAP.md`
