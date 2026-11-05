# 38 — Gamificação V2 completa (flag `gamification_v2`)

> **Estado (2026-10-15):** `gamification_v2` incorporada — sempre ligada
> (`PERMANENT_FEATURE`) desde 2026-10-10; o texto abaixo que fala em ligar ou
> desligar a flag é histórico. O admin segue escolhendo **módulo a módulo** o
> que vale (`platform_settings/gamification`).

## 1. O que é

Uma camada que transforma o que a pessoa já faz (jogar, se inscrever, avaliar,
ensinar, manter uma arena) em **XP, nível, missões, conquistas, temporada,
desafios e recompensas** — sem cobrança. Ninguém perde pontos por ficar parado.

| Para quem | O que tem | Onde |
|---|---|---|
| Atleta | Jornada (XP, nível, sequência, trilhas, primeiros passos), Missões (dia/semana/mês), Competir (duelos, desafios, Temporada, Hall da Fama), Social (avaliações, cartas, reputação, mentoria), Recompensas, Revisão da semana/mês, Configurações | `/gamification?aba=…`, `/gamification/como-funciona`, `/gamification/revisao`, `/gamification/configuracoes`, `/conquistas`, `/hall-da-fama`, `/vinculos` |
| Professor | Saúde da base, metas, desafios e recompensas para os alunos | Painel do professor (`/aulas`) → Engajamento (`?aba=engajamento`) |
| Arena | Saúde, metas, desafios e recompensas para quem joga na arena | Central → Desempenho → Engajamento (`?aba=engajamento`) |
| Clube | Atividade, metas, desafios e recompensas do clube | Central do clube → Engajamento (`/clubes/:id/gerir?aba=engajamento`, só a administração) |
| Admin da plataforma | Configuração (14 módulos, regras, temporada), desafios e recompensas da plataforma, integridade (revisão antifarm) e métricas | Painel admin → Gamificação (`gam-config`, `gam-challenges`, `gam-rewards`, `gam-integrity`, `gam-metrics`) |

## 2. Princípios que não podem regredir

1. **Um motor só no cliente** — `useGamificationEngine` (`modules/progression/hooks`). Compõe stats, fatos, preferências, XP concedido, missões e conquistas; **só grava com `ready`** (nunca um total parcial). Não crie uma segunda conta de XP.
2. **XP é DERIVADO** (`computeTotalXpV2`): atividade + bônus de conquistas + missões + primeiros passos + XP concedido pelo servidor (`user_xp_grants`). Servidor é o único escritor de grants, reputação, hall, métricas, integridade e do valor/posição das entradas de desafio.
3. **Falha não é vazio.** Fonte que falhou é `null`/`undefined`: o número vira "não deu para medir", nunca zero; erro tem texto próprio e "Tentar de novo"; comando que regravaria sobre estado desconhecido **não é renderizado**.
4. **Privacidade na regra, não na tela.** Hall/Temporada públicos saem de `buildRankingRows` no servidor (só quem é público); tier e conquistas no perfil público passam por `gamificationPublicOk(uid)` no `firestore.rules`.
5. **Antifarm marca, nunca pune.** Pares suspeitos de avaliação e picos de XP vão para a fila de integridade do admin.
6. **Tempo de Brasília**; semana segunda–domingo. Paridade cliente×servidor travada em `domain/serverParity.test.js`.
7. **Aditividade.** Zero migração; campos novos opcionais; coleções novas com regras novas.

## 3. Banco

Coleções novas (todas em `firestore.rules`, 74 casos no emulador em `tests/rules/gamificationV2.rules.test.js`):
`user_gamification_prefs`, `user_xp_grants`, `gamification_moderation`, `gamification_flags`, `gamification_metrics`, `gamification_integrity`, `hall_of_fame`, `match_reviews`, `user_reputation`, `user_reputation_private`, `partner_letters`, `partner_letter_authors`, `gamification_challenges`, `challenge_entries`, `duels`, `gamification_rewards`, `reward_claims`, `gamification_goals`. Configuração do admin: documento `platform_settings/gamification`.

**Metas do mês que ainda não existem** (`gamification_goals/{coach|arena|club}_{dono}_{AAAA-MM}`): a leitura olha `resource.data`, que é nulo num documento que não existe, então o `get` dava erro de permissão e o painel de Engajamento mostrava "Não deu para carregar as metas" para o dono, todo mês novo. `canGetMissingGoals` libera o `get` do documento AUSENTE só para o dono que o id nomeia (o mesmo desenho de `canGetMissingArenaUserDoc`); id malformado e conta de outro dono seguem recusados (caso do emulador "mês sem metas").

Já existiam e foram estendidas: `user_progression_v2` e `user_achievements_v2` (leitura: dono, admin ou `gamificationPublicOk`), `season_rankings` (campos públicos opcionais), `mentorships` (convite com aceite: `pending` + `proposedBy`; só a **outra** pessoa aceita).

Campos **opcionais** acrescentados a documentos que já existiam (nenhuma regra mudou — quatro casos do emulador provam que a regra de sempre os aceita e que a privacidade segue igual):

- `user_streak_meta/{uid}.vacations: [{ from, to|null }]` — os períodos de férias da sequência (até 8; o documento antigo, só com `vacationMode`/`vacationStartedAt`, segue válido e é lido por `vacationPeriodsOf`).
- `gamification_metrics/{dia}.onboarding: { dismissed, steps: { <id>: n } }` — o funil dos primeiros passos; só o servidor escreve, só o admin lê.

