# 38 — Gamificação V2 completa (flag `gamification_v2`)

> Flag-mestra `gamification_v2` (default **OFF**). Desligada, nada disto existe:
> nenhuma rota abre, nenhum menu aparece, nenhuma consulta é feita. Ligada, o
> admin ainda escolhe **módulo a módulo** o que vale (`platform_settings/gamification`).

## 1. O que é

Uma camada que transforma o que a pessoa já faz (jogar, se inscrever, avaliar,
ensinar, manter uma arena) em **XP, nível, missões, conquistas, temporada,
desafios e recompensas** — sem cobrança. Ninguém perde pontos por ficar parado.

| Para quem | O que tem | Onde |
|---|---|---|
| Atleta | Jornada (XP, nível, árvore de habilidades, primeiros passos), Missões (semana/mês), Competir (duelos, desafios, Temporada, Hall da Fama), Social (avaliações, cartas, reputação, mentoria), Recompensas, Revisão da semana/mês, Configurações | `/gamification?aba=…`, `/gamification/revisao`, `/gamification/configuracoes`, `/conquistas`, `/hall-da-fama`, `/vinculos` |
| Professor | Saúde da base, metas, desafios e recompensas para os alunos | Painel do professor (`/aulas`) → Engajamento (`?aba=engajamento`) |
| Arena | Saúde, metas, desafios e recompensas para quem joga na arena | Central → Desempenho → Engajamento (`?aba=engajamento`) |
| Clube | Atividade do clube | Detalhe do clube → `?tab=atividade` (admin) |
| Admin da plataforma | Configuração (13 módulos, regras, temporada), desafios e recompensas da plataforma, integridade (revisão antifarm) e métricas | Painel admin → Gamificação (`gam-config`, `gam-challenges`, `gam-rewards`, `gam-integrity`, `gam-metrics`) |

## 2. Princípios que não podem regredir

1. **Um motor só no cliente** — `useGamificationEngine` (`modules/progression/hooks`). Compõe stats, fatos, preferências, XP concedido, missões e conquistas; **só grava com `ready`** (nunca um total parcial). Não crie uma segunda conta de XP.
2. **XP é DERIVADO** (`computeTotalXpV2`): atividade + bônus de conquistas + missões + primeiros passos + XP concedido pelo servidor (`user_xp_grants`). Servidor é o único escritor de grants, reputação, hall, métricas, integridade e do valor/posição das entradas de desafio.
3. **Falha não é vazio.** Fonte que falhou é `null`/`undefined`: o número vira "não deu para medir", nunca zero; erro tem texto próprio e "Tentar de novo"; comando que regravaria sobre estado desconhecido **não é renderizado**.
4. **Privacidade na regra, não na tela.** Hall/Temporada públicos saem de `buildRankingRows` no servidor (só quem é público); tier e conquistas no perfil público passam por `gamificationPublicOk(uid)` no `firestore.rules`.
5. **Antifarm marca, nunca pune.** Pares suspeitos de avaliação e picos de XP vão para a fila de integridade do admin.
6. **Tempo de Brasília**; semana segunda–domingo. Paridade cliente×servidor travada em `domain/serverParity.test.js`.
7. **Aditividade.** Zero migração; campos novos opcionais; coleções novas com regras novas.

## 3. Banco

Coleções novas (todas em `firestore.rules`, 69 asserções no emulador em `tests/rules/gamificationV2.rules.test.js`):
`user_gamification_prefs`, `user_xp_grants`, `gamification_moderation`, `gamification_flags`, `gamification_metrics`, `gamification_integrity`, `hall_of_fame`, `match_reviews`, `user_reputation`, `user_reputation_private`, `partner_letters`, `partner_letter_authors`, `gamification_challenges`, `challenge_entries`, `duels`, `gamification_rewards`, `reward_claims`, `gamification_goals`. Configuração do admin: documento `platform_settings/gamification`.

Já existiam e foram estendidas: `user_progression_v2` e `user_achievements_v2` (leitura: dono, admin ou `gamificationPublicOk`), `season_rankings` (campos públicos opcionais), `mentorships` (convite com aceite: `pending` + `proposedBy`; só a **outra** pessoa aceita).

Índices compostos novos em `firestore.indexes.json` (4). Consultas com `where` + `orderBy` seguem o guarda `indicesCompostos.test.js`.

## 4. Servidor (Cloud Functions, codebase `picklerush`)

`gamificationChallengeStandings`, `gamificationWeeklyDuels`, `gamificationWeeklyDigest`, `gamificationDailyUpkeep` (agendadas). Núcleo puro em `functions/gamificationCore.js`; a temporada em `functions/seasonRanking.js` (linhas com `percent`, `public`, `publicPosition`…). O deploy é por nome (`scripts/functions-deploy.sh` lê os `exports.*` de `functions/index.js`).

## 5. Módulos ligáveis pelo admin

`missions_weekly`, `missions_monthly`, `onboarding`, `weekly_review`, `celebrations`, `hall_of_fame`, `duels`, `challenges`, `rewards`, `match_reviews`, `partner_letters`, `social_bonds`, `supply_panels`. Módulo desligado some da tela (nunca aparece desabilitado) e **não consulta**.

## 6. Mapa do código

- Domínio puro (todo com `.test.js`): `src/modules/progression/domain/` — `gamificationSnapshot`, `supplyMetrics`, `issuerForms`, `syncSchedule`, `challenges`, `rewards`, `onboarding`, `periodReview`, `serverParity.test.js`…
- Hooks: `useGamificationEngine` (central), `useMissionXpTotal`, `usePeriodReview`, `usePeople`, `useSocialGamification`, `useChallenges`, `useRewards`, `useOwnerGoals`, `useGamificationAdmin`, `useClubPublishedGames`.
- UI: `src/v2/components/gamification/` (hub, painéis, `issuer/` para professor/arena/clube), `src/v2/components/admin/gamification/` (console do admin), páginas `V2Gamification*`, `V2HallOfFame`, `V2Achievements`, `V2PublicAchievements`, `V2SocialBonds`.
- Sincronização de fundo: `GamificationBackground` (lazy no `V2Layout`) recalcula a cada 12 h (`syncIsDue`) e registra visitas do roteiro. Preferência por usuário no navegador (`gamificacao:sync`).

## 7. Como ligar em produção

1. Painel admin → Funcionalidades → ligar `gamification_v2`.
2. Painel admin → Gamificação → Configuração: escolher os módulos (comece por Jornada, Missões e Hall) e revisar os prêmios da temporada.
3. Opcional: criar desafios e recompensas da plataforma.
4. Conferir a fila de integridade e as métricas nos primeiros dias.

## 8. Ajuda

Três artigos (atleta, professor, arena) atrás da própria flag (`flags: ['gamification_v2']`) em `src/modules/help/domain/helpCenter.js`, mais pistas de rota para `/gamification`, `/hall-da-fama` e `/conquistas`.
