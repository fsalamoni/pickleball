# 47 — Backend: as Cloud Functions do PickleRush

> Conferido contra `functions/index.js`, `functions/*.js`, `firebase.json`,
> `scripts/functions-deploy.sh` e os workflows em 2026-10-15. A lista
> mecânica de nomes, tipos e agendas é gerada em
> [`46-INVENTARIO.md`](./46-INVENTARIO.md) §7; este documento responde o que o
> inventário não diz: **por quê**, **o que lê e escreve**, **quem pode chamar**
> e **o que cobre cada uma com teste**.
>
> Quem pode o quê em cada perfil: [`48-PERMISSOES-POR-PERFIL.md`](./48-PERMISSOES-POR-PERFIL.md).

## 1. Visão geral

| Item | Valor (onde se confere) |
|---|---|
| Região | `southamerica-east1` (`REGION` em `functions/index.js`; `setGlobalOptions`) |
| Banco | Firestore nomeado **`pickleball`** (`DATABASE_ID`). Todo gatilho declara `database: DATABASE_ID`; o Admin SDK usa `getFirestore(getApp(), DATABASE_ID)` |
| Codebase | **`picklerush`** (`firebase.json` → `functions[0].codebase`). Nunca `default` |
| Runtime | Node **22** (`functions/package.json` → `engines.node`) |
| Dependências | `firebase-admin ^13.10.0`, `firebase-functions ^6.1.0` (v2: `onDocumentWritten/Created/Updated`, `onSchedule`, `onCall`, `onRequest`) |
| Instâncias | `setGlobalOptions({ region, maxInstances: 3 })` — teto global; cada função só sobrescreve `timeoutSeconds`/`memory` |
| Exportações | **53** `exports.*` em `functions/index.js` (lista gerada: `docs/46-INVENTARIO.md` §7) |
| Fuso das agendas | `America/Sao_Paulo` |
| Regras de segurança | O Admin SDK **ignora** `firestore.rules`. Toda função que escreve em nome de alguém tem de conferir quem pede por conta própria (callables) ou depender do evento que a disparou (gatilhos) |

Por que existem funções: o cliente fala direto com o banco e a regra recusa
o que só o servidor deve decidir — **ranking** (`allow write: if false`),
**pedido/oferta/avaliação do Mercado**, **prêmios de XP**, **chamar o próximo
da fila**, **suspender conta**, **excluir cadastro**. Cada função abaixo existe
porque a escrita não pode ser do navegador.

### 1.1 Convenções que valem para todas

- **Erro de agendada/gatilho não vira alerta**: ranking, gamificação e push
  capturam o erro, logam e retornam (o próximo ciclo refaz). Exceções que
  relançam: `advanceOpenSlotWaitlist`, `refreshLadderWeekly`,
  `aggregateNpsDaily`, `autoCloseChecklists` (`throw err`).
- **Idempotência**: prêmios de XP e avisos da gamificação usam id fixo e
  `create` (a mesma concessão nunca vale duas vezes); o recálculo de ranking
  refaz tudo do zero.
- **Pacote isolado**: `functions/` é publicado sozinho e **não importa
  `src/`**. Tudo que o cliente também calcula existe em duas cópias com teste
  de paridade (§9).
- **Texto de aviso** vai por `functions/avisoI18n.js` (`tx`, `textoDoAviso`,
  `i18nDoAviso`) para o aviso carregar as traduções (`functions/i18n/avisos.json`,
  gerado por `npm run i18n:avisos`).

## 2. Ranking e rating da plataforma

Lógica em `functions/platformRankings.js` (passada única), `functions/ranking.js`
(ELO, elegibilidade, assinatura), `functions/engines/dupr.js` e
`functions/engines/doubles.js` (rating 2.0–8.0 e duplas) e
`functions/rankingCatchUp.js` (recuperação).

Uma passada lê as duas fontes de resultado — `tournament_matches` (status
`finished`/`walkover`) e `club_event_games` (`status == 'finished'`) — mais
`tournament_registrations`, `athlete_profiles` e `tournaments`, e grava **os
três rankings juntos**:

| Ranking | Coleções escritas |
|---|---|
| ELO / nacional | `player_ratings`, `rating_history` |
| Rating 2.0–8.0 | `player_skill_ratings`, `skill_rating_history` |
| Duplas | `doubles_rankings` |
| Estado da passada | `platform_settings/global` (campo do último recálculo) e `platform_settings/ranking_worker` (lease + `last_result`) |

Todas essas coleções têm `allow write: if false` no `firestore.rules`: **o
servidor é o único escritor** (nem o admin da plataforma escreve pelo cliente).

| Função | Gatilho / agenda | Dispara quando | Arquivo |
|---|---|---|---|
| `recomputeRankingOnTournamentChange` | `tournaments/{tournamentId}` (written) | muda a elegibilidade (`isEligible` antes ou depois) | `index.js` + `ranking.js` |
| `recomputeRankingOnTournamentMatch` | `tournament_matches/{matchId}` (written) | `mudouResultado(antes, depois, CAMPOS_PARTIDA_TORNEIO)` | `platformRankings.js` |
| `recomputeRankingOnTournamentRegistration` | `tournament_registrations/{registrationId}` (written) | `mudouResultado(..., CAMPOS_INSCRICAO)` — trocar o uid por trás da inscrição muda de quem é o jogo | `platformRankings.js` |
| `recomputeRankingOnClubEventGame` | `club_event_games/{gameId}` (written) | `mudouResultado(..., CAMPOS_JOGO_EVENTO)` — é por aqui que a **publicação do dia de jogo** chega ao ranking | `platformRankings.js` |
| `catchUpPlatformRankings` | agendada, `every 30 minutes` | compara a **impressão** da última passada com o banco; só recalcula se faltou | `rankingCatchUp.js` |

Os quatro gatilhos têm `timeoutSeconds: 540`, `memory: 512MiB`, e chamam
`requestRankingRecompute` (erro vira log, retorna `{ ran: false, reason: 'error' }`).
Quem chama: ninguém diretamente — são eventos do banco; a "autorização" é a
regra de quem escreveu o documento de origem.

### 2.1 Lease e coalescência (`requestRankingRecompute`)

Publicar um dia de jogo escreve dezenas de partidas; recalcular a plataforma
por partida seria absurdo. Controle em `platform_settings/ranking_worker`:

1. `tomarLease` (transação): se `running_since` tem menos de `LEASE_TTL_MS`
   (**9 min**), marca `pending: true` e **sai** (`reason: 'coalesced'`); senão
   grava `running_since` e segue.
2. Recalcula. `consumirPendente` (transação): se chegou pedido no meio, limpa
   `pending`, renova o lease e manda **mais uma passada**; senão solta o lease
   e grava `last_run_at` e `last_result`.
3. Teto: no máximo `MAX_PASSADAS_EXTRAS = 2` passadas extras; ao bater, solta o
   lease (`soltarLease`) — o pedido não se perde, a próxima escrita chama tudo
   de novo.
4. Falha: `soltarLease(db, err)` grava `last_error`/`last_error_at`; se nem isso
   grava, o TTL de 9 min resolve.

`last_result` carrega `fingerprint`, `matchesUsed`, `excluded` (por que cada
partida decidida ficou de fora — só contagens e ids, o documento é público),
`eloPlayers`, `duprPlayers`, `doublesPairs`, `removedAccounts`. O painel admin
lê isso (`src/modules/rating/domain/rankingWorkerStatus.js`).

### 2.2 Recuperação (`catchUpPlatformRankings`)

Gatilho não tem fila: resultado escrito enquanto a função não existe se perde
(incidente de 2026-09-22). A cada 30 min a função lê `platform_settings/ranking_worker.last_result.fingerprint`
e a impressão atual — duas contagens (`count()` de `tournament_matches`
finalizadas e de `club_event_games` finalizados) + hash SHA-1 da assinatura dos
torneios (`computeSignature`) — e só pede recálculo se diferirem ou se não
houver impressão. Em dia, **não grava nada**. Limite assumido: editar o
placar de um jogo já publicado não muda contagem nem assinatura; se acontecer
com as funções fora do ar, só entra na próxima passada.

**Testes**: `functions/platformRankings.test.js`, `functions/rankingCatchUp.test.js`,
`functions/singlesRankings.test.js` (jogo simples → rating de simples, fora das
duplas), `functions/engines/parity.test.js` (§9). Doc de produto:
[`18-RANKINGS.md`](./18-RANKINGS.md).

## 3. Clubes

