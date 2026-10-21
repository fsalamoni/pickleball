# 50 — Federações: filiação, carteirinha digital e a Central da federação

> Flag **`federations`** (default OFF; só o admin da plataforma liga, em Painel
> admin → Funcionalidades → "Federações"). Documento de referência do que o
> código faz **hoje** (PR 1 da frente de federação). O desenho completo, com
> as decisões D1–D16 e as fases seguintes, está fora do repositório em
> `/mnt/project-files/federacao/proposta-gestao-de-federacao.md`.
>
> Módulo: `src/modules/federations/` (README é a fonte dos arquivos). Telas:
> `src/v2/pages/V2Federation*.jsx`, `src/v2/components/federations/`,
> `src/pages/PublicFederation*.jsx`. Servidor: `functions/federations.js`.

---

## 1. O que é

A **federação** é uma entidade própria (com CNPJ) que filia atletas,
professores e árbitros de uma região, cobra mensalidade ou anuidade por Pix
**na própria conta** e emite a **carteirinha digital** com verificação
pública. A plataforma organiza o pedido, a cobrança e a carteirinha; **não
recebe dinheiro, não repassa e não cobra taxa**. Pode haver mais de uma
federação por estado; o admin da plataforma marca a reconhecida como
"Oficial".

O que esta entrega cobre:

| Frente | Onde |
|---|---|
| Abrir a federação (qualquer conta pede; o admin aprova) | `/federacoes/abrir` → Painel admin → Federações |
| Diretório e página de cada federação no app | `/federacoes`, `/federacoes/:id` |
| Página pública sem conta | `/f/:slug` |
| Planos de filiação (mensal/anual, cadastrado/federado, por tipo de pessoa, idade, descontos) | Central → Configurações → Planos |
| Pedido de filiação, aprovação, cobrança Pix, "Já paguei", confirmação | `/federacoes/:id/filiar`, Central → Filiados / Financeiro |
| Carteirinha digital (PNG, imprimir, compartilhar) e verificação pelo QR | Minha área → Federações, página da federação, `/f/verificar/:codigo` |
| Equipe com 8 papéis e permissões | Central → Equipe |
| Sub-módulos que cada federação liga para si | Central → Configurações → Módulos (os nove do catálogo, todos `available`) |
| Indicadores dos últimos 12 meses (filiados, renovação, receita, atraso), com CSV | Central → Gerir → Indicadores (§6.8) |
| Declaração de vínculo imprimível, com QR | página da federação, Minha área → Federações, Central → Filiados (§6.8) |
| Avisos (sino, e por e-mail/celular quando `external_messaging` estiver ligada) | categoria "Federações" em Configurações → Notificações |
| Exclusão de conta e exportação de dados | `functions/accountDeletion.js`, `federationExportService.js` |
| Ajuda, guias com seta, pontos de dica, en/es, termos legais | §9 |

