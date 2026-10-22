# federations/ — federações: filiação, carteirinha digital e a Central (flag `federations`)

A federação é a entidade que filia atletas, professores e árbitros de uma
região, cobra mensalidade ou anuidade por Pix **na própria conta** e emite a
carteirinha digital com verificação pública. Documento completo:
`docs/50-FEDERACAO.md`. Flag `federations` (default OFF, só o admin liga);
desligada, a regra recusa toda escrita e as telas somem — nada é apagado.

```
federations/
├── domain/                      # regra pura, cada arquivo com .test.js ao lado
│   ├── constants.js             # coleções, enums GRAVADOS (status, papéis, permissões, planos, módulos)
│   ├── federation.js            # validação do pedido/página/Pix, slug, selos, ações de revisão, FED_MODULE_META
│   ├── staff.js                 # cargos (os da federação ou os 8 de modelo), mandato, admin master, quem pode nomear/prorrogar/passar (cópia no servidor: federationStaffPolicy.js)
│   ├── plans.js                 # validatePlanInput, planPrice (descontos por idade), rótulos
│   ├── membership.js            # a CONTA da filiação: validade, renovação, estado, número, código, verificação
│   ├── charges.js               # estado da cobrança, resumo financeiro, CSV
│   ├── card.js                  # o que a carteirinha mostra (faixa com cor E texto), verifyPath
│   ├── federationPending.js     # "Precisa de você" da Central e da Minha área
│   ├── affiliations.js          # PR 2: pedido e decisão de filiação de clube/arena, contagens
│   ├── sanction.js              # PR 2: chancela do torneio (pedir, decidir, retirar) e a exigência "só filiados"
│   ├── officialRanking.js       # PR 2: a CONTA do ranking oficial (cópia em functions/federationRanking.js)
│   ├── privateData.js           # PR 3: CPF (só se a federação pede), idade/faixa, menor e dependente, documentos exigidos
│   ├── transfers.js             # PR 3: troca de clube / de federação — prazo de liberação, carência, estados
│   ├── importMembers.js         # PR 3: a lista colada (CSV/linhas) → linhas válidas, erros, prévia
│   ├── courses.js               # PR 3: estado do curso, vagas, cancelar inscrição, estado da credencial
│   ├── discipline.js            # PR 3: sanção (validação, efeito, recurso) e ouvidoria (protocolo)
│   ├── news.js                  # PR 4: validação da notícia, quem a vê (`visibleNews`), o link do aviso
│   ├── sponsors.js              # PR 4: lista de patrocinadores (≤ 12, cotas, links https)
│   ├── governance.js            # PR 4: estatuto, mandato, diretoria e atas (`validateGovernance`)
│   ├── indicators.js            # PR 6: Indicadores de 12 meses (filiados, renovação, recebido, atraso) e o CSV
│   └── declaration.js           # PR 6: a declaração de vínculo (quando sai, texto, resultados desta federação)
├── services/
│   ├── federationService.js     # leituras (uma igualdade, ordenação em memória), escritas da regra
│   │                            # (pedido, página, Pix, módulos, equipe, planos, preferências, "Já paguei")
│   │                            # e as chamadas ao servidor (reviewFederation, membershipAction, chargeAction, verifyCard;
│   │                            # PR 3: transferAction, courseAction, disciplineAction, importMembers, fetchDocument;
│   │                            # PR 4: notícias, notifyNews, patrocinadores, governança)
│   └── federationExportService.js  # o bloco `federations` da exportação de dados
├── hooks/useFederations.js      # chaves em `fedKeys`; useMyFederationRole, useMyMemberships, useCardVerification…
└── i18n/locales/{en,es}.js      # 1224 chaves (inclui os avisos do servidor e os textos dos cartões fora do módulo)
```

Telas: `src/v2/pages/V2Federations.jsx` (`/federacoes`), `V2FederationApply`
(`/federacoes/abrir`), `V2FederationDetail` (`/federacoes/:id?aba=`: página pública em
abas `FederationProfile`, área do filiado `FedMemberArea.jsx` e barra da equipe
`FedStaffBar.jsx`, em `src/v2/components/federations/profile/`; abas em
`domain/profile.js` — `docs/50-FEDERACAO.md` §18),
`V2FederationJoin` (`/federacoes/:id/filiar`), `V2FederationManage`
(`/federacoes/:id/gerir?aba=`, painéis em `src/v2/components/federations/manage/`);
públicas V1 `src/pages/PublicFederation.jsx` (`/f/:slug`, o mesmo `FederationProfile`) e
`PublicFederationVerify.jsx` (`/f/verificar/:codigo?`); Minha área → Federações
(`UserAreaSections.jsx`); Painel admin → Federações
(`src/v2/components/admin/federations/AdminFederationsPanel.jsx`).

