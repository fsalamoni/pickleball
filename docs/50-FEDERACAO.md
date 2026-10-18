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
| Sub-módulos que cada federação liga para si | Central → Configurações → Módulos (todos ainda `planned`: "em breve") |
| Avisos (sino, e por e-mail/celular quando `external_messaging` estiver ligada) | categoria "Federações" em Configurações → Notificações |
| Exclusão de conta e exportação de dados | `functions/accountDeletion.js`, `federationExportService.js` |
| Ajuda, guias com seta, pontos de dica, en/es, termos legais | §9 |

O que **não** está nesta entrega e aparece como "em breve" na aba Módulos:
torneios chancelados, ranking oficial, clubes e arenas filiados, cursos e
credenciais, disciplina e ouvidoria, notícias, patrocinadores, loja oficial.
São as fases seguintes do plano (PR 2 a PR 4). `FED_MODULE_META[x].status`
passa de `planned` a `available` quando a tela existir.

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
   **`affiliations`** (clubes e arenas filiados). Os demais seguem `planned`
   ("Em breve"). A tela de cada módulo pergunta `fedModuleOn(federation, x)`
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
| **Equipe** (`federation_staff/{fedId}_{uid}.role`) | 8 papéis → permissões (`STAFF_ROLE_PERMISSIONS`, cópia na regra `fedRolePerms`, paridade em `staff.test.js`) | `president`/`director`: tudo (`admin`, `members`, `finance`, …); `secretary`: `members`; `treasurer`: `finance`; `competitions`, `referees` (→ `courses`), `discipline`, `communication` (→ `comms`): só o seu, ainda sem tela |
| **Filiado** (`federation_members/{fedId}_{uid}`) | `user_id == uid` | Lê a própria filiação e cobranças, muda só as próprias preferências (`public_badge`, `show_in_directory`, `public_photo`), declara o pagamento ("Já paguei"), pede renovação e cancela |
| **Visitante** | sem conta | Lê federação aprovada e planos (`/f/:slug`) e verifica carteirinha (`federationVerify`) |
| **Admin da plataforma** | `isPlatformAdmin()` | Aprova/recusa/suspende a federação, dá e tira os selos "Verificada" e "Oficial", lê os dados da entidade |

Só o **presidente** (ou o admin da plataforma) nomeia ou troca o presidente, e
o presidente não se rebaixa sozinho: passa a presidência antes. Quem tem `admin`
acrescenta e troca os demais papéis; qualquer um (menos o presidente) sai da
equipe sozinho. Tudo isso é regra (`federation_staff`), não só tela.

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

Ao ativar: o **número** sai de `federations.member_counter` numa transação
(`SIGLA-ANO-000001`, `formatMemberNumber`); `valid_from`/`valid_until` pela
conta do plano (`computeValidUntil`); a renovação começa no **fim da validade
atual** (`renewalStart`), nunca antes. A conta vive em
`domain/membership.js` e tem **cópia no servidor**
(`functions/federationMembership.js`) com teste de paridade.

### 5.3 Cobrança (`federation_charges`)
Só o servidor cria (`novaCobranca`: `amount_cents`, `plan_*`, `origin`
`membership|renewal`, `due_date` = hoje + 10 dias, `status: 'open'`). A pessoa
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
`expiry_notified`); recontagem de `member_count` por federação.

## 6. As telas

