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
│   ├── plans.js                 # validatePlanInput (tipo do catálogo; clube/arena sem idade nem desconto), planPrice, rótulos
│   ├── memberTypes.js           # Etapa 2: catálogo de tipos de filiação do admin (pessoa/clube/arena, grupo), cópia no servidor
│   ├── registry.js              # Etapa 3: abas por tipo, filtro filiado × cadastrado, partes da pasta, linha do tempo
│   ├── membership.js            # a CONTA da filiação: validade, renovação, estado, número, código, verificação
│   ├── charges.js               # estado da cobrança, resumo financeiro, CSV
│   ├── card.js                  # o que a carteirinha mostra (faixa com cor E texto), verifyPath
│   ├── federationPending.js     # "Precisa de você" da Central e da Minha área
│   ├── affiliations.js          # PR 2: pedido e decisão de filiação de clube/arena, contagens
│   ├── sanction.js              # PR 2: chancela do torneio (pedir, decidir, retirar) e a exigência "só filiados"
│   ├── officialRanking.js       # PR 2 (refeito 2026-10-22): lançamento de pontos por torneio, soma do ano, ano fechado em 31/01, histórico do atleta (cópia em functions/federationRanking.js)
│   ├── privateData.js           # PR 3: CPF (só se a federação pede), idade/faixa, menor e dependente, documentos exigidos (requiredDocs: fixos + "outros" com nome)
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
O ranking oficial é um LIVRO: cada torneio chancelado lança os pontos em
`federation_points/{resultId}_{uid}` (o histórico do atleta, que ele vê em
Minha filiação → Meus pontos no ranking, `FedMyPoints`); o ano soma os
lançamentos em `federation_rankings/{fed}_{ano}` e fecha em 31/01 do ano
seguinte — fechado, não muda (regra `fedSeasonOpen`, servidor e tela). Mudar a
tabela de pontos não reescreve o que já foi lançado (`docs/50` §6.3).

Coleções (`firestore.rules` § FEDERAÇÕES, provadas em
`tests/rules/federation.rules.test.js`): `federations` (+ `private/data`),
`federation_staff`, `federation_admin_grants` (PR 7), `federation_plans`, `federation_members` (+ `private/data`),
`federation_charges`, `federation_card_index`, `federation_affiliations`,
`federation_results`, `federation_rankings`, `federation_points` (`tests/rules/federationPr2.rules.test.js`);
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
usuários da plataforma, também na equipe); convite a CLUBE ou ARENA = o próprio
`federation_affiliations` com `status: 'invited'` (`buildAffiliationInvite`,
`inviteAffiliation`/`answerAffiliationInvite`, tela `manage/FedOrgInviteDialog.jsx`,
aceite em `OrgAffiliationCard.jsx`; `docs/50` §6.1); o interruptor de módulo grava só
`modules.x` (`setFederationModule`). Zero índice composto; os únicos campos novos
em coleção existente são os opcionais `tournaments.federation_id`/`federation_sanction`.

## O que não pode regredir

- **Contratos de patrocínio e patrimônio** (`docs/50` §34, módulos `sponsors`
  e `assets`): `federation_sponsor_contracts` e `federation_assets` **só o
  servidor grava** (callable `federationManagement` em
  `functions/federationManagement.js`, mais a varredura); régua em
  `domain/management.js` com cópia e paridade em
  `functions/federationManagementPolicy.js`. A parcela recebida entra nas
  contas UMA vez, derivada (`sponsorIncome` → `accountItems({ extraIncome })`,
  nos dois lados), não muda nem some numa edição e respeita o período fechado.
  Quem recebe empréstimo é texto, nunca uid. Telas em `management/` (seção
  Administração da Central). O **relatório anual** (`domain/annualReport.js`)
  e as **planilhas** (`domain/exports.js`) são zero banco: fonte que falhou é
  dita, nunca zero. Regras em `tests/rules/federationManagement.rules.test.js`.
