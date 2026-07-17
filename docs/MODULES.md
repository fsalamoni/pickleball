# MODULES

> O que cada módulo faz, arquivos-chave e fluxos principais. Panorama em
> `docs/AI_CONTEXT.md`; dados em `docs/DATA_MODEL.md`.

A plataforma tem **17 módulos** em `src/modules/`. A camada de apresentação
ativa (V2, `src/v2/`) consome os hooks e services desses módulos. A camada
legada (V1, `src/pages/`) também, mas está em desuso.

---

## tournament/ — núcleo

Torneios de ponta a ponta: criação, modalidades, inscrições, sorteio,
agendamento por quadra, jogos, ranking ao vivo, admins compartilhados, visão
pública e impressão.

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
  `V2ModalityInfoContent`, `V2Collapsible`. Páginas dedicadas:
  `V2Dashboard`, `V2Tournaments`, `V2CreateTournament`, `V2JoinTournament`,
  `V2ModalityPage`, `V2FormatsGuide`.
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

## arenas/ — arenas e reservas

Diretório de arenas com perfil, fotos, contatos e preços; reservas avulsas e
recorrentes; favoritos, reviews e painel de gestão para o dono.

- **V2 (ativo)**: `V2Arenas` (lista), `V2ArenaDetail`, `V2CreateArena`,
  `V2ArenaManage`, `V2Bookings`; componentes `V2ArenaActions`,
  `V2ArenaEditors`, `V2ArenaReviews`, `V2BookingRow`.
- **V1 (legado)**: `ArenasDirectory`, `CreateArena`, `ArenaDetail`,
  `ArenaManage`, `MyBookings`.
- **services**: CRUD de arenas, `arena_bookings`, `arena_favorites`,
  `arena_managers`, `arena_reviews`. Bloqueio de conflito com horários já
  confirmados; negociação manual de valor.
- **domain (puro, testado)**: regras de disponibilidade e conflito.

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
game-day. Acesso por papel: não-membro vê só o card+descrição; membros acessam
abas; só admin acessa Administração.

- **V2 (ativo)**: `V2Clubs`, `V2ClubDetail`, `V2EventDetail`,
  `V2CreateClub`; componentes `V2ClubAdmin`, `V2ClubEvents`, `V2ClubFeed`,
  `V2ClubForums`, `V2ClubMembers`, `V2EventChat`, `V2EventDatesPanel`,
  `V2EventParticipantsPanel`, `V2ForumPoll`, `V2ForumThreadView`,
  `V2GameDayOrganizer`.
- **V1 (legado)**: `ClubsDirectory`, `CreateClub`, `ClubDetail`, `EventDetail`,
  com `ClubMembersTab`, `ClubFeedTab`, `ClubForumsTab`, `ClubEventsTab`,
  `GameDayOrganizer`, `ClubAdminTab`, `ForumThreadView`, `CreateThreadDialog`,
  `ForumPoll`, `PollBuilder`, `EventChat`, `EventParticipantsPanel`,
  `EventDatesPanel`.
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

## notifications/ — sino

- `hooks/useNotifications` — lê `notifications` do usuário, expõe `unreadCount`
  e `markAsRead`. Renderizado pelo `NotificationsMenu` no `Layout`.
- Serviço de escrita é compartilhado: `core/services/notificationService.js`.
- Lembretes de perfil/nivelamento são **derivados no Layout** (não persistidos).

## admin/ — plataforma

Painel exclusivo de `platform_admin` (`/admin/*`).

- **V2 (ativo)**: `V2AdminTournaments` (arquivar/excluir/desarquivar
  torneios), `V2AdminMetrics` (métricas), `V2AdminPartners` (espaço de
  parceiros).
- **V1 (legado)**: `AdminTournaments`, `AdminMetrics`, `AdminPartners`.
- **services**: `adminService`. Ações geram `audit_logs`
  (`platform_archive_tournament`, `platform_delete_tournament`…).

## games/ — jogos abertos e procura-jogo

- **V2 (ativo)**: `V2OpenGames`.
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

- **V2 (ativo)**: `V2Performance`.
- **V1 (legado)**: `MyPerformance`.
- Coleções: `player_ratings`, `rating_history`, `player_goals`, `follows`.
- Ganchos com o módulo `rating/` (ranking nacional, head-to-head).

## progression/ — progressão do atleta

Curvas de progressão, níveis e metas.

- **hooks**, **domain** e **services** próprios; sem página dedicada (reusado
  por `performance/` e `profile/`).

## rating/ — ranking nacional

Ranking nacional, head-to-head, busca de jogadores.

- **V2 (ativo)**: `V2Ranking`, `V2FindPlayers`.
- **V1 (legado)**: `NationalRanking`, `FindPlayers`.
- **domain (puro, testado)**: `headToHead`.
- Materialização no client + gatilho Cloud Function
  `recomputeRankingOnTournamentChange` para manter o ranking nacional
  atualizado quando torneios públicos terminam/reabrem.

## sharing/ — compartilhamento e certificados

Componentes de compartilhamento social e geração de certificados.

- `ShareCardButton`, `CertificateButton`. Sem página dedicada.

## social/ — feed, follows, metas

Feed da comunidade, follows de atletas, metas pessoais.

- **V2 (ativo)**: `V2Community` (página `/novidades`).
- **V1 (legado)**: `CommunityFeed`.
- Coleções: `follows`, `player_goals`, e leitura transversal em
  `users` / `athlete_profiles`.

## achievements/ — conquistas

Conquistas e medalhas (preparação para gamificação).

- Hooks e domain próprios; sem página dedicada no momento. Integração
  prevista com `performance/` e `profile/`.

## analytics/ — funil e observabilidade

Funil de uso, eventos de produto e observabilidade client-side.

- `hooks/useFunnel`, `domain/funnelEvents` (com testes).
- Eventos emitidos no `Profile` e em outros pontos críticos.

---

## Mapa rota → módulo (V2, app ativo)

| Rota | Módulo / arquivo |
|---|---|
| `/` `/login` | `src/v2/pages/V2Landing` · `src/v2/pages/V2Login` (em migração) |
| `/inicio` | `src/v2/pages/V2Dashboard` |
| `/torneios/*` | `src/v2/pages/V2Tournaments` + `src/v2/pages/V2Tournament` |
| `/arenas/*` `/minhas-reservas` | `src/v2/pages/V2Arenas` · `V2ArenaDetail` · `V2CreateArena` · `V2ArenaManage` · `V2Bookings` |
| `/atletas` `/atleta/:uid` | `src/v2/pages/V2Athletes` · `V2AthleteProfile` |
| `/clubes/*` | `src/v2/pages/V2Clubs` · `V2ClubDetail` · `V2CreateClub` · `V2EventDetail` |
| `/chat` `/novidades` | `src/v2/pages/V2Chat` · `V2Community` |
| `/ranking` `/encontrar-jogadores` `/procura-jogo` `/parceiros` | `V2Ranking` · `V2FindPlayers` · `V2OpenGames` · `V2Partners` |
| `/meu-desempenho` `/perfil*` | `V2Performance` · `V2Profile` · `V2ProfileEdit` |
| `/regras` `/nivelamento` `/historia` `/conduta` `/politica-uso` | `V2Rules` · `V2Leveling` · `V2History` · `V2Conduct` · `V2Privacy` |
| `/admin/*` | `V2AdminTournaments` · `V2AdminMetrics` · `V2AdminPartners` |
| `/p/:id` `/torneios/:id/imprimir` | `src/pages/PublicTournament` · `src/pages/PrintTournament` (públicas, mantidas em `pages/`) |
