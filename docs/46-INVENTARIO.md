# 46 — Inventário gerado do código

> ⚙️ **Arquivo GERADO. Não edite à mão.** Fonte: `scripts/gen-inventario.mjs`.
> Depois de mexer em rota, coleção, regra, índice, Cloud Function, flag ou
> módulo, rode `npm run docs:inventario` e comite o resultado. O CI (job de
> documentação) reprova o PR se este arquivo não bater com o código.
>
> Para o **porquê** e o **como** de cada parte, siga o mapa em
> [`00-INDEX.md`](./00-INDEX.md). Este arquivo responde só **"o que existe hoje"**.

## 1. Números

| Item | Valor |
|---|---|
| Módulos de domínio (`src/modules/`) | 31 |
| Telas V2 (`src/v2/pages/V2*.jsx`) | 111 |
| Pastas de componentes V2 (`src/v2/components/`) | 31 |
| Coleções raiz no `firestore.rules` | 188 |
| Blocos `match` (raiz + subcoleções) | 207 |
| Índices compostos (`firestore.indexes.json`) | 38 |
| Cloud Functions exportadas | 68 |
| Feature flags ligáveis (`FEATURE_FLAG`) | 7 |
| Funcionalidades permanentes (`PERMANENT_FEATURE`) | 33 |
| Caminhos de Storage com regra | 7 |
| Arquivos de teste (`*.test.js(x)`) | 700 |
| Workflows do GitHub Actions | 7 |
| Documentos/pastas em `docs/` | 56 |

## 2. Stack (de `package.json`)

React ^18.2.0 · Vite ^6.1.0 · Tailwind ^3.4.17 · Firebase JS ^12.12.1 · React Query ^5.84.1 · Vitest ^4.1.11.
Cloud Functions: Node 22, `firebase-admin` ^13.10.0, `firebase-functions` ^6.1.0. Região `southamerica-east1`, banco Firestore nomeado `pickleball`.

## 3. Módulos de domínio

Colunas = arquivos de código (sem testes) por camada; `·` = a camada não existe no módulo.

| Módulo | domain | services | hooks | components | pages | i18n | README |
|---|---|---|---|---|---|---|---|
| `achievements` | 2 | 1 | 2 | 3 | · | · | sim |
| `admin` | 9 | 5 | 1 | 1 | · | 2 | sim |
| `analytics` | 1 | · | 1 | 1 | · | · | sim |
| `arenas` | 62 | 24 | 17 | 6 | · | 2 | sim |
| `athletes` | 8 | 1 | 2 | 1 | · | · | sim |
| `chat` | 2 | 1 | 1 | 1 | · | · | sim |
| `circuits` | 1 | 1 | 1 | · | · | · | sim |
| `clubs` | 8 | 3 | 4 | 7 | · | · | sim |
| `coaches` | 11 | 9 | 9 | 16 | · | 2 | sim |
| `federations` | 19 | 2 | 1 | · | · | 2 | sim |
| `feed` | 0 | 0 | 0 | 0 | · | · | sim |
| `games` | 19 | 5 | 11 | 1 | · | 2 | sim |
| `help` | 7 | 1 | · | · | · | 2 | sim |
| `home` | 7 | 1 | 2 | · | · | 2 | sim |
| `legal` | 3 | 1 | 2 | · | · | 2 | sim |
| `leveling` | 1 | · | · | · | · | · | sim |
| `marketplace` | 21 | 5 | 1 | · | · | 2 | sim |
| `messaging` | 3 | 1 | 1 | · | · | 2 | sim |
| `moderation` | 0 | 0 | 0 | 0 | · | · | sim |
| `notifications` | 2 | · | 1 | · | · | 2 | sim |
| `partners` | 1 | 1 | 1 | · | · | · | sim |
| `performance` | 2 | · | 1 | · | · | · | sim |
| `progression` | 37 | 20 | 27 | 14 | · | 2 | sim |
| `promo` | 2 | 1 | 1 | · | · | · | sim |
| `rating` | 15 | 7 | 5 | 2 | · | · | sim |
| `search` | 1 | · | · | · | · | · | sim |
| `sharing` | 1 | · | · | 2 | · | · | sim |
| `social` | 1 | 1 | 2 | 1 | · | · | sim |
| `tournament` | 53 | 15 | 3 | 15 | · | 2 | sim |
| `training` | 19 | 13 | 12 | · | · | 2 | sim |
| `trophies` | 2 | 1 | 1 | · | · | · | sim |