Fora do módulo, mas dele (`src/v2/components/federations/`): `FedPublicBlocks.jsx`
(torneios chancelados, ranking, clubes/arenas, cursos, credenciados e ouvidoria
na página da federação), `FedMemberExtras.jsx` (PR 3: documentos do filiado,
sanções e recurso, transferência), `manage/FedSecretariatPanel.jsx`
(Transferências · Documentos · Importar), `manage/FedCoursesPanel.jsx`
(Cursos · Credenciais), `manage/FedDisciplinePanel.jsx` (Sanções · Ouvidoria),
`FedTags.jsx` (selos), `OrgAffiliationCard.jsx` (gestão do clube e Central da
arena → Federação), `TournamentSanctionCard.jsx` (gestão do torneio → Geral),
`FederationResultButton.jsx` (resultados do torneio); e a trava "só filiados"
em `ModalityRegistrationDialog.jsx` (`membershipRequirement`). PR 4:
`FedCommsBlocks.jsx` (notícias, promoções, patrocinadores, governança e o link
da loja na página), `manage/FedCommsPanel.jsx` (Notícias · Cupons e campanhas ·
Patrocinadores), Governança e Loja em `manage/FedSettingsPanel.jsx`,
`HomeFederationCard.jsx` (card do início) e, no Mercado, o vendedor
`federation_{id}` (`V2MarketSell.jsx` + `storeFederations` em `domain/staff.js`).

Servidor: `functions/federations.js` (`federationReview`,
`federationMembership`, `federationChargeConfirm`, `federationVerify`,
`federationMembershipSweep`), PR 3 `functions/federationTransfers.js`
(`federationTransfer` + a liberação automática na varredura),
`federationCourses.js` (`federationCourse`), `federationDiscipline.js`
(`federationDiscipline`), `federationSecretariat.js`
(`federationImportMembers`, `federationDocument`) — testes em
`functions/federationPr3.test.js`; PR 4 `functions/federationNews.js`
(`federationNews`) e o operador da loja em `functions/marketplace.js`
(`operatorUids`) — testes em `functions/federationPr4.test.js`; e `functions/federationMembership.js` — **cópia**
de `domain/membership.js` com paridade em
`functions/federationMembership.parity.test.js`; `functions/federationRanking.js`
(`federationRankingRecompute`, `federationRankingConfig`) — **cópia** de
`domain/officialRanking.js` com paridade em `federationRanking.parity.test.js`.