Os sub-módulos entregues nos PRs 2 a 4 (torneios chancelados, ranking
oficial, clubes e arenas filiados, cursos e credenciais, disciplina e
ouvidoria, notícias, patrocinadores, cupons e campanhas, loja oficial) estão
`available` — hoje os nove do catálogo. Módulo novo nasce `planned` ("em
breve") e `FED_MODULE_META[x].status` só muda quando a tela existir.

## 2. Duas chaves: a flag e os módulos da federação

1. **`FEATURE_FLAG.FEDERATIONS`** (`federations`) é o interruptor geral.
   Desligada: a tela não mostra nada (hub "Competir" sem o item, Minha área
   sem a seção, Painel admin sem a seção, `/federacoes*` e `/f/*` redirecionam
   para o início via `FederationGate`), e a **regra recusa toda escrita** nas
   coleções `federation*` (`fedOn()` lê `platform_settings/global.feature_flags.federations`).
   As Cloud Functions também conferem (`flagLigada`). **Nada é apagado** ao
   desligar; religar devolve tudo.
2. **`federations/{id}.modules`** (`{ [FED_MODULE]: boolean }`) é o que **cada
   federação** liga para si, em Configurações → Módulos. Desde o PR 2 três
   módulos têm tela (`status: 'available'`): **`tournaments`** (chancela de
   torneios e envio de resultados), **`ranking`** (ranking oficial) e
   **`affiliations`** (clubes e arenas filiados); do PR 3, **`courses`** e
   **`discipline`**; do PR 4, **`news`** (notícias e avisos), **`sponsors`**
   (patrocinadores), **`promos`** (cupons e campanhas) e **`store`** (loja
   oficial no Mercado) — os nove do catálogo. Módulo novo nasce `planned` ("Em breve"). A tela de cada módulo pergunta `fedModuleOn(federation, x)`
   (`domain/federation.js`), e a **regra também pergunta** (`fedModuleOn()` no
   `firestore.rules`): módulo desligado ⇒ ninguém pede filiação de clube/arena
   nem chancela àquela federação. Desligar um módulo não apaga nada: o que
   está gravado (filiações aprovadas, chancelas, resultados, ranking) deixa de
   aparecer e volta ao religar.

A filiação, a cobrança e a carteirinha **não** são módulo: toda federação
aprovada tem.

## 3. Quem é quem

| Perfil | Como é reconhecido | O que faz |
|---|---|---|
| **Quem pede a abertura** | `federations.created_by == uid` | Lê a própria federação pendente/recusada, edita `private/data` enquanto pendente, corrige e pede de novo |
| **Equipe** (`federation_staff/{fedId}_{uid}`) | um **cargo** da federação (`federations.staff_roles`, ou os 8 de modelo enquanto a federação não monta os seus) e um **mandato**; a regra lê a cópia `perms` do documento (`fedPerms`) e, sem ela, o mapa dos 8 papéis (`fedRolePerms`) | o que o cargo abre (`admin`, `members`, `finance`, `competitions`, `courses`, `discipline`, `comms`, `staff`); o **admin master** tem tudo. Mandato vencido não dá poder — salvo ao último admin master (§13) |
| **Filiado** (`federation_members/{fedId}_{uid}`) | `user_id == uid` | Lê a própria filiação e cobranças, muda só as próprias preferências (`public_badge`, `show_in_directory`, `public_photo`), declara o pagamento ("Já paguei"), pede renovação e cancela |
| **Visitante** | sem conta | Lê federação aprovada e planos (`/f/:slug`) e verifica carteirinha (`federationVerify`) |
| **Admin da plataforma** | `isPlatformAdmin()`; dentro da Central, só com o **acesso justificado** valendo (`fedPlat`) | Aprova/recusa/suspende a federação e dá os selos (pelo servidor); para agir na Central ou ler dado pessoal informa motivo e prazo (§13) |

Desde a Etapa 1 do acervo (PR 7) **só o servidor grava a equipe** (`federationStaff`; a regra de
`federation_staff` é `allow write: if false`). Só admin master monta os cargos,
mexe em admin master e passa a administração; quem tem a permissão `staff`
nomeia, prorroga e tira pessoas de cargos que não são admin master, nunca a si
mesmo, e só dá permissões que tem. Sempre fica pelo menos um admin master.
Detalhe em §13.

## 4. O ciclo da federação

```
pedido (/federacoes/abrir)  ──►  pending  ──admin aprova──►  approved
   CNPJ, razão social e notas          │                        │ (quem pediu vira president)
   em federations/{id}/private/data    ├─admin recusa──► rejected (motivo em `review.reason`;
   em público só `cnpj_masked`         │                 a pessoa corrige e pede de novo)
                                       └─admin suspende─► suspended (página fecha, filiações param)
```

- `applyFederation` grava o documento público (nome, sigla, `slug` único,
  abrangência `state|regional|national`, UF, cidade, sobre, site, Instagram,
  contato público, `branding`, `payment: {}`, `modules`) e o privado. A regra
  exige `status: 'pending'`, `verified`/`official` falsos e nenhum campo
  travado (`fedLocked()`: status, selos, contadores, `review`, `cnpj_masked`).
- Aprovar, recusar, suspender, verificar e marcar oficial é a função
  **`federationReview`** (só o admin). Aprovar cria `federation_staff/{fed}_{uid}`
  com `president`, grava `review` e avisa. A equipe edita página, Pix, marca e
  módulos pela regra (permissão `admin`), **nunca** os campos travados.
- Enquanto `pending`, a Central já abre para quem pediu preparar planos, Pix e
  página; a filiação só abre em `approved` (regra `fedApproved`).

## 5. Planos, filiação, cobrança e carteirinha

### 5.1 Plano (`federation_plans`, público)
Por **tipo de pessoa** (`athlete|coach|referee`), **vínculo** (`registered` =
gratuito, só consta; `federated` = pontua no ranking oficial), **cobrança**
(`monthly|annual`), **validade** (`rolling` = 12 meses a partir do pagamento;
`calendar` = até `rollover_mmdd` com `calendar_grace_days`, padrão 60: quem
paga a menos de N dias da virada já vale para a temporada seguinte),
`price_cents` (0 = gratuito), faixa de idade (`age_min`/`age_max`), descontos
(`minor_pct`, `senior_pct`, `family_pct`), `auto_approve`, `active`. Quem cria
e edita: `admin` ou `finance`. Plano não se apaga (filiações apontam para ele):
desativa.

### 5.2 Filiação (`federation_members/{fedId}_{uid}`, **nunca pública**)
Só o servidor cria e muda o estado (`federationMembership`, ações `request`,
`renew`, `cancel` da própria pessoa; `approve`, `reject`, `suspend`,
`reinstate` da secretaria — permissão `members`).

```
request ─► pending ──approve──► (gratuito) active
                   │             (pago) awaiting_payment ──cobrança paga──► active
                   └─reject──► rejected (pode pedir de novo)
active ──data passa (varredura 06:00)──► expired ──renew + pagar──► active
active/expired ──suspend (motivo)──► suspended ──reinstate──► volta ao estado pela data
qualquer vivo ──cancel (a pessoa)──► cancelled
```

Com `auto_approve`: gratuito ativa na hora; pago nasce `awaiting_payment` com
a cobrança. O pedido confere no servidor: federação aprovada, plano ativo,
idade do perfil contra a faixa do plano, nenhuma filiação viva. O pedido leva
**nome, foto, tipo, vínculo, plano, preferências, clube representado e
observação** — e-mail, telefone, nascimento e endereço **não** vão.

**Dados privados, menores e dependentes (PR 3, `domain/privateData.js`).** O
CPF só é pedido se a federação ligou `rules.ask_cpf` (Configurações → Regras)
e vai para `federation_members/{id}/private/data` (só dígitos, validado por
`isValidCpf`), junto com nascimento e responsável — **nunca** no documento da
filiação. Na Central ele aparece **mascarado**; "Revelar" exige motivo e grava
`audit_logs` (`federation_member_private_reveal`). Menor de 18 (`MINOR_AGE`) é
menor; **menor de 12** (`GUARDIAN_ONLY_AGE`) só entra como **dependente**
(`/federacoes/:id/filiar?dependente=1`): a filiação é `{fed}_dep_{id}`, com
`user_id` nulo e `guardian_uid` do responsável, que paga por ele e responde
pelas preferências (`fedMemberOwner` na regra); de 12 a 17 a pessoa pede
sozinha, com o responsável ciente, e a foto do menor só sai na verificação
pública com `minor_photo_consent`. Quem **já é federado em outra federação**
não pede filiação nova: só entra por **transferência** (§6.4). O plano pode
exigir **documentos** (`requires_docs[]`: identidade, atestado, comprovante de
residência, autorização do responsável, outro): a pessoa envia pela página da
federação (`FedMemberDocuments`, Storage `federacao/{uid}/`, PDF ou imagem
< 5 MB, registro em `federation_documents_submitted`) e a secretaria aceita ou
recusa (aba Documentos; o arquivo chega pela função `federationDocument`).

Ao ativar: o **número** sai de `federations.member_counter` numa transação
(`SIGLA-ANO-000001`, `formatMemberNumber`); `valid_from`/`valid_until` pela
conta do plano (`computeValidUntil`); a renovação começa no **fim da validade
atual** (`renewalStart`), nunca antes. A conta vive em
`domain/membership.js` e tem **cópia no servidor**
(`functions/federationMembership.js`) com teste de paridade.

### 5.3 Cobrança (`federation_charges`)
Só o servidor cria (`novaCobranca`: `amount_cents`, `plan_*`, `origin`
`membership|renewal|course|fine`, `due_date` = hoje + 10 dias, `status: 'open'`;
o pagador é a pessoa ou o **responsável** do dependente). O valor da filiação
já vem com o desconto do plano (menor, 60+, família — `planPrice`, com cópia no
servidor). Confirmar uma cobrança de **curso** confirma a inscrição; de
**multa**, quita a sanção (§6.5–6.6). A pessoa
paga pelo app do banco (QR e "copia e cola" montados por `buildPixPayload`,
do torneio, via `chargePixPayload`) e **declara** ("Já paguei" → `declared`, com
observação; é a única escrita do pagador na regra). O financeiro
(`federationChargeConfirm`, permissão `finance`) **confirma** (`paid`, ativa
ou renova a filiação, emite a carteirinha, avisa) ou **cancela** (`cancelled`,
devolve o pedido ao estado anterior). Recibo, nota e tributos são da
federação.

### 5.4 Carteirinha e verificação
`card_code`: 10 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(sem 0/O/1/I), gerado no servidor e **girado a cada ativação, renovação e
suspensão** — uma carteirinha antiga clonada deixa de verificar. O índice
`federation_card_index/{code}` → `{ member_id, federation_id }` só o servidor
lê e escreve. A verificação (`federationVerify`, sem conta, `/f/verificar/:codigo`)
devolve o **mínimo** (`publicVerification`): nome, foto (se `public_photo`),
federação, vínculo, número, validade e se está em dia — nada mais. A carteirinha
(`MemberCard`, `buildMemberCard`) tem faixa de situação com cor **e texto**,
Compartilhar / PNG / Imprimir, e sai sempre clara na imagem (`tema-claro`).

### 5.5 Varredura diária (`federationMembershipSweep`, 06:00 Brasília)
`active` → `expired` na data; avisos 30, 7 e 1 dia antes (uma vez cada,
`expiry_notified`); recontagem de `member_count` por federação; e, do PR 3,
**libera as transferências de federação sem resposta no prazo**
(`federationTransfers.sweep`). A suspensão disciplinar **não** depende dela:
termina sozinha na data gravada (`discipline_until_ms`, lido pela regra).

## 6. As telas

| Rota | Tela | O que mostra |
|---|---|---|
| `/federacoes` | `V2Federations` | "Suas federações" (filiado ou equipe, com "Gerir"), todas as aprovadas (as da região primeiro, `useRegionalList`; a busca ignora a região), "Abrir uma federação" |
| `/federacoes/abrir` | `V2FederationApply` | Formulário (campos públicos em `FederationPublicFields` + dados da entidade), estado do pedido (em análise / aprovada / recusada com motivo) |
| `/federacoes/:id` | `V2FederationDetail` | Marca, selos, contagem, planos (`PlansList`), sobre, contato e **a situação da pessoa** (`MinhaSituacao`: filiar-se, cobrança Pix, renovar, carteirinha); "Gerir" para a equipe. Com os módulos ligados (`FedPublicBlocks.jsx`): **Torneios chancelados** (`FedSanctionedTournaments`), **Ranking oficial** (`FedRankingBlock`: temporada, classe, paginação, a minha linha em destaque), **Cursos** (`FedCoursesSection`, inscrever-se/cancelar), **Credenciados** (`FedCredentialsDirectory`, só credenciais válidas que a pessoa tornou públicas), **Clubes e arenas filiados** (`FedAffiliatesSection`) e **Ouvidoria** (`FedOmbudsmanBlock`: abrir manifestação, consultar protocolo). Para o filiado (PR 3): aviso de suspensão disciplinar, **Documentos** (`FedMemberDocuments`), **Sanções** (`FedMySanctions`, com recurso), **Transferência** (`FedTransferDialog`) e "Filiar um dependente" |
| `/federacoes/:id/filiar` | `V2FederationJoin` | 1. tipo de filiação → 2. plano (preço com o desconto da pessoa; faixa de idade exige nascimento no perfil) → 3. preferências, clube, observação, termos → pedido. PR 3: CPF se a federação pede (`federationAsksCpf`), responsável ciente para 12–17, menor de 12 só com `?dependente=1` (nome, nascimento e dados do dependente, na conta do responsável), documentos exigidos listados antes de enviar |
| `/federacoes/:id/gerir?aba=` | `V2FederationManage` | A Central: **Atender** (Hoje · Filiados: Pedidos, Filiados, **Clubes e arenas** [módulo `affiliations`], **Transferências**, **Documentos**, **Importar** [`FedSecretariatPanel`] · **Competições** [permissão `competitions`; módulos `tournaments`/`ranking`]: Chancelas, Resultados, Ranking · **Cursos** [permissão `courses`; módulo `courses`; `FedCoursesPanel`]: Cursos, Credenciais · **Disciplina** [permissão `discipline`; módulo `discipline`; `FedDisciplinePanel`]: Sanções, Ouvidoria · **Comunicação** [permissão `comms`; PR 4]: **Notícias** [módulo `news`], **Cupons e campanhas** [módulo `promos`], **Patrocinadores** [`admin` + módulo `sponsors`] · Financeiro: Cobranças, Recebidos) e **Gerir** (Equipe · Configurações: Planos, Recebimento, Página, Módulos, **Regras**, **Governança**, **Loja** [`admin`/`finance` + módulo `store`]). A seção só existe para quem tem a permissão e a aba de módulo só com o módulo ligado (`buildFederationSections(perms, federation)`); a aba mora na URL (`?aba=`; `?secao=` abre a primeira). Faixa "Precisa de você" (`FederationPendencias` ← `federationPendingItems`: pedidos, pagamentos, **clubes/arenas pedindo**, **chancelas para analisar**, transferências para responder, documentos para conferir, recursos de sanção, manifestações sem resposta) no topo |
| `/f/:slug` | `PublicFederation` (V1, fora do V2Layout) | A página pública: marca, planos, chamada para entrar/filiar-se; com os módulos ligados, torneios chancelados, ranking oficial e clubes/arenas filiados (os mesmos blocos do detalhe); do PR 4, notícias públicas, promoções, patrocinadores, governança e o link da loja oficial (`FedCommsBlocks.jsx`) |
| Início → card **Federação** | `HomeFederationCard` (`home_cards`, opcional, só com a flag) | Até 3 filiações (as que pedem pagar ou renovar primeiro, `homeFederationRows`) e a última notícia de cada federação |
| Gestão do clube → Federação | `OrgAffiliationCard kind="club"` (`V2ClubAdmin`) | Pedir filiação a uma federação com `affiliations` ligado (mensagem ≤ 500), acompanhar (pendente/aprovada/recusada/suspensa com motivo), retirar o pedido ou desfiliar |
| Central da arena → Equipe e parceiros → **Federação** (`?aba=federacao`) | `OrgAffiliationCard kind="arena"` (`V2ArenaManage`, aba só com a flag) | O mesmo cartão para a arena |
| Página do clube / da arena | `OrgAffiliationBadges` (`FedTags.jsx`) | Selo "Filiado · SIGLA" (só filiação **aprovada**), ligando à federação |
| Gestão do torneio → Geral → **Federação** | `TournamentSanctionCard` (`TournamentAdminTab`) | Pedir a chancela: federação com `tournaments` ligado, tipo proposto (regional/estadual/principal) e "Só filiados em dia se inscrevem"; estado e motivo; retirar o pedido pendente |
| Torneio (hero, cartão da lista, página pública `/p/:id`) | `TournamentSanctionBadge` | Selo "Chancelado · SIGLA" (+ "só filiados"), só com a chancela **aprovada** |
| Resultados do torneio (gestão, por categoria) | `FederationResultButton` (ao lado do `PodiumBlock`) | Com a chancela aprovada e a categoria **completa** (`isModalityComplete`): "Enviar ao ranking oficial" / "Reenviar"; mostra "No ranking desde…" ou "recusado: motivo" |
| Inscrição numa modalidade | `ModalityRegistrationDialog` | Torneio "só filiados": `membershipRequirement(tournament, minhasFiliacoes)` — sem filiação em dia, aviso vermelho com link à federação e **sem botão de inscrever**; consulta falhando ⇒ "não deu para conferir" + tentar de novo (nunca afirma que a pessoa não é filiada). O organizador inscreve qualquer pessoa |
| `/f/verificar/:codigo?` | `PublicFederationVerify` | Digitar/ler o código → em dia / irregular / não encontrada; o mesmo código verifica a **credencial** de curso (PR 3: nome, foto se permitida, tipo, curso, emissão, validade) |
| Minha área → Federações | `FederacoesSecao` | Cobranças para pagar, filiações (carteirinha, renovar), equipe; pendências na faixa (`myFederationPending`). PR 3: transferências pendentes, **dependentes** filiados, **credenciais** (tornar pública/privada, verificar) e sanções |
| Painel admin → Federações | `AdminFederationsPanel` | Filtros por estado, aprovar/recusar/suspender com motivo, selos, dados da entidade; na caixa de entrada do admin, "Federações esperando aprovação" |

Os valores de `?aba=` da Central (`pedidos`, `filiados`, `filiados-orgs`,
`transferencias`, `documentos`, `importar`, `chancelas`, `resultados`,
`ranking`, `cursos`, `credenciais`, `sancoes`, `ouvidoria`, `cobrancas`,
`recebidos`, `equipe`, `planos`, `pix`, `pagina`, `modulos`, `regras`, `hoje`
e, do PR 4, `noticias`, `divulgacao`, `patrocinadores`, `governanca`, `loja`)
são **contrato de link**: os avisos levam a eles (pedido de clube/arena →
`filiados-orgs`; pedido de chancela → `chancelas`; transferência →
`transferencias`; recurso → `sancoes`; manifestação → `ouvidoria`). Nunca
renomeie. O mesmo vale para `?aba=federacao`
da Central da arena.

### 6.1 Clubes e arenas filiados (módulo `affiliations`)

Quem administra o clube (`isClubAdmin`) ou gere a arena (`isArenaManager`) pede
— a regra confere os dois (`fedOrgManager(kind, orgId)`), e só com o módulo
ligado na federação. O pedido é `federation_affiliations/{fedId}_{kind}_{orgId}`
(`buildAffiliationRequest`, `domain/affiliations.js`): nome, cidade, UF e logo
da organização **copiados** (a página da federação não lê `clubs`/`arenas`),
`status: 'pending'`, mensagem ≤ 500. A equipe com `members` ou `admin` decide
(`affiliationDecision`: aprovar, recusar com motivo ≥ 3, suspender com motivo;
reintegrar = aprovar de novo) só nas chaves `status`/`review`/`updated_at`.
**Pedido recusado ou suspenso pode ser refeito**: o serviço apaga o documento
antigo e cria o novo (mesmo id). Aprovada é **pública** (a lista da federação e
o selo); pendente/recusada só quem pediu, quem gere a organização e a equipe.
Quem gere a organização pode apagar (retirar o pedido ou desfiliar). Avisos:
à equipe (`?aba=filiados-orgs`) e a quem pediu (link ao clube/arena).

### 6.2 Chancela de torneio (módulo `tournaments`)

Dois campos **opcionais** em `tournaments/{id}` — os primeiros campos novos
em coleção existente da federação: `federation_id` e `federation_sanction
{ status, federation_name, federation_acronym, tier, requires_membership,
requested_by, requested_at_ms, decided_by, decided_at_ms, reason }`
(`buildSanctionRequest`, `domain/sanction.js`). Ausentes, nada muda. A regra:

- o **organizador** só grava o par como `pending` (`tournamentFederationOk()`:
  flag ligada, módulo `tournaments` ligado na federação, `requested_by` = ele)
  ou apaga os dois (`SANCTION_WITHDRAW_PATCH`, só pendente); nunca escreve
  `approved`;
- a **equipe com `competitions`** decide (`sanctionDecision`: aprovar — podendo
  trocar `tier` e `requires_membership` —, recusar, revogar; motivo ≥ 3 nos
  dois últimos) só em `federation_sanction`/`updated_at`, sem mudar
  `federation_id`, e só para `approved|rejected|revoked`;
- **"só filiados"** vale na regra da inscrição: `tournament_registrations`
  criada pela própria pessoa exige `tournamentMembershipOk(tid)` —
  `federation_members/{fed}_{uid}.status == 'active'` quando a chancela está
  aprovada com `requires_membership`. O organizador (`isTournamentAdmin`)
  inscreve qualquer pessoa, como antes.

`sanctionState(tournament)` é a leitura única (status, sigla, `approved`,
`requiresMembership`, `canRequest`, `canWithdraw`). O **peso** (`tier`:
regional ×1, estadual ×1,5, principal ×2 por padrão) é o multiplicador dos
pontos no ranking.

### 6.3 Resultado e ranking oficial (módulos `tournaments` e `ranking`)

- **Envio** (`sendFederationResult`): `federation_results/{fed}_{torneio}_{modalidade}`
  com a colocação de `modalityPlacement` (**a mesma do pódio e dos cartões**;
  nunca outra conta), `rows[] { uid, name, photo_url, position, played, won }`
  (≤ 400, uma linha por **pessoa**, via `registrationAllPeople`), `uids[]`,
  `gender_category`, `age_category`, `format`, `tier`, `date`, `season` (ano
  do fim do torneio), `status: 'sent'`. Só o organizador (`isTournamentAdmin`)
  de torneio com a chancela daquela federação aprovada (`fedSanctionedBy`);
  reenviar sobrescreve. A equipe `competitions` **recusa** (motivo) ou
  **readmite** (`reviewFederationResult`), só em `status`/`review`.
  Documento público (é resultado de torneio público).
- **Ranking** (`federation_rankings/{fed}_{temporada}`, `allow write: if false`):
  o servidor recalcula a temporada a cada escrita em `federation_results`
  (`federationRankingRecompute`) e todas as temporadas quando
  `federations/{id}.ranking_config` muda (`federationRankingConfig`). A conta é
  `computeOfficialRanking` (`domain/officialRanking.js`) com **cópia** em
  `functions/federationRanking.js` e paridade
  (`functions/federationRanking.parity.test.js`): por **classe**
  (`gender_age_format`) e **geral**; pontos = `points_by_place[position]` (1º–8º)
  ou `participation` (9º em diante) × `tier_multipliers[tier]`; contam os
  `best_n` melhores resultados de cada pessoa por classe (0 = todos); empate
  divide a posição; resultado `rejected` fica de fora; linha sem `uid` (sem
  conta) fica de fora; com `members_only`, só quem tinha filiação **federada**
  ativa na **data do torneio** (`memberValidOn`). `DEFAULT_RANKING_CONFIG` em
  `constants.js`; a equipe `competitions` edita em Competições → Ranking
  (`updateRankingConfig`, chave `ranking_config` liberada na regra do
  documento da federação). A tela só **lê** o documento gravado — nunca
  recalcula no navegador (lição do ranking da plataforma, `docs/18`).

### 6.4 Secretaria: transferências, documentos e importação (PR 3)

**Transferência** (`federation_transfers`, só o servidor grava —
`federationTransfer`; domínio `domain/transfers.js`). Duas espécies
(`TRANSFER_KIND`): **troca de clube** representado (a própria federação
decide) e **troca de federação** (D9: a federação ATUAL libera; sem resposta
até o prazo — `rules.transfer_release_days`, padrão 15 — a varredura libera
sozinha, `auto_released`). A pessoa (ou o responsável do dependente) pede pela
página da federação ("Transferência", só com filiação viva e sem pedido
pendente), cancela enquanto pendente; a secretaria aprova/recusa na aba
Transferências. Aprovada a troca de federação, a filiação atual é
**encerrada** (o código deixa de verificar) e a pessoa pede filiação na nova,
que a aceita porque a antiga já não está ativa. Carência entre transferências:
`rules.transfer_cooldown_days` (padrão 90). **Os pontos ficam onde foram
feitos** — o ranking oficial não migra.

**Documentos** (`federation_documents_submitted` + Storage `federacao/{uid}/`).
A pessoa envia (`FedMemberDocuments`: tipo, PDF ou imagem < 5 MB, sem
sobrescrever), só o dono lê a própria pasta pela regra do Storage; a secretaria
(`members`/`admin`) vê o arquivo pela função `federationDocument` (base64,
auditado em `federation_document_view`) e marca `approved|rejected` com
observação; a pessoa apaga o pendente. O plano diz o que exige (`requires_docs`).

**Importação** (`federationImportMembers`, até 500 linhas, aba Importar). A
federação que já existia fora da plataforma cola a lista (nome, e-mail, número,
validade) e escolhe o plano: quem **tem conta** com aquele e-mail vira filiado
**ativo** numa transação por pessoa (número da lista ou sequencial, validade
da lista ou do plano); quem já tem filiação viva é pulado; quem **não tem
conta** fica em `federation_imports.pending` (só a equipe lê) para a
secretaria convidar por fora — **não** há vínculo automático quando a pessoa
se cadastra depois. Nenhum e-mail vai para a filiação.

**Regras da federação** (`federations.rules`, aba Regras, `admin`):
`ask_cpf`, `transfer_release_days`, `transfer_cooldown_days`.

### 6.5 Cursos e credenciais (módulo `courses`, PR 3)

O curso (`federation_courses`: arbitragem, formação de treinador, clínica,
workshop; `draft|open|closed|done|cancelled`; vagas, preço e preço de filiado,
`requires_membership`, `issues_credential` + `credential_months`) a equipe
`courses` grava **pelo cliente** — a regra confere nome, tipo, estado, preço
≥ 0 e `enrolled_count` intocado. **Inscrição, vaga, cobrança e credencial só
o servidor** (`federationCourse`): `enroll` (curso aberto, com vaga, do módulo
ligado; se exige filiação, filiação **ativa** nesta federação; preço de filiado
para quem é; pago → `awaiting_payment` + cobrança `origin: 'course'`, que o
financeiro confirma; grátis → `confirmed`), `cancel` (antes do início; devolve
a vaga e cancela a cobrança), `pass`/`fail` (equipe). Aprovado em curso que
emite credencial ganha `federation_credentials/{curso}_{uid}` com código no
**mesmo índice da carteirinha** (`federation_card_index`, `kind: 'credential'`)
— a verificação pública (`/f/verificar/:codigo`) responde pelos dois. A
credencial nasce **privada**; a pessoa a torna pública (Minha área →
Federações), e só então entra no diretório "Credenciados" da página da
federação; a equipe revoga (`status: 'revoked'`). Domínio `domain/courses.js`
(`courseState`, `seatsLeft`, `canCancelEnrollment`, `credentialState`).

### 6.6 Disciplina e ouvidoria (módulo `discipline`, PR 3)

**Sanção** (`federation_sanctions`, só o servidor — `federationDiscipline`;
domínio `domain/discipline.js`): advertência, **suspensão** (grava
`discipline_until_ms`/`discipline_sanction_id` na filiação — a regra da
auto-inscrição em torneio "só filiados" lê esse campo e a carteirinha mostra
"Suspensa"; **termina sozinha na data**, sem varredura), **multa** (vira
cobrança `origin: 'fine'`, quitada em `chargeConfirm`) e **exclusão**
(encerra a filiação, guardando o estado anterior). A pessoa (ou o responsável)
**recorre uma vez** (`appeal`, enquanto em vigor); a equipe `discipline`
decide (`uphold`/`overturn` — revertida desfaz o efeito) ou encerra antes do
prazo (`end`). **Só a pessoa e a federação veem** (D11): a sanção não é
pública e o ranking oficial não a desconta. Protocolo de recurso visível na
Minha área e na página da federação (`FedMySanctions`).

**Ouvidoria** (`federation_reports`, gravada **pelo cliente** — a regra
confere): qualquer conta abre manifestação (tipo conduta/arbitragem/
organização/outro, torneio, texto 20–2000 caracteres) **identificada ou
anônima** (`anonymous: true` ⇒ `reporter_uid` nulo, imposto na regra) e recebe
um **protocolo** (`reportProtocol`, derivado do id — `protocolToId` lê de
volta); consulta o andamento pelo protocolo sem login na página pública. A
equipe `discipline` responde (`open|in_review|closed`, `notes`, `handled_by` —
campos que a pessoa nunca grava). Manifestação identificada de conta excluída
vira anônima.

### 6.7 Comunicação, patrocínio, governança e loja (PR 4)

- **Notícias** (módulo `news`, `federation_news`): a equipe de comunicação
  (`comms`) ou a presidência (`admin`) escreve pelo cliente — título, resumo,
  corpo, imagem, link, fixada (`pinned`), `audience` (`public` | `members`) e `status` (`draft` |
  `published`). A regra lê: publicada e pública, qualquer um (até sem conta);
  "só filiados", quem tem filiação **ativa** (`fedMemberActive`); rascunho e a
  lista inteira, só `comms`/`admin`. O cliente **nunca** grava
  `notified_at`/`notified_count` nem troca a federação. **Avisar os
  filiados** é da função `federationNews` (§8): um aviso por conta (o
  dependente avisa o responsável), uma vez só, link
  `/federacoes/{id}?noticia={id}` (a página abre a notícia). Na página: bloco
  Notícias (`FedNewsSection`, âncora `#federacao-noticias`); no card do início,
  a última de cada federação.
- **Patrocinadores** (módulo `sponsors`): `federations.sponsors` (campo
  opcional, lista de até 12 `{ name, tier, logo_url, url }`), só `admin`
  grava. Aparecem na página (`FedSponsorsStrip`) e, só os nomes, na
  carteirinha.
- **Governança** (não é módulo: transparência não se desliga; em branco nada
  aparece): `federations.governance` (`statute_url`, `bylaws`, `mandate`,
  `board` ≤ 12, `minutes` ≤ 24), só `admin` grava, validada por
  `validateGovernance` (`domain/governance.js`, links só https). Bloco
  `FedGovernanceBlock` na página.
- **Cupons e campanhas** (módulo `promos`): a federação é o terceiro emissor
  do `promo/` (`PROMO_ISSUER.FEDERATION`, `issuer_id` = id da federação),
  com os mesmos editores da plataforma e dos professores. "Só filiados" reusa
  `PROMO_VISIBILITY.STUDENTS` e vale para quem tem filiação ativa naquela
  federação (`fedIdsOfMember`). **A campanha da federação não manda aviso**
  (`PROMO_AUDIENCES_BY_ISSUER.federation = []`): o canal de aviso é a notícia.
  Destinos: a página da federação e a loja. Na página, `FedPromosSection`; no
  início, a vitrine de promoções só mostra federação com a flag ligada.
- **Loja oficial** (módulo `store`): vendedor do Mercado de chave
  `federation_{id}` (`SELLER_TYPE.FEDERATION`). Abre e opera quem tem `admin`
  ou `finance` na equipe — no cliente `storeFederations` (`domain/staff.js`),
  na regra `isMarketOperator`, no servidor `operatorUids`
  (`functions/marketplace.js`): as três perguntas têm de dar a mesma resposta.
  A loja nasce `active`, sem selo nem reputação. O resto (anúncio, pedido,
  Pix direto à federação) é o Mercado de sempre.

### 6.8 Indicadores e declaração de vínculo (PR 6, zero banco)

- **Indicadores** (Central → Gerir → Indicadores; aparece para quem tem
  `members` ou `finance`): os últimos 12 meses em
  `domain/indicators.js` — filiados em dia, pedidos por mês, venceram sem
  renovar, divisão por plano, tipo e categoria (bloco de quem tem `members`);
  recebido por mês e por origem, renovações pagas e cobranças em atraso
  (bloco de quem tem `finance`). A **taxa de renovação** é renovações pagas ÷
  (renovações pagas + vencidas sem renovar) em 12 meses e só existe com as
  duas fontes; sem uma, a tela diz por quê. "Baixar CSV" leva tudo
  (`indicatorsCsv`, `;`, células que começam com `=+-@` neutralizadas). Usa as
  mesmas leituras da Central (`membersQ`, `chargesQ`): nenhuma consulta nova.
  Fonte que falhou mostra o erro com "Tentar de novo", nunca zero.
- **Declaração de vínculo** (`domain/declaration.js` +
  `MembershipDeclaration.jsx`): a folha para Bolsa Atleta, escola, empregador
  ou patrocinador — dados da federação (nome, sigla, CNPJ mascarado, cidade,
  logo), o texto "Declaramos… está com a filiação em dia, válida de/até…",
  o responsável (dependente), os resultados oficiais da pessoa NESTA
  federação (até 20, sem os recusados, de `federation_results` —
  `usePersonFederationResults`), a data de emissão e o QR da verificação
  pública (`/f/verificar/:codigo`). Imprime pela mesma folha do recibo
  (`cartao-folha-raiz recibo-folha`, `imprimindo-cartao`). Só sai com a
  filiação **em dia**, **sem suspensão** (de status ou disciplinar) e **com
  código**; o código gira na renovação/suspensão, então declaração antiga
  deixa de verificar — o rodapé diz isso. Quem emite: a secretaria sempre
  (Filiados → "Declaração"); o filiado ou o responsável na página da
  federação e em Minha área, se a regra `rules.member_declarations` da
  federação deixar (padrão sim; Configurações → Regras). Nada é gravado.

## 7. Dados (resumo; esquema completo em `docs/05-DATA-MODEL.md` § Federações)

Vinte coleções, todas com prefixo `federation` e **zero índice composto**
(consultas de uma igualdade — ou duas igualdades, que também não pedem
índice; ordenação em memória): `federations` (+ `private/data`),
`federation_staff`, `federation_plans`, `federation_members` (+ `private/data`:
CPF, nascimento, responsável — PR 3), `federation_charges`,
`federation_card_index`; do PR 2, `federation_affiliations`,
`federation_results`, `federation_rankings`; do PR 3,
`federation_documents_submitted`, `federation_transfers`, `federation_imports`,
`federation_courses`, `federation_course_enrollments`, `federation_credentials`,
`federation_sanctions`, `federation_reports`, do PR 4, `federation_news`
(campos opcionais novos na própria federação: `sponsors`, `governance`), do
PR 7, `federation_admin_grants` (campos novos: `staff_roles`) e, do PR 8,
`federation_docs` (campo novo: `doc_numbers`, §14).
**Storage**: `federacao/{uid}/`
(só o dono lê; PDF ou imagem < 5 MB); do PR 8, `federacao-acervo/{uid}/`
(rascunho do acervo, só o dono) e `federacao-acervo-oficial/` (fechada à
regra; só o servidor e o link com token). Campos novos em coleção existente: só os
dois **opcionais** de `tournaments` (`federation_id`, `federation_sanction`,
§6.2). Os avisos são `notifications` com `type: 'federation'` (os do PR 2 saem
do navegador, `origin` padrão; os das funções, `origin: 'server'`).

**Dado pessoal** (princípio 10): CNPJ completo, razão social e telefone da
entidade ficam em `federations/{id}/private/data` (quem pediu, a equipe
`admin`, o admin da plataforma); em público só `cnpj_masked`. A filiação
**nunca** é pública: só o próprio, a equipe que atende e o admin. **CPF,
nascimento e responsável** do filiado ficam em `federation_members/{id}/private/data`
(o dono ou o responsável escreve; a secretaria revela com motivo e auditoria);
os **documentos** só o dono lê no Storage e a secretaria pela função; a
**sanção** só a pessoa e a federação veem; a **manifestação anônima** não leva
`reporter_uid`. A verificação pública mostra o mínimo. O que vai no pedido
está em §5.2.

**Exclusão de conta**: filiações e cobranças **ficam sem o nome**
(`coletarFederacoes`), os códigos de carteirinha são apagados, os papéis em
equipe saem, a federação que a pessoa pediu fica com "Usuário removido"; nos
**resultados oficiais** a linha da pessoa vira "Atleta removido" sem `uid` (o
ranking refeito a tira; os demais seguem valendo), o pedido de filiação de
clube/arena que ela fez fica sem `requested_by`;
**presidente de federação não exclui a conta** (bloqueio, como dono de arena —
passa a presidência antes). PR 3: o `private/data` da filiação **some**; os
**dependentes** ficam sem o responsável (a filiação é do menor — o nome dele
fica; o código deixa de verificar); transferências, sanções, inscrições em
curso e credenciais ficam sem o nome (a credencial sai do diretório e o código
dela deixa de verificar); a manifestação identificada vira anônima; os
**documentos enviados são apagados** (o arquivo vai junto, pela pasta
`federacao/{uid}/`). **Exportação**: bloco `federations`
(`collectFederationExport`: filiações, cobranças, papéis, federações que pediu,
pedidos de filiação de clube/arena, resultados oficiais em que aparece;
PR 3: dependentes, documentos [registro], transferências, inscrições em
cursos, credenciais, sanções [suas e dos dependentes], manifestações
identificadas). PR 4: as notícias que a pessoa escreveu ficam (são da federação;
guardam só o `created_by`, contado na prévia como retido) e não vão na
exportação. `federation_rankings` fica fora da exportação de propósito: é
derivado dos resultados, que já vão.
`exclusaoCobreColecoes.test.js` reprova coleção `federation_*` nova fora dos dois.

## 8. Servidor (detalhe em `docs/47-BACKEND-CLOUD-FUNCTIONS.md` §8a)

| Função | Tipo | Quem | Faz |
|---|---|---|---|
| `federationReview` | callable | admin da plataforma | approve / reject / suspend / verify / unverify / official / unofficial |
| `federationMembership` | callable | a pessoa (`request`, `renew`, `cancel`) ou `members` (`approve`, `reject`, `suspend`, `reinstate`) | o ciclo da filiação (§5.2) |
| `federationChargeConfirm` | callable | `finance` | `confirm` / `cancel` da cobrança |
| `federationVerify` | callable **sem login** | qualquer um | o mínimo da carteirinha por código |
| `federationMembershipSweep` | agendada 06:00 | — | vencimentos, avisos 30/7/1, contagem; **libera transferências de federação vencidas** (`federationTransfers.sweep`) |
| `federationTransfer` | callable | a pessoa/responsável (`request`, `cancel`) ou `members` (`approve`, `reject`) | troca de clube ou de federação (§6.4) |
| `federationCourse` | callable | a pessoa (`enroll`, `cancel`) ou `courses` (`pass`, `fail`) | inscrição, vaga, cobrança do curso e credencial (§6.5) |
| `federationDiscipline` | callable | `discipline` (`apply`, `decide_appeal`, `end`) ou a pessoa/responsável (`appeal`) | sanção e o efeito na filiação (§6.6) |
| `federationImportMembers` | callable | `members` | importa até 500 linhas; quem tem conta vira filiado ativo, quem não tem fica em `federation_imports` |
| `federationDocument` | callable | `members`/`admin` da federação do documento | devolve o arquivo do Storage (base64) à secretaria, com auditoria |
| `federationNews` | callable | `comms`/`admin` da federação | avisa os filiados ativos de uma notícia publicada, uma vez só (§6.7) |
| `federationAcervo` | callable (540 s, 1 GiB) | `docs`/`admin` da federação; `file` para quem lê o documento | acervo oficial: rascunho, publicação numerada com SHA-256, retificação, visibilidade, retirada do ar, entrega de arquivo restrito (§14) |
| `federationRankingRecompute` | gatilho `federation_results/{id}` | — | recalcula `federation_rankings/{fed}_{temporada}` (§6.3) |
| `federationRankingConfig` | gatilho `federations/{id}` | — | `ranking_config` mudou ⇒ refaz todas as temporadas da federação |

Toda função confere a flag, grava `audit_logs` (`federation_*`) e avisa por
`notifications` (`origin: 'server'`, textos em `tx()` → `functions/i18n/avisos.json`).

## 9. Ajuda, dicas, idiomas e termos

- **Central de ajuda** (`helpCenter.js`, parte Atleta, `flags: ['federations']`):
  "Filiar-se a uma federação" (com torneio chancelado, ranking oficial,
  clubes/arenas filiados e, do PR 3, CPF e documentos, menor de idade,
  transferência, cursos e credenciais, sanções e ouvidoria), "Abrir e
  administrar uma federação" (Competições, Clubes e arenas, Módulos e, do PR 3,
  Secretaria, Regras, Cursos, Disciplina, varredura diária) e **"Torneio
  chancelado por uma federação"** (`federacao-torneios`: pedir, decidir, só
  filiados, enviar, pontuar); do PR 4, **"Notícias, cupons e loja da
  federação"** (`federacao-comunicacao`); pistas de rota para `/federacoes*`
  (a Central também aponta o artigo do torneio e o da comunicação); catorze
  perguntas no FAQ.
