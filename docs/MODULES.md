# MODULES

> O que cada módulo faz, arquivos-chave e fluxos principais. Panorama em
> `docs/AI_CONTEXT.md`; dados em `docs/DATA_MODEL.md`.

A plataforma tem **19 módulos** em `src/modules/`. A camada de apresentação
ativa (V2, `src/v2/`) consome os hooks e services desses módulos. A camada
legada (V1, `src/pages/`) também, mas está em desuso.

**Feature flags**: cada nova feature vive atrás de uma flag
(`src/core/featureFlags.js` — 124 flags, ver `AI_CONTEXT.md` §9). UI
gateada com `<FeatureFlagGuard flag=...>` ou via hook `useFeatureFlag(key)`.
**Sempre aditivo** — nunca quebra o que está OFF.

---

## tournament/ — núcleo

Torneios de ponta a ponta: criação, modalidades, inscrições, sorteio,
agendamento por quadra, jogos, ranking ao vivo, admins compartilhados, visão
pública, impressão, telão e courtside scoring.

- **pages (V1 legacy)**: `Dashboard` (meus torneios), `CreateTournament`,
  `JoinTournament` (código de convite), `PublicTournamentsList`,
  `Tournament` (abas via `:tab`), `ModalityPage`, `TournamentFormatsGuide`.
- **components (V1)**: `TournamentOverviewTab`, `TournamentModalitiesTab`,
  `TournamentRegistrationsTab`, `TournamentDrawTab`, `TournamentMatchesTab`,
  `TournamentRankingTab`, `TournamentAdminTab`/`TournamentAdminPanel`,
  + dialogs (`ModalityRegistrationDialog`, `ModalityInfoModal`),
  `StageExplanation`, `ParticipationHistoryCard`, `CertificateButton`,
  `ShareCardButton`, `Gallery`.
- **V2 (ativo)**: `src/v2/pages/V2Tournament.jsx` (componente principal
  que reusa a lógica e renderiza abas próprias) + `V2TournamentDrawTab`,
  `V2TournamentModalitiesTab`, `V2TournamentRegistrationsTab`,
  `V2MatchesBlock`, `V2RankingBlock`, `V2OverviewBlock`, `V2Gallery`,
  `V2TournamentAdminPanel`, `V2ParticipationHistoryCard`,
  `V2ModalityInfoContent`, `V2Collapsible`, `V2TournamentOpsDashboard`,
  `V2TournamentWizard` (criação em etapas, Onda 5b), `V2TournamentTVMode`
  (Telão, Onda 4), `V2CourtsideScoring` (placar courtside, Onda 4b),
  `V2BracketTree` (árvore visual, Onda 4b), `V2TournamentTemplates`
  (marcar como modelo, Onda 5). Páginas dedicadas: `V2Dashboard`,
  `V2Tournaments`, `V2CreateTournament`, `V2JoinTournament`,
  `V2ModalityPage`, `V2FormatsGuide`.
- **services**: `tournamentService` (CRUD + `setTournamentStatus` → notifica
  comunidade quando torneio **público** abre inscrições +
  `archiveTournament`/`unarchiveTournament` para o criador/admin, exigindo
  `status === 'cancelled'` para arquivar + `duplicateAsTemplate` (Onda 5)),
  `modalityService`, `registrationService` (com export CSV — Onda 1),
  `participationService`, `matchService`, `drawService`, `rankingService`,
  `courtService`, `tournamentAnnouncementService` (Onda 9b),
  `tournamentPhotoService` (galeria).
- **domain (puro, testado)**: `scoring`, `draw`/`seeding`, `progression`,
  `doubleElimination`, `swiss`, `mexicano` (Onda 2), `reinaQuadra` (Onda 2),
  `schedule`/`scheduling`, `ranking`, `capacity`, `eligibility`,
  `participation`, `formatExplain`, `whistTables`, `constants`,
  `archiveValidation`, `bracketLayout` (Onda 4b — layout da árvore visual).
- **hooks**: `useTournament`, `useTournamentAnnouncements`,
  `useTournamentPhotos`, `useTournamentOps` (Onda 9b), `useTournamentWizard`
  (Onda 5b).