Lógica em `functions/clubRanking.js` (`recomputeClubInternalRankings(db, clubId)`).
Lê `club_members`, `athlete_profiles`, `club_events` (+ subcoleção `games`),
`club_event_games`, `tournament_matches`, `tournament_registrations`,
`tournaments`; escreve `club_internal_ratings`, `club_internal_ratings_ext`,
`club_internal_doubles_ratings`, `club_internal_doubles_ratings_ext`
(o cliente só lê — ver `useClubInternalRanking`).

| Função | Tipo / gatilho | O que faz | Quem chama |
|---|---|---|---|
| `recomputeClubRankingOnClubGame` | `club_events/{eventId}/games/{gameId}` (written), 120 s/512 MiB | recalcula o clube dono do evento | evento do banco |
| `recomputeClubRankingOnClubEventGame` | `club_event_games/{gameId}` (written), 120 s | recalcula o clube do jogo **e** os clubes de cada atleta dos lados (`athlete_profiles.club_ids`) | evento do banco |
| `recomputeClubRankingOnTournamentMatch` | `tournament_matches/{matchId}` (written), 180 s | resolve inscrição → uids (até 30) → clubes e recalcula cada um | evento do banco |
| `recomputeClubRankingOnMemberChange` | `club_members/{memberId}` (written), 60 s/256 MiB | recalcula o clube do membro | evento do banco |
| `recomputeClubRankingOnAthleteProfileChange` | `athlete_profiles/{uid}` (written), 60 s | recalcula cada clube que entrou/saiu de `club_ids` | evento do banco |
| `recomputeAllClubsMonthly` | agendada `0 4 1 * *`, 540 s/1 GiB | defesa mensal: recalcula **todos** os clubes | agenda |
| `recomputeAllClubInternalRankings` | **callable**, 540 s/1 GiB | backfill de todos os clubes | **só platform admin** (`isPlatformAdminUser`: claim `platform_admin` ou `users/{uid}.role == 'platform_admin'`); senão `permission-denied` |
| `recomputeOneClubInternalRanking` | **callable**, 120 s | recalcula um clube (`data.clubId`) | exige login (`unauthenticated`); passa se platform admin **ou** `club_members/{clubId}_{uid}.role == 'admin'`; senão `permission-denied`. Cliente: `useClubRankingAdmin.js` |

Observação: `recalcOneClub` captura o erro e só loga — um clube que falha não
derruba os outros. **Teste**: não há `*.test.js` em `functions/` para
`clubRanking.js` nem para os wrappers de `index.js` (não encontrei cobertura
dedicada; o cálculo é o mesmo motor de rating, coberto indiretamente pelos
testes de motores no cliente).

## 4. Arenas: fila de espera do jogo aberto e rotinas

### 4.1 Fila de espera (`functions/openSlotWaitlist.js`)

Chamar o próximo da fila é escrever na entrada de **outra** pessoa — o
navegador de quem sai não pode (a regra recusa). Por isso é servidor.
`promoverProximo` roda **numa transação** (dois gatilhos quase juntos não
chamam duas pessoas para o mesmo lugar): lugares livres = total − quem está na
vaga − quem foi chamado e ainda está no prazo; chama quantos couberem, na ordem
da fila. A ordem usa o `createTime` do documento (`_criado`), não `position` /
`joined_at`, que o navegador de quem entra escreve. Janela de aceite:
`JANELA_PROMOCAO_MIN = 60` min.

| Função | Gatilho | Faz | Lê / escreve |
|---|---|---|---|
| `advanceOpenSlotWaitlist` | agendada `every 10 minutes` | expira (`status: 'expired'`) as chamadas `notified` com prazo vencido (até 300) e chama o próximo de cada vaga afetada | lê `arena_waitlist`; escreve `arena_waitlist`; via `promoverProximo`: `arena_open_slots`, `game_days`(+`participants`), `notifications` |
| `promoteOpenSlotWaitlistOnSlot` | `arena_open_slots/{slotId}` (updated) | `vagaAbriuLugar(antes, depois)` → promove na hora | idem |
| `promoteOpenSlotWaitlistOnEntry` | `arena_waitlist/{entryId}` (written) | `chamadaLiberouLugar(antes, depois)` (recusada, expirada, apagada) → promove | idem |

**Testes**: `functions/openSlotWaitlist.test.js`; cliente espelha prazo/limites
em `src/modules/arenas/domain/waitlist.js` (`waitlist.test.js`).
Doc: `docs/24-MODULOS-DE-ARENA/01-MATCHMAKING.md`.

### 4.1a Lista de espera do professor (`functions/coachWaitlist.js`)

Avisar o aluno é escrever para **outra** pessoa (o aviso e o `notified_at`
da entrada dele), então é servidor. Os mesmos gatilhos mantêm a lista
pública de horários ocupados (`coach_busy_slots`), que o pedido de aula lê.

| Função | Gatilho | Faz | Lê / escreve |
|---|---|---|---|
| `onCoachAvailabilityWritten` | `coach_availability/{coachId}` (written) | recalcula os ocupados; se `abriuHorario` (janela nova ou folga futura retirada), avisa a lista | lê `coach_lessons`, `coach_waitlist`, `coaches`; escreve `coach_busy_slots`, `notifications`, `coach_waitlist` |
| `onCoachLessonWritten` | `coach_lessons/{lessonId}` (written) | recalcula os ocupados se status/horários mudaram; se `aulaLiberouHorario` (confirmada futura cancelada/recusada) num professor com janelas, avisa a lista | lê `coach_lessons`, `coach_availability`, `coach_waitlist`, `coaches`; escreve `coach_busy_slots`, `notifications`, `coach_waitlist` |

Cada entrada é avisada no máximo uma vez a cada `INTERVALO_HORAS = 6`; a
pessoa fica na lista até pedir aula ou sair. Textos por `tx` (catálogo
`functions/i18n/avisos.json`). **Testes**: `functions/coachWaitlist.test.js`.

### 4.2 Rotinas agendadas das arenas (código em `index.js`, sem módulo próprio)

| Função | Agenda | Faz | Lê / escreve |
|---|---|---|---|
| `refreshLadderWeekly` | `0 23 * * 0` (domingo 23h), 540 s | para cada arena com `leagues_ladder` ligado, agrega vitórias/derrotas das últimas 500 `arena_matches` e grava o top 50 | lê `arena_module_states` (`module_id == 'leagues_ladder'`, `enabled == true`), `arena_matches`; escreve `arena_ladders/{arenaId}_current` (`source: 'cloud_function_refreshLadderWeekly'`) |
| `aggregateNpsDaily` | `0 4 * * *` | consolida o NPS das últimas 24 h por arena (promotores ≥ 9, detratores ≤ 6) | lê `arena_nps_responses`; escreve `arena_nps_daily/{arenaId}_{AAAA-MM-DD}` |
| `autoCloseChecklists` | `0 1 * * *` | fecha checklists com `auto_close == true` e `closed == false` que estão 100% concluídos ou têm > 24 h (até 200) | lê/escreve `arena_checklists` (`closed`, `closed_at`, `auto_closed`) |
| `expireStaleNotifications` | `0 3 1 1 *` (uma vez por ano) | **aposentada (no-op)** em 2026-10-10: falhava todo dia por falta de índice e ninguém lia `archived`. Fica exportada porque o deploy é por nome e não apaga função; para remover: `firebase functions:delete expireStaleNotifications --region southamerica-east1` e apagar o bloco | nada |

Sem testes unitários dedicados em `functions/` (verificação em
`scripts/health-check-arena-v3.mjs`). `aggregateNpsDaily` e `autoCloseChecklists`
relançam o erro (o agendador registra a falha).

## 5. Notificações e push

`pushOnNotificationCreate` — gatilho `notifications/{notifId}` (**created**).
Espelha a notificação in-app para o celular. Passos (todos conferidos em
`index.js`):

1. Lê `push_tokens` com `user_id == n.user_id`; sem tokens, retorna (o normal
   até o opt-in).
2. Lê `users/{uid}`: `notification_prefs` (categoria silenciada **não** vira
   push — `notificationPrefs.isNotificationMuted(prefs, n.type)`) e `language`
   (o push sai no idioma da pessoa quando o aviso tem `i18n` —
   `avisoI18n.campoNoIdioma`). Se as preferências não puderem ser lidas,
   **envia assim mesmo** (perder um aviso é pior que um a mais). Com a flag
   `external_messaging` ligada, também confere `messagingPolicy.pushAllowed`:
   área desligada (pelo admin ou pela pessoa) e horário de silêncio estendido
   ao push não viram push.
3. Monta o link absoluto sobre `https://picklerush.web.app`, envia por
   `getMessaging().sendEachForMulticast`.
4. Apaga tokens inválidos (`registration-token-not-registered`,
   `invalid-registration-token`, `invalid-argument`) em lote.