### 3.1 Dependências entre módulos

Lidas dos imports estáticos. **"Usado por"** é quem pode quebrar se você mudar
o módulo: rode os testes desses módulos também. Ciclos de import em `src/`:
**0** (o guarda `src/core/guards/fronteirasDeModulos.test.js` exige zero).

| Módulo | Nº de módulos que o usam | Usado por | Usa |
|---|---|---|---|
| `achievements` | 1 | `progression` | `progression` |
| `admin` | 2 | `messaging`, `tournament` | `athletes`, `leveling`, `rating`, `tournament` |
| `analytics` | 2 | `games`, `tournament` | — |
| `arenas` | 8 | `coaches`, `federations`, `games`, `home`, `marketplace`, `promo`, `tournament`, `trophies` | `athletes`, `clubs`, `games`, `rating`, `sharing`, `tournament` |
| `athletes` | 12 | `admin`, `arenas`, `chat`, `clubs`, `coaches`, `games`, `home`, `progression`, `rating`, `search`, `tournament`, `trophies` | `games`, `performance`, `rating`, `tournament` |
| `chat` | 0 | — | `athletes` |
| `circuits` | 0 | — | — |
| `clubs` | 6 | `arenas`, `games`, `help`, `home`, `progression`, `training` | `athletes`, `games` |
| `coaches` | 4 | `home`, `progression`, `promo`, `training` | `arenas`, `athletes`, `leveling`, `marketplace`, `promo`, `rating`, `sharing`, `training` |
| `federations` | 2 | `promo`, `tournament` | `arenas`, `marketplace`, `tournament` |
| `feed` | 0 | — | — |
| `games` | 9 | `arenas`, `athletes`, `clubs`, `home`, `performance`, `progression`, `rating`, `social`, `training` | `analytics`, `arenas`, `athletes`, `clubs`, `leveling`, `performance`, `rating`, `tournament` |
| `help` | 0 | — | `clubs`, `progression` |
| `home` | 2 | `tournament`, `training` | `arenas`, `athletes`, `clubs`, `coaches`, `games`, `tournament` |
| `legal` | 0 | — | — |
| `leveling` | 5 | `admin`, `coaches`, `games`, `rating`, `tournament` | — |
| `marketplace` | 2 | `coaches`, `federations` | `arenas`, `training` |
| `messaging` | 0 | — | `admin`, `notifications` |
| `moderation` | 0 | — | — |
| `notifications` | 1 | `messaging` | — |
| `partners` | 0 | — | — |
| `performance` | 3 | `athletes`, `games`, `progression` | `games`, `tournament` |
| `progression` | 3 | `achievements`, `help`, `training` | `achievements`, `athletes`, `clubs`, `coaches`, `games`, `performance`, `rating` |
| `promo` | 1 | `coaches` | `arenas`, `coaches`, `federations` |
| `rating` | 8 | `admin`, `arenas`, `athletes`, `coaches`, `games`, `progression`, `tournament`, `training` | `athletes`, `games`, `leveling`, `tournament` |
| `search` | 0 | — | `athletes` |
| `sharing` | 2 | `arenas`, `coaches` | — |
| `social` | 0 | — | `games`, `tournament` |
| `tournament` | 11 | `admin`, `arenas`, `athletes`, `federations`, `games`, `home`, `performance`, `rating`, `social`, `training`, `trophies` | `admin`, `analytics`, `arenas`, `athletes`, `federations`, `home`, `leveling`, `rating` |
| `training` | 2 | `coaches`, `marketplace` | `clubs`, `coaches`, `games`, `home`, `progression`, `rating`, `tournament` |
| `trophies` | 0 | — | `arenas`, `athletes`, `tournament` |

Pastas de componentes V2: `admin`, `arenas`, `chat`, `clubs`, `coach`, `dicas`, `federations`, `feed`, `games`, `gamification`, `home`, `i18n`, `idioma`, `legal`, `leveling`, `marketplace`, `notifications`, `onboarding`, `performance`, `profile`, `promo`, `rating`, `region`, `search`, `settings`, `theme`, `tournament`, `training`, `trophies`, `tutorial`, `userArea`.

## 4. Rotas

### Raiz (`src/App.jsx`) — públicas, telão, impressão e redirecionamentos (18)