Fluxo típico: criar torneio → adicionar modalidades → abrir inscrições
(notifica) → inscrições/check-in → sortear (`drawService`+`domain/draw`) →
agendar quadras → registrar resultados (`matchService`) → ranking recalculado
(`rankingService`+`domain/ranking`).

**Formatos extras (Onda 2)**: Mexicano (rodízio de duplas por rodada) e
Rei da Quadra (vencedor fica, demais rotacionam) — ambos com domínio puro
testado em `domain/mexicano.js` / `domain/reinaQuadra.js`.

## arenas/ — arenas, reservas, PDV e Arena V3

Diretório de arenas com perfil, fotos, contatos e preços; reservas avulsas,
recorrentes, compartilhadas e aulas com professor; lista de espera; política
de cancelamento; no-show tracking; favoritos, reviews, CRM; **Arena V3**:
PDV, membros, ligas, marketing, IoT, operations, matchmaking.

- **V2 (ativo)**: 67 páginas V2. Arenas: `V2Arenas` (lista),
  `V2ArenaDetail`, `V2CreateArena`, `V2ArenaManage` (painel admin 2 níveis),
  `V2ArenaOnboarding` (stepper 4 passos), `V2Bookings` (minhas reservas);
  componentes `V2ArenaActions`, `V2ArenaEditors`, `V2ArenaReviews`,
  `V2BookingRow`, `V2BookingCalendar` (mensal com badges), `V2DaySlotsDialog`
  (info do dia com reservas), `V2CourtDayGrid` (PR #70: linhas=horários,
  colunas=quadras), `V2CourtSchedules`, `V2CourtPriceRules`,
  `V2ArenaCRM` (Onda 6b), `V2ArenaWaitlist` (Onda 6b),
  `V2ArenaCancellationPolicy` (Onda 6), `V2ArenaNoShow` (Onda 6).
  V3: `V2ArenaPDV`, `V2ArenaMembers`, `V2ArenaClasses`, `V2ArenaLeagues`,
  `V2ArenaMarketing`, `V2ArenaOperations`, `V2ArenaMatchmaking`,
  `V2ArenaModules`, `V2ArenaOpenMatch`, `V2ArenaAdvanced`, `V2ArenaAdminOpenMatch`,
  `V2ArenaAdminMembers`, `V2ArenaCoaches` (Sistema C).
- **V1 (legado)**: `ArenasDirectory`, `CreateArena`, `ArenaDetail`,
  `ArenaManage`, `MyBookings`.
- **services**: CRUD de arenas, `arena_bookings` (com `booking_type`,
  `responsibles[]`, auto-atribuição de `court_id`), `arena_courts`,
  `arena_court_schedules`, `arena_favorites`, `arena_managers`,
  `arena_reviews`, `arena_unavailabilities`, `arena_waitlist` (Onda 6b),
  `arena_products`/`arena_sales`/`arena_payments` (PDV),
  `arena_members`/`arena_packages`/`arena_subscriptions` (members),
  `arena_ladders`/`arena_matches`/`arena_internal_tournaments` (leagues),
  `arena_classes`/`arena_class_bookings` (Sistema C — aulas da arena),
  `arena_campaigns`/`arena_coupons`/`arena_referrals` (marketing),
  `arena_inventory_*` (operations), `arena_devices` (IoT),
  `arena_open_slots` (matchmaking).