- **Guias com seta** (`guias.js`, área **Federações**): `federacao-filiar`
  (buscar → filiar → plano → enviar → carteirinha), `federacao-gerir` (Central:
  seções, configurações, filiados, financeiro, pendências),
  **`federacao-chancela`** (lista de torneios → Geral → Federação → a Central
  decide → enviar o resultado → o ranking na página) e, do PR 3,
  **`federacao-secretaria`** (abrir a Central → a secretaria em Filiados →
  regras e documentos do plano em Configurações → Cursos → Disciplina) e
  **`federacao-cursos`** (encontrar a federação → Cursos e clínicas →
  inscrever-se → a credencial na sua filiação) e, do PR 4,
  **`federacao-comunicacao`** (abrir a Central → Comunicação → nova notícia →
  publicar e avisar). **Pontos de
  dica** (`pontosDeDica.js`): abrir, minhas, filiar, carteirinha, seções,
  pendências, Pix, o do admin, do PR 2 torneios chancelados, ranking oficial e
  clubes/arenas filiados (página da federação), Competições e Clubes e arenas
  (Central), Federação na gestão do torneio, "Enviar ao ranking oficial",
  Federação na gestão do clube e na Central da arena; do PR 3 cursos e
  ouvidoria (página da federação), Cursos e Disciplina (Central); do PR 4
  notícias (página da federação) e Comunicação (Central). Âncoras
  `data-dica="federacao-…"`, `torneio-federacao`, `torneio-enviar-resultado`,
  `torneio-so-filiados`, `clube-federacao`, `arena-federacao` e
  `minha-area-credencial-publica` são contrato (guarda `dicas.test.js`). Uma
  rota tem no máximo 8 pontos (`guias.test.js`): `/federacoes/*` e
  `/federacoes/*/gerir` estão com 8 — ponto novo ali exige tirar outro.