| Rota | Tela | O que mostra |
|---|---|---|
| `/federacoes` | `V2Federations` | "Suas federações" (filiado ou equipe, com "Gerir"), todas as aprovadas (as da região primeiro, `useRegionalList`; a busca ignora a região), "Abrir uma federação" |
| `/federacoes/abrir` | `V2FederationApply` | Formulário (campos públicos em `FederationPublicFields` + dados da entidade), estado do pedido (em análise / aprovada / recusada com motivo) |
| `/federacoes/:id` | `V2FederationDetail` | Marca, selos, contagem, planos (`PlansList`), sobre, contato e **a situação da pessoa** (`MinhaSituacao`: filiar-se, cobrança Pix, renovar, carteirinha); "Gerir" para a equipe. Com os módulos ligados (`FedPublicBlocks.jsx`): **Torneios chancelados** (`FedSanctionedTournaments`), **Ranking oficial** (`FedRankingBlock`: temporada, classe, paginação, a minha linha em destaque) e **Clubes e arenas filiados** (`FedAffiliatesSection`) |
| `/federacoes/:id/filiar` | `V2FederationJoin` | 1. tipo de filiação → 2. plano (preço com o desconto da pessoa; faixa de idade exige nascimento no perfil) → 3. preferências, clube, observação, termos → pedido |
| `/federacoes/:id/gerir?aba=` | `V2FederationManage` | A Central: **Atender** (Hoje · Filiados: Pedidos, Filiados, **Clubes e arenas** [módulo `affiliations`] · **Competições** [permissão `competitions`; módulos `tournaments`/`ranking`]: Chancelas, Resultados, Ranking · Financeiro: Cobranças, Recebidos) e **Gerir** (Equipe · Configurações: Planos, Recebimento, Página, Módulos). A seção só existe para quem tem a permissão e a aba de módulo só com o módulo ligado (`buildFederationSections(perms, federation)`); a aba mora na URL (`?aba=`; `?secao=` abre a primeira). Faixa "Precisa de você" (`FederationPendencias` ← `federationPendingItems`: pedidos, pagamentos, **clubes/arenas pedindo**, **chancelas para analisar**) no topo |
| `/f/:slug` | `PublicFederation` (V1, fora do V2Layout) | A página pública: marca, planos, chamada para entrar/filiar-se; com os módulos ligados, torneios chancelados, ranking oficial e clubes/arenas filiados (os mesmos blocos do detalhe) |
| Gestão do clube → Federação | `OrgAffiliationCard kind="club"` (`V2ClubAdmin`) | Pedir filiação a uma federação com `affiliations` ligado (mensagem ≤ 500), acompanhar (pendente/aprovada/recusada/suspensa com motivo), retirar o pedido ou desfiliar |
| Central da arena → Equipe e parceiros → **Federação** (`?aba=federacao`) | `OrgAffiliationCard kind="arena"` (`V2ArenaManage`, aba só com a flag) | O mesmo cartão para a arena |
| Página do clube / da arena | `OrgAffiliationBadges` (`FedTags.jsx`) | Selo "Filiado · SIGLA" (só filiação **aprovada**), ligando à federação |
| Gestão do torneio → Geral → **Federação** | `TournamentSanctionCard` (`TournamentAdminTab`) | Pedir a chancela: federação com `tournaments` ligado, tipo proposto (regional/estadual/principal) e "Só filiados em dia se inscrevem"; estado e motivo; retirar o pedido pendente |
| Torneio (hero, cartão da lista, página pública `/p/:id`) | `TournamentSanctionBadge` | Selo "Chancelado · SIGLA" (+ "só filiados"), só com a chancela **aprovada** |
| Resultados do torneio (gestão, por categoria) | `FederationResultButton` (ao lado do `PodiumBlock`) | Com a chancela aprovada e a categoria **completa** (`isModalityComplete`): "Enviar ao ranking oficial" / "Reenviar"; mostra "No ranking desde…" ou "recusado: motivo" |
| Inscrição numa modalidade | `ModalityRegistrationDialog` | Torneio "só filiados": `membershipRequirement(tournament, minhasFiliacoes)` — sem filiação em dia, aviso vermelho com link à federação e **sem botão de inscrever**; consulta falhando ⇒ "não deu para conferir" + tentar de novo (nunca afirma que a pessoa não é filiada). O organizador inscreve qualquer pessoa |
| `/f/verificar/:codigo?` | `PublicFederationVerify` | Digitar/ler o código → em dia / irregular / não encontrada |
| Minha área → Federações | `FederacoesSecao` | Cobranças para pagar, filiações (carteirinha, renovar), equipe; pendências na faixa (`myFederationPending`) |
| Painel admin → Federações | `AdminFederationsPanel` | Filtros por estado, aprovar/recusar/suspender com motivo, selos, dados da entidade; na caixa de entrada do admin, "Federações esperando aprovação" |

Os valores de `?aba=` da Central (`pedidos`, `filiados`, `filiados-orgs`,
`chancelas`, `resultados`, `ranking`, `cobrancas`, `recebidos`, `equipe`,
`planos`, `pix`, `pagina`, `modulos`, `hoje`) são **contrato de link**: os
avisos levam a eles (pedido de clube/arena → `filiados-orgs`; pedido de
chancela → `chancelas`). Nunca renomeie. O mesmo vale para `?aba=federacao`
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

## 7. Dados (resumo; esquema completo em `docs/05-DATA-MODEL.md` § Federações)

Nove coleções, todas com prefixo `federation` e **zero índice composto**
(consultas de uma igualdade — ou duas igualdades, que também não pedem
índice; ordenação em memória): `federations` (+ `private/data`),
`federation_staff`, `federation_plans`, `federation_members` (+ `private/data`,
reservado ao PR 3), `federation_charges`, `federation_card_index` e, do PR 2,
`federation_affiliations`, `federation_results`, `federation_rankings`. Campos
novos em coleção existente: só os dois **opcionais** de `tournaments`
(`federation_id`, `federation_sanction`, §6.2). Os avisos são `notifications`
com `type: 'federation'` (os do PR 2 saem do navegador, `origin` padrão).

**Dado pessoal** (princípio 10): CNPJ completo, razão social e telefone da
entidade ficam em `federations/{id}/private/data` (quem pediu, a equipe
`admin`, o admin da plataforma); em público só `cnpj_masked`. A filiação
**nunca** é pública: só o próprio, a equipe que atende e o admin. A
verificação pública mostra o mínimo. O que vai no pedido está em §5.2.