Coleções (`firestore.rules` § FEDERAÇÕES, provadas em
`tests/rules/federation.rules.test.js`): `federations` (+ `private/data`),
`federation_staff`, `federation_admin_grants` (PR 7), `federation_plans`, `federation_members` (+ `private/data`),
`federation_charges`, `federation_card_index`, `federation_affiliations`,
`federation_results`, `federation_rankings` (`tests/rules/federationPr2.rules.test.js`);
PR 3 (`tests/rules/federationPr3.rules.test.js`): `federation_documents_submitted`,
`federation_transfers`, `federation_imports`, `federation_courses`,
`federation_course_enrollments`, `federation_credentials`,
`federation_sanctions`, `federation_reports`; PR 4
(`tests/rules/federationPr4.rules.test.js`): `federation_news`, os campos
`federations.sponsors`/`governance`, a federação como emissora em `promo_*` e
como vendedora em `market_sellers`; Storage `federacao/{uid}/`
(`storage.rules`: só o dono lê); PR 8 (`tests/rules/federationAcervo.rules.test.js`):
`federation_docs` (acervo oficial, só o servidor grava — `functions/federationAcervo.js`,
régua em `federationAcervoPolicy.js` com paridade contra `domain/acervo.js`),
o contador `federations.doc_numbers` e o Storage `federacao-acervo/{uid}/`
(rascunho) + `federacao-acervo-oficial/` (fechada à regra); PR 8b:
`federation_followers` (quem segue o acervo; só a própria pessoa) e a página
pública `/f/:slug/acervo(/:docId)` (`src/pages/PublicFederationAcervo.jsx` +
`src/v2/components/federations/acervo/`); PR 9a
(`tests/rules/federationEvents.rules.test.js`): `federation_events`
(calendário oficial, módulo `calendar`; só o servidor grava —
`functions/federationAgenda.js`, régua e ICS em `federationAgendaPolicy.js`
com paridade contra `domain/agenda.js`), a agenda assinável
`/api/agenda/{slug}.ics` (`federationAgendaFeed`) e a página pública
`/f/:slug/agenda(/:eventId)` (`src/pages/PublicFederationAgenda.jsx` +
`src/v2/components/federations/agenda/`; gestão em
`manage/FedAgendaPanel.jsx`); PR 9b: reuniões e assembleias no campo
`meeting` do evento (convocação com pauta e quórum, resultado por item, ata),
domínio `domain/meeting.js` com cópia em `functions/federationMeetingPolicy.js`,
telas `manage/FedMeetingDialogs.jsx` e `agenda/MeetingBlock.jsx`; PR 10
(`tests/rules/federationComments.rules.test.js`): comentários no documento
publicado e no evento — `federation_comments` (só o autor lê direto) e
`federation_comment_reports` (ninguém lê), tudo gravado por
`functions/federationComments.js` e listado por `federationCommentsList`
(sem uid), régua em `domain/comments.js` com cópia em
`functions/federationCommentsPolicy.js`; telas `comments/CommentsSection.jsx`
e a fila `manage/FedCommentsPanel.jsx`; convites para filiar
(`tests/rules/federationInvites.rules.test.js`, `docs/50` §19):
`federation_invites` (a convidada e a secretaria leem; só o servidor grava,
ações `invite`/`invite_cancel`/`invite_decline` de `federationMembership`;
aceitar = pedir no plano do convite, sem aprovação), telas
`manage/FedInvites.jsx` e o seletor `manage/FedPersonPicker.jsx` (lista de
usuários da plataforma, também na equipe); o interruptor de módulo grava só
`modules.x` (`setFederationModule`). Zero índice composto; os únicos campos novos
em coleção existente são os opcionais `tournaments.federation_id`/`federation_sanction`.

## O que não pode regredir

- **Aprovada não é pública**: pública = `approved` **e** `published == true`
  (ausente = oculta), a mesma régua na regra (`fedPublic`/`fedSees`), no
  cliente (`isFederationPublic`) e no servidor (`publicada`). Só o admin da
  federação publica (Página pública → Publicação, `FedPublicationTab`); oculta,
  a equipe estrutura tudo e ninguém de fora lê nem pede (`docs/50` §17).
- **Só o servidor** cria filiação e cobrança, aprova, confirma pagamento e
  gira o código da carteirinha (`allow create, delete: if false`). O navegador
  só declara "Já paguei" e muda as próprias preferências.
- A flag vale **na regra** (`fedOn()`) e nas funções (`flagLigada`).
- A conta da validade tem **duas cópias com paridade**: mexer num lado só
  quebra o teste, de propósito.
- `federation_members` **nunca** é pública; o pedido não leva e-mail, telefone,
  nascimento nem endereço; a verificação pública mostra o mínimo
  (`publicVerification`).
- **Ranking oficial derivado, só o servidor grava**; a colocação enviada é a
  do pódio (`modalityPlacement`), só de categoria completa.
- **O organizador só pede** a chancela (`pending`); aprovar é da equipe
  `competitions`; "só filiados" vale na regra da inscrição.
- **Módulo desligado vale na regra** (`fedModuleOn()`): sem `affiliations`/
  `tournaments` ligados, ninguém pede filiação de organização nem chancela.
- Enum gravado (`MEMBER_STATUS`, `STAFF_ROLE`, `FED_MODULE`, `PLAN_*`) **nunca
  se renomeia**, só se acrescenta. Os valores de `?aba=` da Central e as
  âncoras `data-dica="federacao-…"` são contrato.
- Coleção `federation_*` nova entra na exclusão de conta
  (`functions/accountDeletion.js`) **e** na exportação
  (`federationExportService.js`) — `exclusaoCobreColecoes.test.js` reprova.