| Caminho | Tela |
|---|---|
| `/login` | `Login` |
| `/p/:tournamentId` | `PublicTournament` |
| `/torneios/:tournamentId/imprimir` | `PrintTournament` |
| `/torneios/:tournamentId/telao` | `Telao` |
| `/dia-de-jogo/:gameDayId/telao` | `GameDayTelao` |
| `/arenas/:arenaId/totem` | `ArenaKiosk` |
| `/c/:clubId` | `PublicClub` |
| `/f/verificar/:codigo?` | `PublicFederationVerify` |
| `/f/:slug` | `PublicFederation` |
| `/r/:code` | `ReferralLanding` |
| `/inicio` | → redireciona para `/` |
| `/dashboard` | → redireciona para `/` |
| `/aviso-jogos` | → redireciona para `/conduta` |
| `/boloes` | → redireciona para `/torneios` |
| `/boloes/criar` | → redireciona para `/torneios/criar` |
| `/boloes/ingressar` | → redireciona para `/torneios/ingressar` |
| `/boloes/:tournamentId` | → redireciona para `/torneios/:tournamentId` |
| `/*` | `MainEntry` |

### Aplicativo (`src/v2/V2App.jsx`) — dentro do `V2Layout`, exige login (121)

| Caminho | Tela |
|---|---|
| `(índice)` | `V2Dashboard` |
| `arenas` | `V2Arenas` |
| `arenas/criar` | `V2CreateArena` |
| `arenas/:arenaId` | `V2ArenaDetail` |
| `arenas/:arenaId/gerir` | `V2ArenaManage` |
| `arenas/:arenaId/onboarding` | `V2ArenaOnboarding` |
| `arenas/:arenaId/gerir/modulos` | `V2ArenaModules` |
| `arenas/:arenaId/gerir/dia-de-jogo` | `V2ArenaGameDays` |
| `arenas/:arenaId/gerir/dia-de-jogo/:gameDayId` | `V2ArenaGameDays` |
| `arenas/:arenaId/gerir/open-match` | `V2ArenaAdminOpenMatch` |
| `arenas/:arenaId/open-match` | `V2ArenaOpenMatch` |
| `arenas/:arenaId/matchmaking` | `V2ArenaMatchmaking` |
| `arenas/:arenaId/membros` | `V2ArenaMembers` |
| `arenas/:arenaId/gerir/membros` | `V2ArenaAdminMembers` |
| `arenas/:arenaId/gerir/professores` | `V2ArenaCoaches` |
| `arenas/:arenaId/loja` | `V2ArenaPDV` |
| `arenas/:arenaId/gerir/pdv` | `V2ArenaAdminPDV` |
| `arenas/:arenaId/aulas` | `V2ArenaClasses` |
| `arenas/:arenaId/gerir/aulas` | `V2ArenaClasses` |
| `arenas/:arenaId/torneios` | `V2ArenaLeagues` |
| `arenas/:arenaId/gerir/torneios` | `V2ArenaLeagues` |
| `arenas/:arenaId/campanhas/:campaignId` | `V2ArenaCampaign` |
| `campanhas/:campaignId` | `V2PromoCampaign` |
| `promocoes` | `V2Promotions` |
| `arenas/:arenaId/marketing` | `V2ArenaMarketing` |
| `arenas/:arenaId/gerir/marketing` | `V2ArenaMarketing` |
| `arenas/:arenaId/gerir/operacoes` | `V2ArenaOperations` |
| `arenas/:arenaId/chegada` | `V2ArenaCheckin` |
| `arenas/:arenaId/gerir/presenca` | `V2ArenaAttendance` |
| `circuits` | `V2Circuits` |
| `circuits/:circuitId` | `V2CircuitManage` |
| `coaches` | `V2Coaches` |
| `coaches/:coachId` | `V2CoachProfile` |
| `aulas` | `V2CoachAgenda` |
| `minhas-aulas` | `V2StudentLessons` |
| `arenas/:arenaId/avancado` | `V2ArenaAdvanced` |
| `arenas/:arenaId/gerir/avancado` | `V2ArenaAdvanced` |
| `minhas-reservas` | `V2Bookings` |
| `torneios` | `V2Tournaments` |
| `torneios/publicos` | → redireciona para `/torneios` |
| `torneios/criar` | `V2CreateTournament` |
| `torneios/ingressar` | `V2JoinTournament` |
| `torneios/guia` | `V2FormatsGuide` |
| `torneios/:tournamentId` | `V2Tournament` |
| `torneios/:tournamentId/gerenciar` | `V2TournamentAdmin` |
| `torneios/:tournamentId/modalidades/:modalityId` | `V2ModalityPage` |
| `torneios/:tournamentId/:tab` | `V2Tournament` |
| `atletas` | `V2Athletes` |
| `buscar` | `V2Search` |
| `atleta/:uid` | `V2AthleteProfile` |
| `clubes` | `V2Clubs` |
| `clubes/criar` | `V2CreateClub` |
| `clubes/:clubId` | `V2ClubDetail` |
| `clubes/:clubId/eventos/:eventId` | `V2EventDetail` |
| `novidades` | `V2Community` |
| `chat` | `V2Chat` |
| `ranking` | `V2Ranking` |
| `ranking/duplas` | `V2DoublesRanking` |
| `meus-jogos` | `V2MyGames` |
| `dia-de-jogo` | `V2GameDays` |
| `dia-de-jogo/:gameDayId` | `V2GameDays` |
| `encontrar-jogadores` | `V2FindPlayers` |
| `procura-jogo` | `V2OpenGames` |
| `parceiros` | `V2Partners` |
| `meu-desempenho` | `V2Performance` |
| `conquistas` | `Gamified` |
| `conquistas/:uid` | `Gamified` |
| `gamification` | `Gamified` |
| `gamification/revisao` | `Gamified` |
| `gamification/configuracoes` | `Gamified` |
| `gamification/como-funciona` | `Gamified` |
| `hall-da-fama` | `Gamified` |
| `vinculos` | `Gamified` |
| `perfil` | `V2Profile` |
| `perfil/torneios` | `V2MyTournamentsAdmin` |
| `perfil/editar` | `V2ProfileEdit` |
| `configuracoes` | `V2Settings` |
| `notificacoes` | `V2Notifications` |
| `mercado` | `V2Market` |
| `mercado/anuncio/:listingId` | `V2MarketListing` |
| `mercado/vendedor/:sellerKey` | `V2MarketSeller` |
| `mercado/favoritos` | `V2MarketFavorites` |
| `mercado/buscas` | `V2MarketSearches` |
| `mercado/vales` | `V2MarketGiftCards` |
| `mercado/carrinho` | `V2MarketCart` |
| `mercado/pedidos` | `V2MarketOrders` |
| `mercado/pedidos/:orderId` | `V2MarketOrder` |
| `mercado/vendas/:orderId` | `V2MarketOrder` |
| `mercado/ofertas/:offerId` | `V2MarketOffer` |
| `mercado/vender` | `V2MarketSell` |
| `federacoes` | `V2Federations` |
| `federacoes/abrir` | `V2FederationApply` |
| `federacoes/:federationId` | `V2FederationDetail` |
| `federacoes/:federationId/filiar` | `V2FederationJoin` |
| `federacoes/:federationId/gerir` | `V2FederationManage` |
| `mercado/vender/anuncio/novo` | `V2MarketListingEditor` |
| `mercado/loja/abrir` | `V2MarketStoreApply` |
| `mercado/vender/anuncio/:listingId` | `V2MarketListingEditor` |
| `treino` | `V2Training` |
| `treino/golpes` | `V2TrainingTechniques` |
| `treino/novo` | `V2TrainingEditor` |
| `treino/item/:itemId` | `V2TrainingItem` |
| `treino/item/:itemId/editar` | `V2TrainingEditor` |
| `treino/planos/:planId` | `V2TrainingPlan` |
| `ajuda` | `V2Help` |
| `regras` | `V2Rules` |
| `nivelamento` | `V2Leveling` |
| `historia` | `V2History` |
| `conduta` | `V2Conduct` |
| `legal` | `V2Legal` |
| `legal/:docRoute` | `V2LegalDocument` |
| `politica-uso` | `V2Privacy` |
| `admin/torneios` | → redireciona para `/admin/painel?tab=tournaments` |
| `admin/metricas` | → redireciona para `/admin/painel?tab=overview` |
| `admin/parceiros` | → redireciona para `/admin/painel?tab=partners` |
| `admin/perfis` | → redireciona para `/admin/painel?tab=profiles` |
| `admin/painel` | `V2AdminConsole` |
| `admin/owner-restore` | `V2AdminOwnerRestore` |
| `admin/owner-debug` | `V2AdminOwnerDebug` |
| `admin/v3-bootstrap` | → redireciona para `/admin/painel?tab=flags` |
| `*` | `NotFoundRoute` |