- **Camada nacional (Bloco 6, `docs/50` §35):** a confederação (`federations.confederation`, marcada pelo admin da plataforma) tem as estaduais como filiadas. `federation_national_links` (vínculo) e `federation_dues` (anuidade) **só o servidor grava** (`functions/federationNational.js`; régua em `domain/national.js` com cópia e paridade em `functions/federationNationalPolicy.js`). O espelho `federations.national_body` dá o selo "Filiada à" e a aba pública "Federações filiadas"; o ranking nacional (`federation_rankings/{conf}_nacional_{ano}`) soma os lançamentos das filiadas; a troca entre estaduais da mesma rede passa por `homologation` (`TRANSFER_OPEN`); a anuidade paga é item derivado das contas das duas (`duesIncome`/`duesExpenses`). Telas: `FedNationalPanel.jsx` (seções Rede nacional e Confederação da Central).
- **Licença de professor e proteção de menores** (`docs/50` §33, módulos
  `coach_licenses` e `safeguarding`, permissão `safeguarding`): licença
  (`federation_coach_licenses`), selo público (`federation_coach_badges`) e
  registro da proteção (`federation_safeguarding`) **só o servidor grava**
  (callable `federationCoaching` em `functions/federationCoaching.js`, mais a
  varredura e o gatilho `federationMinorReportNotify`); régua em
  `domain/coachLicenses.js` e `domain/safeguarding.js` com cópia e paridade em
  `functions/federationCoachingPolicy.js`. A proteção de menores nunca se
  dispensa na licença; o arquivo da certidão é apagado na decisão; a denúncia
  `minor_protection` só a permissão `safeguarding` lê (a lista da disciplina
  filtra `kind in [...]`). Sem estar em dia, escala de arbitragem, licença e
  chancela com diretor são recusadas (`clearanceBlocker`). Telas em
  `coaching/` (Central, Minha área, selo no perfil do professor e aba Cursos);
  regras em `tests/rules/federationCoaching.rules.test.js`.
- **Seleção e editais** (`docs/50` §32, módulos `selection` e `grants`):
  convocação (`federation_callups`), convite (`federation_callup_members`),
  edital (`federation_grants`) e inscrição (`federation_grant_applications`)
  **só o servidor grava** (callable `federationSelection` em
  `functions/federationSelection.js`, mais a varredura); régua em
  `domain/selection.js` com cópia e paridade em
  `functions/federationSelectionPolicy.js`. Pelo ranking, recusar ou vencer o
  prazo chama o próximo sozinho. A delegação pública e o resultado do edital
  não levam uid; o financeiro não lê os convites. Custo pago da convocação e
  pagamento do edital entram nas contas como despesa derivada. Telas em
  `manage/FedSelectionPanel.jsx` e `selection/` (Central, página pública,
  Minha área); regras em `tests/rules/federationSelection.rules.test.js`.
- **Competições** (`docs/50` §31): o pedido de chancela é conferido pelo
  servidor (gatilho `federationSanctionSync` em `functions/federationCompetitions.js`):
  antecedência (`rules.sanction_min_days`), diretor credenciado
  (`rules.sanction_requires_director` + credencial `director` ativa) e a taxa
  da categoria (`tiers[].sanction_fee_cents` → cobrança `origin: 'sanction'`).
  O organizador nunca escreve as chaves conferidas (`tournamentFederationOk`).
  Relatório do diretor (`federation_tournament_reports`) e convites da final
  (`federation_final_invites`) **só o servidor grava** (callable
  `federationCompetition`); régua em `domain/competitions.js` com cópia e
  paridade em `functions/federationCompetitionsPolicy.js`. Na regra, "alguma
  destas permissões" é `fedAny(fid, [...])`. Telas em
  `TournamentSanctionCard.jsx`, `manage/FedCompetitionsPanel.jsx`,
  `competitions/` (relatório, premiação, final, Minha área); regras em
  `tests/rules/federationCompetitions.rules.test.js`.