- **Idiomas**: catálogo `src/modules/federations/i18n/locales/{en,es}.js`
  (1224 chaves, inclusive os avisos do servidor e os textos do PR 2 e do PR 3
  usados nas telas de torneio, clube, arena, Minha área, Mercado e início, que o guarda
  `i18nCatalogos` exige); `npm run i18n:avisos` regravou
  `functions/i18n/avisos.json` (426 avisos).
- **Termos legais** (`legalDocuments.js`, `flags: ['federations']`,
  complementares, sem gate): **Termos para Federações** (`/legal` →
  `termos-federacao`: a federação responde pelos valores e pelos dados;
  plataforma não intermedeia) e **Termos de Filiação** (`termos-filiacao`: o
  que a federação recebe, cancelamento, sem reembolso automático). Aceitos no
  pedido de abertura e no pedido de filiação. Traduções de cortesia en/es.
  ⚠️ Pendente: revisão por advogado.

## 10. O que não pode regredir

1. **Só o servidor cria filiação, cobrança e confirma pagamento** — a regra é
   `allow create, delete: if false`; o navegador só declara "Já paguei" e muda
   as próprias preferências. Provado em `tests/rules/federation.rules.test.js`.
2. **A flag vale na regra** (`fedOn()`), não só na tela.
3. **A conta da validade é uma só**, com cópia no servidor e paridade
   (`functions/federationMembership.parity.test.js`): o que a tela promete
   antes de pagar é o que o servidor grava.