## 5. Coleções Firestore (`firestore.rules`)

Cada coleção raiz tem um bloco `match`; a linha leva à regra exata. Campos e relações: [`05-DATA-MODEL.md`](./05-DATA-MODEL.md).

`platform_settings` · `player_ratings` · `player_skill_ratings` · `skill_rating_history` · `doubles_rankings` · `club_internal_ratings` · `club_internal_ratings_ext` · `club_internal_doubles_ratings` · `club_internal_doubles_ratings_ext` · `rating_history` · `player_goals` · `tournament_photos` · `follows` · `open_games` · `legal_consents` · `push_tokens` · `game_days` · `affiliate_links` · `arenas` · `arena_managers` · `arena_bookings` · `arena_reviews` · `arena_favorites` · `booking_waitlist` · `arena_courts` · `arena_court_schedules` · `arena_settings` · `arena_module_states` · `arena_open_slots` · `arena_waitlist` · `arena_members` · `arena_packages` · `arena_wallets` · `arena_subscriptions` · `arena_products` · `arena_sales` · `arena_payments` · `users` · `tournaments` · `tournament_admins` · `tournament_modalities` · `tournament_registrations` · `provisional_claims` · `tournament_announcements` · `tournament_matches` · `tournament_groups` · `tournament_rankings` · `tournament_courts` · `notifications` · `platform_secrets` · `message_outbox` · `message_suppressions` · `phone_verifications` · `message_reports` · `admin_access_logs` · `audit_logs` · `athlete_profiles` · `clubs` · `club_invite_codes` · `club_code_joins` · `club_members` · `club_join_requests` · `club_member_invites` · `club_events` · `event_invites` · `club_event_games` · `club_event_rsvps` · `club_posts` · `club_forum_threads` · `conversations` · `arena_matches` · `arena_coaches` · `arena_classes` · `arena_class_bookings` · `arena_internal_tournaments` · `arena_ladders` · `arena_coupons` · `arena_campaigns` · `arena_nps_responses` · `arena_referrals` · `arena_checklists` · `arena_maintenance_orders` · `arena_devices` · `arena_networks` · `arena_network_memberships` · `arena_tier_configs` · `circuits` · `circuit_admins` · `circuit_tournaments` · `circuit_results` · `arena_unavailabilities` · `coaches` · `coach_favorites` · `coach_arenas` · `coach_availability` · `coach_lessons` · `coach_busy_slots` · `coach_waitlist` · `coach_student_notes` · `coach_students` · `coach_level_validations` · `coach_clinics` · `coach_clinic_signups` · `coach_packages` · `coach_package_sales` · `coach_content` · `coach_products` · `arena_inventory_products` · `arena_inventory_entries` · `arena_inventory_exits` · `catalog_products` · `arena_market_reports` · `dupr_export_log` · `user_progression_v2` · `user_missions` · `user_achievements_v2` · `user_streak_meta` · `user_referral_codes` · `user_referrals` · `user_kudos` · `user_kudos_index` · `user_rivals` · `crews` · `crew_members` · `mentorships` · `season_rankings` · `promo_coupons` · `promo_campaigns` · `promo_settings` · `user_gamification_prefs` · `user_xp_grants` · `gamification_moderation` · `gamification_flags` · `gamification_metrics` · `gamification_integrity` · `hall_of_fame` · `match_reviews` · `user_reputation` · `user_reputation_private` · `partner_letters` · `partner_letter_authors` · `gamification_challenges` · `challenge_entries` · `duels` · `gamification_rewards` · `reward_claims` · `gamification_goals` · `training_items` · `training_shares` · `training_sessions` · `training_plans` · `training_meta` · `training_debriefs` · `training_questions` · `training_reports` · `market_sellers` · `market_listings` · `market_questions` · `market_favorites` · `market_saved_searches` · `market_addresses` · `market_follows` · `market_carts` · `market_coupons` · `market_gift_cards` · `market_offers` · `market_orders` · `market_reviews` · `market_disputes` · `market_reports` · `federations` · `federation_staff` · `federation_plans` · `federation_members` · `federation_documents_submitted` · `federation_transfers` · `federation_imports` · `federation_courses` · `federation_course_enrollments` · `federation_credentials` · `federation_sanctions` · `federation_reports` · `federation_news` · `federation_charges` · `federation_card_index` · `federation_affiliations` · `federation_results` · `federation_rankings`

