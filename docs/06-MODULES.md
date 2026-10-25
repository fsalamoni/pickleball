# MODULES

> O que cada módulo de `src/modules/` faz, onde estão os arquivos-chave, que
> telas o consomem e que coleções toca. Panorama em `docs/01-AI-CONTEXT.md`;
> dados em `docs/05-DATA-MODEL.md`; **números, rotas, coleções, índices,
> Cloud Functions e flags exatos em [`docs/46-INVENTARIO.md`](./46-INVENTARIO.md)**
> (arquivo GERADO do código — este aqui não repete contagens).

## Como ler

`src/modules/` tem **29 módulos**. Cada um segue (quando precisa) as camadas
`domain/` (regra pura, com `.test.js` ao lado) → `services/` (I/O Firestore)
→ `hooks/` (React Query) → `components/`; `i18n/locales/{en,es}.js` quando tem
texto próprio. As telas ativas moram em `src/v2/pages/V2*.jsx` e os
componentes de tela em `src/v2/components/<área>/`; a camada V1 (`src/pages/`)
só mantém as quatro telas públicas/telão listadas em `docs/01-AI-CONTEXT.md`.
Cada módulo tem um `README.md` próprio, que é a fonte mais detalhada.

**Feature flags** (`src/core/featureFlags.js`): `FEATURE_FLAG` tem só as flags
que o admin liga (hoje `dupr_official_sync`, `gameday_mexicano`,
`gameday_king_of_court`, `marketplace`, `multi_language`, `federations`); as demais viraram
`PERMANENT_FEATURE` (sempre `true`; os `if` que as consultam são dívida a
remover). Nova feature nasce atrás de flag, default OFF, aditiva. Quantas são,
em `docs/46-INVENTARIO.md` §8.

**Coleções**: a lista abaixo é o que o módulo toca no código; o esquema vive em
`docs/05-DATA-MODEL.md` e as regras em `firestore.rules`.

---

## Núcleo esportivo

### tournament/ — torneios
Torneio de ponta a ponta: criação, modalidades e fases, inscrições (com
contato privado), check-in, sorteio (grupos, chaves, pontos corridos, suíço,
Americano em etapas, equipes), jogos e placar, classificação, admins, página
pública, impressão e telão.
- **Arquivos-chave**: `domain/draw.js`, `domain/tiebreak.js`, `domain/teamFormat.js`,
  `domain/podium.js`, `domain/checkin.js`, `domain/americanoEtapas.js`,
  `services/registrationService.js`, `hooks/useTournament.js`. Regras e
  formatos: `docs/26-TORNEIO-FORMATOS-E-REGRAS.md`, `docs/12-TEAM-TOURNAMENTS.md`,
  `docs/37-TORNEIO-ETAPAS-TURNOS-E-CHECKIN.md`.
- **Telas**: `/torneios`, `/torneios/criar`, `/torneios/ingressar`,
  `/torneios/guia`, `/torneios/:id` (`V2Tournament`), `/torneios/:id/gerenciar`
  (`V2TournamentAdmin`), `/torneios/:id/modalidades/:modalityId`
  (`V2ModalityPage`), `/perfil/torneios`; públicas em `src/App.jsx`:
  `/p/:id`, `/torneios/:id/imprimir`, `/torneios/:id/telao`. Componentes em
  `src/v2/components/tournament/`.
- **Coleções**: `tournaments`, `tournament_modalities`, `tournament_registrations`
  (+ `private/contact`), `tournament_matches`, `tournament_groups`,
  `tournament_courts`, `tournament_admins`, `tournament_announcements`,
  `tournament_photos`, `tournament_rankings`, `provisional_claims`,
  `club_event_games` (espelho de equipes).