Nunca lança. Não escreve a notificação in-app. No aparelho, quem mostra é
`public/firebase-messaging-sw.js`, **sem o SDK do Firebase** (o
`/__/firebase/init.js` desta hospedagem não traz `appId`; ver
`PUSH-ATIVACAO.md`). **Quem "chama"**: qualquer
escrita de notificação permitida pela regra (`notifications` create exige
`user_id`, tipo conhecido, link interno, `read == false`; o servidor também as
cria com o Admin SDK).

**Testes**: só os helpers — `functions/notificationPrefs.parity.test.js`
(cópia servidor × `src/modules/notifications/domain`),
`functions/avisoI18n.parity.test.js` e `avisoI18n.test.js`. A função em si não
tem teste; o service worker tem (`src/core/services/pushWorker.test.js`).
Doc: [`36-NOTIFICACOES.md`](./36-NOTIFICACOES.md), `PUSH-ATIVACAO.md`.

### 5.1 Avisos por e-mail, WhatsApp e SMS (flag `external_messaging`)

Código em `functions/messaging.js` (motor), `messagingPolicy.js` (regra pura),
`messagingProviders.js` (HTTP com SES/Resend/Meta/Twilio/Zenvia, AWS
Signature V4 própria, zero dependência nova), `messagingTemplates.js` e
`messagingAdmin.js` (ações). Doc: [`49-AVISOS-POR-EMAIL-E-CELULAR.md`](./49-AVISOS-POR-EMAIL-E-CELULAR.md).

| Função | Gatilho | O que faz |
|---|---|---|
| `messagingOnNotificationCreate` | `notifications/{id}` **created** | `handleNotice`: decide cada canal (`decideChannel`), confere supressão, tetos e orçamento, grava `message_outbox/{aviso}_{canal}` e envia o que é "agora". Nada com a flag desligada |
| `messagingQueue` | agenda, a cada 10 min | Envia o que esperava (silêncio, chat não lido), monta resumos diário/semanal, repete falhas (até 3), apaga registro com mais de 90 dias |
| `messagingAdmin` | callable, só admin da plataforma | Estado (inclui o push: pronto com a chave pública salva, e o total de `push_tokens`), chaves (`platform_secrets`), preparar/verificar domínio, testes (e-mail, WhatsApp, SMS e `push_test` — FCM para os aparelhos do próprio admin, removendo os inválidos), prévias, "por que não chegou", bloqueios, denúncias, modelos do WhatsApp, registro. Audita em `audit_logs` |
| `messagingUser` | callable, a própria pessoa | Código do celular (envia/confirma/esquece — só o servidor grava `users.phone_verified_number`), confirmação e teste de e-mail |
| `messagingAuthEmail` | callable sem login | "Esqueci a senha" pelo nosso provedor, quando `email.login_emails` está ligado; nunca diz se o e-mail existe |
| `messagingHook` | HTTP público, `/api/mensagens/**` (`firebase.json`) | Retornos dos provedores (assinatura conferida em cada um), PARAR, páginas de descadastro e denúncia (links assinados; GET mostra, POST confirma) |

**Testes**: `functions/messaging.test.js`, `messagingAdmin.test.js`,
`messagingProviders.test.js`, `messagingTemplates.test.js`,
`messagingPolicy.test.js`, `messagingPolicy.parity.test.js` e
`accountDeletion.mensagens.test.js`.

## 6. Gamificação (agendadas)

Lógica em `functions/gamification.js` (tarefas), `functions/gamificationCore.js`
(matemática pura, "Brasília", semana de segunda a domingo) e
`functions/seasonRanking.js`. Todas leem a configuração do admin em
`platform_settings/gamification` e **respeitam o módulo desligado**
(`moduloLigado`); respeitam também `user_gamification_prefs` e
`gamification_moderation`. `gamificacaoLigada()` hoje devolve sempre `true` (a
flag virou permanente em 2026-10-10). Nunca relançam o erro
(`rodarGamificacao` devolve `{ error }`).

| Função | Agenda | Faz | Lê → escreve |
|---|---|---|---|
| `gamificationChallengeStandings` | `every 3 hours`, 540 s | placar dos desafios ativos e fechamento dos que terminaram; concede XP e avisa | lê `gamification_challenges`, `challenge_entries`, `athlete_profiles`, `club_members`, `coach_students`, `arena_bookings`, `coach_lessons`, jogos normalizados (`tournament_matches`, `tournament_registrations`, `club_event_games`, `tournaments`) → escreve `challenge_entries`, `gamification_challenges`, `user_xp_grants`, `notifications` |
| `gamificationWeeklyDuels` | `30 5 * * 1` (segunda 05:30) | fecha os duelos da semana que passou e emparelha os novos | lê `duels`, `player_skill_ratings`, `gamification_moderation` → escreve `duels`, `user_xp_grants`, `notifications` |
| `gamificationWeeklyDigest` | `0 8 * * 1` (segunda 8h), 300 s | "Sua semana em revisão" só para quem jogou nos últimos 30 dias e quer receber | lê jogos, `user_gamification_prefs` → escreve `notifications` (id `weekly_{uid}_{semana}`) |
| `gamificationDailyUpkeep` | `0 4 * * *`, 1 GiB | reputação das avaliações, sinais de integridade e retrato diário de métricas | lê `match_reviews`, `club_event_games`, `tournament_matches`, `tournament_registrations`, `user_progression_v2`, `user_kudos`, contagens de `user_*`/`duels`/`reward_claims`/`gamification_flags` → escreve `user_reputation`, `user_reputation_private`, `gamification_flags`, `gamification_integrity`, `gamification_metrics/{dia}` |
| `recomputeSeasonRankingDaily` | `0 3 * * *`, 300 s | ranking sazonal (XP da temporada = `xpTotal − baselineXp`); fecha a temporada anterior e premia | lê `user_progression_v2`, `athlete_profiles`, `gamification_moderation`, `season_rankings` → escreve `season_rankings/{seasonId}_{uid}`, `hall_of_fame`, `user_xp_grants` (prêmio) |

As regras do cliente recusam escrever essas coleções (posição e prêmio não se
decidem no navegador).

**Testes**: `functions/gamification.test.js` (fakes de Firestore: flag e
módulos, duelo, desafios, reputação, integridade, resumo, métricas),
`functions/gamificationCore.test.js`, `functions/seasonRanking.test.js`;
paridade cliente × servidor em `src/modules/progression/domain/serverParity.test.js`.
Doc: [`38-GAMIFICACAO-V2.md`](./38-GAMIFICACAO-V2.md).

## 7. Conta, admin e torneio (callables)

Todas são `onCall` (v2) em `southamerica-east1`. O papel de admin é decidido
por `isPlatformAdminUser` (`index.js`): custom claim `platform_admin` **ou**
`users/{uid}.role == 'platform_admin'`. "Dono" é o e-mail em
`OWNER_EMAILS` (`functions/accountDeletion.js`: `fsalamoni@gmail.com`) **com
e-mail verificado**.

| Função | Faz | Quem pode chamar | Lê / escreve |
|---|---|---|---|
| `adminDeleteAccounts` | exclusão de cadastro. `mode: 'preview'` só lê; `'execute'` refaz a análise no servidor e apaga. Motivo obrigatório, até 25 contas por vez, uma por vez (falha numa não contamina as outras) | `permission-denied` se não for platform admin; **`execute` exige ainda o e-mail do dono verificado** | dezenas de coleções (tabela em `accountDeletion.js`), Firebase Auth e Storage; trilha em `audit_logs`. 540 s/1 GiB |
| `adminMergeAccountHistory` | unifica o histórico de uma conta **excluída** na conta que ficou. Prévia / `execute` | platform admin; `execute` só o dono | `tournament_registrations`, `club_event_games`, `game_days`(+`participants`,`games`), `club_events`, `athlete_profiles`, `arena_ladders`, `coach_level_validations` etc.; `audit_logs`; chama `requestRankingRecompute` ao fim. 540 s/1 GiB |
| `adminSetAccountStatus` | suspender (1 a N dias), bloquear ou reativar. Desliga o login no Firebase Auth e grava `users.account_status*` | só platform admin; travas no servidor: não a própria conta, não outro admin, não e-mail de dono (`targetBlockedReason`) | `users`, Auth, `audit_logs`. 60 s |
| `adminSupportReveal` | revela campos mascarados da ficha (e-mail, telefone, nascimento, endereço) com categoria de motivo + texto ≥ 20 caracteres | só platform admin | lê `users`; escreve `admin_access_logs` (hash do valor, IP, user-agent — registro **interno**, o titular não é avisado). 60 s |
| `tournamentLinkRegistrationAccount` | liga o jogador provisório de uma inscrição à conta real (nome, nível, categoria, foto, e-mail oficial em `private/contact`) e apaga a prova `provisional_claims/{rid}_{slot}` | exige login (`unauthenticated`); passa se platform admin **ou** `tournament_admins/{tournamentId}_{uid}` existe; senão `permission-denied` (`status: 'denied'`) | `tournament_registrations`(+`private`), `provisional_claims`, `users`. Cliente: `registrationService.js` |