- Módulo novo da federação: `FED_MODULE` + `FED_MODULE_META` (nasce `planned`,
  que a aba mostra como "Em breve" e não liga); a tela dele pergunta
  `federation.modules[x]`.
- **Revisão geral (2026-10-21, `docs/50-FEDERACAO.md` §12):** papel →
  permissões é UM mapa com guarda (`src/core/guards/federacaoPermissoes.test.js`
  compara `STAFF_ROLE_PERMISSIONS` com `fedRolePerms()` da regra); o admin da
  plataforma tem toda permissão também na regra (`fedHas`); `private/data` só o
  servidor grava; valor em reais digitado passa por `parseBrlCents`
  (`domain/charges.js`), nunca por conta local; `membershipRequirement` usa
  `membershipState` e vale para a dupla; a exportação leva `private/data`
  (`listMyMembersPrivate`); o host da página pública vem de `publicHost()`;
  benefícios do plano só por `planBenefitLines` (texto ou lista, nunca `.split` na tela).
- **PR 3** — CPF, nascimento e responsável só em `private/data` (nunca no
  documento da filiação; na Central o CPF nasce mascarado e revelar é
  auditado). **Dependente** = filiação com `user_id` nulo e `guardian_uid`:
  "é o dono?" é sempre `fedMemberOwner` na regra, e o cliente consulta
  `user_id` **e** `guardian_uid` (duas consultas somadas), nunca só `user_id`. **Transferência, inscrição em curso, credencial, sanção
  e importação só o servidor grava**; a federação antiga **libera** a troca
  (silêncio = liberada no prazo pela varredura) e os pontos não migram. O
  **documento** só o dono lê no Storage; a secretaria o vê pela função
  `federationDocument`. A **suspensão** vale na regra da inscrição
  (`discipline_until_ms`) e termina sozinha na data — nenhuma varredura a
  encerra. A **credencial** usa o índice da carteirinha (`kind: 'credential'`)
  e nasce privada. Manifestação **anônima** não leva `reporter_uid` (regra);
  o protocolo deriva do id (`reportProtocol`/`protocolToId`). A `origin` da
  cobrança decide o efeito da confirmação (`course` confirma a inscrição,
  `fine` quita a sanção) — um caminho só.
- **PR 4** — o **aviso da notícia** é do servidor e sai uma vez só
  (`notified_at`, que a regra recusa ao cliente); "só filiados" vale na regra
  (`fedMemberActive`). A **campanha** da federação não manda aviso (o canal é
  a notícia). **Quem opera a loja oficial** tem três respostas que precisam
  bater: `isMarketOperator` (regra), `operatorUids` (servidor) e
  `storeFederations` (cliente) — `admin` ou `finance`, só com `store`. O card
  do início exige a flag (`requer: 'federacao'`).
- **PR 6**: indicador sem fonte é "—" com o motivo, nunca zero (a taxa de
  renovação pede filiados E financeiro); a declaração de vínculo só sai com a
  filiação em dia, sem suspensão e com código, e a do próprio filiado obedece
  a `rules.member_declarations` (a secretaria emite sempre). Ver
  `docs/50-FEDERACAO.md` §6.8.
- **PR 8** (acervo oficial): documento publicado não se edita nem se apaga —
  retificação (versão nova com motivo, a anterior em `versions[]`), errata,
  ato que altera ou revoga; retirar do ar só `admin`, com motivo, sem apagar.
  O link do arquivo existe só enquanto o documento é público (cada troca gera
  token novo); o restrito, até 9 MB, vai pela função (`file`). Arquivo novo só
  da pasta de quem salva. Ver `docs/50-FEDERACAO.md` §14.
- **Revisão de UX, Entrega 1** (2026-10-22): link público de torneio/clube é
  `tournamentPath(id, { inApp })` e `orgLink` (visitante sem conta nunca cai no
  login); cupons e loja só para quem entrou; torneios chancelados divididos por
  `splitSanctionedTournaments`; cancelar curso é do servidor (`cancel_course`,
  avisa os inscritos e cancela as cobranças); toda ação irreversível da
  Central confirma (`ConfirmDialog`, que aceita um campo de motivo); a
  suspensão disciplinar sobrevive a desistir e pedir de novo. Ver
  `docs/50-FEDERACAO.md` §20.