Índices compostos novos em `firestore.indexes.json` (4). Consultas com `where` + `orderBy` seguem o guarda `indicesCompostos.test.js`.

## 4. Servidor (Cloud Functions, codebase `picklerush`)

`gamificationChallengeStandings`, `gamificationWeeklyDuels`, `gamificationWeeklyDigest`, `gamificationDailyUpkeep` (agendadas). Núcleo puro em `functions/gamificationCore.js`; a temporada em `functions/seasonRanking.js` (linhas com `percent`, `public`, `publicPosition`…). O deploy é por nome (`scripts/functions-deploy.sh` lê os `exports.*` de `functions/index.js`).

### 4.1 Correções do PR 0b da Carreira (2026-11-04)

Cada uma tem teste que falha sem ela:

- **Teto e tipo da concessão** — `conceder()` (`functions/gamification.js`) grava no máximo `MAX_GRANT_XP` (5.000) e recusa `kind` fora de `XP_GRANT_KINDS`. Antes, um prêmio de desafio acima do teto era gravado inteiro e o cliente (`isValidGrant`) o **ignorava**: a pessoa via o prêmio anunciado e o XP não entrava. Lista de tipos e teto têm paridade com `xpGrants.js` (`serverParity.test.js`).
- **Salto de XP sobre o XP próprio** — `integritySignals` mede o `xp_jump` sobre `xpTotal − grantsXp`, com o `grantsXp` limitado ao que o servidor de fato concedeu (`grantsXpByUid`, lido de `user_xp_grants`: o dono grava o campo, e um valor forjado esconderia o salto), e a fotografia de `gamification_integrity` passou a guardar o próprio. Fechar a temporada ou um desafio (concessões do servidor) abria sinal de salto para o admin. A fotografia antiga (com o total) só deixa o delta menor na primeira passada — nunca abre sinal falso.
- **Configuração lida igual nos dois lados** — paridade de `normalizarConfig` (servidor) × `normalizeGamificationConfig` (cliente) sobre entradas boas e quebradas. A divergência achada: tier público desconhecido passava no servidor e `tierRank` o lia como "Calouro" — o placar abria para todo mundo enquanto o painel do admin mostrava "Jogador". A lista de tiers do servidor é uma só (`TIER_ORDEM`, exportada por `gamification.js` e lida por `seasonRanking.js`).
- **Código morto** — `XP_CAPS_V2`, `applyXpCapV2` e a opção `applyCaps` de `computeXpV2` saíram: ninguém as passava, então o teto diário/semanal nunca valeu. O antifarm é do servidor e marca para revisão (princípio 5).
- **Exclusão e exportação** — as coleções da gamificação entraram na exclusão de conta e a exportação ganhou o bloco `gamification` (`gamificationExportService.js`); tabela em `docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md`. O guarda `exclusaoCobreColecoes.test.js` vigia a família inteira.
- **Metas pessoais** — o `GoalsCard` de Meu desempenho diz "Não deu para carregar as metas" com "Tentar de novo" quando a leitura falha, em vez de "Você ainda não definiu metas".

### 4.2 XP da Carreira (PR 5 da carreira, 2026-11-04)

- **`kind: 'career'`** em `user_xp_grants`, nos dois lados (`XP_GRANT_KIND.CAREER` no cliente, `XP_GRANT_KINDS` no servidor; paridade em `serverParity.test.js`). Grants antigos e os outros tipos não mudam.
- Quem grava é `functions/careerXp.js` (`sync`), chamado por `careerEventWritten` e pelo gatilho novo `careerDebriefWritten` (`training_debriefs/{id}`; só o balanço `externo` faz algo). Id `{uid}_career_{eventoId}`; campo extra `month` (AAAA-MM de Brasília) para o teto.
- Configuração nova `career: { xpPerRecord: 25, monthlyCap: 4 }` em `platform_settings/gamification` (faixas 0–100 e 0–20; paridade cliente × servidor), editável em Painel admin → Gamificação → Configuração → "Carreira".
- O resultado declarado rende 0: só a ficha completa (resultado + foto + balanço) paga, uma vez; apagar ou descompletar ZERA (`xp: 0`); o teto conta os zerados. Regras completas em `docs/54-CARREIRA-DO-ATLETA.md` §4.6a.
- Família de conquistas `my_career` (`CAREER_ACHIEVEMENTS`), só com a flag `athlete_career` (`computeAchievementsV2(user, { career })`); fontes `careerEvents`/`careerGoals` em `FACT_SOURCES`, buscadas só com a flag. Guarda `carreiraNaoPontua.test.js`. A família **não é gravada** em `user_achievements_v2` (legível por toda conta logada; a carreira é privada): só o dono a vê, calculada. Menor de 18 (ou nascimento desconhecido) não ganha o XP de carreira; ficha barrada pelo teto não é reprocessada (docs/54 §4.6a).
- Guia: termo `ficha-completa` (módulo `career_xp`) e uma pergunta, montados por `buildGamificationGuide(config, { career })`, com os números da configuração.

## 5. Módulos ligáveis pelo admin

`missions_weekly`, `missions_monthly`, `onboarding`, `weekly_review`, `celebrations`, `hall_of_fame`, `duels`, `challenges`, `rewards`, `match_reviews`, `partner_letters`, `social_bonds`, `supply_panels`, `career_xp` (XP da ficha completa da Carreira; o servidor confere o módulo E a flag `athlete_career`). Módulo desligado some da tela (nunca aparece desabilitado) e **não consulta**.

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