### games/ — dia de jogo, jogo aberto e procura-jogo
O dia de jogo é **um módulo só** para as três origens (atleta, arena, clube):
formatos Play, Americano, Americano aprimorado, Mexicano e Rei da Quadra;
sorteio, rodízio, grupos do Play, placar por sets, ranking do dia, publicação
no ranking e telão.
- **Arquivos-chave**: `services/gameDayService.js`, `domain/americanoLive.js`,
  `domain/playRotation.js`, `domain/playGroups.js`, `domain/gameDayRoles.js`,
  `domain/arenaGameDay.js`, `domain/playDiscovery.js`. Componente-mestre:
  `src/v2/components/games/GameDayModule.jsx`. Docs `14` a `17`, `22`, `25`, `35`, `39`.
- **Telas**: `/dia-de-jogo`, `/dia-de-jogo/:gameDayId` (`V2GameDays`),
  `/procura-jogo` (`V2OpenGames`), `/meus-jogos` (`V2MyGames`); telão
  `/dia-de-jogo/:id/telao` em `src/App.jsx`.
- **Coleções**: `game_days` (+ `participants`, `games`), `open_games`,
  `club_event_games`, `arena_open_slots`.

### rating/ — ranking, rating 2.0–8.0 e DUPR
Ranking nacional (ELO), rating estilo DUPR (escala 2.0–8.0), ranking de
duplas, confronto direto, nível unificado dos sorteios, exportação/sync DUPR.
O servidor é o único escritor dos rankings (`docs/18-RANKINGS.md`).
- **Arquivos-chave**: `domain/unifiedLevel.js`, `domain/duprScale.js`,
  `domain/duprReconcile.js`, `domain/duprMatchExport.js`, `services/ratingService.js`,
  `services/duprExportService.js`. Espelho no servidor: `functions/engines/`.
- **Telas**: `/ranking` (`V2Ranking`), `/ranking/duplas` (`V2DoublesRanking`),
  `/encontrar-jogadores` (`V2FindPlayers`).
- **Coleções**: `player_ratings`, `player_skill_ratings`, `rating_history`,
  `skill_rating_history`, `doubles_rankings`, `dupr_export_log` (leitura;
  escrita só do servidor).

### circuits/ — circuitos
Séries de torneios com ranking acumulado.
- **Arquivos**: `domain/circuit.js`, `services/circuitService.js`, `hooks/useCircuits.js`.
- **Telas**: `/circuits`, `/circuits/:circuitId` (`V2Circuits`, `V2CircuitManage`).
- **Coleções**: `circuit_admins`, `circuit_results`, `circuit_tournaments`.

### trophies/ — troféus e cartões de campeões
Pódio, estante de troféus e cartões (PNG/PDF) derivados do que já está
gravado. Zero coleção própria. Ver `src/modules/trophies/README.md` e
`docs/43-TROFEUS-E-CARTOES.md`.
- **Arquivos**: `domain/trophies.js`, `domain/medalCard.js`,
  `services/trophyService.js`, `hooks/useTrophies.js`.
- **Telas**: componentes `PodiumBlock`, `MedalCard`, `MedalCardDialog`,
  `TrophyShelf` em `src/v2/components/trophies/` (resultados do torneio,
  `/p/:id`, Minha área, perfil público).
- **Coleções lidas**: `club_event_games` (+ torneio via `tournament/`).

---

## Locais e comunidade

### arenas/ — arenas, reservas e Arena V3
Diretório, calendário e reserva (múltiplas quadras/horários, preço por hora,
bloqueios), dia de jogo da arena, jogo aberto e fila de espera, membros,
pacotes e carteira, aulas, torneios da casa e ranking da casa, loja/PDV,
Mercado (estoque), marketing (cupons, campanhas, banners, NPS, indicação),
operação, chegada/totem e catálogo de 50 módulos em 3 camadas. Docs `08`,
`10-ARENA-V3/`, `22`, `23`, `24-MODULOS-DE-ARENA/`.
- **Arquivos-chave**: `services/bookingService.js`, `hooks/useArenaV3.js`,
  `hooks/arenaQueries.js`, `domain/marketing.js`, `domain/pricing.js`,
  `domain/arenaBlocks.js`, `domain/memberBenefit.js`, `domain/inventory.js`,
  `domain/moduleAccess.js`.