**Testes**: `accountDeletion.test.js`, `accountDeletion.engine.test.js`,
`accountDeletion.pseudo.test.js`, `accountDeletion.mercado.test.js`,
`accountDeletion.treino.test.js`; `accountMerge.test.js`;
`accountStatus.test.js`; `supportAccess.test.js`;
`registrationLink.test.js`. Guarda de cobertura de coleções:
`src/core/guards/exclusaoCobreColecoes.test.js` (a coleção nova do treino/mercado
tem de entrar na exclusão e na exportação). Docs:
`docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md`, `05-ADMIN-SUPORTE.md`.

### 7.1 Erros do navegador → Error Reporting (`clientErrorReport`)

A única função **HTTP** (`onRequest`, `invoker: 'public'`, `maxInstances: 2`,
256 MiB). O Hosting do site `picklerush` encaminha `POST /api/erro` para ela
(rewrite em `firebase.json`, antes do `**`). Ela não toca o banco: grava uma
linha de log no formato `ReportedErrorEvent`, que o **Google Cloud Error
Reporting** agrupa, conta e avisa por e-mail quando aparece um erro novo
(console: `https://console.cloud.google.com/errors?project=pickletour`, serviço
`picklerush-web`, versão = commit do deploy).

| O quê | Como |
|---|---|
| Quem manda | `core/services/errorReport.js` (exceção solta, promessa rejeitada, `recordClientError` dos boundaries, falha da inicialização) e o script de segurança do `index.html` (tela que não abriu). Só no site publicado; nunca em desenvolvimento nem com emuladores |
| O que chega | mensagem, nome, pilha, origem (`fonte`), fatal, rota com ids trocados por `:id`, versão e o uid (quando logado) |
| Fronteira de confiança | o corpo vem de qualquer um: ≤ 16 KB, mensagem ≤ 500, pilha ≤ 4000 / 30 quadros, e-mail na mensagem vira `[e-mail]`, o user-agent vem do **cabeçalho**. Pilha do Safari/Firefox é convertida para o formato do V8 (senão o agrupamento não funciona) |
| Volume | ≤ 10 relatórios por página no navegador (o mesmo erro conta uma vez) e ≤ 120 por minuto por instância no servidor |
| Resposta | sempre `204` (`405` para quem não é POST) — o navegador nunca espera por ela |

**Testes**: `functions/clientErrors.test.js` (formato, e-mail, pilhas, corpo
hostil, teto); cliente em `src/core/domain/errorReport.test.js`. O deploy
confere `POST /api/erro` → 204 depois de publicar (aviso, não falha).

## 8. Mercado (flag `marketplace`)

Lógica em `functions/marketplace.js` (1.694 linhas), `marketPromo.js` (cupom,
vale-presente, `orderPricing`) e `marketSearch.js` (busca salva). A regra do
Firestore **não deixa o navegador escrever** `market_orders`, `market_offers`,
`market_reviews`, `market_disputes` (`allow write: if false`); o servidor
confere estoque, preço (sempre o do banco) e a vez de cada um.

**Callables** (todas via `marketCallable`, 60 s): sem login →
`unauthenticated`; `actor = { uid, isPlatformAdmin }`; `MarketError` vira
`HttpsError` com o mesmo código; erro inesperado vira `internal`. O flag
`marketplace` e as chaves de `platform_settings/marketplace` são relidos a cada
chamada (`loadContext`).

| Função | Faz | Quem pode (checagem no servidor) |
|---|---|---|
| `marketPlaceOrders` | fecha o carrinho: um pedido por vendedor, cada um numa transação que relê o anúncio, confere estoque/preço e baixa o estoque; aplica cupom e vale | conta logada; falha se `marketplace`/`orders_enabled` desligados; **recusa comprar de si mesmo** (`operatorUids` do vendedor contém o comprador) |
| `marketOrderAction` | máquina do pedido (`ORDER_ACTIONS`: aceitar, recusar, enviar comprovante, confirmar pagamento, enviar, entregar, confirmar recebimento, cancelar, disputar, resolver…) | papel por ação: `buyer` = `buyer_uid`; `seller` = quem opera a chave (`operatorUids`: dono do uid, ou **gestores da arena** em `arena_managers`); `admin` = platform admin; `system` = só a rotina. Sem papel → `permission-denied` |
| `marketOfferAction` | oferta, contraproposta, aceite (cria o pedido já aceito, pelo valor combinado) | conta logada; dono do anúncio não oferta; uma negociação aberta por anúncio |
| `marketSubmitReview` | avaliação cega (comprador ou vendedor, depois de `completed`) | só as duas partes do pedido |
| `marketGiftCardAction` | `buy` / `claim` / `issue` / `cancel` de vale-presente | `issue`/`cancel`: só quem opera a loja; `claim`: conta logada, vale ativo/não vencido/não resgatado por outra conta |
| `marketLinkArenaProduct` | liga um anúncio de **arena** a um produto do estoque (`arena_inventory_products.market_listing_id`) | só gestor da arena (`operatorUids`) |

**Gatilhos e agenda**:

| Função | Gatilho | Faz |
|---|---|---|
| `marketHousekeeping` | `every 60 minutes`, 300 s | expira pedidos/ofertas vencidos, conclui entregues, vale-presente (vencimento/lembrete), fim de promoção, revela avaliações, lembra pedido parado |
| `marketFavoriteCount` | `market_favorites/{favId}` | `favorite_count` do anúncio (`FieldValue.increment`) |
| `marketFollowCount` | `market_follows/{followId}` | `follower_count` em `market_sellers` |
| `marketFollowersNotify` | `market_listings/{listingId}` | avisa seguidores quando o anúncio entra no ar (uma vez: `followers_notified_at_ms`) |
| `marketQuestionNotify` | `market_questions/{questionId}` | avisa o outro lado da pergunta/resposta |
| `marketModerateListing` | `market_listings/{listingId}` | termo proibido (`banned_terms` + padrão) pausa o anúncio e avisa; texto corrigido remove a marca |
| `marketPriceDropNotify` | `market_listings/{listingId}` | preço baixou → avisa quem favoritou |
| `marketSavedSearchAlerts` | `every day 10:00` | um aviso por dia por busca salva com anúncio novo (cópia da busca do cliente em `marketSearch.js`) |
| `marketArenaStockSync` | `arena_inventory_products/{productId}` | refaz a quantidade do anúncio ligado (`stock_qty − reservado`); confere os **dois lados** do vínculo |

Coleções tocadas (contagem de `collection('…')` em `marketplace.js`):
`market_listings`, `market_orders`, `market_sellers`(+`private`),
`market_offers`, `market_reviews`, `market_disputes`, `market_coupons`(+`market_coupon_uses`),
`market_gift_cards`, `market_favorites`, `market_follows`, `market_saved_searches`,
`market_carts`, `arena_managers`, `arena_inventory_products`/saídas, `users`,
`notifications`, `audit_logs`, `platform_settings`.

**Testes**: `functions/marketplace.parity.test.js` (tabelas e regras de ação do
pedido e da oferta × `src/modules/marketplace/domain`),
`marketPromo.test.js` + `marketPromo.parity.test.js`,
`marketSearch.parity.test.js`, `marketAlerts.test.js`,
`marketArenaStock.test.js`, `marketplaceQuestions.test.js`, e
`tests/rules/marketplace.functions.test.js` / `marketplace.rules.test.js`
(emulador). Módulo: `src/modules/marketplace/README.md`.

## 8a. Federações (flag `federations`)

Lógica em `functions/federations.js`; a conta da validade em
`functions/federationMembership.js` (**cópia** de
`src/modules/federations/domain/membership.js`, paridade em
`federationMembership.parity.test.js`). A regra do Firestore **não deixa o
navegador** criar filiação nem cobrança, mudar o estado de uma filiação ou
confirmar pagamento (`allow create, delete: if false`); o servidor confere a
flag (`flagLigada`), a federação aprovada **e publicada** (`publicada(fed)`,
exportada de `federations.js`: `status == 'approved'` e `published == true` —
vale para a filiação, a transferência para ela, a agenda assinável, que busca o
endereço só entre as publicadas, e a leitura de comentários de quem é de fora),
o plano, a idade e o papel de quem pede. Doc: `docs/50-FEDERACAO.md` §17.