4. **O código da carteirinha gira** a cada ativação/renovação/suspensão, e o
   índice só o servidor toca.
5. **A filiação nunca é pública**; a verificação mostra o mínimo; o pedido
   não leva contato.
6. **Presidente só por presidente**; campos de confiança (`status`, selos,
   `review`, contadores) só pelo admin/servidor (`fedLocked()`).
7. **Nenhum campo em coleção existente** e **zero índice**: consultas de uma
   igualdade.
8. Coleção `federation_*` nova entra na **exclusão e na exportação** (guarda).
9. Os valores de `?aba=` da Central e as âncoras `data-dica` são contrato.
10. **O ranking oficial é derivado e só o servidor grava** (`federation_rankings`
    `write: if false`); a tela nunca recalcula. A conta tem cópia no servidor
    com paridade (`functions/federationRanking.parity.test.js`).
11. **A colocação enviada é a do pódio** (`modalityPlacement`): nunca uma
    segunda conta de colocação. Resultado só de categoria **completa**.
12. **O organizador nunca aprova a própria chancela**: grava só `pending` e
    só apaga pendente; `approved` é da equipe `competitions`. E "só filiados"
    vale **na regra da inscrição** (`tournamentMembershipOk`), não só na tela.
13. **Módulo desligado vale na regra** (`fedModuleOn()`): sem `affiliations`
    ninguém pede filiação de clube/arena; sem `tournaments` ninguém pede
    chancela. Provado em `tests/rules/federationPr2.rules.test.js`.