- **Telas**: `/arenas`, `/arenas/:arenaId`, `/arenas/:arenaId/gerir` (Central,
  `V2ArenaManage`, `?aba=`/`?secao=`), `/arenas/criar`, `/minhas-reservas`,
  `/arenas/:arenaId/{loja,aulas,torneios,membros,marketing,matchmaking,open-match,chegada,avancado}`,
  `/arenas/:arenaId/gerir/*`, `/arenas/:arenaId/campanhas/:campaignId`;
  totem `/arenas/:arenaId/totem` em `src/App.jsx`.
- **Coleções**: `arenas`, `arena_*` (reservas, quadras, horários, bloqueios,
  membros, carteiras, pacotes, aulas, cupons, campanhas, estoque, vendas,
  pagamentos, redes, dispositivos, NPS…), `booking_waitlist`, `catalog_products`,
  `coach_arenas`.

### clubs/ — clubes
Clubes com papéis, mural, fórum com enquetes, eventos, RSVP, ranking interno,
página pública e dia de jogo do clube (datas novas nascem como `game_days`;
as legadas seguem no `GameDayOrganizer`).
- **Arquivos**: `services/clubService.js`, `components/GameDayOrganizer.jsx`,
  `domain/gameDayDraw.js`, `domain/gameDayFormats.js`, `domain/rankingPublishing.js`,
  `hooks/useClubs.js`.
- **Telas**: `/clubes`, `/clubes/criar`, `/clubes/:clubId`,
  `/clubes/:clubId/eventos/:eventId`; pública `/c/:clubId` em `src/App.jsx`.
- **Coleções**: `clubs`, `club_members`, `club_events` (+ datas),
  `club_event_games`, `club_event_rsvps`, `club_posts`, `club_forum_threads`,
  `club_invite_codes`, `club_join_requests`, `club_member_invites`,
  `club_internal_*_ratings`, `poll_votes`, `event_invites`.
- **Associação (flag `club_association`, default OFF)** — `docs/52-CLUBE-ASSOCIACAO.md`:
  planos de filiação, Pix, carteirinha e Central do clube. Telas
  `/clubes/:clubId/gerir` (Central), aba Associação em `/clubes/:clubId`,
  pública `/c/verificar/:codigo?` e seção "Associe-se" em `/c/:clubId`.
  Coleções `club_x/{clubId}/{plans,aff,charges,staff,roles,imports,cfg,benefits,bsec,news,sponsors,budgets,ledger,reports}` e `club_card_index`.
  Bloco C1: vantagens do associado, comunicados e patrocinadores (`domain/content.js`,
  `services/contentService.js`, `functions/clubContent.js`, seção Comunicação da Central).
  Bloco B: diretoria com cargos e mandatos (`domain/staff.js`, aba Diretoria),
  indicadores (`domain/indicators.js`), importação de associados por CSV e
  declaração de associação (`domain/declaration.js`).
  Arquivos: `domain/association.js`, `services/associationService.js`,
  `hooks/useClubAssociation.js`, `v2/components/clubs/{association,manage}/`.

### coaches/ — professor (Sistema A)
Perfil público e descoberta, agenda e aulas, alunos e anotações,
pacotes/créditos, clínicas, loja, conteúdo, validação de nível e residência
em arena. Não confundir com `arena_classes` (aulas da arena, em `arenas/`).
- **Arquivos**: `services/coachService.js`, `services/lessonService.js`,
  `services/waitlistService.js` (lista de espera e horários ocupados),
  `components/CoachStudentsSection.jsx`, `components/CoachPackagesSection.jsx`,
  `components/CoachWaitlistJoin.jsx` (aluno entra na lista),
  `components/CoachWaitlistSection.jsx` (professor: Hoje e Agenda),
  `components/MyCoachWaitlists.jsx` (aluno, em `/minhas-aulas`). O pedido de
  aula só oferece horários LIVRES; sem nenhum, a lista de espera avisa sozinha
  quando abrir horário (`functions/coachWaitlist.js`).