**Subcoleções com regra própria (19):** `game_days/…/participants` · `game_days/…/games` · `tournament_registrations/…/private` · `club_events/…/dates` · `club_events/…/date_rsvps` · `club_events/…/messages` · `club_events/…/participants` · `club_events/…/games` · `club_forum_threads/…/comments` · `club_forum_threads/…/poll_votes` · `conversations/…/messages` · `training_sessions/…/comments` · `training_questions/…/messages` · `market_sellers/…/private` · `market_coupons/…/market_coupon_uses` · `market_orders/…/events` · `market_orders/…/private` · `federations/…/private` · `federation_members/…/private`

## 6. Índices compostos

- `arena_campaigns`: (arena_id, created_at↓)
- `arena_classes`: (arena_id, starts_at)
- `arena_coupons`: (arena_id, active)
- `arena_devices`: (arena_id, name)
- `arena_internal_tournaments`: (arena_id, date)
- `arena_maintenance_orders`: (arena_id, created_at↓)
- `arena_members`: (arena_id, tier)
- `arena_open_slots`: (arena_id, starts_at)
- `arena_packages`: (arena_id, active)
- `arena_sales`: (arena_id, created_at↓)
- `arena_waitlist`: (arena_id, created_at↓)
- `club_events`: (club_id, visibility)
- `club_internal_doubles_ratings`: (club_id, wins↓)
- `club_internal_doubles_ratings_ext`: (club_id, wins↓)
- `club_internal_ratings`: (club_id, wins↓)
- `club_internal_ratings_ext`: (club_id, wins↓)
- `hall_of_fame`: (state, position)
- `provisional_claims`: (email_lc, claimed)
- `season_rankings`: (seasonId, xp↓) · (uid, xp↓) · (seasonId, public, publicPosition) · (seasonId, public, state, publicPosition)
- `tournament_admins`: (user_id, created_at↓)
- `tournament_courts`: (tournament_id, order)
- `tournament_matches`: (modality_id, stage_index, round) · (modality_id, stage_index, round, position)
- `tournament_modalities`: (tournament_id, created_at)
- `tournament_registrations`: (tournament_id, created_at) · (modality_id, created_at) · (user_id, created_at↓) · (player_a_user_id, created_at↓) · (player_b_user_id, created_at↓) · (player_a_email_lc, created_at↓) · (player_b_email_lc, created_at↓)
- `tournaments`: (creator_uid, created_at↓)
- `user_missions`: (uid, date↓) · (uid, xpEarned)
- `user_progression_v2`: (tier, xpTotal↓)