14. A página da federação **não lê** `clubs`/`arenas`/`tournaments` para
    mostrar filiados e chancelados: nome, cidade e logo são copiados no pedido
    (a lista de torneios chancelados é a única consulta em `tournaments`, por
    `federation_id` + `archived == false`, e só mostra os `approved`).
15. **CPF, nascimento e responsável só em `private/data`** (`fedMemberOwner`
    escreve; `cpf` ≤ 11 dígitos conferido na regra); na Central o CPF nasce
    mascarado e revelar é auditado. Nunca copie esses campos para o documento
    da filiação. Provado em `tests/rules/federationPr3.rules.test.js`.
16. **Dependente é filiação com `user_id` nulo e `guardian_uid`**: toda regra e
    serviço que pergunta "é o dono?" passa por `fedMemberOwner`
    (`user_id` **ou** `guardian_uid`), nunca só `user_id`. Menor de 12 nunca
    pede filiação sozinho (`GUARDIAN_ONLY_AGE`, conferido no servidor).
17. **Transferência, inscrição em curso, credencial, sanção e importação só o
    servidor grava** (`write: if false`); a federação antiga **libera** a troca
    de federação (silêncio = liberada no prazo pela varredura); os pontos do
    ranking oficial **não** migram.
18. **O documento do filiado só o dono lê no Storage** (`federacao/{uid}/`);
    a secretaria o vê pela função `federationDocument`, que confere o papel.
    Nunca abra a pasta na regra do Storage (ela não consulta o banco
    `pickleball`).
19. **A suspensão vale na regra da inscrição** (`discipline_until_ms <
    request.time`) e **termina sozinha na data** — nenhuma varredura a
    encerra, e `end`/`overturn` zeram o campo. A sanção nunca é pública (D11) e
    o ranking oficial não a desconta.
20. **A credencial usa o índice da carteirinha** (`federation_card_index`,
    `kind: 'credential'`): um código verifica os dois; a credencial nasce
    privada e só a pessoa a torna pública. Revogada ou vencida não verifica.
21. **Manifestação anônima não leva `reporter_uid`** (imposto na regra), e
    `notes`/`handled_by` a pessoa nunca grava. O protocolo deriva do id
    (`reportProtocol`/`protocolToId`): renomear a conta quebra todo protocolo
    já entregue.
22. **Cobrança de curso confirma a inscrição; de multa, quita a sanção** —
    tudo em `chargeConfirm`, pela `origin`. Nunca crie um segundo caminho de
    confirmação.
23. **O aviso da notícia é do servidor e sai uma vez só** (`notified_at`); a
    regra recusa o cliente gravando `notified_*`, e "só filiados" é conferido
    na regra (`fedMemberActive`), não só na tela. Provado em
    `tests/rules/federationPr4.rules.test.js` e `functions/federationPr4.test.js`.
24. **A campanha da federação não manda aviso** (`PROMO_AUDIENCES_BY_ISSUER`):
    abrir esse canal seria um segundo jeito de mandar mensagem em massa aos
    filiados, sem o controle de uma vez só da notícia.
25. **Quem opera a loja oficial é uma pergunta com três respostas que têm de
    bater**: `isMarketOperator` (regra), `operatorUids` (servidor) e
    `storeFederations` (cliente) — `admin` ou `finance`, só com `store` ligado.
26. **O card do início só existe com a flag** (`requer: 'federacao'` no
    catálogo de cards); flag desligada, ele some até do seletor.
27. **O admin da plataforma tem toda permissão também na regra** (`fedHas`);
    tela, servidor e regra respondem igual. Papel → permissões é UM mapa com
    guarda (`federacaoPermissoes.test.js`).
28. **`private/data` da filiação só o servidor grava**; o dono lê. E a
    exportação de dados leva esses campos.
29. **Teste de regra grava valor DIFERENTE**: update idêntico tem
    `affectedKeys()` vazio e `hasOnly` passa à toa.
30. **"Só filiados" vale para a dupla inteira** (`fedMemberOk` no parceiro) e
    "em dia" é a conta de `membershipState` (vencida ou suspensa não está).
31. **Valor em reais digitado passa por `parseBrlCents`**; nunca uma conta
    local com `replace('.', '')`.
32. **A própria filiação ainda inexistente é legível** (`allow get` por id em
    `federation_members`): sem isso ninguém que não é filiado vê o
    "Filiar-se". Toda leitura de documento `{fed}_{uid}` antes de criar precisa
    de uma cláusula assim — prove no emulador, não com banco falso.

33. **Indicador sem fonte é "—" com o motivo, nunca zero** (`federationIndicators`
    devolve `null` para o bloco sem leitura); a taxa de renovação exige as
    duas fontes.
34. **A declaração só sai com a filiação em dia, sem suspensão e com
    código** (`buildMembershipDeclaration`), e a do próprio filiado obedece a
    `rules.member_declarations`; a secretaria emite sempre.
35. **A equipe só o servidor grava** (`federation_staff` `write: if false`;
    `federations.staff_roles` em `fedLocked()`), e a regra lê a CÓPIA das
    permissões gravada no documento da pessoa — mudar um cargo regrava a cópia
    de todos que o ocupam.
36. **Sempre há um admin master.** Tirar, rebaixar ou deixar sair o último é
    recusado; o mandato vencido do último NÃO fecha o acesso (regra e
    varredura), só avisa uma vez.
37. **O admin da plataforma só age na Central com o acesso justificado
    valendo** (`fedPlat`: `federation_admin_grants/{fed}_{uid}` com
    `expires_ms` no futuro). O registro vai PRIMEIRO para `admin_access_logs`;
    falhou o registro, o acesso não abre. A federação não vê o registro.
38. **Lógica de cargos com cópia no servidor** (`functions/federationStaffPolicy.js`
    ⇄ `domain/staff.js`, paridade em `functions/federationStaff.parity.test.js`).
39. **Documento publicado não se edita nem se apaga.** Corrige-se por
    retificação (versão nova com motivo; a anterior fica em `versions[]`, com
    os arquivos e o SHA-256), errata, ato que altera ou que revoga. Tirar do
    ar é só do `admin`, com motivo, e nada é apagado (§14).
40. **`federation_docs` só o servidor grava** (`write: if false`), e o
    contador `federations.doc_numbers` está em `fedLocked()` — o número do
    ato é dado numa transação, uma vez só.
41. **O link do arquivo existe só enquanto o documento é PÚBLICO.** Mudar
    para "só filiados"/"só a equipe" ou retirar do ar troca o token e mata o
    link; o arquivo restrito (até 9 MB) é entregue pela função (`file`) a
    quem pode ler. A pasta oficial é fechada à regra do Storage.