- **Telas**: `/coaches`, `/coaches/:coachId`, `/aulas` (`V2CoachAgenda`),
  `/minhas-aulas` (`V2StudentLessons`).
- **Coleções**: `coach_lessons`, `coach_students`, `coach_student_notes`,
  `coach_availability`, `coach_packages`, `coach_package_sales`,
  `coach_clinics`, `coach_clinic_signups`, `coach_products`, `coach_content`,
  `coach_level_validations`, `coach_favorites`, `coach_arenas`,
  `coach_waitlist` (quem espera horário) e `coach_busy_slots` (só data e hora
  ocupadas, pública, escrita pelo servidor).

### athletes/ — diretório e perfil
Perfis públicos pesquisáveis, privacidade, exportação de dados do titular,
**Minha área** (`/perfil` como central da pessoa: `domain/userArea.js`,
`docs/41-MINHA-AREA.md`), metadados do perfil (`domain/profileMeta.js`).
- **Arquivos**: `services/athleteService.js`, `domain/publicProfile.js`,
  `domain/dataExport.js`, `domain/globalSearch.js`, `domain/directoryResync.js`.
- **Telas**: `/atletas`, `/atleta/:uid`, `/perfil`, `/perfil/editar`
  (`V2Profile`, `V2ProfileEdit`); componentes em `src/v2/components/userArea/`
  e `profile/`.
- **Coleções**: `athlete_profiles`, `users`, `club_members`, `audit_logs`.

### chat/ — mensagens
Conversas 1:1 e em grupo; gera avisos de mensagem e convite.
- **Arquivos**: `services/chatService.js`, `hooks/useChat.js`, `domain/conversations.js`.
- **Telas**: `/chat` (`V2Chat`). **Coleções**: `conversations` (+ `messages`).

### social/ — seguir e feed da comunidade
Follows e a "comunidade" (atividade recente), busca federada do `/buscar`.
- **Arquivos**: `services/followService.js`, `hooks/useFeed.js`, `domain/feed.js`.
- **Telas**: `/novidades` (`V2Community`), `/buscar` (`V2Search`).
- **Coleções**: `follows`.

### search/ — paleta de comandos
Índice puro da paleta de comandos (`commandIndex`). Zero banco. Ver
`src/modules/search/README.md`.
- **Arquivos**: `domain/commandIndex.js`.
- **Consumidor**: `src/v2/components/search/V2CommandPalette.jsx` (lazy no `V2Layout`).

### feed/ e moderation/ — planejados
Pastas estruturadas só com `README.md`: **nenhum código** (desenho em
`docs/FUTURO/FEED/` e `docs/FUTURO/CONFIANCA-E-MODERACAO/`). O que existe hoje
de "feed" é `social/` e a moderação de atletas do `admin/`.

---

## Progressão, treino e evolução

### progression/ — gamificação V2
Motor único de XP (`useGamificationEngine`), missões, sequência semanal
(`weekStreak.js`), temporada, desafios, recompensas, kudos, reputação, metas,
hall da fama, painéis de professor/arena/clube/admin e o guia
`/gamification/como-funciona`. Flag de gamificação em `docs/38-GAMIFICACAO-V2.md`.
- **Arquivos**: `domain/progressionV2.js`, `domain/missions.js`,
  `domain/gamificationGuide.js`, `domain/weekStreak.js`, `domain/supplyHealth.js`.
- **Telas**: `/conquistas`, `/gamification*`, `/hall-da-fama`, `/vinculos`
  (todas via `Gamified`).
- **Coleções**: `user_progression_v2`, `user_xp_grants`, `user_missions`,
  `user_streak_meta`, `user_kudos`, `user_kudos_index`, `user_reputation`,
  `season_rankings`, `gamification_*`, `hall_of_fame`, `reward_claims`,
  `player_goals`, `training_debriefs`, entre outras.

### achievements/ — conquistas
Conquistas V1 e V2 (`domain/achievementsV2.js`, `services/achievementsV2Service.js`,
`hooks/useSyncAchievementsV2.js`). **Coleção**: `user_achievements_v2`.