**Callables** (via `federationCallable`, 60 s): sem login → `unauthenticated`;
`actor = { uid, isPlatformAdmin }`; `FederationError` vira `HttpsError` com o
mesmo código; erro inesperado vira `internal`.

| Função | Faz | Quem pode (checagem no servidor) |
|---|---|---|
| `federationReview` | exige a flag; `approve` (recusa se outra federação **aprovada** já usa o slug; cria o presidente em `federation_staff` só se a conta `created_by` existir; na primeira aprovação — pendente ou recusada antes, nunca suspensa — liga os módulos marcados em `platform_settings/federations.default_modules`, campo a campo (`modules.<id>`), sem desligar nenhum; grava `review`), `reject` (motivo), `suspend` (motivo), `verify`/`unverify`, `official`/`unofficial`; avisa quem pediu/a equipe | admin da plataforma |
| `federationMembership` | `request` (confere plano ativo, idade do perfil — plano por faixa de idade exige o nascimento conhecido —, filiação viva; gratuito com `auto_approve` ativa numa transação, pago gera a cobrança; sem `auto_approve` avisa a secretaria), `renew` (nova cobrança; a validade nova começa no fim da atual), `cancel`; `approve` (número por transação sobre `member_counter`; gratuito ativa, pago cobra), `reject`, `suspend` (gira o código), `reinstate`; convites (`federation_invites`, 2026-10-22): `invite` (federação publicada, plano ativo, até 50 pessoas; pula sem conta, com filiação viva ou convite em aberto; avisa cada uma; vale 30 dias), `invite_cancel`, `invite_decline`; o `request` no plano de um convite válido entra sem aprovação (`invited: true`, convite `accepted`); Etapa 2 (2026-10-22): o tipo do plano é relido no catálogo `platform_settings/federations` (`federationMemberTypes.js`, paridade com o cliente) e decide quem pede — `request` com `org: { kind, id }` filia CLUBE/ARENA (só quem gere a entidade; `{fed}_{kind}_{org}`, `user_id` nulo, representante = quem pede, cargo obrigatório) e o espelho em `federation_affiliations` acompanha ativação/vencimento/suspensão/cancelamento, com o `tier` do plano (`federationOrgMembers.js`); `represent` (outro gestor assume a representação, as cobranças em aberto passam a ele, o anterior é avisado, auditoria `federation_membership_represent`) | a própria pessoa ou quem gere a entidade (`request`/`renew`/`cancel`/`invite_decline`/`represent`) ou permissão `members` |
| `federationChargeConfirm` | `confirm` (cobrança `paid`; ativa ou renova a filiação, emite/gira o código da carteirinha, avisa) e `cancel` (devolve o pedido ao estado anterior) | permissão `finance` |
| `federationVerify` | com a flag desligada responde `found: false`; o mínimo da carteirinha pelo código (`publicVerification`): nome, foto se permitida, federação, vínculo, número, validade, em dia ou não; PR 3: o mesmo código responde pela **credencial** de curso (`kind: 'credential'` no índice) | **sem login** (o QR é lido por qualquer um); `onCall` próprio, 30 s |
| `federationTransfer` (PR 3, `functions/federationTransfers.js`) | `request` (troca de clube ou de federação; confere filiação viva, carência `rules.transfer_cooldown_days` e pedido pendente), `cancel`; `approve` (clube → muda `represented_club_id`; federação → **encerra** a filiação atual e apaga o código), `reject` | a pessoa ou o responsável do dependente (`request`/`cancel`); permissão `members` da federação atual |
| `federationCourse` (PR 3, `functions/federationCourses.js`) | `enroll` (curso `open` com vaga e módulo ligado; filiação ativa se exigida; preço de filiado; pago → `awaiting_payment` + cobrança `origin: 'course'`, grátis → `confirmed`; vaga por transação), `cancel` (antes do início; devolve a vaga, cancela a cobrança); `pass`/`fail` (aprovado em curso que emite credencial ganha `federation_credentials` com código no `federation_card_index`); `cancel_course` (motivo obrigatório: curso `cancelled`, inscrições vivas e cobranças abertas/informadas canceladas, aviso a cada inscrito — quem pagou é lembrado de que a devolução é com a federação) | a pessoa (`enroll`/`cancel`); permissão `courses` (`pass`/`fail`/`cancel_course`) |
| `federationDiscipline` (PR 3, `functions/federationDiscipline.js`) | `apply` (advertência; suspensão grava `discipline_until_ms` na filiação; multa vira cobrança `origin: 'fine'`; exclusão encerra a filiação guardando o estado anterior), `appeal` (uma vez, em vigor), `decide_appeal` (`uphold`/`overturn` — revertida desfaz o efeito), `end` (antes do prazo). A suspensão em vigor sobrevive a desistir e pedir a filiação de novo (`pedirFiliacao` copia `discipline_until_ms`) | permissão `discipline` (`apply`/`decide_appeal`/`end`); a pessoa ou o responsável (`appeal`) |
| `federationImportMembers` (PR 3, `functions/federationSecretariat.js`) | até 500 linhas (nome, e-mail, número, validade) + plano: quem tem conta com o e-mail vira filiado **ativo** numa transação por pessoa; filiação viva é pulada; sem conta fica em `federation_imports.pending` (+ `pending_emails`) | permissão `members` |
| `federationImportInvite` (2026-10-22, gatilho `users/{uid}` criado, `onUserCreated`) | conta nova com e-mail de importação sem conta (`pending_emails` `array-contains`) em federação publicada, plano ativo e sem filiação viva → grava `federation_invites` (`source: 'import'`, número e validade da lista, 90 dias), avisa a pessoa, move o e-mail para `invited_emails` e audita `federation_import_invite`. Aceito pelo pedido no plano do convite (`federationMembership`), a filiação entra **ativa sem cobrança** | — (servidor) |
| `federationDocument` (PR 3, `functions/federationSecretariat.js`) | devolve o arquivo de `federacao/{uid}/…` do Storage em base64 à secretaria (a regra do Storage só deixa o dono ler e não consulta o banco `pickleball`); audita `federation_document_view`. Com `{ chargeId }` (Etapa 3, `chargeProof`) devolve o **comprovante** anexado à cobrança (`declared_proof`) e audita `federation_charge_proof_view` (o pagador abre o próprio sem registro) | documento: permissão `members` ou `admin`; comprovante: o pagador, ou `finance`/`members`/`fiscal`/`admin` da federação da cobrança |
| `federationStaff` (PR 7, `functions/federationStaff.js`) | `role_save`/`role_delete` (cargos em `federations.staff_roles`; mudar regrava a cópia `perms` de quem ocupa; cargo com gente não sai), `appoint` (nomear ou mudar cargo, com mandato), `extend` (nova data + motivo + ato, em `term_history`), `remove`, `transfer` (vira admin master; `leave` tira quem passou). Nunca deixa a federação sem admin master. Lógica pura em `federationStaffPolicy.js` (paridade com `domain/staff.js`) | admin master; permissão `staff` só em cargo não master, nunca em si, só com permissões que tem; a própria pessoa sai |
| `federationAcervo` (PR 8, `functions/federationAcervo.js`; 540 s, 1 GiB) | acervo oficial: `save` (rascunho; valida pela régua de `federationAcervoPolicy.js`, paridade com `domain/acervo.js`; arquivo novo só da pasta de quem salva), `delete` (só rascunho, apaga os arquivos), `publish` (copia para `federacao-acervo-oficial/`, confere tipo/tamanho pelo Storage, SHA-256, número por tipo e ano em transação sobre `federations.doc_numbers`, marca `related_by`/`revoked_by` nos atos relacionados; público ganha link com token), `rectify` (versão nova com motivo; a anterior vai para `versions[]`), `visibility` (troca o token: o link só existe enquanto público), `withdraw` (só `admin`, motivo, mata os links), `file` (até 9 MB em base64 para quem lê o documento). `publish` e `rectify` avisam (`notifications`, lotes de 400) quem segue o acervo em `federation_followers` e pode ler o ato — falha no aviso não desfaz a publicação. Audita `federation_doc_*` (com `followers_notified`) | permissão `docs` ou `admin` (o `withdraw` só `admin`); `file` para quem pode ler o documento |
| `federationAgenda` (PR 9a, `functions/federationAgenda.js`) | calendário oficial (módulo `calendar`): `save` (valida pela régua de `federationAgendaPolicy.js`, paridade com `domain/agenda.js`; documentos ligados só atos publicados da federação; evento já divulgado que muda de data ou estava adiado/cancelado exige motivo ≥ 10 letras e ganha linha em `history[]`), `postpone` (adiado sem data, motivo), `cancel` (motivo; fica na agenda), `delete` (só o nunca divulgado). Remarcar, reabrir, adiar e cancelar avisam quem segue (`federation_followers`) e pode ver o evento; marcar avisa quando a equipe pede. PR 9b: `convene` (pauta, edital publicado do tipo convocação/aviso, quórum; mudar a convocação divulgada pede motivo e vai ao histórico) e `record` (só depois do início; presença, resultado por item — sem quórum só adiado/retirado —, votos, ata/lista/votação; corrigir pede motivo), com a régua copiada em `federationMeetingPolicy.js` (paridade com `domain/meeting.js`). Audita `federation_event_*` (com `followers_notified`) | permissão `docs`/`admin`; `competitions` só nos tipos da agenda esportiva |
| `federationAgendaFeed` (PR 9a, HTTP público, rewrite `/api/agenda/**`) | a agenda assinável: `/api/agenda/{slug ou id}.ics` → ICS (RFC 5545, linhas dobradas em 75 octetos) com os eventos **públicos** do último ano para a frente e os torneios chancelados; adiado = `TENTATIVE`, cancelado = `CANCELLED`; cache 15 min; 404 se a flag, a federação, a aprovação ou o módulo faltam | qualquer um (só lê o público) |
| `federationComments` (PR 10, `functions/federationComments.js`) | comentários no acervo e na agenda: `post` (quem pode ler o alvo, com os comentários abertos; texto 3–1.000 pela régua de `federationCommentsPolicy.js`, paridade com `domain/comments.js`; 30 s entre comentários e 10 por dia por alvo), `report` (motivo da lista; uma por pessoa em `federation_comment_reports`, numa transação; a 3ª oculta), `delete` (só o autor; leva respostas e denúncias), e para `docs`/`admin`: `reply` (resposta oficial, avisa o autor), `hide` (motivo ≥ 10, avisa o autor com o motivo), `restore` (zera as denúncias), `settings` (aberto/fechado/consulta pública até o fim do dia em Brasília) e `queue` (a fila da moderação). Audita `federation_comment_reply\|hide\|restore\|settings` | conta logada; moderação `docs`/`admin` |
| `federationAccounts` (módulo `accounts`, `functions/federationAccounts.js`) | orçamento e prestação de contas: `budget_save` (cria; editar o aprovado/publicado é reformular, motivo ≥ 10, volta a rascunho), `budget_submit`, `budget_approve` (data + reunião da agenda opcional, conferida), `budget_publish` (`pub` + cópia `published`), `entry_add` (anexo copiado de `federacao-contas/{uid}/` para `federacao-contas-oficial/`, SHA-256; data nunca no futuro), `entry_void` (motivo), `entry_import` (até 200 movimentos do extrato bancário lidos na tela; cada um com a validação do `entry_add`, data nunca no futuro e período aberto, senão o lote inteiro é recusado; id determinístico pelo `bank_ref`, numa transação que só grava o que falta; audita `federation_ledger_import`), `report_open` (cria; reabre a enviada com motivo, só antes do parecer), `report_save` (demonstrações e notas), `report_submit` (só com o período encerrado; congela o retrato e avisa `fiscal`), `opinion` (`fiscal`/`admin`; avisa `finance`+`admin`), `report_assembly`, `report_publish` (exige parecer; com `official_docs` publica dois atos no acervo via `publicarAto`), `file` (anexo em base64, ≤ 9 MB). Período com prestação enviada recusa lançar e estornar. Régua em `federationAccountsPolicy.js` (paridade com `domain/accounts.js`); `despesasDerivadas()` é o ponto de junção da arbitragem. Audita `federation_budget_*`, `federation_ledger_*`, `federation_account_*` | `finance`/`admin` preparam; `fiscal`/`admin` dão o parecer; todos os três leem |
| `federationCommentsList` (PR 10, sem login) | `list`: os comentários de um documento publicado ou evento, conferindo a leitura do alvo com a régua da regra (público / filiado ativo e equipe / equipe); ocultos só para a moderação e o autor; nunca devolve uid (só nome e "é meu") | aberta; o que volta depende de quem lê |
| `federationReferees` (arbitragem, `functions/federationReferees.js`) | módulo `referees` (`docs/50` §22). Equipe: `roster_add`/`roster_update`/`roster_remove` (quadro por nível; pela pessoa ou pela credencial; notas em `private/staff`), `assign` (até 20 por vez; alertas — indisponível, outra escala no dia, inscrito como atleta, nível abaixo do mínimo — não bloqueiam; fora do quadro, inativo, função errada e duplicado bloqueiam), `reassign`, `cancel` (motivo), `close_event` (falta × atuou; sem resposta é cancelada), `evaluate` (5 critérios 1–5), `mark_paid` (lote, `paid: false` desfaz), `rules` (`federations.referee_rules`). Árbitro: `respond` (aceitar/recusar com conflito declarado), `report` (súmula), `self` (disponibilidade + quadro público), `crew` (só com `crew_visible`). Régua em `federationRefereesPolicy.js` com paridade contra `domain/referees.js`. Avisa e audita `federation_referee_*` | equipe com `courses`/`admin`; o árbitro só nas próprias escalas |
| `federationRegularity` (regularidade do filiado, `functions/federationRegularity.js`, `docs/50` §30) | `level_set` (nível oficial com motivo e histórico; avisa o atleta/responsável), `level_review` (o dono pede, um por vez; avisa `competitions`/`members`), `level_review_decide` (aceitar = definir o nível; recusar com motivo), `consents` (o dono; só o que mudou entra no registro), `incident_create` (módulo `insurance`; o dono ou a equipe; guarda `insured` e a cópia da apólice; avisa o outro lado), `incident_update` (andamento; `claim` exige número do sinistro). Régua em `federationRegularityPolicy.js` com paridade contra `domain/regularity.js`. Audita `federation_level_*`, `federation_consents_update`, `federation_incident_*` | nível: `members`/`competitions`; revisão e autorizações: o dono da filiação (pessoa, responsável ou gestor da entidade); ocorrência: o dono ou `members`/`competitions` |
| `federationCompetition` (competições, `functions/federationCompetitions.js`, `docs/50` §31) | `checklist` e `report` (o diretor, quem organiza ou `competitions`/`admin`; o relatório só a partir do início do torneio, com descrição obrigatória de lesões e reclamações; a primeira entrega avisa competições), `final_send` (`competitions`/`admin`, torneio chancelado por esta federação: convida os primeiros de cada categoria de `federation_rankings/{fed}_{ano}` que ainda não foram convidados e guarda as opções em `report.final`), `final_answer` (o próprio atleta, dentro do prazo; recusar chama o próximo), `final_cancel` (equipe, com motivo; chama o próximo). Régua em `federationCompetitionsPolicy.js`, paridade com `domain/competitions.js` | conta logada; a ação confere quem |
| `federationSelection` (seleção e editais, `functions/federationSelection.js`, `docs/50` §32) | Convocação (módulo `selection`; `competitions`/`admin`): `callup_save` (rascunho; publicada, a regra não muda), `callup_publish` (pelo ranking, convida os primeiros de cada categoria de `federation_rankings/{fed}_{ano}`), `callup_add` (a dedo, depois de publicada), `callup_member_update` (documentos conferidos, anotação), `callup_cancel_member` (com motivo; chama o próximo), `callup_close` e `callup_cancel` (o rascunho é apagado). `callup_costs`: competições edita os custos, só o financeiro marca `paid_at`. `callup_answer`: o próprio convocado, no prazo, com o tamanho do uniforme quando pedido; recusar chama o próximo. Edital (módulo `grants`): `grant_save`, `grant_publish` (com o acervo ligado vira ato numerado), `grant_decide`, `grant_result`, `grant_appeal_decide`, `grant_finalize`, `grant_cancel` (competições/admin), `grant_pay` (financeiro/admin; `undo` desfaz), `grant_apply`, `grant_withdraw`, `grant_appeal` (a própria pessoa; só filiado em dia com `members_only`; arquivo só da própria pasta). Régua em `federationSelectionPolicy.js`, paridade com `domain/selection.js`. O arquivo da inscrição sai por `federationDocument` com `applicationId` (auditado em `federation_grant_file_view`) | conta logada; a ação confere quem |
| `federationRefereesPublic` (arbitragem, sem login) | o quadro público (ativos com `public_listing`: nome, nível, cidade, foto) e quem apita os eventos públicos (só `confirmed`, nome e função, a partir de 30 dias atrás; com `tournamentId`, só aquele torneio chancelado e público). Nunca valor, nota, conflito, disponibilidade nem uid; federação oculta só para equipe e filiado ativo | qualquer um |
| `federationElections` (módulo `elections`, `functions/federationElections.js`) | eleições: `preview` (colégio de hoje com pesos, 1/3 dos atletas, 1:6), `create`/`update` (rascunho; publicado muda só calendário e colégio, com motivo), `commission`, `publish` (edital no acervo via `publicarAtoDeTexto`; avisa os filiados), `cancel`; `candidacy_info`/`candidacy_submit`/`candidacy_withdraw`, `endorse` (transação, um por cargo), `challenge`/`defend`/`judge` (julga só depois da defesa ou do prazo); `open_voting` (congela o colégio em `federation_election_voters`), `vote` (cédula SEM uid, id aleatório, na MESMA transação que marca o eleitor; voto duplo recusado; auditoria só com federação e eleição), `close_voting`, `count` (prévia), `record_presential` (uma vez; totais por cargo fecham com o peso), `publish_result` (ata no acervo; opcional levar os eleitos à governança), `apply_governance`. Régua em `federationElectionsPolicy.js` (paridade com `domain/elections.js`). Avisos em lote | admin cria, publica, cancela e aplica a governança; a comissão eleitoral conduz (sem comissão, o admin); o filiado ativo registra chapa, apoia, impugna e vota |
| `federationAdminAccess` (PR 7) | `grant` (categoria, motivo ≥ 20 letras, 1/2/4/8 h, referência): grava PRIMEIRO `admin_access_logs` (`federation_access`) e depois `federation_admin_grants`; `end` registra `federation_access_end` e apaga | admin da plataforma |
| `federationNews` (PR 4, `functions/federationNews.js`) | `notify`: notícia **publicada** e ainda não avisada, de federação com o módulo `news` → um aviso por conta entre as filiações `active` (o dependente avisa o responsável), lotes de 400, link `/federacoes/{id}?noticia={id}`; grava `notified_at`/`notified_count`/`notified_by` (a regra recusa o cliente nesses campos) e audita `federation_news_notify`. Segunda chamada ⇒ `failed-precondition` | permissão `comms` ou `admin` da federação |