42. **Arquivo novo só da pasta de quem salva** (`exigeDono`): ninguém anexa o
    rascunho que outra pessoa enviou. Tipo e tamanho são conferidos pelo que
    o Storage diz, não pelo que a tela mandou.
43. **Validação do acervo com cópia no servidor**
    (`functions/federationAcervoPolicy.js` ⇄ `domain/acervo.js`, paridade em
    `functions/federationAcervo.parity.test.js`): tipos, categorias,
    numerados, tetos, famílias de arquivo e links de vídeo.

## 11. Pendências e próximas fases

- Flavio: ligar a flag `federations` em Painel admin → Funcionalidades;
  revisão jurídica dos dois termos.
- ~~**PR 2**~~ — entregue: clubes e arenas filiados (`affiliations`),
  chancela de torneios (`tournaments`) e ranking oficial (`ranking`).
  Fora de propósito: ranking por **dupla** (as linhas são por pessoa, como o
  ranking da plataforma), descarte de resultado por **data** (só `best_n`),
  e a federação **convidar** clube/arena (quem gere pede). Quando pedirem.
- ~~**PR 3**~~ — entregue: `federation_members/{id}/private/data` (CPF por
  regra da federação, responsável do menor), dependentes, documentos,
  transferências de clube e de federação, importação de filiados, cursos e
  credenciais (`courses`), disciplina e ouvidoria (`discipline`). Fora de
  propósito: e-mail importado sem conta **não** vira filiação sozinho quando a
  pessoa se cadastra depois (a secretaria convida e aprova); documento aceito
  **não** é apagado por prazo (a pessoa apaga o pendente; a exclusão de conta
  apaga todos); o ranking oficial **não** desconta suspensão (D11). Quando
  pedirem.
- ~~**PR 4**~~ — entregue: notícias e avisos (`news`), patrocinadores
  (`sponsors`), cupons e campanhas (emissor `federation` no `promo/`), loja
  oficial no Mercado (`store`), governança e card no início (§6.7). Fora de
  propósito: notícia agendada (publica-se na hora), aviso de campanha (o canal
  é a notícia) e patrocinador com contrato/valores (só a vitrine).
- ~~**PR 6**~~ — entregue: Indicadores na Central e declaração de vínculo
  (§6.8). Fora de propósito: assinatura digital certificada (ICP-Brasil) na
  declaração — a autenticidade é o QR; gráfico de anos anteriores (12 meses
  bastam para a prestação de contas anual).

## 12. Revisão geral (2026-10-21)

Uma varredura de ponta a ponta — regra × servidor × cliente, vínculos entre
coleções, telas, idiomas e exportação — depois dos quatro PRs. O que estava
errado e foi corrigido no mesmo PR (tudo com teste):

**Regras do Firestore** (`tests/rules/federationRevisao.rules.test.js` +
ajustes nos quatro arquivos existentes)
- `fedHas` passou a incluir o admin da plataforma — a tela e o servidor já
  diziam que ele tem toda permissão, e a regra recusava o que a tela oferecia.
- A validação do pedido de abertura (`fedProfileOk`) vale também quando o
  `admin` edita nome, sigla, endereço ou nível; o `finance` só toca o Pix
  (`payment`).
- A equipe de uma federação **aprovada** é legível por qualquer conta (a
  página mostra a diretoria e a tela de chancela precisa saber quem decide);
  anônimo não lê. A `discipline` lê as filiações (escolhe o filiado na lista).
- `federation_members/{id}/private/data` **só o servidor grava** (o pedido de
  filiação e a secretaria gravam pelo servidor; o dono lê).
- Documento enviado tem de ser da federação da filiação; apagar documento e
  resultado pelo `admin` exige a flag ligada; a decisão da chancela exige a
  flag e o organizador não altera uma chancela aprovada.
- "Só filiados" vale para a **dupla inteira** (`fedMemberOk` para o parceiro)
  e o resultado enviado tem de ser do `tier` da chancela.
- 🐞 Armadilha de teste: `chg()` é `affectedKeys()`, e um update com o MESMO
  valor tem conjunto vazio — `hasOnly([...])` passa à toa. Teste de regra
  grava um valor DIFERENTE.

**Servidor** (`functions/federations.test.js`, `federationPr3.test.js`)
- Transação do Admin SDK: toda leitura antes de toda escrita (o banco falso
  dos testes agora recusa leitura depois de escrita, como o SDK).
- Filiação gratuita com `auto_approve` nasce num `set`, não num `update` de
  documento inexistente; `exigeSemOutraFederacao` vale no pedido e na
  aprovação; preço do plano arredonda igual ao cliente (paridade).
- `chargeConfirm` aceita cobrança sem filiação (curso de não filiado) e recusa
  quitar filiação inexistente; o link do curso usa `?ancora=fed-cursos` (a
  regra de `notifications` recusa `#`).
- `review` exige a flag, recusa aprovar com slug já usado por outra aprovada
  e só cria presidente se a conta existir; `verify` responde "não encontrado"
  com a flag desligada; cancelar filiação apaga `card_code`.
- Varredura: expira pela DATA (`daysLeft < 0`), avisa "vence hoje", e as três
  varreduras (filiação, transferência, disciplina) rodam com `allSettled`.
- Disciplina: suspensões sobrepostas recalculam o fim (`recalcularSuspensao`),
  suspensão futura entra pela varredura (`sweep`), desfazer exclusão emite
  código novo de carteirinha, recurso só `uphold|overturn`, sanção só em
  filiação viva. Exclusão de conta cancela as filiações vivas da pessoa e dos
  dependentes.

**Cliente**
- `parseBrlCents` (uma só leitura de "R$": "10.50" era R$ 1.000,00 nas três
  telas); CSV do financeiro sem célula-fórmula; virada do plano anual só em
  dia que existe; diretoria/atas acima do teto é erro dito; importação recusa
  31/02; logo só https; `slugEmUso` consulta só aprovadas (a regra provava
  só isso); notícia publicada com a data LOCAL; revogar chancela rejeita os
  resultados já enviados; `membershipRequirement` usa a MESMA conta da
  carteirinha (vencida ou suspensa não está em dia) e avisa que vale para a
  dupla.
- Telas: `disabled` num `<Link>` não desliga nada (federação suspensa escondia
  o botão e abria a tela) — agora o texto diz; site só https; `CNPJ {n}` por
  `t()`; `useHashScroll` na página (o aviso leva a `#fed-cursos`); datas por
  `quando()`/`fmtData`; "Entrar para se inscrever" volta à federação
  (`/login?next=`, só caminho interno); inscrever em curso só com a lista de
  inscrições em mãos; "Apagar" curso só para `admin` (a regra); o dependente
  renova pela Minha área (`memberId`); a disciplina carrega a lista de
  filiados; federação recusada diz o motivo; `MEMBER_STATUS.PENDING` no lugar
  do literal; host da página pública vem do navegador; contraste cinza-500.
- Exportação LGPD leva `private/data` das filiações da pessoa e dos
  dependentes (`listMyMembersPrivate`).
- 🐞 Achado pelo teste de navegador: o `get` da PRÓPRIA filiação ainda
  inexistente (`federation_members/{fed}_{uid}`) era RECUSADO pela regra —
  documento ausente ⇒ `od()` nulo ⇒ erro — e a página da federação mostrava
  "Não carregou a sua situação" no lugar do **Filiar-se** para toda pessoa que
  ainda não é filiada. Nenhum teste de serviço pega isso (o banco falso não
  recusa); só o emulador e o navegador. Agora `allow get` para o id com o
  próprio uid no fim (`federationRevisao.rules.test.js` item 9) — a mesma
  lição de `canGetMissingArenaUserDoc`.
- 🐞 Achado pelo teste de navegador: `benefits` do plano é TEXTO (um por
  linha), e as duas listas de planos faziam `.split('\n')` direto — um plano
  com lista gravada (importação, mão) derrubava a página pública inteira no
  "Algo deu errado". Agora `planBenefitLines(plan)` (`domain/plans.js`) lê
  texto ou lista, nos dois lugares.
- Guarda nova `src/core/guards/federacaoPermissoes.test.js`: papel →
  permissões igual em `STAFF_ROLE_PERMISSIONS` e em `fedRolePerms()` da regra.
- Teste de navegador (`tests/e2e/logado.spec.js`, `@emuladores`): página
  pública sem conta, diretório, página da federação, formulário de filiação e
  Minha área → Federações montam com a flag ligada.

## 13. Cargos, mandatos, admins master e acesso justificado (Etapa 1 do acervo, PR 7)

Pedido do dono (2026-10-21): a federação cria cargos com atribuições próprias,
com mandato de início e fim prorrogável; o admin master passa a administração;
pode haver vários admins master e nunca nenhum; o admin da plataforma entra
com justificativa registrada e por prazo. Plano das quatro etapas (cargos →
acervo e mural → calendário e assembleias → comentários) em
`/mnt/project-files/federacao/plano-acervo-calendario-cargos.md`.

### 13.1 Cargos (`federations.staff_roles`)

Lista de até 30 cargos `{ id, name, description, perms[], is_master,
term_months }` (0 = sem prazo, até 120). Ausente ou vazia, valem os 8 de
modelo (`DEFAULT_STAFF_ROLES`: `president` é admin master; presidente e
diretor com mandato de 48 meses). Só admin master grava (`role_save`,
`role_delete`), sempre pelo servidor; cargo com gente não pode ser apagado e
mudar as permissões regrava a cópia `perms` de todos que o ocupam. A permissão
nova `staff` ("Equipe") abre a seção Equipe sem dar admin master.

