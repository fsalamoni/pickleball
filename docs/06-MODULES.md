# MODULES

> O que cada módulo faz, arquivos-chave e fluxos principais. Panorama em
> `docs/01-AI-CONTEXT.md`; dados em `docs/05-DATA-MODEL.md`.

A plataforma tem **19 módulos** em `src/modules/`. A camada de apresentação
ativa (V2, `src/v2/`) consome os hooks e services desses módulos. A camada
legada (V1, `src/pages/`) também, mas está em desuso.

**Feature flags**: cada nova feature vive atrás de uma flag
(`src/core/featureFlags.js` — 124 flags, ver `01-AI-CONTEXT.md` §9). UI
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

Reservas: simple/recurring + **multi** (PR #78) + **shared** (múltiplos
responsáveis com rateio por tempo de uso, PR #68 + #70) + **coach_lesson**
(aula do professor em arena parceira, PR #68). `court_id` é **obrigatório**
em toda reserva (PR #75) — auto-atribuído via `pickAvailableCourt` se user
não escolhe (`domain/court_assignment.js`).

**BookingRequestDialog reescrito** (PRs #77, #78): 3 modos de seleção
de quadras — qualquer disponível (auto), específicas (1+ escolhidas, cada
uma = reserva independente com `booking_group_id`), todas (cada quadra
ativa = reserva). Convida participantes. Suporte a múltiplos horários
(kind `multi`). Cancelar individual ou em lote no calendário.

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

**Hub "Aulas"** (PR #82): renomeado de "Professores" para "Aulas".
Ordem: Professores / Minhas aulas / Painel do professor. Painel do
professor só aparece para quem é professor.

**`listCoaches` in-memory** (PR #82): query simples (`limit(500)`) +
filtros/ordenação em memória. Resolve bug onde professores não
apareciam na busca (índice composto `active+accepting+display_name`
faltando). Padrão emergente — ver `02-STANDARDS.md §5.3.2`.

**Perfil › Professor** (PR #82): ganha acesso direto ao Painel do
Professor + texto atualizado.

**Página pública sem botões de gestão** (Wave B, item 3.2):
- ✅ Mantém: "Ver perfil de atleta" (navegação), "Solicitar aula" (CTA)
- ✅ Mantém: Like (Heart) + Share (QR + WhatsApp + PNG)
- ❌ Removidos: "Adicionar arena" (vai pro painel), "Gerenciar biblioteca"
  (vai pro painel), "Minha agenda de aulas" (vai pro painel),
  "Editar meu perfil" (vai pro painel)
- ❌ `AddResidencyForm` + função "remover residência" removidas

**BUG #2 do materializado corrigido (Wave C.6.1, Sprint 21)**:
- **Causa**: faltavam **índices compostos** no Firestore para as
  queries `where('club_id', '==', x) + orderBy('wins', 'desc')`
  nas 4 coleções materializadas.
- **Sintoma**: o Firestore lançava `FAILED_PRECONDITION` (código 9),
  React Query tratava como erro, e o front mostrava "0 atletas do
  clube, sem ranking" mesmo com o materializado populado no
  servidor.
- **Por que passou despercebido até agora**: a Wave C.3 introduziu
  o materializado e as queries no frontend mas **esqueceu de criar
  os índices compostos**. As Waves C.4, C.5 e C.6 mexeram no
  backend (Cloud Function, callable, sideToUids) mas ninguém
  olhou se a **leitura no cliente** tinha índice. Os testes
  cobriam o pipeline do servidor; o `useClubInternalRanking`
  nunca teve teste.
- **Fix**: 4 índices compostos adicionados em
  `firestore.indexes.json` (ASC club_id + DESC wins, um por
  coleção). O workflow `deploy-firebase.yml` deploya
  automaticamente. Comentário no hook documenta o requisito.
- **D-MATERIALIZADO-EXIGE-INDICES (Wave C.6.1)**: toda coleção
  materializada com `where + orderBy` em campos diferentes
  PRECISA de índice composto.

**BUG RAIZ do materializado corrigido (Wave C.6, Sprint 20)**:
- **Causa raiz**: `GameDayOrganizer` salvava `side_a`/`side_b` em
  `club_events/.../games` como `{ id, name }` onde `id` é
  **doc_id de `event_participants`**, NÃO `user_id`. A Cloud
  Function `sideToUids` retornava `p.id` (doc_id) e o
  materializado ficava com chaves que não correspondiam a
  `club_members.user_id` nem `athlete_profiles.uid`.
- **Sintoma visível**: "0 atletas do clube" mesmo com 16 membros.
  Materializado sempre VAZIO para clubes com game day organizer.
- **Por que ficou visível agora**: antes da Wave C.3 (cálculo
  client-side), o bug era latente — a UI mostrava nomes do
  `name` salvo, dando impressão de funcionar. Com a materialização,
  o cálculo tentou agregar por `user_id` real, expôs o bug.
- **Fix server-side** (`functions/clubRanking.js`):
  `sideToUids(side, participantById)` aceita mapa
  `eventParticipantDocId → event_participant` e resolve
  `p.id → user_id`. Convidados sem user_id são pulados. Nova
  função `loadEventParticipantsMap` constrói o mapa por clube.
- **Fix client-side** (`GameDayOrganizer` + `sanitizeGameSide`):
  para dados NOVOS, salva `user_id` direto no `side_a`/`side_b`.
  Mantém `id` para retrocompat. Schema novo funciona no
  server-side sem precisar do mapa.
- **10 testes novos** em `clubRankingUserIdFix.test.js`
  (1387 total): regressão explícita "sem participantById,
  materializado fica VAZIO" + cenário do Pickleholics.

**Correções do materializado server-side (Wave C.5, Sprint 19)**:
- **Bug #1 (crítico)**: `applyToIndividual` agora seta `user_id` no
  row (era `undefined`, gerando doc id `{clubId}_undefined`).
- **Bug #2**: torneios do clube (Wave B) agora contam como
  `is_club=true` no escopo interno, via resolução de
  `tournament.club_id` (novo `loadTournaments()` em chunks de 30).
- **Bug #3**: callable `recomputeOneClubInternalRanking` aceita
  `platform_admin` por custom claim **OU** por `users/{uid}.role`
  (Fsa tinha role no Firestore, não no claim → 500 fix).
- **Painel Admin V2** — novo `ClubRankingBackfillPanel` em
  `src/modules/admin/components/`, usado em V2AdminConsole
  (Visão geral) e V2AdminMetrics (`/admin/metricas`). Mostra
  contagem (clubes/materializados/vazios), botão de backfill
  total com confirm, lista de clubes vazios com botão granular
  'Recalcular' por clube. Substituiu o `ClubRankingPanel` legado
  (removido).
- **Feature flag** `CLUB_INTERNAL_BACKFILL` (default ON quando
  `CLUB_INTERNAL_RANKING` está ON).
- **5 testes novos** em `clubRankingServer.test.js` cobrindo a
  regressão `user_id` (1377 passing total).

**Fix do filtro de clube + backfill do materializado (Wave C.4, Sprint 18)**:
- **Filtro de clube no ranking nacional** (`NationalRanking.jsx`):
  agora carrega `useClubs()` (diretório oficial) + mescla com
  `player_ratings.clubs` denormalizado. Antes: dropdown
  "Todos os clubes" não listava nenhum clube.
- **`loadClubUids(clubId)`** no hook `useClubInternalRanking`:
  lê `club_members` + `athlete_profiles.club_ids` (array-contains).
  Antes: `clubUids` vinha do materializado (vazio para clubes
  legados) → badge "0 atletas do clube" mesmo com 16 membros.
- **Botão "Recalcular rankings de todos os clubes"** no `AdminMetrics`
  (platform admin) — backfill manual via Callable.
- **Botão "Materializar ranking agora"** no `ClubRankingTab` (admin
  do clube) + CTA no empty state individual.
- **Cloud Function mensal `recomputeAllClubsMonthly`** (1º dia às
  4h) — auto-cura mensal sem interação humana.
- **Workflow de deploy** com passo "Backfill club internal rankings"
  (documenta o caminho).

**Ranking interno do clube MATERIALIZADO no Firestore (Wave C.3, Sprint 17)**:
- Cloud Function `recomputeClubInternalRankings` materializa 4 coleções
  top-level com W/L/Aprov/Saldo **e** `display_name`/`photo_url`:
  - `club_internal_ratings/{clubId_userId}` (individual, só clube)
  - `club_internal_ratings_ext/{clubId_userId}` (individual, com externos)
  - `club_internal_doubles_ratings/{clubId_pairKey}` (duplas, só clube)
  - `club_internal_doubles_ratings_ext/{clubId_pairKey}` (duplas, com externos)
- **5 gatilhos** (5 onDocumentWritten) cobrem todas as origens de
  resultado: `club_events/{id}/games/{id}`, `club_event_games/{id}`,
  `tournament_matches/{id}`, `club_members/{id}`,
  `athlete_profiles/{id}` (quando `club_ids` muda).
- **2 callable** (admin): `recomputeAllClubInternalRankings`
  (platform admin) e `recomputeOneClubInternalRanking`
  (admin do clube OU platform admin).
- Frontend **só LÊ** (hook `useClubInternalRanking`). Toggle
  "Incluir resultados externos" = trocar coleção. Sem nenhum
  cálculo client-side. Sem latência. Múltiplos users leem do
  mesmo materializado.
- Bug do nome (Wave C.2 mostrava uid) resolvido: `display_name`
  e `photo_url` desnormalizados no documento materializado.

**Ranking interno do clube em duplas (Wave C.2, Sprint 16)**:
- `ClubRankingTab` agora tem sub-abas **Individual** | **Duplas** (a
  segunda só aparece se `CLUB_INTERNAL_DOUBLES_RANKING` estiver ON).
- Ranking de duplas via `computeDoublesRanking` (domínio puro,
  reusado do ranking nacional) — agrupa parcerias pelo par de
  uids e soma vitórias/derrotas/saldo.
- **Toggle "Incluir resultados externos"** (só admins do clube):
  - Default OFF (escopo só do clube).
  - Quando ON, agrega também:
    * `tournament_matches` finalizados em que atletas do clube
      participaram.
    * `club_event_games` (Wave C) de outros clubes.
- `useClubInternalRanking(clubId, { includeExternal })` centraliza
  a coleta de fontes e o cálculo.
- `clubRankingSources` (domínio puro) normaliza matches de qualquer
  formato (`side_a_ids`/`side_b_ids` ou objetos) e filtra pelos
  uids do clube. 13 testes unitários.

**Dias de jogo → ranking nacional (Wave C, Sprint 15)**:
- `club_events/{id}/dates/{dateId}.publish_to_ranking` (default false)
- Criador do evento + admins do clube podem LIGAR a chave para espelhar
  os jogos com resultado decidido em `club_event_games`
- Apenas jogos DECIDIDOS (com placar lançado) entram no ranking; jogos
  sem resultado são pulados
- Publicação é idempotente (Republicar não duplica); despublicar remove
  os jogos espelhados e recalcula o rating
- `recomputeAllRatings` agora lê AMBAS as coleções
  (`tournament_matches` + `club_event_games`)
- `clearGameDayData` também limpa os espelhamentos quando o dia de
  jogo é excluído

## athletes/ — diretório de atletas

Perfis públicos pesquisáveis (`athlete_profiles`, `directory_listed`).

- **V2 (ativo)**: `V2Athletes`, `V2AthleteProfile`, `V2ProfileEdit`.
- **V1 (legado)**: `AthletesDirectory`, `AthleteProfile`.
- **services**: `athleteService` (`syncAthleteProfile`, `listAthletes`,
  `getAthlete`, `removeAthleteProfile`).
- **domain (puro, testado)**: `publicProfile` (montagem do perfil público).
- Reusado na busca de atletas para **convidar membros de clube** e como
  audiência do aviso de "torneio aberto".
- **ID DUPR** (PR #90, Sprint 27): campo `dupr_id` em
  `users/{uid}` + espelhado em `athlete_profiles/{uid}` via
  `buildAthletePublicProfile` (trim, null quando vazio).
  Aparece em: editor de perfil (seção Identidade), cards do
  diretório (+ busca por DUPR), perfil público (chip no herói),
  inscrições de torneio (linha "DUPR: X / Y" por dupla), meu
  perfil (chip). Aditivo/backward-compat, sem índice novo.
- **Lado da quadra + Interesses** (PR #91, Sprint 28):
  - **Lado da quadra**: campo `quadrant` (qualquer/esquerda/
    direita) em `users` + espelhado em `athlete_profiles`.
    Aparece no perfil público (ajuda parcerias).
  - **Interesses na plataforma**: array `interests` em `users`
    (multi-seleção de funcionalidades — ver
    `athletes/domain/profileMeta.js`). Drive do painel
    personalizado.
  - **Cadastro completo obrigatório**: `profile_completeness`
    calculado em tempo real (não armazenado). Valida campos-chave
    +1+1 (interesses + lado da quadra).
  - **Painel personalizado**: a home do usuário mostra conteúdo
    baseado em `interests[]` + papel.
  - **+1 componente** `profileMetaIcons.js` (ícones por interesse).

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
- **"Ver como usuário"** (PR #79): toggle no header (só admin) que faz
  `isPlatformAdmin`/`canCreatePools` retornarem `false`. App se comporta
  como user comum. Útil pra debug. Lógica em `FirebaseAuthContext.jsx`
  via flag `impersonate`.
  Ações geram `audit_logs` (`platform_archive_tournament`,
  `platform_delete_tournament`, `feature_flag_changed`…).

**V2AdminConsole** (PR #69): painel 2 níveis (sticky top-2 + sub-tab-bar),
com flags agrupadas por assunto (`core` / `nav` / `athlete` / `tournaments`
/ `arenas` / `coaches` / `community` / `arena_v3` / `other`).
**Arena V3 Boot embutido** — sub-seção de bootstrap dos módulos V3
(executa migração, ativa sub-flags).

## games/ — jogos abertos, procura-jogo e dia de jogo do atleta

- **V2 (ativo)**: `V2OpenGames` (Procura-se jogo), `V2GameDays` (Dia de jogo),
  `V2MyGames` (rota legada → redireciona a `/meu-desempenho`).
- **V1 (legado)**: `OpenGames`.
- Coleções: `games`, `open_games`, `participants`, `game_days` (+ subcoleções
  `participants`/`games`). Gera notificações para quem confirmou presença.
- **Dia de jogo do atleta** (flag `athlete_game_day`): qualquer atleta cria seu
  próprio dia de jogo (público ou privado por convite), insere/convida qualquer
  atleta da plataforma e organiza os jogos (reaproveita `gameDayDraw`/
  `gameDayFormats` dos clubes). Dias de jogo públicos publicam um convite em
  `open_games` (`kind='game_day'`); ao "Participar", o dia de jogo passa a
  aparecer na aba "Dia de jogo" do atleta. O criador pode publicar os resultados
  decididos no ranking geral (espelho em `club_event_games`) — e no ranking de um
  clube quando todos os atletas de uma partida são do mesmo clube (`club_id`
  resolvido por partida). Visível apenas ao criador e aos membros.
- **Data nos convites** (Wave #88): "Publicar convite" exige data OU
  descrição. Feed ordenado por data (mais próximos primeiro; sem
  data ao final). Convites passados em seção colapsável fechada
  por padrão. Mesmo padrão para "Dia de jogo".
- **Editar dia de jogo** (PR #89): botão "Editar" no detalhe (só
  para o criador) reaproveita `CreateGameDayDialog` em modo
  edição. Atualização de visibilidade sincroniza o convite
  público em `open_games` (privado→público publica, público→privado
  remove, público→público atualiza data/descrição).
- **Dia de jogo em "Meu desempenho"** (Wave #87): `myGames.js`
  agrega todos os jogos de dia de jogo (publicados OU não) do
  atleta, deduplicando por `gd_${gameDayId}_${gameId}`. Alimenta a
  Estatística (fold em `usePlayerStats`) e a aba Meus jogos
  (`MyGamesPanel`).
- **Ranking de duplas consome dia de jogo** (Wave #87):
  `listFinishedEngineMatches` lê `club_event_games` (dias de jogo
  publicados) usando `side_a_ids`/`side_b_ids`. Ranking de duplas
  agora reflete publicação de dia de jogo.
- **Navegação**: em "Jogar" a aba "Meus jogos" passou a ser sub-aba de "Meu
  desempenho" (abas "Estatística" + "Meus jogos"); no lugar dela entra "Dia de
  jogo".
- **Formato Play (open play)** (NOVO Onda F, PRs #101-#104): fila
  de espera + substituição + próximo da fila. Visões separadas
  organizador/participante (`AthletePlayOrganizer.jsx` +
  `AthletePlayParticipant.jsx`). Sorteio aditivo (não destrutivo)
  + ranking do dia.
- **Play — polimento** (PRs #105-#109): sorteio Americano ciente
  do histórico, `pickSwapReplacement` (substituído não volta à
  mesma partida), `normalizeStatsFormat` (formato do jogo, não
  da inscrição — americano = duplas), parceiro na rotação
  do Americano.

## legal/ — documentos legais e consentimento

- **Flag**: `legal_center`. **V2**: `V2Legal` (central `/legal`),
  `V2LegalDocument` (`/legal/:docRoute`).
- Registro de documentos em `domain/legalDocuments.js` (dado puro, versionado):
  essenciais (Termos de Uso, Política de Privacidade, Termo de Riscos — aceite
  **bloqueante** via `LegalConsentGate` no `V2Layout`), complementares (Cookies,
  Diretrizes da Comunidade, Pagamentos/Reembolsos, Cancelamento) e por papel
  (Organizador, Arena, Professor — aceite no fluxo que assume o papel via
  `useRoleConsent`).
- Consentimento versionado em `legal_consents` (`domain/consent.js` +
  `services/consentService.js` + `hooks/useConsents.js`). Bump de versão de um
  documento reabre o portão de aceite.
- A página legada `/politica-uso` (V2Privacy) segue existindo; com a flag
  desligada, tudo isso fica oculto e só ela permanece.

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

## rating/ — ranking nacional + DUPR + matchmaking

Ranking nacional, ranking de duplas (Onda 3), head-to-head, matchmaking,
**ranking estilo DUPR** (escala 2.0-8.0, Onda G Sprints 38-43).

- **V2 (ativo)**: `V2Ranking` (com aba "Nivel 2.0-8.0" gated por
  `skill_rating_dupr`), `V2DoublesRanking`, `V2FindPlayers`
  (com score de matchmaking gated por `smart_matchmaking`).
- **Componentes de rating (NOVO)**: `V2DuprRankingView`,
  `V2DuprEvolution`, `V2DuprRatingBadge`, `HeadToHeadCard`,
  `RatingSparkline` (em `v2/components/rating/`).
- **domain (puro, testado)**:
  - `headToHead` (legacy).
  - `doublesRanking` (Onda 3).
  - `matchmaking` (NOVO Onda H) — score 0-100 com
    proximidade de rating, complementaridade de lado,
    cidade, interesses.
  - **`elo`** (testado) — ELO original (intacto).
  - **`duprScale`** (NOVO Onda G) — escala 2.0-8.0 com
    confiabilidade, baseado no placar, simples/duplas
    separados, replay determinístico.
  - **`gameLog`** (NOVO Onda G) — normalizador compartilhado
    de jogos (espelha fonte do ELO, sem tocá-lo).
  - **`coachSeed`** (NOVO Onda M) — semente de rating por
    nível validado.
  - **`ratingSignature`** (NOVO) — assinatura de rating
    (replay determinístico).
  - **`duprMatchExport`** (NOVO) — gera CSV para DUPR
    (exclui `0×0`, resolve `dupr_id` de `users`).
- **services**: `ratingService`, `headToHeadService`,
  `duprRatingService`, `duprOfficial` (stub sem rede),
  `duprExportService`.
- **hooks**: `useRating`, `useHeadToHead`, `useDuprRating`,
  `useDuprExport`.
- **Materialização no client + Cloud Function
  `recomputeRankingOnTournamentChange`**.
- **Coleções (NOVAS)**: `player_skill_ratings/{userId_format}`
  (rating DUPR), `skill_rating_history/{id}` (evolução).
- **ELO intacto**: nada do ELO foi tocado. Tudo aditivo.

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
- **Push Notifications** (NOVO Onda H) — opt-in/opt-out
  via `V2PushCard`. Gated por `push_notifications`.

- `services/dataExportService` (gera arquivo em `user_data_exports/`)
- `core/services/pushService.js` (NOVO Onda H) — opt-in,
  opt-out, no-op gracioso sem VAPID.
- `domain/dataExport` (formato do export)

## home/ — Home orientada a ação (NOVO Onda H)

Substitui a home neutra por uma home **orientada a ação** gated
por `action_home` (default OFF). Componentes:

- `v2/components/home/V2ActionHome.jsx` (NOVO) — bloco "O que
  fazer agora" (próximo jogo, pendências, torneios abertos
  perto da sua cidade) + faixa "Sua evolução" (streak,
  nível/XP, próxima conquista, metas).
- **Reuso**: `progression/`, `achievements/`, `performance/`.
- **Sem query nova**: tudo via dedupe do React Query.
- **Desligada, home segue exatamente como está**.

## arenas/ — Mercado (NOVO Onda J)

Sistema de mercado da arena (PDV V2) — 6 PRs (#95-#100).
Componentes:
- `v2/components/arenas/V2ArenaMercadoTab.jsx` (NOVO)
- `v2/components/arenas/V2ArenaCatalogBrowser.jsx` (NOVO)
- `v2/components/arenas/V2ArenaFinanceTab.jsx` (NOVO)
- `v2/components/arenas/V2ArenaGestaoTab.jsx` (NOVO)
- `v2/components/arenas/ProductTypeahead.jsx` (NOVO)
- `v2/components/admin/AdminCatalogTab.jsx` (NOVO)
- **Painel "Como foi minha semana"** (gated
  `arena_ops_kpis`, Onda N) — KPIs + heatmap de horários.

Domínio (NOVO):
- `arenas/domain/catalogSeed.js` — seed do catálogo padrão.
- `arenas/domain/productCatalog.js` (testado) — CRUD catálogo.
- `arenas/domain/marketReports.js` (testado) — relatórios
  financeiros.
- `arenas/domain/dynamic_pricing.js` (NOVO, testado) — preço
  dinâmico.
- `arenas/domain/arena_week.js` (NOVO, testado) — KPIs
  semanais + heatmap.

Coleções (NOVAS): `arena_products`, `arena_sales`,
`arena_marketplace_catalog` (seed).

## tournament/ — Torneio + Equipes (NOVO Onda I)

Torneio cresceu **muito** com a Onda I (formato Equipes).
Componentes novos:
- `v2/components/tournament/TeamConfrontationCard.jsx` (NOVO)
- `v2/components/tournament/TeamConfrontationDialogs.jsx` (NOVO)
- `v2/components/tournament/TeamModalityConfig.jsx` (NOVO)
- `v2/components/tournament/TeamModalityView.jsx` (NOVO)
- `v2/components/tournament/TeamRegistrationDialog.jsx` (NOVO)
- `v2/components/tournament/TeamRegistrationForm.jsx` (NOVO)
- `v2/components/tournament/TeamStandingsTable.jsx` (NOVO)
- `v2/components/tournament/V2TournamentAdminPanel.jsx` (NOVO)
- `v2/components/tournament/V2TournamentOpsTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentRegistrationsTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentDrawTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentModalitiesTab.jsx` (NOVO)
- `v2/components/tournament/V2MatchesBlock.jsx` (NOVO)
- `v2/components/tournament/V2Collapsible.jsx` (NOVO)
- `v2/components/tournament/PartnerInviteNotificationAction.jsx` (NOVO)

Páginas novas:
- `v2/pages/V2TournamentAdmin.jsx` (NOVO) — console dedicado.
- `v2/pages/V2MyTournamentsAdmin.jsx` (NOVO) — aba no Perfil.

Coleções novas:
- `tournament_team_registrations/{id}`
- `tournament_team_lineups/{id}`
- `tournament_team_confrontations/{id}`

Flags:
- `team_tournaments` (default OFF) — formato equipes.
- `tournament_admin_console` (default OFF) — console dedicado.
- `partner_invite_quick_confirm` (default OFF) — confirmar
  dupla direto na notificação.

---

## core/lib/ — biblioteca compartilhada (perfil + onboarding)

Lógica de perfil e onboarding que não cabe em um módulo (usada
por `athletes/`, `auth/`, `coaches/`, `arenas/`, etc.).

- **`profileValidation.js` + `profileValidation.test.js`** —
  validação de `profile_completeness` (campos-chave do perfil).
- **`onboarding/`** (PRs #92 e #94, Sprints 29 e 31):
  - **3 caminhos para o nível** no passo final: teste /
    lista explicativa / pular.
  - **Onboarding não bloqueia** (PR #94): o wizard pode ser
    interrompido e retomado.
  - **Aceite persistido em `legal_consents`** (PR #94 + #86):
    cada aceite no onboarding vira doc auditável
    (`legal_consents/{uid}_privacy_policy`).
- **`profileMeta.js`** + **`profileMetaIcons.js`** (PR #91,
  Sprint 28): registro de lados da quadra + interesses, com
  ícones correspondentes. Drive da home personalizada.
- **`core/lib/utils.js`**: helpers de nível (reusa `LEVEL_TABLE`).
- **Regra de ouro**: o onboarding é **opcional e destravado**.
  Nada bloqueia o usuário de usar o app.

---

## nav/ — navegação (V2)

- **PR #93 (Sprint 30)**: "Termos e Documentos" unificado na
  seção legal do Perfil (não é mais hub standalone).
- **PR #93 (Sprint 30)**: "Meu desempenho" virou aba dentro de
  Perfil (não é mais rota standalone).
- **Regra D-NAV-SEM-DUPLICIDADE**: não há 2 caminhos para a
  mesma coisa. Cada coisa fica em UM lugar.

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