- **Regularidade do filiado** (`docs/50` §30): validade dos documentos
  (`doc_validity` no plano, `valid_until` gravado pela secretaria), nível
  oficial com histórico e pedido de revisão, autorizações (LGPD) e o seguro
  com ocorrências (módulo `insurance`, `federation_incidents`). `docs_state`,
  `docs_block`, `official_level*`, `level_review` e `consents*` **só o
  servidor grava** (`functions/federationRegularity.js`; régua em
  `domain/regularity.js` com cópia e paridade em
  `functions/federationRegularityPolicy.js`). A trava de documento vencido só
  vale com `rules.block_expired_docs`, e vale na regra (`fedMemberOk`). A
  cobertura olha `membershipState(...).status`. Telas em
  `v2/components/federations/FedRegularity.jsx` e
  `manage/FedInsurancePanel.jsx`; regras provadas em
  `tests/rules/federationRegularity.rules.test.js`.
- **Arbitragem** (módulo `referees`, `docs/50` §22): `federation_referees` e
  `federation_assignments` **só o servidor grava** (`functions/federationReferees.js`,
  régua em `domain/referees.js` com cópia e paridade em
  `functions/federationRefereesPolicy.js`; `federations.referee_rules` em
  `fedLocked()`). O árbitro lê só o seu, a equipe `courses`/`admin` lê tudo, as
  notas (`private/staff`) só a equipe. Alerta de impedimento **avisa, não
  bloqueia**. O público vê só pela função `federationRefereesPublic` (quem
  aceitou aparecer + confirmados de evento público, nome e função) — nunca
  valor, nota, conflito nem disponibilidade. Diária paga vira despesa por
  `refereeFeesAsExpenses`. Funções, situações e ids de nível são gravados.
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
- **Contas** (módulo `accounts`, `docs/50-FEDERACAO.md` §22): orçamento,
  lançamentos e prestação de contas **só o servidor grava**
  (`functions/federationAccounts.js`, régua em `federationAccountsPolicy.js`
  com paridade contra `domain/accounts.js`); a cobrança paga entra sozinha
  como receita (nunca lance de novo); o retrato da prestação **congela** no
  envio ao conselho e fecha o período; publicar exige o parecer; o público
  só lê `pub == true` e o lançamento nunca; categorias e `?aba=`
  (`orcamento`, `orcamento-anual`, `lancamentos`, `prestacao-contas`) são
  contrato. `extraExpenses`/`despesasDerivadas()` é onde a arbitragem entra.
  O **extrato bancário** (OFX ou CSV) é lido na tela por `domain/bankStatement.js`
  e gravado pela ação `entry_import`: a identidade do movimento (`bank_ref`)
  vira o id do lançamento, então importar de novo não duplica — nunca troque
  a forma de montar o `bank_ref` (o mesmo extrato passaria a entrar duas vezes).
- **Revisão de UX, Entrega 1** (2026-10-22): link público de torneio/clube é
  `tournamentPath(id, { inApp })` e `orgLink` (visitante sem conta nunca cai no
  login); cupons e loja só para quem entrou; torneios chancelados divididos por
  `splitSanctionedTournaments`; cancelar curso é do servidor (`cancel_course`,
  avisa os inscritos e cancela as cobranças); toda ação irreversível da
  Central confirma (`ConfirmDialog`, que aceita um campo de motivo); a
  suspensão disciplinar sobrevive a desistir e pedir de novo. Ver
  `docs/50-FEDERACAO.md` §20.
- **Revisão de UX, Entregas 2–4** (2026-10-22): listas da Central com busca,
  filtros na URL e "Mostrar mais" (`manage/listTools.jsx`); aviso de alteração
  não salva (`manage/naoSalvo.js`); CSV para o Excel brasileiro; recibo da
  cobrança paga (`chargeReceipt` + `FedReceipt.jsx`); `renewalOpensOn`;
  lembrete de cobrança vencida na varredura (`overdue_notified`); "Em vigor" só
  em norma (`docHasValidity`); `whatsappLink`; "Filiar-se neste plano"
  (`?plano=`). Ver `docs/50-FEDERACAO.md` §21.
- **Eleições** (módulo `elections`, 2026-10-22): `domain/elections.js` (cópia
  de `functions/federationElectionsPolicy.js`, com paridade), função
  `federationElections`, telas em `v2/components/federations/elections/` e
  Central → Eleições. **O voto é secreto**: `federation_ballots` sem uid, id
  aleatório, gravada na mesma transação que marca o eleitor; ninguém lê pelo
  cliente; a tela mostra só % de participação e o resultado só em pesos. Quem
  conduz é a comissão (`fedElRun` na regra; sem comissão, o admin). O colégio
  congela na abertura. Edital e ata vão ao acervo (`publicarAtoDeTexto`). Ver
  `docs/50-FEDERACAO.md` §22.