- **domain (puro, testado)**: `booking` (compartilhamento, rateio),
  `booking_conflict` (conflito entre slots), `booking_waitlist` (Onda 6b),
  `calendar`/`calendar_aggregate` (resumo mensal), `cancellation_policy`
  (Onda 6), `court`/`court_schedule`/`court_assignment` (PR #70:
  `pickAvailableCourt`), `instant_booking`, `inventory` (operations),
  `leagues` (V3), `marketing` (V3), `matchmaking`, `members`, `modules`,
  `openMatch`, `operations`, `pdv`, `pix_payment` (V3), `pricing` (com
  `court_id`), `review_response`, `shared_booking` (PR #68),
  `settings`/`slot_status`/`waitlist` (legado).
- **hooks**: `useArena`, `useArenaBookings`, `useArenaCourts`, `useArenaWaitlist`
  (Onda 6b), `useArenaCRM` (Onda 6b), `useArenaCancellation` (Onda 6).

Reservas: simple/recurring + **shared** (múltiplos responsáveis com rateio
por tempo de uso, PR #68 + #70) + **coach_lesson** (aula do professor em
arena parceira, PR #68). Auto-atribuição de `court_id` se user não escolhe
(`pickAvailableCourt` em `domain/court_assignment.js`).

**Política de cancelamento (Onda 6)**: regras percentuais baseadas em
`tempo até o slot`. Reembolso integral antes do limite, parcial depois,
nenhum após o slot. Domain: `cancellation_policy.js`.

**Lista de espera (Onda 6b)**: usuário entra na fila quando slot está
cheio; arena é notificada ao abrir vaga.

## coaches/ — produto do professor

> Estende o **Sistema A** (professor = usuário real, uid). NÃO conflita com
> Arena V3 Sistema C (`arena_classes` — aulas operadas por arena).

Perfil público, diretório, residência em arena, agenda/aulas, roster de
alunos, pacotes/créditos, biblioteca de conteúdo, loja, clínicas, validação
de nível.

- **V2 (ativo)**: `V2Coaches` (diretório), `V2CoachProfile` (público),
  `V2CoachAgenda` (painel: agenda, alunos, pacotes, biblioteca, loja),
  `V2StudentLessons` (aulas do aluno), `V2ArenaCoaches` (Sistema C).
- **services**: `coachService` (perfil), `coachAvailabilityService`
  (janelas), `coachLessonService` (aulas), `coachStudentService` (vínculo),
  `coachPackageService` (pacotes), `coachPackageSaleService` (créditos),
  `coachContentService` (biblioteca), `coachClinicService` (clínicas),
  `coachClinicSignupService`, `coachLevelValidationService` (Onda 7b),
  `coachProductService` (loja), `coachArenaService` (residência,
  com `partnership_status` mútuo na Onda 7).
- **domain (puro, testado)**: `availability`, `clinic`, `coach` (perfil),
  `coachProduct` (loja), `content` (biblioteca), `lesson` (aulas),
  `package` (pacotes), `student` (vínculo), `validation` (nível validado).
- **hooks**: `useCoachProfile`, `useCoachLessons`, `useCoachStudents`,
  `useCoachPackages`, `useCoachClinics`, `useCoachContent`.

**Fases (PR #68)**:
- **A**: agenda (coach_availability) + aulas (coach_lessons) + loja (coach_products)
- **B**: roster (coach_students) + agenda de aulas por aluno
- **C**: pacotes (coach_packages) + vendas (coach_package_sales) + financeiro
- **D**: biblioteca de conteúdo (coach_content) — drills, vídeos, planos

**Onda 7b**: clínicas/workshops abertos (coach_clinics) e validação de
nível (coach_level_validations).

## athletes/ — diretório de atletas

Perfis públicos pesquisáveis (`athlete_profiles`, `directory_listed`).

- **V2 (ativo)**: `V2Athletes`, `V2AthleteProfile`.
- **V1 (legado)**: `AthletesDirectory`, `AthleteProfile`.
- **services**: `athleteService` (`syncAthleteProfile`, `listAthletes`,
  `getAthlete`, `removeAthleteProfile`).
- **domain (puro, testado)**: `publicProfile` (montagem do perfil público).
- Reusado na busca de atletas para **convidar membros de clube** e como
  audiência do aviso de "torneio aberto".

## clubs/ — clubes e comunidade

Clubes com associação por papel, mural, fórum (com enquetes), eventos e
game-day (com Mexicano + Rei da Quadra), ranking interno, página pública.
Acesso por papel: não-membro vê só o card+descrição; membros acessam
abas; só admin acessa Administração.

- **V2 (ativo)**: `V2Clubs`, `V2ClubDetail`, `V2EventDetail`,
  `V2CreateClub`; componentes `V2ClubAdmin`, `V2ClubEvents`, `V2ClubFeed`,
  `V2ClubForums`, `V2ClubMembers`, `V2EventChat`, `V2EventDatesPanel`,
  `V2EventParticipantsPanel`, `V2ForumPoll`, `V2ForumThreadView`,
  `V2GameDayOrganizer` (com Mexicano + Rei da Quadra), `V2ClubInternalRanking`
  (Onda 8), `V2ClubPublicPage` (Onda 8b), `V2ClubRecurringEvents` (Onda 8b),
  `V2ClubInviteLink` (Onda 8b).
- **V1 (legado)**: `ClubsDirectory`, `CreateClub`, `ClubDetail`, `EventDetail`,
  com `ClubMembersTab`, `ClubFeedTab`, `ClubForumsTab`, `ClubEventsTab`,
  `GameDayOrganizer`, `ClubAdminTab`, `ForumThreadView`, `CreateThreadDialog`,
  `ForumPoll`, `PollBuilder`, `EventChat`, `EventParticipantsPanel`,
  `EventDatesPanel`.
- **services**: `clubService` (clube, membros, pedidos, convites, com
  `is_public`, `public_slug`, `invite_link` — Onda 8b), `forumService`.
- **domain (puro, testado)**: `clubRanking` (Onda 8), `forumPoll`,
  `gameDayDraw` (com Mexicano + Rei da Quadra — Onda 2), `constants`.
- **hooks**: `useClubs`, `useClubForum`, `useClubRanking` (Onda 8),
  `useClubPublicPage` (Onda 8b).

Ingresso (3 caminhos): **pedir para ingressar** (`club_join_requests` → notifica
admins → aprovação cria `club_members`), **convite do admin**
(`club_member_invites` → notifica convidado → aceite cria membro),
**link de convite** (Onda 8b), **código de convite**. Eventos públicos
publicados notificam membros.

**Eventos recorrentes (Onda 8b)**: `club_events` com `recurring_rule`
(frequência semanal/mensal, weekdays, end_date). UI mostra a série.

**Página pública (Onda 8b)**: `/clubes/p/:slug` — clubes com `is_public=true`
exibem página para visitantes (sem login). Mostra membros, eventos, ranking
interno (se configurado).

## chat/ — mensagens

Conversas 1:1 e em grupo.

- **V2 (ativo)**: `V2Chat`; componentes `V2ConversationList`, `V2ChatWindow`,
  `V2MessageBubble`, `V2ChatComposer`, `V2ChatLauncherButton`.
- **V1 (legado)**: `ChatPage`; componentes `ConversationList`, `ChatWindow`,
  `MessageBubble`, `ChatComposer`, `NewChatDialog`, `ChatLauncherButton`.
- **services**: `chatService`.
- **hooks**: `useChat`.
- **domain**: `conversations` (resolução/ordenação, testado).
- Gera notificações `chat_message` / `chat_invite`.

## leveling/ — nivelamento (CBPE/USAP)

Tabela de níveis + questionário auto-avaliativo.

- **V2 (ativo)**: `V2Leveling` (página pública `/nivelamento`); componentes
  `V2LevelTable`, `V2LevelingQuestionnaire`.
- **V1 (legado)**: `Leveling`; componentes `LevelTable`,
  `LevelingQuestionnaire`, `LevelingResultCard`.
- `data/levels.js` (catálogo), `domain/questionnaire.js` (cálculo do nível).
- Resultado salvo em `users.leveling_*`. Integração no `Profile` (V1 e V2).
- **Onda 7b**: validação por outro professor (coach_level_validations).

## notifications/ — sino + preferências

- `hooks/useNotifications` — lê `notifications` do usuário, expõe
  `unreadCount`, `markAsRead`, **`markAllAsRead`** (Onda 1). Renderizado pelo
  `NotificationsMenu` no `Layout`.
- **Preferências (Onda 9b)**: hook `useNotificationPreferences` — categorias
  silenciáveis (booking_confirmed, tournament_*, chat_*, forum_*, etc).
  Salvo em `users/{uid}.notification_prefs: {category: bool}`.
- Serviço de escrita é compartilhado: `core/services/notificationService.js`.
- Lembretes de perfil/nivelamento são **derivados no Layout** (não persistidos).

## admin/ — plataforma

Painel exclusivo de `platform_admin` (`/admin/*`).

- **V2 (ativo)**: `V2AdminTournaments` (arquivar/excluir/desarquivar
  torneios), `V2AdminMetrics` (métricas), `V2AdminPartners` (espaço de
  parceiros), `V2AdminConsole` (feature flags, 1-click on/off),
  `V2AdminProfiles`, `V2AdminBootstrap`, `V2AdminOwnerDebug`,
  `V2AdminOwnerRestore`.
- **V1 (legado)**: `AdminTournaments`, `AdminMetrics`, `AdminPartners`.
- **services**: `adminService`, `platformSettingsService` (feature flags).
  Ações geram `audit_logs` (`platform_archive_tournament`,
  `platform_delete_tournament`, `feature_flag_changed`…).

**V2AdminConsole** (PR #69): painel 2 níveis (sticky top-2 + sub-tab-bar),
com flags agrupadas por assunto (`core` / `nav` / `athlete` / `tournaments`
/ `arenas` / `coaches` / `community` / `arena_v3` / `other`).
**Arena V3 Boot embutido** — sub-seção de bootstrap dos módulos V3
(executa migração, ativa sub-flags).

## games/ — jogos abertos e procura-jogo

- **V2 (ativo)**: `V2OpenGames`, `V2MyGames`.
- **V1 (legado)**: `OpenGames`.
- Coleções: `games`, `open_games`, `participants`. Gera notificações
  para quem confirmou presença.

## partners/ — espaço de parceiros (admin)

Área dedicada de parceiros (logos, banners, links). Painel do admin
(`/admin/parceiros`).

- **V2 (ativo)**: `V2Partners` (visualização) + `V2AdminPartners` (gestão).
- **V1 (legado)**: `Partners`, `AdminPartners`.
- Coleção: `affiliate_links`. Tráfego, LGPD (IP hash, UA truncado).

## performance/ — meu desempenho

Estatísticas e histórico individual do atleta.

- **V2 (ativo)**: `V2Performance`, `V2AthleteAgenda` (Onda 3 — agenda do
  atleta: aulas + torneios próximos).
- **V1 (legado)**: `MyPerformance`.
- Coleções: `player_ratings`, `rating_history`, `player_goals`, `follows`.
- Ganchos com o módulo `rating/` (ranking nacional, head-to-head).

## progression/ — progressão do atleta

Curvas de progressão, níveis e metas.

- **hooks**, **domain** e **services** próprios; sem página dedicada (reusado
  por `performance/` e `profile/`).

## rating/ — ranking nacional

Ranking nacional, ranking de duplas (Onda 3), head-to-head, busca de
jogadores.

- **V2 (ativo)**: `V2Ranking`, `V2DoublesRanking` (Onda 3), `V2FindPlayers`.
- **V1 (legado)**: `NationalRanking`, `FindPlayers`.
- **domain (puro, testado)**: `headToHead`, `doublesRanking` (Onda 3).
- Materialização no client + gatilho Cloud Function
  `recomputeRankingOnTournamentChange` para manter o ranking nacional
  atualizado quando torneios públicos terminam/reabrem.

## sharing/ — compartilhamento e certificados

Componentes de compartilhamento social, geração de certificados, e
**calendar export** (Onda 1 — `.ics` para download de aulas/torneios).

- `ShareCardButton`, `CertificateButton`, `CalendarExportButton` (Onda 1).
- Sem página dedicada. `domain/ics.js` (puro, testado).

## social/ — feed, follows, metas

Feed da comunidade, follows de atletas, metas pessoais.

- **V2 (ativo)**: `V2Community` (página `/novidades`), `V2Search` (Onda 10
  — busca global federada: atletas + torneios + arenas + clubes).
- **V1 (legado)**: `CommunityFeed`.
- Coleções: `follows`, `player_goals`, e leitura transversal em
  `users` / `athlete_profiles`.

## achievements/ — conquistas

Conquistas e medalhas (gamificação expandida na Onda 9b).

- Hooks e domain próprios; sem página dedicada no momento. Integração
  com `performance/`, `profile/` e `social/`.

## circuits/ — circuitos (séries de torneios)

> Renomeado/separado de `tournament/` (estava agrupado antes). Séries de
> torneios com ranking acumulado.

- **V2 (ativo)**: `V2Circuits`, `V2CircuitManage`.
- Coleções: `circuits`, `circuit_admins`, `circuit_tournaments`,
  `circuit_results`. Ranking agregado (computeCircuitRanking) em
  `domain/`.

## analytics/ — funil e observabilidade

Funil de uso, eventos de produto e observabilidade client-side.

- `hooks/useFunnel`, `domain/funnelEvents` (com testes).
- Eventos emitidos no `Profile` e em outros pontos críticos.

## settings/ — configurações do usuário (Onda 9)

Página `/configuracoes` (V2Settings) com:
- Privacidade (`directory_listed`, nível visível publicamente)
- Notificações (categorias silenciáveis — `notification_prefs`)
- Tema (placeholder)
- Conta (dados pessoais, nível)
- **LGPD data export** (Onda 9) — gera JSON com tudo do user

- `services/dataExportService` (gera arquivo em `user_data_exports/`)
- `domain/dataExport` (formato do export)

---

## Mapa rota → módulo (V2, app ativo)

| Rota | Módulo / arquivo |
|---|---|
| `/` `/login` | `src/v2/pages/V2Landing` · `src/v2/pages/V2Login` |
| `/inicio` | `src/v2/pages/V2Dashboard` |
| `/torneios/*` `/torneios/:id/telao` `/torneios/:id/courtside` | `V2Tournaments` · `V2Tournament` · `V2TournamentTVMode` · `V2CourtsideScoring` |
| `/torneios/criar` `/torneios/ingressar` `/torneios/guia` | `V2CreateTournament` (wizard 5b) · `V2JoinTournament` · `V2FormatsGuide` |
| `/arenas/*` `/minhas-reservas` | `V2Arenas` · `V2ArenaDetail` · `V2CreateArena` · `V2ArenaManage` · `V2Bookings` · `V2ArenaPDV` · `V2ArenaMembers` · `V2ArenaLeagues` · `V2ArenaClasses` · `V2ArenaMarketing` · `V2ArenaOperations` · `V2ArenaMatchmaking` |
| `/atletas` `/atleta/:uid` | `V2Athletes` · `V2AthleteProfile` |
| `/clubes/*` `/clubes/p/:slug` | `V2Clubs` · `V2ClubDetail` · `V2ClubPublicPage` · `V2CreateClub` · `V2EventDetail` |
| `/coaches` `/coaches/:id` | `V2Coaches` · `V2CoachProfile` |
| `/coach/agenda` `/aluno/aulas` | `V2CoachAgenda` · `V2StudentLessons` |
| `/chat` `/novidades` | `V2Chat` · `V2Community` |
| `/ranking` `/ranking/duplas` `/encontrar-jogadores` `/procura-jogo` `/parceiros` | `V2Ranking` · `V2DoublesRanking` · `V2FindPlayers` · `V2OpenGames` · `V2Partners` |
| `/meu-desempenho` `/perfil*` `/configuracoes` | `V2Performance` · `V2AthleteAgenda` · `V2Profile` · `V2ProfileEdit` · `V2Settings` |
| `/buscar` | `V2Search` (busca global, Onda 10) |
| `/404` | `V2NotFound` (Onda 1) |
| `/regras` `/nivelamento` `/historia` `/conduta` `/politica-uso` | `V2Rules` · `V2Leveling` · `V2History` · `V2Conduct` · `V2Privacy` |
| `/admin/*` | `V2AdminTournaments` · `V2AdminMetrics` · `V2AdminPartners` · `V2AdminConsole` · `V2AdminProfiles` · `V2AdminBootstrap` · `V2AdminOwnerDebug` · `V2AdminOwnerRestore` |
| `/p/:id` `/torneios/:id/imprimir` | `src/pages/PublicTournament` · `src/pages/PrintTournament` (públicas, mantidas em `pages/`) |