> Regra do projeto: consulta com `where` + `orderBy` precisa de índice EXATO; o guarda `src/core/guards/indicesCompostos.test.js` confere.

## 7. Cloud Functions (`functions/index.js`)

| Função | Tipo | Gatilho / agenda |
|---|---|---|
| `recomputeRankingOnTournamentChange` | gatilho Firestore | `tournaments/{tournamentId}` |
| `recomputeRankingOnTournamentMatch` | gatilho Firestore | `tournament_matches/{matchId}` |
| `recomputeRankingOnTournamentRegistration` | gatilho Firestore | `tournament_registrations/{registrationId}` |
| `recomputeRankingOnClubEventGame` | gatilho Firestore | `club_event_games/{gameId}` |
| `catchUpPlatformRankings` | agendada | `every 30 minutes` |
| `expireStaleNotifications` | agendada | `0 3 1 1 *` |
| `advanceOpenSlotWaitlist` | agendada | `every 10 minutes` |
| `promoteOpenSlotWaitlistOnSlot` | gatilho Firestore | `arena_open_slots/{slotId}` |
| `promoteOpenSlotWaitlistOnEntry` | gatilho Firestore | `arena_waitlist/{entryId}` |
| `onCoachAvailabilityWritten` | gatilho Firestore | `coach_availability/{coachId}` |
| `onCoachLessonWritten` | gatilho Firestore | `coach_lessons/{lessonId}` |
| `pushOnNotificationCreate` | gatilho Firestore | `notifications/{notifId}` |
| `refreshLadderWeekly` | agendada | `0 23 * * 0` |
| `aggregateNpsDaily` | agendada | `0 4 * * *` |
| `autoCloseChecklists` | agendada | `0 1 * * *` |
| `recomputeClubRankingOnClubGame` | gatilho Firestore | `club_events/{eventId}/games/{gameId}` |
| `recomputeClubRankingOnClubEventGame` | gatilho Firestore | `club_event_games/{gameId}` |
| `recomputeClubRankingOnTournamentMatch` | gatilho Firestore | `tournament_matches/{matchId}` |
| `recomputeClubRankingOnMemberChange` | gatilho Firestore | `club_members/{memberId}` |
| `recomputeClubRankingOnAthleteProfileChange` | gatilho Firestore | `athlete_profiles/{uid}` |
| `recomputeAllClubInternalRankings` | chamável (callable) |  |
| `recomputeOneClubInternalRanking` | chamável (callable) |  |
| `recomputeAllClubsMonthly` | agendada | `0 4 1 * *` |
| `recomputeSeasonRankingDaily` | agendada | `0 3 * * *` |
| `gamificationChallengeStandings` | agendada | `every 3 hours` |
| `gamificationWeeklyDuels` | agendada | `30 5 * * 1` |
| `gamificationWeeklyDigest` | agendada | `0 8 * * 1` |
| `gamificationDailyUpkeep` | agendada | `0 4 * * *` |
| `adminDeleteAccounts` | chamável (callable) |  |
| `adminMergeAccountHistory` | chamável (callable) |  |
| `adminSetAccountStatus` | chamável (callable) |  |
| `adminSupportReveal` | chamável (callable) |  |
| `tournamentLinkRegistrationAccount` | chamável (callable) |  |
| `marketPlaceOrders` | chamável (callable) |  |
| `marketOrderAction` | chamável (callable) |  |
| `marketOfferAction` | chamável (callable) |  |
| `marketSubmitReview` | chamável (callable) |  |
| `marketGiftCardAction` | chamável (callable) |  |
| `marketHousekeeping` | agendada | `every 60 minutes` |
| `federationReview` | federationCallable |  |
| `federationMembership` | federationCallable |  |
| `federationChargeConfirm` | federationCallable |  |
| `federationVerify` | chamável (callable) |  |
| `federationTransfer` | federationCallable |  |
| `federationCourse` | federationCallable |  |
| `federationDiscipline` | federationCallable |  |
| `federationImportMembers` | federationCallable |  |
| `federationNews` | federationCallable |  |
| `federationDocument` | federationCallable |  |
| `federationMembershipSweep` | agendada | `every day 06:00` |
| `federationRankingRecompute` | gatilho Firestore | `federation_results/{resultId}` |
| `federationRankingConfig` | gatilho Firestore | `federations/{fedId}` |
| `marketFavoriteCount` | gatilho Firestore | `market_favorites/{favId}` |
| `marketFollowCount` | gatilho Firestore | `market_follows/{followId}` |
| `marketFollowersNotify` | gatilho Firestore | `market_listings/{listingId}` |
| `marketQuestionNotify` | gatilho Firestore | `market_questions/{questionId}` |
| `marketModerateListing` | gatilho Firestore | `market_listings/{listingId}` |
| `marketSavedSearchAlerts` | agendada | `every day 10:00` |
| `marketPriceDropNotify` | gatilho Firestore | `market_listings/{listingId}` |
| `marketLinkArenaProduct` | chamável (callable) |  |
| `marketArenaStockSync` | gatilho Firestore | `arena_inventory_products/{productId}` |
| `clientErrorReport` | onRequest |  |
| `messagingOnNotificationCreate` | gatilho Firestore | `notifications/{notifId}` |
| `messagingQueue` | agendada | `every 10 minutes` |
| `messagingAdmin` | chamável (callable) |  |
| `messagingUser` | chamável (callable) |  |
| `messagingAuthEmail` | chamável (callable) |  |
| `messagingHook` | onRequest |  |