- **Tipos de filiação e clube/arena por plano** (Etapa 2, 2026-10-22): o
  catálogo de tipos é do admin da plataforma (`platform_settings/federations`,
  `domain/memberTypes.js` com cópia em `functions/federationMemberTypes.js` e
  paridade); o plano grava o tipo resolvido e o servidor relê o catálogo no
  pedido. A filiação da entidade é `{fed}_{club|arena}_{org}` com `user_id`
  nulo: "é o dono?" inclui quem gere a entidade (`fedMemberOwner` →
  `fedOrgManager`), a cobrança vai ao representante (`represent` troca) e o
  espelho em `federation_affiliations` (com `member_id`) só o servidor grava
  (`functions/federationOrgMembers.js`). Telas: `OrgMembershipJoin`
  (`/federacoes/:id/filiar?entidade=club:ID`), `AdminFederationsConfig`. Ver
  `docs/50-FEDERACAO.md` §26.
- **Filiados e cadastrados e a pasta** (Etapa 3, 2026-10-22): o Cadastro tem
  uma aba por tipo (`domain/registry.js`, `?tipo=`/`?vinculo=`) e cada filiação
  abre uma PASTA (`?pasta=`, `FedMemberFolder`) com as partes do tipo. Cada
  parte consulta só com a permissão da regra (`hooks/useMemberFolder.js`) e,
  sem ela, diz quem vê. O "Já paguei" aceita comprovante (`declared_proof`,
  arquivo na pasta do pagador), que a equipe abre por `federationDocument`
  com `chargeId` (auditado). Ver `docs/50-FEDERACAO.md` §27.
- **Categorias de torneio e torneio da federação** (Etapa 4, 2026-10-22):
  `ranking_config.tiers[]` (sigla, grupo, tabela até o 64º, participação,
  requisitos, ativa) em `domain/officialRanking.js` (`normalizeRankingConfig`,
  `tierOptions`, `validateTiers`, `tierTableFromChampion`), com cópia e
  paridade no servidor; sem categorias próprias, as três padrão são derivadas
  como antes. A chancela grava a categoria (`resolveSanctionTier`) e a origem
  (`origin: 'federation'` = "Realizado pela"); `startFederationTournament`
  cria o torneio já realizado pela federação (`/torneios/criar?federacao=`,
  `FedTournamentOrigin`). Telas: `FedTiersEditor`, `FedTierRequirements`.
  O `id` da categoria é gravado: nunca renomeie. Ver `docs/50-FEDERACAO.md` §28.
- **Configuração geral no painel do admin** (Etapa 5, 2026-10-22): Painel
  admin → Federações → Configuração em quatro abas (`?parte=`): tipos de
  filiação, documentos sugeridos (`doc_kinds[]`, atalho no plano que copia o
  nome para `other_docs[]` com id `c_<id>`), modelos de categorias de torneio
  (`tournament_tier_templates[]`, `{SIGLA}` vira a sigla ao copiar em
  Competições → Ranking) e módulos que nascem ligados (`default_modules`,
  aplicados pelo servidor na primeira aprovação em `federationReview`).
  Domínio em `domain/platformCatalog.js`; gravação por
  `saveFederationPlatformCatalog`. Mudar a configuração não mexe no que as
  federações já gravaram. Ver `docs/50-FEDERACAO.md` §29.
- **Revisão de uso** (2026-10-22): filiado paga e cadastrado é gratuito
  (`validatePlanInput`); plano por faixa de idade exige o nascimento (cliente e
  servidor); plano de clube/arena não oferece o botão de pessoa; o espelho de
  entidade leva `tier` (selo "Cadastrado"/"Filiado"); `personTypeLabel` aceita o
  catálogo; a pasta lista os documentos exigidos. Ver `docs/50-FEDERACAO.md` §29.6.