**Exclusão de conta**: filiações e cobranças **ficam sem o nome**
(`coletarFederacoes`), os códigos de carteirinha são apagados, os papéis em
equipe saem, a federação que a pessoa pediu fica com "Usuário removido"; nos
**resultados oficiais** a linha da pessoa vira "Atleta removido" sem `uid` (o
ranking refeito a tira; os demais seguem valendo), o pedido de filiação de
clube/arena que ela fez fica sem `requested_by`;
**presidente de federação não exclui a conta** (bloqueio, como dono de arena —
passa a presidência antes). **Exportação**: bloco `federations`
(`collectFederationExport`: filiações, cobranças, papéis, federações que pediu,
pedidos de filiação de clube/arena, resultados oficiais em que aparece).
`federation_rankings` fica fora da exportação de propósito: é derivado dos
resultados, que já vão.
`exclusaoCobreColecoes.test.js` reprova coleção `federation_*` nova fora dos dois.

## 8. Servidor (detalhe em `docs/47-BACKEND-CLOUD-FUNCTIONS.md` §8a)

| Função | Tipo | Quem | Faz |
|---|---|---|---|
| `federationReview` | callable | admin da plataforma | approve / reject / suspend / verify / unverify / official / unofficial |
| `federationMembership` | callable | a pessoa (`request`, `renew`, `cancel`) ou `members` (`approve`, `reject`, `suspend`, `reinstate`) | o ciclo da filiação (§5.2) |
| `federationChargeConfirm` | callable | `finance` | `confirm` / `cancel` da cobrança |
| `federationVerify` | callable **sem login** | qualquer um | o mínimo da carteirinha por código |
| `federationMembershipSweep` | agendada 06:00 | — | vencimentos, avisos 30/7/1, contagem |
| `federationRankingRecompute` | gatilho `federation_results/{id}` | — | recalcula `federation_rankings/{fed}_{temporada}` (§6.3) |
| `federationRankingConfig` | gatilho `federations/{id}` | — | `ranking_config` mudou ⇒ refaz todas as temporadas da federação |

Toda função confere a flag, grava `audit_logs` (`federation_*`) e avisa por
`notifications` (`origin: 'server'`, textos em `tx()` → `functions/i18n/avisos.json`).

## 9. Ajuda, dicas, idiomas e termos

- **Central de ajuda** (`helpCenter.js`, parte Atleta, `flags: ['federations']`):
  "Filiar-se a uma federação" (com torneio chancelado, ranking oficial e
  clubes/arenas filiados), "Abrir e administrar uma federação" (Competições,
  Clubes e arenas, Módulos) e **"Torneio chancelado por uma federação"**
  (`federacao-torneios`: pedir, decidir, só filiados, enviar, pontuar); pistas
  de rota para `/federacoes*` (a Central também aponta o artigo do torneio);
  seis perguntas no FAQ.
- **Guias com seta** (`guias.js`, área **Federações**): `federacao-filiar`
  (buscar → filiar → plano → enviar → carteirinha), `federacao-gerir` (Central:
  seções, configurações, filiados, financeiro, pendências) e
  **`federacao-chancela`** (lista de torneios → Geral → Federação → a Central
  decide → enviar o resultado → o ranking na página). **Pontos de dica**
  (`pontosDeDica.js`): abrir, minhas, filiar, carteirinha, seções, pendências,
  Pix, o do admin e, do PR 2, torneios chancelados, ranking oficial e clubes/
  arenas filiados (página da federação), Competições e Clubes e arenas (Central),
  Federação na gestão do torneio, "Enviar ao ranking oficial", Federação na
  gestão do clube e na Central da arena. Âncoras `data-dica="federacao-…"`,
  `torneio-federacao`, `torneio-enviar-resultado`, `torneio-so-filiados`,
  `clube-federacao` e `arena-federacao` são contrato (guarda `dicas.test.js`).
- **Idiomas**: catálogo `src/modules/federations/i18n/locales/{en,es}.js`
  (687 chaves, inclusive os avisos do servidor e os textos do PR 2, que o
  guarda `i18nCatalogos` exige mesmo quando usados nas telas de torneio, clube
  e arena); `npm run i18n:avisos` regravou `functions/i18n/avisos.json`.
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

## 11. Pendências e próximas fases

- Flavio: ligar a flag `federations` em Painel admin → Funcionalidades;
  revisão jurídica dos dois termos.
- ~~**PR 2**~~ — entregue: clubes e arenas filiados (`affiliations`),
  chancela de torneios (`tournaments`) e ranking oficial (`ranking`).
  Fora de propósito: ranking por **dupla** (as linhas são por pessoa, como o
  ranking da plataforma), descarte de resultado por **data** (só `best_n`),
  e a federação **convidar** clube/arena (quem gere pede). Quando pedirem.
- **PR 3** — `federation_members/{id}/private/data` (CPF, responsável do
  menor), transferências, importação de filiados, cursos e credenciais
  (`courses`), disciplina e ouvidoria (`discipline`).
- **PR 4** — notícias e avisos (`news`), patrocinadores (`sponsors`), cupons e
  vantagens (emissor `federation` no `promo/`), loja no Mercado (`store`),
  governança e card no início.