## 8. Feature flags

**Ligáveis pelo admin (`FEATURE_FLAG`, padrão desligado):** `dupr_official_sync`, `gameday_mexicano`, `gameday_king_of_court`, `marketplace`, `federations`, `multi_language`, `external_messaging`.

**Incorporadas (`PERMANENT_FEATURE`, sempre ligadas, 33):** `dupr_match_export`, `action_home`, `smart_matchmaking`, `post_game_flow`, `push_notifications`, `arena_ops_kpis`, `arena_unified_checkout`, `arena_dynamic_pricing`, `arena_member_crm`, `coach_public_discovery`, `coach_booking_pay`, `coach_student_progress`, `coach_level_rating_seed`, `gamification_v2`, `play_smart_rotation`, `play_groups`, `gameday_americano_live`, `help_center`, `arena_game_day`, `arena_modules`, `personalized_home`, `home_cards`, `platform_marketing`, `coach_marketing`, `dark_mode`, `guided_tips`, `essential_profile`, `my_region`, `notifications_center`, `tournament_americano_etapas`, `user_hub`, `training_center`, `game_debrief`.

## 9. Storage (`storage.rules`)

`/b/` · `/uploads/` · `/uploads/` · `/uploads/` · `/treino/` · `/mercado/` · `/federacao/`