`federationChargeConfirm` (PR 3): a `origin` decide o efeito da confirmação —
`membership|renewal` ativa/renova, `course` confirma a inscrição, `fine` quita a
sanção; o pagador pode ser o **responsável** do dependente. Cobrança de curso
de quem não é filiado não tem `member_id`, e confirmar/cancelar funciona sem
ele; quitar filiação sem `member_id` é `failed-precondition`.

**Agendada**: `federationNewsPublish` (2026-10-22) — a cada 15 minutos,
`federationNews.publishDue`: as notícias `status == 'scheduled'` (uma
igualdade, zero índice) com `publish_at_ms` vencido viram `published`, com
`published_at` na data de Brasília da hora marcada; com `notify_on_publish` o
aviso de `notify` sai junto (uma vez, `notified_by: 'system'`). Federação sem
o módulo `news` ou com a flag desligada: nada muda. Audita
`federation_news_scheduled_publish`.

**Agendada**: `federationMembershipSweep` — todo dia às 06:00 (Brasília),
quatro varreduras independentes (`Promise.allSettled`: uma falhando não derruba
as outras, e o erro vai para o log): `federations.sweep` — `active` →
`expired` quando a validade já PASSOU (`daysLeft < 0`); avisos 30, 7 e 1 dia
antes e "vence hoje" (uma vez cada, em `expiry_notified`); lembrete da
cobrança ainda `open` no vencimento e 7 dias depois, a `payer_uid` (uma vez
cada, em `overdue_notified`); recontagem de `member_count`; `federationTransfers.sweep` (PR 3) — libera as
transferências de federação sem resposta até `deadline` (`auto_released:
true`, avisa os dois lados); e `federationDiscipline.sweep` — aplica na data a
suspensão gravada com início FUTURO (`applied_at_ms` nulo). O FIM da
suspensão não passa pela varredura: termina na data gravada, que a regra
compara com `request.time`; suspensões sobrepostas valem até a mais longa
(`recalcularSuspensao`). `federationStaff.sweep` (PR 7) — avisa 30, 7 e 1 dia antes do fim do mandato (pessoa e admins master, uma vez cada em `term_warned`); vencido, tira da equipe e avisa, salvo o último admin master (fica, um aviso só em `term_held_notified`). `federationRegularity.sweep` (`docs/50` §30) — documento aceito com `valid_until` nos próximos 30 dias avisa quem enviou aos 30 e 7 dias e no dia (uma vez cada, em `expiry_notified`); o vencido nos últimos 7 dias ganha `expired_applied` e refaz `docs_state`/`docs_block` da filiação. O gatilho `federationDocumentsSync` (`onDocumentWritten federation_documents_submitted/{docId}`) refaz o mesmo resumo a cada envio, aceite, recusa ou exclusão, e só grava se mudou. `federationSelection.sweep` (`docs/50` §32) — convite de convocação sem resposta no prazo vira `expired`, o próximo do ranking é chamado e a lista pública é refeita; edital aberto com `closes_at` vencido passa a `review` (avisa competições); resultado com o prazo de recurso vencido e nenhum recurso pendente vira `final`. `federationCompetitions.sweep` (`docs/50` §31.5) — convite da final sem resposta no prazo vira `expired` e o próximo do ranking é chamado, até o torneio começar. O gatilho `federationSanctionSync` (`onDocumentWritten tournaments/{tournamentId}`; torneio sem federação sai sem ler nada) confere o pedido de chancela NOVO uma vez (antecedência, diretor credenciado, taxa da categoria → cobrança `origin: 'sanction'`, ou recusa com o motivo), cancela a taxa aberta do pedido retirado/recusado e, na aprovação, abre `federation_tournament_reports/{id}` e avisa o diretor. `federationChargeConfirm` com `origin: 'sanction'` grava `fee_paid_at_ms`/`fee_cancelled_at_ms` no torneio e avisa competições. `federationReferees.sweep` (arbitragem) — avisa o convocado que ainda não respondeu na véspera do prazo (`respond_by` = amanhã), uma vez (`reminded`).

