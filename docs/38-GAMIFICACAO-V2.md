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
| Atleta | Jornada (XP, nível, sequência, trilhas, primeiros passos), Missões (dia/semana/mês), Competir (duelos, desafios, Temporada, Hall da Fama), Social (avaliações, cartas, reputação, mentoria), Recompensas, Revisão da semana/mês, Configurações | `/gamification?aba=…`, `/gamification/como-funciona`, `/gamification/revisao`, `/gamification/configuracoes`, `/conquistas`, `/hall-da-fama`, `/vinculos` |
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

Coleções novas (todas em `firestore.rules`, 73 casos no emulador em `tests/rules/gamificationV2.rules.test.js`):
`user_gamification_prefs`, `user_xp_grants`, `gamification_moderation`, `gamification_flags`, `gamification_metrics`, `gamification_integrity`, `hall_of_fame`, `match_reviews`, `user_reputation`, `user_reputation_private`, `partner_letters`, `partner_letter_authors`, `gamification_challenges`, `challenge_entries`, `duels`, `gamification_rewards`, `reward_claims`, `gamification_goals`. Configuração do admin: documento `platform_settings/gamification`.

Já existiam e foram estendidas: `user_progression_v2` e `user_achievements_v2` (leitura: dono, admin ou `gamificationPublicOk`), `season_rankings` (campos públicos opcionais), `mentorships` (convite com aceite: `pending` + `proposedBy`; só a **outra** pessoa aceita).

Campos **opcionais** acrescentados a documentos que já existiam (nenhuma regra mudou — quatro casos do emulador provam que a regra de sempre os aceita e que a privacidade segue igual):

- `user_streak_meta/{uid}.vacations: [{ from, to|null }]` — os períodos de férias da sequência (até 8; o documento antigo, só com `vacationMode`/`vacationStartedAt`, segue válido e é lido por `vacationPeriodsOf`).
- `gamification_metrics/{dia}.onboarding: { dismissed, steps: { <id>: n } }` — o funil dos primeiros passos; só o servidor escreve, só o admin lê.

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

## 6.1 A sequência (Onda W2)

`modules/progression/domain/weekStreak.js` — **a única conta** de sequência (hub, perfil, marcos, recompensas e conquistas leem a mesma):

- semanas de **segunda a domingo em Brasília** com pelo menos um jogo; a semana de agora ainda está aberta (nunca quebra, fica "em risco");
- **zera** quando a pessoa para (🐞 antes a sequência antiga ficava no número para sempre); o **recorde** (`best`) alimenta as conquistas, a sequência de agora (`weeks`) alimenta tela, marcos e recompensas;
- **folga automática**: uma semana em branco por mês, nunca duas seguidas; não soma;
- **férias** declaradas: cobrem até 4 semanas (`STREAK_VACATION_MAX_DAYS`) e só reiniciam 90 dias depois (`STREAK_VACATION_COOLDOWN_DAYS`) — a regra mora no serviço (`enableVacation` recusa com mensagem em português), não só na tela.

A proteção antiga (dias de folga e congelamentos) era decorativa: o motor calculava sem lê-la. Foi removida junto com `StreakShieldBadge`.

## 6.2 Texto explicativo, dicas e ajuda (Onda W2)

Uma fonte só para o que a plataforma diz sobre si mesma:

| Camada | Onde | Quando aparece |
|---|---|---|
| **Guia completo** `/gamification/como-funciona` | `domain/gamificationGuide.js` (≈36 termos, por público: atleta, professor, arena, clube, admin; busca; perguntas frequentes) + `V2GamificationGuide` | sempre que a flag está ligada; o público "admin" só para o dono |
| **"?" em cada conceito** | `TermHint` (balão de uma frase + "Entender melhor") e `TermNote` (a frase visível) | nos títulos de hub, painéis, Hall, vínculos, preferências e console |
| **"Como funciona" de cada aba** | `HowItWorks` (cartão recolhível que lembra a escolha) | no topo de Jornada, Missões, Competir, Social e Recompensas |
| **Dicas guiadas** | área "Gamificação" do painel de dicas: 17 guias (atleta, arena, professor, admin) e 20 pontos; ver `docs/32-DICAS-GUIADAS.md` §8.1 | só quando a pessoa pede (flag `guided_tips`) |
| **Central de Ajuda** | 11 artigos em Atleta/Arena/Professor, 4 perguntas frequentes e 7 pistas de rota; ver `docs/21-CENTRAL-DE-AJUDA.md` | só com `gamification_v2` ligada |

**Os números nunca são escritos à mão**: o guia os lê de `XP_WEIGHTS_V2`, `TIERS`, `MISSIONS_PER_SCOPE`, `MISSION_BONUS_XP`, `ONBOARDING_STEPS`, `weekStreak`, dos limites das avaliações/cartas/vínculos e **da configuração do admin** — mudou o prêmio da temporada, o texto muda. Há teste de paridade para cada um (`gamificationGuide.test.js`), e os artigos da ajuda que repetem um número (as férias) têm o seu.

## 6.3 Para o admin (Onda W2)

- **Configuração** agrupa os onze números por parte (temporada e placar público · duelo · avaliações · integridade) e diz quando o módulo do grupo está desligado (o valor só vale quando ele for ligado).
- **Métricas** ganharam o **funil dos primeiros passos**: por etapa, quantas pessoas concluíram (sobre quem abriu a gamificação), a etapa que menos gente conclui e quantas dispensaram o roteiro. O servidor conta com consultas de agregação em índice de campo único (nenhum índice novo); retrato antigo diz "ainda não medido", nunca zeros.
- 🐞 `listMetrics` trazia os 60 retratos mais **antigos** (limit sem ordem): passados 60 dias o painel mostraria um retrato velho como "o último". Agora ordena por dia decrescente.

## 7. Como ligar em produção

1. Painel admin → Funcionalidades → ligar `gamification_v2`.
2. Painel admin → Gamificação → Configuração: escolher os módulos (comece por Jornada, Missões e Hall) e revisar os prêmios da temporada.
3. Opcional: criar desafios e recompensas da plataforma.
4. Conferir a fila de integridade e as métricas nos primeiros dias.

## 8. Ajuda

Onze artigos (nove do atleta — visão geral, XP/nível/tier, missões, sequência, competir, social, recompensas, privacidade e clube —, um da arena e um do professor) atrás da própria flag (`flags: ['gamification_v2']`) em `src/modules/help/domain/helpCenter.js`, quatro perguntas frequentes e pistas de rota para `/gamification`, `/gamification/como-funciona`, `/gamification/revisao`, `/gamification/configuracoes`, `/hall-da-fama`, `/vinculos` e `/conquistas`. Detalhes em §6.2.