## 10. Automação e comandos

Workflows:
- `ci.yml`
- `deploy-firebase.yml`
- `deploy-pages.yml`
- `firestore-manual-export.yml`
- `firestore-rules-diagnostico.yml`
- `functions-watchdog.yml`
- `privacy-legacy-email-cleanup.yml`

| Comando | O que roda |
|---|---|
| `npm run dev` | `vite` |
| `npm run build` | `vite build` |
| `npm run build:budget` | `node scripts/check-bundle-size.mjs` |
| `npm run preview` | `vite preview` |
| `npm run e2e:install` | `playwright install chromium` |
| `npm run e2e` | `bash scripts/e2e.sh` |
| `npm run e2e:producao` | `E2E_BASE_URL=https://picklerush.web.app playwright test` |
| `npm run lint` | `eslint . --quiet` |
| `npm run lint:fix` | `eslint . --fix` |
| `npm run privacy:legacy-email-cleanup` | `node scripts/privacy-legacy-email-cleanup.mjs` |
| `npm run security:secrets` | `node scripts/check-no-secrets.mjs` |
| `npm run i18n:avisos` | `node scripts/i18n-avisos.mjs` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run test:coverage` | `vitest run --coverage` |
| `npm run test:rules` | `npx --yes firebase-tools@13 emulators:exec --only firestore,storage --project demo-pick…` |
| `npm run typecheck` | `tsc -p ./jsconfig.json --noEmit` |
| `npm run docs:inventario` | `node scripts/gen-inventario.mjs` |
| `npm run docs:inventario:check` | `node scripts/gen-inventario.mjs --check` |

## 11. Documentos em `docs/`

`00-INDEX.md` · `01-AI-CONTEXT.md` · `02-STANDARDS.md` · `03-WORKFLOW.md` · `04-ARCHITECTURE.md` · `05-DATA-MODEL.md` · `06-MODULES.md` · `07-DESIGN-STANDARD.md` · `08-ARENA-ROADMAP.md` · `09-UX-ANALYSIS` · `10-ARENA-V3` · `11-REFERENCE` · `12-TEAM-TOURNAMENTS.md` · `13-NIVEL-UNIFICADO.md` · `14-DIA-DE-JOGO-TELAO.md` · `15-DIA-DE-JOGO-PERMISSOES.md` · `16-DIA-DE-JOGO-RODIZIO.md` · `17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` · `18-RANKINGS.md` · `19-TUTORIAIS.md` · `20-SEGURANCA-E-PRIVACIDADE` · `21-CENTRAL-DE-AJUDA.md` · `22-DIA-DE-JOGO-DA-ARENA.md` · `23-ARENA-CALENDARIO-E-RESERVA.md` · `24-MODULOS-DE-ARENA` · `25-DIA-DE-JOGO-COMO-MODULO.md` · `26-TORNEIO-FORMATOS-E-REGRAS.md` · `27-FALHA-NAO-E-VAZIO.md` · `28-ERRO-NAO-DERRUBA-O-APP.md` · `29-INICIO-PERSONALIZADO-E-DIVULGACAO.md` · `30-MODO-ESCURO.md` · `31-INICIO-SOB-MEDIDA.md` · `32-DICAS-GUIADAS.md` · `33-CADASTRO-ESSENCIAL.md` · `34-MINHA-REGIAO.md` · `35-JOGAR-ENTRAR-E-SAIR.md` · `36-NOTIFICACOES.md` · `37-TORNEIO-ETAPAS-TURNOS-E-CHECKIN.md` · `38-GAMIFICACAO-V2.md` · `39-PLAY-GRUPOS.md` · `40-CENTRO-DE-TREINO.md` · `40a-AVALIACAO-100-DRILLS.md` · `41-MINHA-AREA.md` · `42-BALANCO-DO-JOGO.md` · `43-TROFEUS-E-CARTOES.md` · `44-IDIOMAS.md` · `45-MOLDURA-DAS-PAGINAS.md` · `46-INVENTARIO.md` · `47-BACKEND-CLOUD-FUNCTIONS.md` · `48-PERMISSOES-POR-PERFIL.md` · `49-AVISOS-POR-EMAIL-E-CELULAR.md` · `50-FEDERACAO.md` · `AUDIT-2026-09-28.md` · `FUTURO` · `HISTORICO-POR-ONDA.md` · `PUSH-ATIVACAO.md`