Toda ação grava `audit_logs` (`federation_*`) e avisa por `notifications`
(`type: 'federation'`, `origin: 'server'`, `essential: true`, textos por
`tx()` → `functions/i18n/avisos.json`). Testes: `functions/federations.test.js`
(ciclo com banco falso), `functions/federationPr3.test.js` (transferência,
curso, disciplina, importação, documento, dependente, cobrança por origem,
suspensões sobrepostas e futuras, cobrança sem filiação), `federationPr4.test.js`
e `tests/rules/federation.rules.test.js` + `federationPr2/3/4.rules.test.js` +
`federationRevisao.rules.test.js` (emulador). O banco falso dos testes
(`tests/fakes/fakeFirestore.cjs`) recusa leitura depois de escrita dentro de
`runTransaction`, como o Admin SDK — leia tudo antes de escrever.

**Gatilhos do ranking oficial** (`functions/federationRanking.js`, PR 2):

| Função | Gatilho | Faz |
|---|---|---|
| `federationRankingRecompute` | `onDocumentWritten federation_results/{resultId}` | `onResultWritten`: temporada fechada ⇒ nada. Senão lê `federations/{fed}.ranking_config`, os `federation_points` do resultado (`result_id`) e as filiações de quem está nele (`federation_members/{fed}_{uid}`, para `members_only`: federada ativa na data do torneio); `ledgerDiff` decide quem é lançado, quem fica como está, quem é refeito (com `previous`) e quem é cancelado (com o motivo); grava em lotes de 400 e soma `federation_rankings/{fed}_{temporada}` (`recomputeSeason`, a partir dos lançamentos; antes, lança uma vez o resultado `sent` da temporada que ainda não tem lançamento — os enviados antes do livro de pontos). |
| `federationRankingConfig` | `onDocumentWritten federations/{fedId}` | Só quando `ranking_config` mudou (comparação por JSON): reaplica a soma (o `best_n`) só aos anos **abertos** (`openSeasons`); não reescreve lançamento nem ano fechado. |
| `federationRankingRolling` | agendada (aposentada) | Função vazia: o ranking corrido (PR #308) foi desfeito em 2026-10-22. Fica publicada porque o deploy por nome não apaga; remover com `firebase functions:delete federationRankingRolling --region southamerica-east1`. |

Categorias de torneio (2026-10-22): com `ranking_config.tiers[]` próprias, cada
resultado pontua pela tabela da categoria (`result.tier` = o `id` dela,
multiplicador 1) e o lançamento leva a cópia `tier_code`/`tier_group`/`tier_name`;
sem categorias próprias, as três padrão são derivadas como antes. A
normalização é idempotente (categoria marcada `legacy` é descartada ao reler).

A conta (`awardPoints`, `aggregateSeason`, `ledgerDiff`, `seasonClosed`,
`normalizeRankingConfig`) é
**cópia** de `src/modules/federations/domain/officialRanking.js`, com paridade
em `functions/federationRanking.parity.test.js`; o documento gravado corta os
`results` de cada linha em 12. `federation_points` e `federation_rankings` são
`allow write: if false`: o navegador só lê. O ano fecha em 01/02 do ano
seguinte (00:00 de Brasília), derivado da data — nenhuma tarefa agendada. Não
avisa ninguém e não grava auditoria (é derivado).

## 9. Motores duplicados e testes de paridade

O pacote de Functions não importa `src/`, então estas regras existem **duas
vezes** — cópia que diverge é uma plataforma com duas verdades. Cada par tem
teste que roda as duas implementações sobre as mesmas entradas e exige
resultado idêntico (mexer num lado só quebra o teste, de propósito):

| Regra | Servidor | Cliente | Teste de paridade |
|---|---|---|---|
| ELO, rating 2.0–8.0, duplas, tabela de níveis | `functions/ranking.js`, `functions/engines/dupr.js`, `functions/engines/doubles.js`, `LEVEL_TABLE` de `platformRankings.js` | `src/modules/rating/domain/{elo,duprScale,doublesRanking}.js`, `leveling/data/levels` | `functions/engines/parity.test.js` (400 partidas; confere também a ordem da tabela de níveis) |
| Elegibilidade do torneio para o ranking | `isEligible` (`functions/ranking.js`) | `isTournamentRankingEligible` | `src/modules/tournament/domain/rankingEligibility.test.js` |
| Mercado: ações do pedido e da oferta, avaliação, termos proibidos | `functions/marketplace.js` | `src/modules/marketplace/domain/{orderStatus,offers,reputation,settings,listing}.js` | `functions/marketplace.parity.test.js` |
| Mercado: preço com cupom/vale | `functions/marketPromo.js` | `src/modules/marketplace/domain/promotions.js` | `functions/marketPromo.parity.test.js` |
| Mercado: busca salva | `functions/marketSearch.js` | domínio de descoberta do cliente | `functions/marketSearch.parity.test.js` |
| Preferências de notificação e área do aviso | `functions/notificationPrefs.js` | `src/modules/notifications/domain/{preferences,noticeFeed}.js` | `functions/notificationPrefs.parity.test.js` |
| Textos de aviso traduzidos | `functions/avisoI18n.js` + `functions/i18n/avisos.json` | `src/core/i18n/avisos.js` | `functions/avisoI18n.parity.test.js` (+ guarda do JSON gerado) |
| Gamificação: matemática e ids dos primeiros passos | `functions/gamificationCore.js`, `gamification.js` | `src/modules/progression/domain` | `src/modules/progression/domain/serverParity.test.js` |
| Avisos por e-mail/celular: configuração, escolhas, decisão por canal | `functions/messagingPolicy.js` | `src/modules/messaging/domain/policy.js` | `functions/messagingPolicy.parity.test.js` |
| Fila de espera: prazo e lugares | `functions/openSlotWaitlist.js` | `src/modules/arenas/domain/waitlist.js` | `functions/openSlotWaitlist.test.js` / `waitlist.test.js` |

## 10. Deploy, vigilância e como testar

### 10.1 Por que um codebase próprio e deploy por nome

O projeto Firebase é **compartilhado com outro aplicativo**. `firebase deploy
--only functions --force` apaga toda função do mesmo codebase ausente do código
local; em 2026-09 isso apagou funções nos dois sentidos. Duas camadas:

1. **Codebase `picklerush`** (`firebase.json`): a CLI só considera "removidas"
   funções do **mesmo** codebase — o deploy do outro app (codebase `default`)
   não enxerga as nossas, e o nosso não toca nas dele.
2. **Deploy por nome**: `scripts/functions-deploy.sh` lista
   `grep -oE '^exports\.[A-Za-z0-9_]+' functions/index.js` e publica
   `firebase deploy --only functions:picklerush:a,functions:picklerush:b,…`.
   Lista vazia **não publica nada** (um `--only` vazio voltaria a significar
   "tudo"). O script recusa codebase vazio ou `default`.

Consequência prática: **toda função nova precisa ser `exports.nome = …` no
início da linha de `functions/index.js`** (é o que o script e a vigilância
leem). Para aposentar uma função, não basta tirar a exportação (a versão antiga
continua rodando): veja o roteiro de `expireStaleNotifications` em §4.2.

Guarda: `src/core/guards/deployFunctions.test.js` (codebase próprio; nenhum
workflow faz deploy amplo; deploy e vigilância usam o mesmo script) e
`src/core/guards/deployFirebaseWorkflow.test.js`.

### 10.2 Publicação automática

`.github/workflows/deploy-firebase.yml` (push em `main`): `npm --prefix
functions ci` e `bash scripts/functions-deploy.sh` no passo **"Deploy Cloud
Functions (non-fatal)"**. É não-fatal: Hosting e Firestore já foram aplicados;
o passo emite avisos específicos para Blaze ausente e IAM (a service account
precisa de Cloud Functions Admin e Service Account User, e as APIs
cloudfunctions/cloudbuild/artifactregistry/run/eventarc/pubsub habilitadas — ver
`functions/README.md`).

### 10.3 Vigilância (`functions-watchdog.yml`)

Agenda `7,37 * * * *` (a cada 30 min) + `workflow_dispatch`, `timeout-minutes: 20`,
`concurrency: functions-watchdog`. Instala `firebase-tools@13`, usa a service
account do secret `FIREBASE_SERVICE_ACCOUNT` e:

1. compara as funções exportadas em `functions/index.js` com
   `firebase functions:list --json` na região `southamerica-east1`;
2. se faltar alguma — ou se alguma nossa não tiver o rótulo do codebase —
   roda `npm --prefix functions ci` + `bash scripts/functions-deploy.sh`;
3. se algo **sumiu**, **falha o job de propósito** (e-mail ao dono do
   repositório), dizendo que algo fora do repositório apagou funções; a
   recuperação agendada do ranking (`catchUpPlatformRankings`) cobre os
   resultados do intervalo.

Só lê a lista de funções; não toca no banco. O que segue compartilhado mesmo
assim (Auth, bucket do Storage, service account): `docs/03-WORKFLOW.md` §9.1.

### 10.4 Testar e publicar localmente

```bash
npm test                                   # vitest: inclui functions/**/*.test.js e engines/parity
npx vitest run functions/platformRankings.test.js   # um arquivo
npm run test:rules                         # emulador (Firestore + Storage): tests/rules/*
npm run i18n:avisos                        # regenera functions/i18n/avisos.json
npm run docs:inventario                    # regenera o 46-INVENTARIO.md (CI reprova se desatualizado)
```

Os testes de `functions/` usam Firestore falso (`tests/fakes/fakeFirestore.cjs`,
`fakeFirestoreRico.cjs`) e `createRequire` para carregar os módulos CommonJS.
**Limite**: o falso nunca recusa — o que depende de regra precisa de teste no
emulador. Os wrappers de `functions/index.js` (gatilhos e callables) não são
carregados pelos testes; a lógica testável mora nos módulos ao lado.

Publicação manual (exige login na CLI e `FIREBASE_PROJECT_ID`; o script usa
`jq`):

```bash
FIREBASE_PROJECT_ID=<projeto> bash scripts/functions-deploy.sh
```

Nunca use `firebase deploy --only functions` (amplo).

## 11. Roteiro para criar uma função nova

1. Lógica em módulo próprio em `functions/` (CommonJS, sem importar `src/`),
   com `*.test.js` ao lado; se o cliente tem a mesma regra, escreva o teste de
   paridade.
2. Em `functions/index.js`: `exports.nome = onX({ …, database: DATABASE_ID,
   region: REGION }, …)` com a exportação **no início da linha**.
3. Callable: confira `req.auth` e o papel **dentro da função** (o Admin SDK não
   passa pelas regras); erro conhecido vira `HttpsError` com código; `execute`
   destrutivo exige prévia e motivo.
4. Escrita em coleção nova: `match` aditivo no `firestore.rules` (normalmente
   `allow write: if false` do lado do cliente); coleção com dado da pessoa entra
   na exclusão e na exportação de conta.
5. Rode `npm run docs:inventario` e atualize esta página.