### performance/ — meu desempenho
Estatísticas individuais e cobertura do ranking ("por que este jogo não
conta"). **Arquivos**: `domain/playerStats.js`, `domain/rankingCoverage.js`,
`hooks/usePlayerStats.js`. **Tela**: `/meu-desempenho` (`V2Performance`). Sem coleção própria.

### leveling/ — nivelamento
Tabela de níveis e questionário de autoavaliação. **Arquivos**:
`domain/questionnaire.js`, `data/levels.js`. **Tela**: `/nivelamento`. Sem coleção.

### training/ — Centro de Treino
Biblioteca de drills e treinos (semente + professores + comunidade), planos,
diário, evolução, dúvidas ao professor, alunos, balanço do jogo
(`domain/debrief.js`) e revisão do admin. Docs `40`, `40a`, `42`.
- **Arquivos**: `domain/debrief.js`, `content/seed/drills.js`,
  `content/seed/fundamentos.js`, `services/` e `hooks/` (13 e 12 arquivos).
- **Telas**: `/treino`, `/treino/novo`, `/treino/golpes`, `/treino/item/:itemId`,
  `/treino/item/:itemId/editar`, `/treino/planos/:planId`; componentes em
  `src/v2/components/training/`.
- **Coleções**: `training_items`, `training_plans`, `training_sessions`,
  `training_meta`, `training_questions`, `training_reports`, `training_shares`,
  `training_debriefs` (+ `coach_content`). Storage `treino/{uid}/`.

---

## Plataforma, conteúdo e comércio

### admin/ — painel da plataforma
Console do `platform_admin` (`/admin/painel`): acessos e poderes, cadastros
(edição, suspensão, exclusão, unificação), flags, divulgação, métricas,
governança, ranking automático e **Comunicações** (avisos por e-mail,
WhatsApp, SMS e push — módulo `messaging/`). Docs `20-SEGURANCA-E-PRIVACIDADE/`.
- **Arquivos**: `services/adminService.js`, `domain/accessRoster.js`,
  `domain/adminUserEdit.js`, `domain/accountStatus.js`,
  `components/RankingAutomatico.jsx`.
- **Telas**: `/admin/painel` (`V2AdminConsole`), `/admin/owner-restore`,
  `/admin/owner-debug`; `/admin/torneios|metricas|parceiros|perfis` e
  `/admin/v3-bootstrap` redirecionam para abas do painel.
- **Coleções**: `audit_logs`, `admin_access_logs`, `users`, `platform_settings`
  e as que o painel administra.

### notifications/ — avisos
Sino e central `/notificacoes` (agrupamento por dia, filtros na URL),
preferências por categoria, push. O serviço de escrita é compartilhado em
`src/core/services/notificationService.js`; links passam por `linkDeAviso`.
- **Arquivos**: `hooks/useNotifications.js` (uma assinatura por usuário),
  `domain/noticeFeed.js`, `domain/preferences.js`. Cópia servidor:
  `functions/notificationPrefs.js`.
- **Telas**: `V2Notifications`, `NotificationsBell`. **Coleção**: `notifications`.

### messaging/ — avisos por e-mail, WhatsApp, SMS e push
Leva o aviso para fora da plataforma conforme o admin configurou (Painel admin
→ Comunicações) e a pessoa escolheu (Configurações → "E-mail e celular"). Quem
envia é o servidor (`functions/messaging*.js`). Flag `external_messaging`.
Doc `49`.
- **Arquivos**: `domain/policy.js` (cópia de `functions/messagingPolicy.js`,
  com paridade), `domain/meta.js`, `domain/guides.js`,
  `services/messagingService.js`, `hooks/useMessaging.js`.
- **Telas**: `src/v2/components/admin/messaging/`,
  `src/v2/components/settings/MessagingSettingsCard.jsx`.
- **Coleções**: `message_outbox`, `message_suppressions`, `message_reports`,
  `phone_verifications`, `platform_secrets`; documentos
  `platform_settings/messaging` e `platform_settings/messaging_status`; campos
  `users.notification_channels` e `users.phone_verified_*`.

### home/ — tela inicial personalizada
Início por pessoa (focos por papel, agenda unificada, cards escolhidos).
- **Arquivos**: `domain/homeProfile.js`, `domain/homeCards.js`,
  `domain/homeAgenda.js`, `domain/homeTournaments.js`, `domain/freshness.js`.
- **Telas**: `/` (`V2Dashboard`/`V2PersonalHome`); `src/v2/components/home/`.
  Docs `29`, `31`. Sem coleção própria (lê arenas, clubes, torneios, aulas).

### promo/ — cupons e campanhas da plataforma e dos professores
Mesmas ferramentas do marketing da arena para dois emissores novos.
- **Arquivos**: `domain/promo.js`, `domain/lessonCoupon.js` (leve; nunca importe
  `promo.js` do domínio de aulas), `services/promoService.js`, `hooks/usePromo.js`.
- **Telas**: `/promocoes`, `/campanhas/:campaignId`; `src/v2/components/promo/`.
- **Coleções**: `promo_coupons`, `promo_campaigns`, `promo_settings`.

### marketplace/ — o Mercado (`/mercado`)
Marketplace multi-vendedor: anúncios, carrinho, pedidos, ofertas, avaliações,
disputas, cupons, vales-presente, buscas salvas; pedidos e disputas só o
servidor escreve (`functions/marketplace.js`). Flag `marketplace`.
- **Arquivos**: `services/marketService.js`, `hooks/useMarket.js`,
  `domain/listing.js`, `domain/promotions.js`. README do módulo é a fonte.
- **Telas**: `/mercado` e subrotas (`V2Market*`, ver inventário §4).
- **Coleções**: `market_*` (listings, orders, offers, carts, coupons,
  gift_cards, reviews, disputes, sellers…).
- Não confundir com o PDV/"Mercado" de estoque da arena (`arena_*`).

### federations/ — federações, filiação e carteirinha digital
A federação (entidade com CNPJ) filia atletas, professores e árbitros, cobra
mensalidade ou anuidade por Pix na própria conta e emite a carteirinha digital
com verificação pública; o admin da plataforma aprova a abertura e dá os selos
"Verificada" e "Oficial". Filiação, cobrança e confirmação **só o servidor**
escreve (`functions/federations.js`). Flag `federations` (default OFF);
sub-módulos por federação (`FED_MODULE_META`): `tournaments` (chancela de
torneios + envio de resultados), `ranking` (ranking oficial, derivado pelo
servidor), `affiliations` (clubes e arenas filiados), `courses` (cursos e
credenciais verificáveis) e `discipline` (sanções com efeito na inscrição e
ouvidoria com protocolo) disponíveis e, do PR 4, `news` (notícias com aviso
aos filiados pelo servidor), `sponsors` (patrocinadores), `promos` (a
federação como emissora de cupons e campanhas no `promo/`) e `store` (loja
oficial no Mercado, vendedor `federation_{id}`); os demais "em breve". A
governança (estatuto, mandato, diretoria, atas) não é módulo. A secretaria
(transferências, documentos, importação, CPF e dependentes) não é módulo: vem
com a federação. Doc: `docs/50-FEDERACAO.md`.
- **Arquivos**: `domain/{constants,federation,staff,plans,membership,charges,card,federationPending,affiliations,sanction,officialRanking,privateData,transfers,importMembers,courses,discipline,news,sponsors,governance,profile}.js`,
  `services/federationService.js`, `hooks/useFederations.js`. README do módulo é a fonte.
- **Telas**: `/federacoes`, `/federacoes/abrir`, `/federacoes/:id?aba=` (página
  pública em abas + área do filiado + barra da equipe, `src/v2/components/federations/profile/` — `docs/50-FEDERACAO.md` §18),
  `/federacoes/:id/filiar`, `/federacoes/:id/gerir?aba=` (a Central:
  `src/v2/components/federations/manage/`); públicas `/f/:slug` e
  `/f/verificar/:codigo?` (V1, `src/pages/PublicFederation*.jsx`); Minha área →
  Federações; Painel admin → Federações. Fora do módulo: cartão Federação na
  gestão do clube e na Central da arena (`OrgAffiliationCard`), na gestão do
  torneio (`TournamentSanctionCard`), "Enviar ao ranking oficial" nos
  resultados (`FederationResultButton`), selos (`FedTags.jsx`) e a trava "só
  filiados" na inscrição.
- **Coleções**: `federations` (+ `private/data`), `federation_staff`,
  `federation_plans`, `federation_members` (+ `private/data`: CPF, nascimento,
  responsável), `federation_charges`, `federation_card_index`,
  `federation_affiliations`, `federation_results`, `federation_rankings`,
  `federation_documents_submitted`, `federation_transfers`,
  `federation_imports`, `federation_courses`, `federation_course_enrollments`,
  `federation_credentials`, `federation_sanctions`, `federation_reports`,
  `federation_news`; Storage `federacao/{uid}/`; campos opcionais
  `federations.sponsors`/`.governance`,
  `tournaments.federation_id`/`.federation_sanction`.

### help/ — tutoriais, dicas guiadas e central de ajuda
Conteúdo puro e contas das telas de ajuda. Zero banco (memória no
localStorage por usuário).
- **Arquivos**: `domain/helpCenter.js` (artigos, só em telas de ajuda),
  `domain/helpLink.js` (leve, para links), `domain/tutorials.js`,
  `domain/guias.js`, `domain/pontosDeDica.js`.
- **Telas**: `/ajuda` (`V2Help`); motor de dicas em `src/v2/components/dicas/`,
  tutoriais em `src/v2/components/tutorial/`. Docs `19`, `21`, `32`.

### legal/ — documentos legais e consentimento
Termos, privacidade e demais documentos (pt/en/es), portão de aceite,
registro de consentimento.
- **Arquivos**: `domain/legalDocuments.js`, `domain/consent.js`,
  `services/consentService.js`, `hooks/useConsents.js`.
- **Telas**: `/legal`, `/legal/:docRoute`, `/politica-uso`. **Coleção**: `legal_consents`.

### partners/ — parceiros
Logos, banners e links de afiliados. **Arquivos**: `domain/affiliate.js`,
`services/affiliateService.js`, `hooks/useAffiliates.js`. **Tela**: `/parceiros`
(`V2Partners`; gestão no painel admin). **Coleção**: `affiliate_links`.

### sharing/ — compartilhar
Cartões de compartilhamento e links (`components/ShareCardDialog.jsx`,
`components/ShareCardButton.jsx`, `domain/shareLinks.js`) e exportação `.ics`.
Sem coleção.

### analytics/ — funil
Eventos de funil e rastreio client-side (`domain/funnelEvents.js`,
`hooks/useFunnel.js`, `components/AuthFunnelTracker.jsx`). Sem coleção própria.

---

## Fora de `src/modules/`

- **`src/core/`**: `featureFlags.js` (+ `featureFlagGroups.js`), `lib/` (auth,
  tema, `viewPreference.js`, `profileValidation.js`, `queryState.js`,
  `useWakeLock.js`, `useRelogio.js`), `domain/` (`instant.js`, `internalLink.js`,
  `sidebarNav.js`, `errorRecovery.js`), `i18n/` (`t()`/`tk()`), `theme/`
  (paleta do modo escuro), `geo/` (cidades do IBGE, import dinâmico),
  `services/` (notificações, push, auditoria), `guards/` (testes de fonte que
  travam as armadilhas documentadas no `CLAUDE.md`).
- **`src/v2/`**: `V2App.jsx` (rotas), `pages/`, `components/`, `ui/`
  (primitivos, `V2Page`, `pageFrame.js`). Moldura única: `docs/45-MOLDURA-DAS-PAGINAS.md`.

## Mapa rota → tela

A lista completa e atualizada de rotas (raiz e V2) está em
`docs/46-INVENTARIO.md` §4 — gerada de `src/App.jsx` e `src/v2/V2App.jsx`.
Não copie rotas para cá.