### 13.2 Pessoas e mandatos (`federation_staff/{fed}_{uid}`)

Campos novos (todos opcionais; documento antigo vale pelo `role`):
`role_id`, `role_name`, `perms[]` (cópia), `is_master`, `term_start`,
`term_end` (`''` = sem fim), `term_end_ms` (0 = sem fim), `term_history[]`
(até 20: `{ at_ms, by, from, to, reason, act }`), `term_warned[]`,
`term_held_notified`. Ações do `federationStaff`: `appoint` (nomear ou mudar
cargo; a pessoa é escolhida pela lista de usuários e recebe aviso), `extend`
(nova data + motivo + ato), `remove` (tirar ou sair), `transfer` (torna outra
pessoa admin master; com `leave`, quem passou sai na hora).

Regras de quem pode: admin master pode tudo; quem tem `staff` age só em
cargos que não são admin master, nunca em si mesmo e só dando permissões que
tem. Sempre fica um admin master (`lastMasterBlocked`).

**Varredura** (dentro de `federationMembershipSweep`): avisa a pessoa e os
admins master 30, 7 e 1 dia antes do fim (`term_warned`); vencido, tira da
equipe e avisa — salvo o último admin master, que fica e recebe um aviso só.

### 13.3 Acesso justificado do admin da plataforma

Na Central de uma federação em que não é da equipe, o admin da plataforma vê
`FedSupportAccessGate`: categoria do motivo (`REVEAL_REASON_META`), texto de
pelo menos 20 letras, prazo de 1, 2, 4 ou 8 horas e uma referência opcional.
`federationAdminAccess` (`grant`) grava primeiro em `admin_access_logs`
(`action: 'federation_access'`) e só então `federation_admin_grants/{fed}_{uid}`
(só o admin lê, ninguém grava pelo cliente). A faixa
`FedSupportAccessBanner` mostra o prazo e "Encerrar acesso" (`end`, registrado
como `federation_access_end`). A regra `fedPlat(fedId)` exige o acesso
valendo para toda escrita e para a leitura de CPF e sanções. A revisão da
federação (aprovar, selos) continua pelo servidor, sem acesso. No Painel
admin → Federações, "Entrar na Central (com motivo)" e a lista "Acessos de
suporte às Centrais". Como no suporte de cadastros, a federação **não vê** o
registro (decisão do dono, 2026-10-12).

### 13.4 Telas

`FedStaffPanel` (Equipe → Pessoas: nomear, mudar cargo, prorrogar, tirar,
histórico, passar a administração; Equipe → Cargos, só admin master),
`FedSupportAccess.jsx` (porta e faixa do acesso justificado). Ajuda: artigo
`federacao-equipe` e guia `federacao-equipe`; âncoras `federacao-equipe`,
`federacao-equipe-adicionar`, `federacao-equipe-passar`, `federacao-aba-cargos`,
`federacao-cargos`, `federacao-acesso-suporte`, `admin-federacoes-acessos`.

## 14. Acervo oficial e transparência (Etapa 2 do acervo, PR 8)

Pedido do dono (2026-10-21): normas, regulamentos, atos, atas, convocações,
súmulas, avaliação de arenas, vídeo e áudio, com envio de arquivos e gestão
completa, e um ambiente público para ler, baixar e compartilhar. Base de
transparência: Lei Geral do Esporte (Lei 14.597/2023, art. 36). Esta parte
(PR 8a) é a gestão na Central; a página pública do acervo vem no PR 8b.

### 14.1 Módulo, permissão e tela

Sub-módulo `official_docs` ("Acervo oficial"); permissão `docs` (cargo
modelo `secretary`). Seção **Acervo oficial** da Central
(`federationSections`, `grupo: 'atender'`), aberta a quem tem `docs` ou
`admin` com o módulo ligado: abas **Documentos** (`?aba=acervo`) e
**Transparência** (`?aba=transparencia`). Telas em
`src/v2/components/federations/manage/FedAcervoPanel.jsx` (lista com busca
sem acento, categoria, situação e ano; detalhe; diálogos de publicar,
retificar, visibilidade, retirar e apagar) e `FedAcervoForm.jsx` (rascunho,
envio de arquivos com progresso, links de vídeo, relações com outros atos).

### 14.2 Catálogo (`domain/acervo.js`)

Dez categorias (estrutura e organização, ética e disciplina, regulamentos
esportivos, atos e deliberações, convocações, atas e registros, eventos e
competições, transparência e finanças, mídia, calendário) e 38 tipos — de
estatuto, regimento, código de ética e regulamento de competições a
resolução, portaria, deliberação, edital, nota oficial, errata, edital de
convocação, ata, lista de presença, súmula, boletim de resultados, relatório
de arbitragem, **avaliação de arena**, demonstrações financeiras, parecer do
conselho fiscal, vídeo, áudio e calendário anual. O tipo decide a categoria
e se é **numerado** (atos, editais, atas, decisões disciplinares). Os ids de
tipo e categoria são gravados: nunca renomeie.

Relações entre atos: `revokes` (revoga), `amends` (altera), `errata`
(corrige), `regulates` (regulamenta), `refers` (cita). A errata exige apontar
o corrigido; só se relaciona com ato **publicado** da mesma federação, e
revogar/alterar/corrigir um revogado é recusado.

Arquivos: documentos (PDF, Office, ODF, texto, CSV) até 25 MB, imagens
(WebP, JPEG, PNG) até 10 MB, áudio até 50 MB, vídeo até 100 MB; até 10 por
documento. Vídeo longo vai por link do **YouTube** (incorporado por
`youtube-nocookie.com`) ou **Vimeo** — outro site é recusado. Tetos de
texto: título 200, resumo 600, corpo 30.000, 10 palavras-chave, 10 relações,
5 links.

### 14.3 Ciclo do documento (`functions/federationAcervo.js`)

1. **Rascunho** (`save`): os arquivos sobem para `federacao-acervo/{uid}/`
   (só o dono lê e escreve; tipo e teto na regra do Storage; sem
   sobrescrever). O servidor valida com a mesma régua da tela e só aceita
   arquivo NOVO da pasta de quem salva. Rascunho se edita e se apaga
   (`delete`, que apaga os arquivos).
2. **Publicar** (`publish`): copia cada arquivo para
   `federacao-acervo-oficial/{fed}/{doc}/v1/{n}.{ext}`, confere tipo e
   tamanho **pelo Storage**, calcula o **SHA-256** e, numa transação, dá o
   número por tipo e ano de Brasília (`federations.doc_numbers`, ex.:
   "Resolução nº 3/2026") e marca nos atos relacionados `related_by[]` (e
   `revoked_by` quando revoga). Documento público ganha link com token
   (`firebaseStorageDownloadTokens`, cache de um ano).
3. **Retificar** (`rectify`): versão nova com motivo (≥ 10 letras); tipo,
   número, visibilidade e relações não mudam. A versão anterior vai para
   `versions[]` (até 10) com os arquivos e os códigos. Revogado não se
   retifica.
4. **Visibilidade** (`visibility`): público / só filiados / só a equipe. Cada
   troca gera token novo: o link antigo morre e só volta a existir se ficar
   público. Restrito aceita arquivo de até 9 MB (entregue pela função).
5. **Retirar do ar** (`withdraw`, só `admin`): motivo (≥ 20 letras), status
   `withdrawn`, links mortos; o documento e os arquivos ficam para a equipe.
6. **Arquivo restrito** (`file`): até 9 MB, em base64, para quem pode ler o
   documento sem link público (filiado ativo, equipe, rascunho para `docs`).

Toda ação grava `audit_logs` (`federation_doc_save`, `_delete`, `_publish`,
`_rectify`, `_visibility`, `_withdraw`).

### 14.4 Quem lê (regra e servidor iguais)

Publicado e **público**: qualquer um, até sem conta. **Só filiados**: filiado
`active` e qualquer pessoa da equipe. **Só a equipe**: qualquer cargo.
**Rascunho e retirado**: só `docs`/`admin`. O admin da plataforma lê com o
acesso justificado valendo (`fedPlat`). A lista pública consulta por três
igualdades (`federation_id` + `status` + `visibility`) — sem índice. Provado
em `tests/rules/federationAcervo.rules.test.js`.

### 14.5 Transparência

A aba Transparência confere, entre os documentos **públicos e em vigor**, os
itens do art. 36 da Lei 14.597/2023 e das boas práticas
(`TRANSPARENCY_ITEMS`): estatuto, dirigentes e remuneração, convênios e
prestação de contas, demonstrações financeiras e parecer fiscal (do ano
passado para cá), relatório e atos de gestão, calendário e atas das
assembleias, regulamento de competições, código de ética. O que falta
aparece como "não publicado", com atalho para publicar.

### 14.6 Exclusão de conta e exportação

O documento é ato da federação, não dado da pessoa: fica, guardando só o
`created_by` (contado como retido na prévia), e não vai na exportação. Os
rascunhos não usados em `federacao-acervo/{uid}/` são apagados com a conta.

### 14.7 Âncoras

`federacao-secao-acervo`, `federacao-acervo`, `federacao-acervo-novo`,
`federacao-acervo-formulario`, `federacao-acervo-anexar`,
`federacao-acervo-relacoes`, `federacao-transparencia`. Artigo de ajuda,
guia e a página pública chegam no PR 8b.
