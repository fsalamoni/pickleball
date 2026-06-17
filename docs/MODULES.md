# MODULES

> O que cada módulo faz, arquivos-chave e fluxos principais. Panorama em
> `docs/AI_CONTEXT.md`; dados em `docs/DATA_MODEL.md`.

## tournament/ — núcleo

Torneios de ponta a ponta: criação, modalidades, inscrições, sorteio,
agendamento por quadra, jogos, ranking ao vivo, admins compartilhados, visão
pública e impressão.

- **pages**: `Dashboard` (meus torneios), `CreateTournament`, `JoinTournament`
  (código de convite), `PublicTournamentsList`, `Tournament` (abas via
  `:tab`).
- **components (abas)**: `TournamentOverviewTab`, `TournamentModalitiesTab`,
  `TournamentRegistrationsTab`, `TournamentDrawTab`, `TournamentMatchesTab`,
  `TournamentRankingTab`, `TournamentAdminTab`/`TournamentAdminPanel`,
  + dialogs (`ModalityRegistrationDialog`, `ModalityInfoModal`),
  `StageExplanation`, `ParticipationHistoryCard`.
- **services**: `tournamentService` (CRUD + `setTournamentStatus` → notifica
  comunidade quando torneio **público** abre inscrições), `modalityService`,
  `registrationService`, `participationService`, `matchService`, `drawService`,
  `rankingService`, `courtService`.
- **domain (puro, testado)**: `scoring`, `draw`/`seeding`, `progression`,
  `doubleElimination`, `swiss`, `schedule`/`scheduling`, `ranking`, `capacity`,
  `eligibility`, `participation`, `formatExplain`, `whistTables`, `constants`.
- **hooks**: `useTournament` (queries/mutations + invalidações
  `['tournaments-public']` etc.).

Fluxo típico: criar torneio → adicionar modalidades → abrir inscrições
(notifica) → inscrições/check-in → sortear (`drawService`+`domain/draw`) →
agendar quadras → registrar resultados (`matchService`) → ranking recalculado
(`rankingService`+`domain/ranking`).

## athletes/ — diretório de atletas

Perfis públicos pesquisáveis (`athlete_profiles`, `directory_listed`).
- `pages/AthletesDirectory`, `hooks/useAthletes`, `services/athleteService`
  (`syncAthleteProfile`, `listAthletes`, `getAthlete`, `removeAthleteProfile`).
- `domain/publicProfile` (montagem do perfil público, testado).
- Reusado na busca de atletas para **convidar membros de clube** e como
  audiência do aviso de "torneio aberto".

## clubs/ — clubes e comunidade

Clubes com associação por papel, mural, fórum (com enquetes), eventos e
game-day. Acesso por papel: não-membro vê só o card+descrição; membros acessam
abas; só admin acessa Administração.

- **pages**: `ClubsDirectory`, `CreateClub`, `ClubDetail` (abas), `EventDetail`.
- **components**: `ClubMembersTab`, `ClubFeedTab` (mural), `ClubForumsTab` +
  `ForumThreadView`/`CreateThreadDialog`/`ForumPoll`/`PollBuilder`,
  `ClubEventsTab` + `EventChat`/`EventParticipantsPanel`/`EventDatesPanel`,
  `GameDayOrganizer`, `ClubAdminTab` (pedidos de ingresso, convites, membros).
- **services**: `clubService` (clube, membros, pedidos, convites — ids
  deterministas `clubId_uid`), `forumService`.
- **domain (puro, testado)**: `forumPoll`, `gameDayDraw`, `constants`.
- **hooks**: `useClubs`, `useClubForum`.

Ingresso (3 caminhos): **pedir para ingressar** (`club_join_requests` → notifica
admins → aprovação cria `club_members`), **convite do admin**
(`club_member_invites` → notifica convidado → aceite cria membro), **código de
convite**. Eventos públicos publicados notificam membros.

## chat/ — mensagens

Conversas 1:1 e em grupo.
- `pages/ChatPage`, `hooks/useChat`, `services/chatService`.
- **components**: `ConversationList`, `ChatWindow`, `MessageBubble`,
  `ChatComposer`, `NewChatDialog`, `ChatLauncherButton`.
- **domain**: `conversations` (resolução/ordenação, testado).
- Gera notificações `chat_message` / `chat_invite`.

## leveling/ — nivelamento (CBPE/USAP)

Tabela de níveis + questionário auto-avaliativo.
- **components**: `LevelTable`, `LevelingQuestionnaire`, `LevelingResultCard`.
- `data/levels.js` (catálogo), `domain/questionnaire.js` (cálculo do nível).
- Resultado salvo em `users.leveling_*`. Página pública `/nivelamento` e
  integração no `Profile`.

## notifications/ — sino

- `hooks/useNotifications` — lê `notifications` do usuário, expõe `unreadCount`
  e `markAsRead`. Renderizado pelo `NotificationsMenu` no `Layout`.
- Serviço de escrita é compartilhado: `core/services/notificationService.js`.
- Lembretes de perfil/nivelamento são **derivados no Layout** (não persistidos).

## admin/ — plataforma

Painel exclusivo de `platform_admin` (`/admin/*`).
- **pages**: `AdminTournaments` (arquivar/excluir/desarquivar torneios),
  `AdminMetrics` (métricas).
- **services**: `adminService`. Ações geram `audit_logs`
  (`platform_archive_tournament`, `platform_delete_tournament`…).

## Mapa rota → módulo

| Rota | Módulo / arquivo |
| --- | --- |
| `/inicio` | tournament/pages/Dashboard |
| `/torneios/*` | tournament/pages/* |
| `/p/:id`, `/torneios/:id/imprimir` | pages/PublicTournament, pages/PrintTournament |
| `/atletas` | athletes/pages/AthletesDirectory |
| `/clubes/*` | clubs/pages/* |
| `/chat` | chat/pages/ChatPage |
| `/nivelamento` | pages/Leveling (+ leveling/*) |
| `/perfil` | pages/Profile |
| `/admin/*` | admin/pages/* |
</content>
