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
│   ├── staff.js                 # papel → permissões, canChangeStaff (presidente só por presidente)
│   ├── plans.js                 # validatePlanInput, planPrice (descontos por idade), rótulos
│   ├── membership.js            # a CONTA da filiação: validade, renovação, estado, número, código, verificação
│   ├── charges.js               # estado da cobrança, resumo financeiro, CSV
│   ├── card.js                  # o que a carteirinha mostra (faixa com cor E texto), verifyPath
│   ├── federationPending.js     # "Precisa de você" da Central e da Minha área
│   ├── affiliations.js          # PR 2: pedido e decisão de filiação de clube/arena, contagens
│   ├── sanction.js              # PR 2: chancela do torneio (pedir, decidir, retirar) e a exigência "só filiados"
│   └── officialRanking.js       # PR 2: a CONTA do ranking oficial (cópia em functions/federationRanking.js)
├── services/
│   ├── federationService.js     # leituras (uma igualdade, ordenação em memória), escritas da regra
│   │                            # (pedido, página, Pix, módulos, equipe, planos, preferências, "Já paguei")
│   │                            # e as chamadas ao servidor (reviewFederation, membershipAction, chargeAction, verifyCard)
│   └── federationExportService.js  # o bloco `federations` da exportação de dados
├── hooks/useFederations.js      # chaves em `fedKeys`; useMyFederationRole, useMyMemberships, useCardVerification…
└── i18n/locales/{en,es}.js      # 687 chaves (inclui os avisos do servidor e os textos dos cartões fora do módulo)
```

Telas: `src/v2/pages/V2Federations.jsx` (`/federacoes`), `V2FederationApply`
(`/federacoes/abrir`), `V2FederationDetail` (`/federacoes/:id`),
`V2FederationJoin` (`/federacoes/:id/filiar`), `V2FederationManage`
(`/federacoes/:id/gerir?aba=`, painéis em `src/v2/components/federations/manage/`);
públicas V1 `src/pages/PublicFederation.jsx` (`/f/:slug`) e
`PublicFederationVerify.jsx` (`/f/verificar/:codigo?`); Minha área → Federações
(`UserAreaSections.jsx`); Painel admin → Federações
(`src/v2/components/admin/federations/AdminFederationsPanel.jsx`).

Fora do módulo, mas dele (`src/v2/components/federations/`): `FedPublicBlocks.jsx`
(torneios chancelados, ranking, clubes/arenas na página da federação),
`FedTags.jsx` (selos), `OrgAffiliationCard.jsx` (gestão do clube e Central da
arena → Federação), `TournamentSanctionCard.jsx` (gestão do torneio → Geral),
`FederationResultButton.jsx` (resultados do torneio); e a trava "só filiados"
em `ModalityRegistrationDialog.jsx` (`membershipRequirement`).

Servidor: `functions/federations.js` (`federationReview`,
`federationMembership`, `federationChargeConfirm`, `federationVerify`,
`federationMembershipSweep`) e `functions/federationMembership.js` — **cópia**
de `domain/membership.js` com paridade em
`functions/federationMembership.parity.test.js`; `functions/federationRanking.js`
(`federationRankingRecompute`, `federationRankingConfig`) — **cópia** de
`domain/officialRanking.js` com paridade em `federationRanking.parity.test.js`.

Coleções (`firestore.rules` § FEDERAÇÕES, provadas em
`tests/rules/federation.rules.test.js`): `federations` (+ `private/data`),
`federation_staff`, `federation_plans`, `federation_members` (+ `private/data`),
`federation_charges`, `federation_card_index`, `federation_affiliations`,
`federation_results`, `federation_rankings` (`tests/rules/federationPr2.rules.test.js`).
Zero índice composto; os únicos campos novos em coleção existente são os
opcionais `tournaments.federation_id`/`federation_sanction`.

## O que não pode regredir

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
