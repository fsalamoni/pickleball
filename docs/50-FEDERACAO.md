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
| Sub-módulos que cada federação liga para si | Central → Configurações → Módulos (os doze disponíveis, com a arbitragem do §22; §19) |
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
   oficial no Mercado); depois, **`official_docs`** (acervo) e **`calendar`**
   (agenda); **`accounts`** (orçamento e prestação de contas, §22), **`referees`** (arbitragem, §23) e **`elections`** (eleições, §24) — os catorze disponíveis. Ligar e desligar: §19. Módulo novo nasce `planned` ("Em breve"). A tela de cada módulo pergunta `fedModuleOn(federation, x)`
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
  página. Aprovada, a federação **nasce oculta** (`published` ausente) e só
  abre ao público quando o admin dela publica em Página pública → Publicação;
  a filiação e os pedidos de fora só abrem publicada (`fedPublic`, §17).

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
residência, autorização do responsável, outro). "Outro documento" exige o
**nome** de cada um (`other_docs[] { id, label }`, até 5, id estável
`o_xxxxxxxx`; `requiredDocs(plan)` em `domain/privateData.js` devolve a lista
que a tela mostra). A pessoa escolhe os arquivos **no próprio formulário de
filiação** (`V2FederationJoin`, um campo por documento): eles sobem logo depois
que o servidor cria a filiação (a regra exige a filiação existindo), e o que
falhar fica para a aba Minha filiação (`FedMemberDocuments`), sem perder o
pedido. Storage `federacao/{uid}/`, PDF ou imagem < 5 MB, registro em
`federation_documents_submitted` com `doc_key` (o id do documento próprio) e
`label`; a secretaria aceita ou recusa (aba Documentos; o arquivo chega pela
função `federationDocument`). Plano antigo com "outro" sem nome segue pedindo
um "Outro documento" genérico; ao editar, o plano pede o nome.

**Termos.** **Filiado** é quem tem o vínculo pago com a federação (plano
`tier: 'federated'`, o valor gravado não muda); **cadastrado** é o vínculo
gratuito (`registered`). A tela, a declaração e a ajuda usam esses dois nomes.

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
| `/federacoes` | `V2Federations` | As da pessoa em DOIS grupos (§18): **Na equipe** (cargo + "Abrir a Central") e **Suas filiações** (situação + "Minha filiação", que abre `?aba=minha`); depois todas as publicadas (as da região primeiro, `useRegionalList`; a busca ignora a região) e "Abrir uma federação" |
| `/federacoes/abrir` | `V2FederationApply` | Formulário (campos públicos em `FederationPublicFields` + dados da entidade), estado do pedido (em análise / aprovada / recusada com motivo) |
| `/federacoes/:id?aba=` | `V2FederationDetail` | **Três camadas separadas (§18)**: a barra escura da equipe (`FedStaffBar`, só quem tem cargo ou o suporte), a página pública em abas (`FederationProfile`, a MESMA do `/f/:slug`) e a área do filiado (faixa `FedMemberStrip` + aba **Minha filiação** `FedMyMembership`, marcadas "Só você vê"). Abas (`profileTabs`, só as dos módulos ligados): Visão geral (sobre, planos, promoções, 3 notícias, 3 eventos, patrocinadores; contato, loja e conferir carteirinha ao lado), Minha filiação, Notícias, Agenda, Competições (torneios chancelados + ranking oficial), Documentos (acervo + governança), Cursos (+ credenciados), Clubes e arenas, Contato (+ ouvidoria com `discipline`). Na aba Minha filiação: aviso de suspensão, cobranças Pix, carteirinha, declaração, renovar, **Documentos**, **Sanções** (com recurso), **Transferência** e "Filiar um dependente". `?visao=publico` = prévia "como visitante" para a equipe |
| `/federacoes/:id/filiar` | `V2FederationJoin` | 1. tipo de filiação → 2. plano (preço com o desconto da pessoa; faixa de idade exige nascimento no perfil) → 3. preferências, clube, observação, termos → pedido. PR 3: CPF se a federação pede (`federationAsksCpf`), responsável ciente para 12–17, menor de 12 só com `?dependente=1` (nome, nascimento e dados do dependente, na conta do responsável), documentos exigidos listados antes de enviar |
| `/federacoes/:id/gerir?aba=` | `V2FederationManage` | A Central (cabeçalho "Central da federação · área da equipe", com "Ver como visitante" e "Página pública"): **Atender** (Hoje · Filiados: Pedidos, Filiados, **Clubes e arenas** [módulo `affiliations`], **Transferências**, **Documentos**, **Importar** [`FedSecretariatPanel`] · **Competições** [permissão `competitions`; módulos `tournaments`/`ranking`]: Chancelas, Resultados, Ranking · **Cursos** [permissão `courses`; módulo `courses`; `FedCoursesPanel`]: Cursos, Credenciais · **Disciplina** [permissão `discipline`; módulo `discipline`; `FedDisciplinePanel`]: Sanções, Ouvidoria · **Comunicação** [permissão `comms`; PR 4]: **Notícias** [módulo `news`], **Cupons e campanhas** [módulo `promos`], **Patrocinadores** [`admin` + módulo `sponsors`] · Financeiro: Cobranças, Recebidos) e **Gerir** (**Página pública** [`admin`]: Publicação, Conteúdo, Transparência · Equipe · Configurações: Planos, Recebimento, Módulos, **Regras**, **Loja** [`admin`/`finance` + módulo `store`]). A seção só existe para quem tem a permissão e a aba de módulo só com o módulo ligado (`buildFederationSections(perms, federation)`); a aba mora na URL (`?aba=`; `?secao=` abre a primeira). Faixa "Precisa de você" (`FederationPendencias` ← `federationPendingItems`: pedidos, pagamentos, **clubes/arenas pedindo**, **chancelas para analisar**, transferências para responder, documentos para conferir, recursos de sanção, manifestações sem resposta) no topo |
| `/f/:slug?aba=` | `PublicFederation` (V1, fora do V2Layout) | A página pública para quem não tem conta: cabeçalho do PickleRush ("Abrir no app"/"Entrar") e o MESMO `FederationProfile` do app, com as mesmas abas; sem barra da equipe nem área do filiado (§18) |
| Início → card **Federação** | `HomeFederationCard` (`home_cards`, opcional, só com a flag) | Até 3 filiações (as que pedem pagar ou renovar primeiro, `homeFederationRows`) e a última notícia de cada federação |
| Gestão do clube → Federação | `OrgAffiliationCard kind="club"` (`V2ClubAdmin`) | Pedir filiação a uma federação com `affiliations` ligado (mensagem ≤ 500), acompanhar (pendente/aprovada/recusada/suspensa com motivo), retirar o pedido ou desfiliar |
| Central da arena → Equipe e parceiros → **Federação** (`?aba=federacao`) | `OrgAffiliationCard kind="arena"` (`V2ArenaManage`, aba só com a flag) | O mesmo cartão para a arena |
| Página do clube / da arena | `OrgAffiliationBadges` (`FedTags.jsx`) | Selo "Filiado · SIGLA" (só filiação **aprovada**), ligando à federação |
| Gestão do torneio → Geral → **Federação** | `TournamentSanctionCard` (`TournamentAdminTab`) | Pedir a chancela: federação com `tournaments` ligado, tipo proposto (regional/estadual/principal) e "Só filiados em dia se inscrevem"; estado e motivo; retirar o pedido pendente |
| Torneio (hero, cartão da lista, página pública `/p/:id`) | `TournamentSanctionBadge` | Selo "Chancelado · SIGLA" (+ "só filiados"), só com a chancela **aprovada** |
| Resultados do torneio (gestão, por categoria) | `FederationResultButton` (ao lado do `PodiumBlock`) | Com a chancela aprovada e a categoria **completa** (`isModalityComplete`): "Enviar ao ranking oficial" / "Reenviar"; mostra "No ranking desde…" ou "recusado: motivo"; temporada fechada (depois de 31/01 do ano seguinte) esconde o botão e diz que o resultado não muda mais |
| Inscrição numa modalidade | `ModalityRegistrationDialog` | Torneio "só filiados": `membershipRequirement(tournament, minhasFiliacoes)` — sem filiação em dia, aviso vermelho com link à federação e **sem botão de inscrever**; consulta falhando ⇒ "não deu para conferir" + tentar de novo (nunca afirma que a pessoa não é filiada). O organizador inscreve qualquer pessoa |
| `/f/verificar/:codigo?` | `PublicFederationVerify` | Digitar/ler o código → em dia / irregular / não encontrada; o mesmo código verifica a **credencial** de curso (PR 3: nome, foto se permitida, tipo, curso, emissão, validade) |
| Minha área → Federações | `FederacoesSecao` | Cobranças para pagar, filiações (carteirinha, renovar), equipe; pendências na faixa (`myFederationPending`). PR 3: transferências pendentes, **dependentes** filiados, **credenciais** (tornar pública/privada, verificar) e sanções |
| Painel admin → Federações | `AdminFederationsPanel` | Filtros por estado, aprovar/recusar/suspender com motivo, selos, dados da entidade; na caixa de entrada do admin, "Federações esperando aprovação" |

Os valores de `?aba=` da Central (`pedidos`, `filiados`, `filiados-orgs`,
`transferencias`, `documentos`, `importar`, `chancelas`, `resultados`,
`ranking`, `cursos`, `credenciais`, `sancoes`, `ouvidoria`, `cobrancas`,
`recebidos`, `equipe`, `planos`, `pix`, `pagina`, `modulos`, `regras`, `hoje`
e, do PR 4, `noticias`, `divulgacao`, `patrocinadores`, `governanca`, `loja`; desde
§18 `publicacao`, `pagina` e `governanca` moram na seção Página pública, com os
mesmos valores)
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

**A federação também convida** (2026-10-22). Em Filiados → Clubes e arenas,
"Convidar clube ou arena" (`FedOrgInviteDialog`) abre a lista de clubes e
arenas da plataforma já aberta, com busca por nome ou cidade; quem já é
filiado, pediu ou tem convite aparece com o motivo e sem botão
(`canInviteOrg`: só sem documento ou recusado). O convite é o MESMO documento,
com `status: 'invited'`, `invited_by` e `requested_by: null`
(`buildAffiliationInvite`), gravado pela equipe `admin`/`members` de federação
**pública** — nenhuma coleção nova. Quem gere a organização recebe o aviso
(administradores do clube por `club_members`, gestores da arena por
`arena_managers`, com o link para a aba Federação) e **aceita** — vira
`approved` na hora, com `requested_by` = quem aceitou (é o representante que
vota nas eleições) e `accepted_at_ms` — ou **recusa** (o documento é apagado;
dá para convidar de novo). A equipe pode cancelar o convite enquanto não for
respondido, e é avisada da resposta. A equipe **não** aprova o próprio convite
(a regra recusa atualização de staff num `invited`). Suspenso volta por
"Reintegrar", não por convite.

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
  Documento público (é resultado de torneio público). **Temporada fechada é
  imutável na regra** (`fedSeasonOpen(season)`: até 01/02 do ano seguinte,
  00:00 de Brasília): criar, reenviar, recusar, readmitir e apagar resultado de
  ano fechado é recusado, e o reenvio não troca o `season` gravado.
- **Lançamento de pontos** (`federation_points/{resultId}_{uid}`, leitura
  pública, `allow write: if false`) — 2026-10-22, decisão do dono: **o ranking
  não é recalculado por janela nem por dia; cada torneio chancelado LANÇA os
  pontos de quem pontuou, naquela data, no histórico do atleta.** O gatilho
  `federationRankingRecompute` (`onResultWritten`) compara o envio com os
  lançamentos que já existem (`ledgerDiff`): quem entrou é lançado com a
  tabela do dia (`awardPoints`: `points_by_place[position]` 1º–8º ou
  `participation` × `tier_multipliers[tier]`; com `members_only`, só quem tinha
  filiação **federada** ativa na **data do torneio**, `memberValidOn`; linha
  sem `uid` não pontua); quem segue com a mesma colocação **fica como está**
  (os pontos não são refeitos por a tabela ou a filiação terem mudado
  depois); quem mudou de colocação tem o lançamento refeito, com o anterior em
  `previous { position, points }` e `revised_at_ms`; quem saiu, o resultado
  recusado e o resultado apagado têm o lançamento **cancelado** com
  `cancel_reason` (`not_in_result`, `result_rejected`, `result_deleted`; a
  exclusão de conta usa `account_deleted`). O lançamento guarda torneio,
  modalidade, data, temporada, categoria, colocação, pontos-base, peso e
  pontos — é o histórico do atleta, que ele vê em Minha filiação → **Meus
  pontos no ranking** (`FedMyPoints`, `personPointsHistory`, ano a ano + a soma
  de todos os anos).
- **Ranking do ano** (`federation_rankings/{fed}_{temporada}`, `allow write:
  if false`): a soma dos lançamentos `awarded` daquele ano
  (`aggregateSeason`), por **classe** (`gender_age_format`) e **geral**;
  contam os `best_n` melhores resultados de cada pessoa por classe (0 =
  todos; cada resultado leva `counts`); empate divide a posição. O documento
  guarda `uids` (a exclusão de conta acha o ano por aqui), `entries_count`,
  `closes_at_ms` e `last_day`. **Cada ano é imutável pelo ano seguinte**: em
  01/02 o ano fecha (`seasonClosed`, derivado da data — nenhuma tarefa
  agendada); fechado, o gatilho não muda lançamento nem soma, e a regra recusa
  mexer nos resultados dele. Mudar `ranking_config` (`federationRankingConfig`)
  **não é retroativo**: vale para os próximos envios e só reaplica o
  `best_n` aos anos **abertos** (`openSeasons`).
  Resultado `sent` que ainda não tem lançamento (enviado antes do livro de
  pontos, ou cujo gatilho se perdeu) é lançado na próxima soma do ano aberto
  (`recomputeSeason`), uma vez só — nenhuma migração à mão. A conta é
  `domain/officialRanking.js` com **cópia** em `functions/federationRanking.js`
  e paridade (`functions/federationRanking.parity.test.js`).
  `DEFAULT_RANKING_CONFIG` em `constants.js`; a equipe `competitions` edita em
  Competições → Ranking (`updateRankingConfig`). A tela só **lê** — nunca
  recalcula no navegador (lição do ranking da plataforma, `docs/18`). A página
  pública oferece os anos desde a criação da federação (`rankingSeasons`), com
  o selo "aberto até 31/01" ou "encerrado", e cada linha abre os resultados que
  somaram (e os que não contam). A aposentada `federationRankingRolling`
  (ranking corrido do PR #308, desfeito) segue publicada como função vazia até
  ser apagada à mão (`firebase functions:delete federationRankingRolling
  --region southamerica-east1`), porque o deploy por nome nunca apaga.

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
observação; a pessoa apaga o pendente. O plano diz o que exige (`requires_docs`
+ `other_docs`); o envio casa com o exigido por `submittedDocKey` (`doc_key`, ou
o `kind` nos tipos fixos).

**Importação** (`federationImportMembers`, até 500 linhas, aba Importar). A
federação que já existia fora da plataforma cola a lista (nome, e-mail, número,
validade) e escolhe o plano: quem **tem conta** com aquele e-mail vira filiado
**ativo** numa transação por pessoa (número da lista ou sequencial, validade
da lista ou do plano); quem já tem filiação viva é pulado; quem **não tem
conta** fica em `federation_imports.pending` (só a equipe lê). **Quando ela
cria a conta com aquele e-mail** (2026-10-22), o gatilho `federationImportInvite`
(`users/{uid}` criado → `onUserCreated`, `functions/federationSecretariat.js`)
acha a importação por `pending_emails` (`array-contains`, zero índice) e grava
o **convite** (`federation_invites`, `source: 'import'`, com o número e a
validade da lista, vale 90 dias) e o aviso — nunca a filiação direta: ninguém
vira filiado sem aceitar. Confirmando no plano do convite (`/federacoes/:id/filiar`
mostra "A federação já tinha você na lista de filiados"), a filiação entra
**ativa e sem cobrança**, com o número e a validade da lista, como a de quem
já tinha conta. Federação oculta, plano desativado ou filiação viva: não
convida e o e-mail segue pendente. A aba Importar mostra quem já foi
convidado (`invited_emails`). Nenhum e-mail vai para a filiação.

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
  a última de cada federação. **Agendada** (2026-10-22): estado `scheduled`
  com "Publicar em" (data e hora, até um ano; `publish_at_ms`) e, se marcado,
  "Avisar os filiados quando publicar" (`notify_on_publish`). Até a hora só a
  equipe lê (a regra só abre `published`); a varredura `federationNewsPublish`
  (a cada 15 min) publica com a data de Brasília daquele instante e, se pedido,
  manda o mesmo aviso de "Avisar os filiados", uma vez só. Federação com o
  módulo desligado deixa a agendada esperando.
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

Vinte e duas coleções, todas com prefixo `federation` e **zero índice composto**
(consultas de uma igualdade — ou duas igualdades, que também não pedem
índice; ordenação em memória): `federations` (+ `private/data`),
`federation_staff`, `federation_plans`, `federation_members` (+ `private/data`:
CPF, nascimento, responsável — PR 3), `federation_charges`,
`federation_card_index`; do PR 2, `federation_affiliations`,
`federation_results`, `federation_rankings`, `federation_points` (2026-10-22); do PR 3,
`federation_documents_submitted`, `federation_transfers`, `federation_imports`,
`federation_courses`, `federation_course_enrollments`, `federation_credentials`,
`federation_sanctions`, `federation_reports`, do PR 4, `federation_news`
(campos opcionais novos na própria federação: `sponsors`, `governance`), do
PR 7, `federation_admin_grants` (campos novos: `staff_roles`) e, do PR 8,
`federation_docs` (campo novo: `doc_numbers`, §14) e `federation_followers`
(quem segue o acervo e o calendário, §14.8) e, do PR 9a, `federation_events`
(calendário oficial, §15).
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
ranking refeito a tira; os demais seguem valendo); os **lançamentos de
pontos** ficam como histórico do torneio, sem `uid`, nome e foto — no ano
aberto são cancelados (`account_deleted`), no ano fechado a soma não muda e só
o nome sai, também do ranking gravado daquele ano; o pedido de filiação de
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
exportação. Os **lançamentos de pontos** da pessoa vão na exportação
(`official_points`, `listMyFederationPoints`). `federation_rankings` fica fora
de propósito: é a soma anual derivada dos lançamentos, que já vão.
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
| `federationImportInvite` | gatilho `users/{uid}` criado | — | conta nova com e-mail de importação recebe o convite (aceito: ativa sem cobrança) |
| `federationDocument` | callable | `members`/`admin` da federação do documento | devolve o arquivo do Storage (base64) à secretaria, com auditoria |
| `federationNews` | callable | `comms`/`admin` da federação | avisa os filiados ativos de uma notícia publicada, uma vez só (§6.7) |
| `federationAcervo` | callable (540 s, 1 GiB) | `docs`/`admin` da federação; `file` para quem lê o documento | acervo oficial: rascunho, publicação numerada com SHA-256, retificação, visibilidade, retirada do ar, entrega de arquivo restrito (§14) |
| `federationAgenda` | callable | `docs`/`admin` da federação; `competitions` só na agenda esportiva | calendário oficial: marcar/editar (motivo e histórico ao remarcar o que já foi divulgado), adiar, cancelar, apagar o nunca divulgado, aviso a quem segue (§15); reunião: convocar (pauta, edital, quórum) e registrar o resultado (presença, decisão por item, ata) (§15.9) |
| `federationAgendaFeed` | HTTP público (`/api/agenda/{slug}.ics`) | qualquer um | a agenda assinável (ICS) com os eventos públicos e os torneios chancelados (§15.6) |
| `federationRankingRecompute` | gatilho `federation_results/{id}` | — | lança, refaz ou cancela os `federation_points` do resultado e soma `federation_rankings/{fed}_{temporada}`; ano fechado não muda (§6.3) |
| `federationRankingConfig` | gatilho `federations/{id}` | — | `ranking_config` mudou ⇒ reaplica o `best_n` só aos anos **abertos**; não reescreve lançamento |
| `federationRankingRolling` | agendada (aposentada) | — | função vazia: o ranking corrido foi desfeito; apagar à mão (§6.3) |

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
  perguntas no FAQ. Depois vieram `federacao-acervo`, `federacao-agenda`,
  `federacao-reuniao`, `federacao-comentarios` e, em 2026-10-22, os artigos dos
  módulos de governança: **`federacao-arbitragem`** (quadro, escalas, súmula,
  avaliação, diárias, o que o público vê), **`federacao-contas`** (orçamento,
  lançamentos, prestação, parecer, prazo de abril), **`federacao-eleicoes`**
  (edital, chapas, impugnação, voto secreto, apuração) e
  **`federacao-conformidade`** (a lista da Lei 14.597), com cinco perguntas no
  FAQ e as pistas da Central e da página da federação (eleições).
- **Guias com seta (2026-10-22)**: **`federacao-arbitragem`** (Central →
  Arbitragem → Quadro → Incluir árbitro), **`federacao-contas`** (Contas →
  Orçamento → Lançamentos → Prestação de contas), **`federacao-eleicao`**
  (Eleições → Nova eleição) e **`federacao-votar`** (página → aba Eleições →
  Votar → Confirmar → comprovante). As abas Quadro, Orçamento, Lançamentos e
  Prestação de contas ganharam âncora (`federacao-aba-arbitragem-quadro`,
  `federacao-aba-orcamento-anual`, `federacao-aba-lancamentos`,
  `federacao-aba-prestacao-contas`) — contrato. Nenhum ponto de dica novo: as
  duas rotas da federação já estão no teto de 8.
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
    e `federation_points` `write: if false`); a tela nunca recalcula. A conta
    tem cópia no servidor com paridade (`functions/federationRanking.parity.test.js`).
    Cada torneio **lança** os pontos no histórico do atleta (o que foi lançado
    não é refeito por mudança de tabela ou de filiação); o ano soma os
    lançamentos e **fecha em 31/01 do ano seguinte** — fechado, não muda
    (regra `fedSeasonOpen`, servidor e tela). Nunca volte a um ranking por
    janela móvel nem recalculado por dia.
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
44. **`federation_events` só o servidor grava** (`federationAgenda`), e o
    evento já divulgado **não muda de data nem some calado**: remarcar,
    reabrir, adiar e cancelar exigem motivo, entram no histórico e avisam
    quem segue; apagar só o que só a equipe viu (§15).
45. **Os tipos de evento são gravados** e a validação tem cópia no servidor
    (`federationAgendaPolicy.js` ⇄ `domain/agenda.js`, paridade em
    `federationAgenda.parity.test.js`, que também confere o ICS byte a
    byte). O horário é sempre o de Brasília.
46. **A agenda assinável leva só o público.** O que é só para filiados ou só
    da equipe nunca entra no ICS (o endereço é aberto); torneio entra só
    chancelado e público.
47. **Reunião: a convocação e o resultado são do servidor** (`federationAgenda`,
    ações `convene` e `record`), com a validação copiada em
    `federationMeetingPolicy.js` (paridade com `domain/meeting.js`). Sem
    quórum nada se decide (só adiado ou retirado); votos só no que foi votado;
    mudar a convocação divulgada e corrigir resultado exigem motivo e vão ao
    histórico; o resultado só depois do início, e depois dele a data não muda.
    O prazo do estatuto (`rules.convocation_min_days`) **avisa, não bloqueia**
    (§15.9).
48. **Comentários: tudo pelo servidor, e a lista não entrega uid.**
    `federation_comments` só o autor lê direto e ninguém grava;
    `federation_comment_reports` ninguém lê nem grava. A lista
    (`federationCommentsList`) confere a leitura do documento ou evento com a
    régua da regra; três denúncias de pessoas diferentes ocultam; ocultar exige
    motivo e avisa o autor; consulta pública vai até o fim do dia em Brasília
    (paridade `federationComments.parity.test.js`). Modos e motivos de
    denúncia são gravados — nunca renomeie (§16).
49. **Aprovada não é pública.** Pública = `approved` **e** `published == true`,
    com a mesma régua na regra (`fedPublic`/`fedSees`), no cliente
    (`isFederationPublic`) e no servidor (`publicada`). Campo ausente = oculta.
    Toda leitura de fora e todo pedido de fora (filiação, transferência,
    clube/arena, chancela, cupom, campanha, loja, agenda assinável) passam
    por ela; a equipe estrutura tudo oculta. Consulta do diretório leva as duas
    igualdades. Só o admin da federação publica (§17).

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
transparência: Lei Geral do Esporte (Lei 14.597/2023, art. 36). O PR 8a fez
a gestão na Central; o PR 8b, a página pública, seguir o acervo e o cartaz
da sede (§14.8).

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

**Cota de mulheres na direção** (PR 10): no fim da aba, o item do art. 36,
IX (no mínimo 30% de mulheres nos cargos de direção), calculado por
`womenQuota` (`domain/governance.js`) a partir da diretoria da Governança e de
`governance.women_count` — o NÚMERO de mulheres, nunca quem, que o admin
informa em Página pública → Transparência, logo abaixo da diretoria, com o mesmo
aviso. O mínimo é arredondado para cima (7 cargos ⇒ 3). **Só aviso**: nada
é barrado. O fim de mandato já avisa desde a Etapa 1 (30, 7 e 1 dia antes,
`federationStaff`).

### 14.6 Exclusão de conta e exportação

O documento é ato da federação, não dado da pessoa: fica, guardando só o
`created_by` (contado como retido na prévia), e não vai na exportação. Os
rascunhos não usados em `federacao-acervo/{uid}/` são apagados com a conta.
O "seguir" (`federation_followers`) é da pessoa: sai com a conta e vai na
exportação ("Acervos de federação que você segue").

### 14.7 Âncoras

`federacao-secao-acervo`, `federacao-acervo`, `federacao-acervo-novo`,
`federacao-acervo-formulario`, `federacao-acervo-anexar`,
`federacao-acervo-relacoes`, `federacao-transparencia`,
`federacao-acervo-cartaz`; na página pública, `federacao-acervo-publico`
(bloco na página da federação), `federacao-acervo-pagina`,
`federacao-acervo-transparencia`, `federacao-acervo-seguir`,
`federacao-acervo-compartilhar`, `federacao-acervo-integridade`. Artigo de
ajuda `federacao-acervo` e guia `federacao-acervo` (Central → publicar).

### 14.8 Página pública, seguir e mural da sede (PR 8b)

- **Endereço**: `/f/:slug/acervo` e `/f/:slug/acervo/:docId`
  (`src/pages/PublicFederationAcervo.jsx`, rota em `src/App.jsx`, fora do
  V2Layout, abre sem conta). Flag desligada ⇒ início; módulo desligado ⇒
  "Acervo não disponível". Documento de outra federação, rascunho, retirado
  ou sem permissão ⇒ "Documento indisponível" (a regra não distingue
  "não existe" de "não pode", e a tela não finge saber), com "Entrar" para
  quem não tem conta. Outra falha ⇒ `V2ErrorState`.
- **Lista** (`v2/components/federations/acervo/AcervoPublic.jsx`):
  `useVisibleAcervo` junta as três consultas (públicos, só filiados para
  filiado ativo/equipe, só equipe para a equipe) por `mergeDocLists`; se as
  restritas falham, a lista mostra os públicos e DIZ que faltou. Abas
  **Mural** (`muralDocs`, publicações e retificações mais recentes, selo
  "Novo" por 7 dias), **Documentos** (busca sem acento, categoria, ano, "só
  em vigor") e **Transparência** (o mesmo `TRANSPARENCY_ITEMS` da Central),
  com `?aba=` na URL. Bloco `FedAcervoBlock` (últimos 4) na página da
  federação — pública e no app.
- **Documento** (`AcervoDocView.jsx`): código, título, selos, aviso de
  revogado (com link para o ato que revoga) e de retificado; metadados;
  leitor no próprio lugar (`fileViewKind`: PDF em `iframe`, imagem, áudio,
  vídeo; o restrito chega pela função como `blob:`), "Abrir ou baixar",
  vídeo por link só depois do toque; atos relacionados e versões anteriores
  com os arquivos; **compartilhar** (nativo ou WhatsApp, copiar link, QR com
  download), **imprimir** (rodapé com o endereço); **conferir integridade**:
  a pessoa escolhe o arquivo, o SHA-256 é calculado no aparelho
  (`crypto.subtle`) e comparado com os da versão atual e das anteriores
  (`findFileByHash`) — o arquivo não sai do aparelho.
- **Seguir** (`federation_followers/{fed}_{uid}`, campos `federation_id`,
  `user_id`, `created_at`): só a própria pessoa lê, cria e apaga; o `get` do
  documento ainda inexistente é permitido (é como o botão sabe). Publicar e
  retificar avisam no sino quem segue **e pode ler** o ato (público: todos;
  só filiados: filiado ativo ou equipe; só equipe: ninguém), menos quem
  publicou; lotes de 400; a contagem vai na auditoria
  (`followers_notified`) e falha no aviso nunca desfaz a publicação.
- **Cartaz da sede** (Central → Acervo → "Cartaz para a sede"): folha A4
  com marca, nome e QR do acervo, pelo mesmo caminho de impressão da
  carteirinha — a lei pede as publicações também em mural físico.
- **CSP**: `frame-src` ganhou `https://firebasestorage.googleapis.com` e
  `blob:` (o PDF dentro da página).

## 15. Calendário oficial (Etapa 3 do acervo, PR 9a)

A agenda esportiva e institucional da federação: competições, assembleias,
reuniões dos órgãos, prazos e eventos. A lei pede que a entidade divulgue os
atos e as convocações (Lei Geral do Esporte, art. 36); o calendário é onde
quem joga e quem é filiado vê **quando** as coisas acontecem, e o que mudou.
As **reuniões com pauta, quórum, presença e votação** vieram no PR 9b
(§15.9): o tipo `meeting` do catálogo marca quais eventos as têm.

### 15.1 Módulo, permissão e tela

Sub-módulo `calendar` ("Calendário oficial"). Marca e gerencia quem tem
`docs` ou `admin` (qualquer evento); a diretoria de competições
(`competitions`) marca e gerencia **só a agenda esportiva**. Seção **Agenda**
da Central (`?aba=agenda`), componente
`src/v2/components/federations/manage/FedAgendaPanel.jsx`: formulário de
evento, adiar/cancelar com motivo, apagar o que nunca foi divulgado, lista de
próximos e anteriores, e "Ver como o público vê".

### 15.2 Catálogo e validação (`domain/agenda.js`)

Três agendas (`group`): `sport`, `institutional`, `event`. Catorze tipos
(`kind`, **gravados — nunca renomeie**): competição, seletiva, curso,
outro esportivo; assembleia geral ordinária, extraordinária, especial ou
eleitoral, diretoria, conselho fiscal, comissão (estes seis com
`meeting: true`), prazo oficial, expediente/recesso; solenidade, evento.
Horário **de Brasília** (UTC−3, sem horário de verão); dia inteiro ou com
início e fim; até um ano de duração; local (nome, endereço, cidade, UF da
lista), link `https://` para acompanhar online, órgão que se reúne, descrição
(até 4.000 caracteres), até 10 documentos **publicados** do acervo ligados e
quem vê (`public`, `members`, `staff`). A validação tem **cópia no servidor**
(`functions/federationAgendaPolicy.js`, paridade em
`functions/federationAgenda.parity.test.js`), e é ela que calcula
`starts_at_ms`/`ends_at_ms`.

### 15.3 Ciclo do evento (`functions/federationAgenda.js`)

- **`save`** cria ou edita. Evento que **já foi divulgado**
  (`ever_visible`: algum dia foi público ou só filiados) e muda de data ou
  horário, ou que estava adiado/cancelado, **exige motivo** (≥ 10
  caracteres) e ganha uma linha no histórico (`rescheduled` ou `reopened`,
  com a data anterior e a nova). Ao divulgar pela primeira vez, a equipe
  escolhe avisar quem segue.
- **`postpone`** — adiado sem nova data, com motivo; fica na agenda como
  "Adiado — nova data a definir". Só um evento confirmado e que ainda não
  aconteceu.
- **`cancel`** — cancelado, com motivo; fica na agenda, riscado.
- **`delete`** — só o que **nunca** foi divulgado. O resto se cancela.

O histórico guarda as 20 últimas mudanças (`history[]`: `kind`, `reason`,
`at_ms`, `by_name`, datas de antes e depois). Remarcar, reabrir, adiar e
cancelar **avisam quem segue** as publicações oficiais
(`federation_followers`, o mesmo botão do acervo) e pode ver o evento;
auditoria `federation_event_save|postpone|cancel|delete` com a contagem de
avisados.

### 15.4 Quem lê (regra)

`federation_events`: público para todos; "só filiados" para filiado ativo e
equipe; "só a equipe" para quem tem cargo; o admin da plataforma só com o
acesso justificado valendo (`fedPlat`). `write: if false`. A tela consulta
por `federation_id` + `visibility` (duas igualdades, sem índice) — consulta
que a regra consegue provar. Emulador:
`tests/rules/federationEvents.rules.test.js`.

### 15.5 Torneios chancelados

Com o módulo `tournaments` ligado, os torneios **chancelados** (chancela
aprovada, públicos, não arquivados, nem rascunho nem cancelados) entram na
agenda como itens **derivados** (`tournamentAgendaItem`, nada gravado), com o
link para o torneio. Também vão no ICS.

### 15.6 Página pública e agenda assinável

- **Endereço**: `/f/:slug/agenda` e `/f/:slug/agenda/:eventId`
  (`src/pages/PublicFederationAgenda.jsx`, rota em `src/App.jsx`). Módulo
  desligado ⇒ "Agenda não disponível"; evento que a pessoa não pode ver
  (permissão negada) é dito diferente de falha de rede.
- **Lista** (`v2/components/federations/agenda/AgendaPublic.jsx`):
  `useVisibleAgenda` junta públicos, só filiados (para filiado ou equipe), só
  equipe e torneios; parte que falhou é dita ("Parte da agenda… não
  carregou"), nunca vira vazio. Próximos e anteriores (`?aba=`), busca, filtro
  por agenda, grupos por mês e os adiados à parte. Bloco `FedAgendaBlock`
  (próximos 4) na página pública e na página logada da federação.
- **Evento** (`AgendaEventView.jsx`): selos, faixa de adiado/cancelado com o
  motivo, data e local (mapa), link online, órgão, descrição, documentos
  ligados (cadeado quando restritos), **Adicionar ao calendário** (.ics do
  evento), **Google Agenda**, compartilhar/WhatsApp/copiar, seguir e "O que
  mudou".
- **Assinar a agenda**: `/api/agenda/{slug ou id}.ics`, servido por
  `federationAgendaFeed` (rewrite no `firebase.json`; cache de 15 min). Leva só
  os eventos **públicos** do último ano para a frente e os torneios
  chancelados; o adiado sai como `STATUS:TENTATIVE`, o cancelado como
  `CANCELLED` (o calendário de quem assinou atualiza sozinho). A tela oferece
  `webcal://`, o Google Agenda (`calendar/r?cid=`) e copiar o endereço.

### 15.7 Exclusão de conta e exportação

O evento é da federação: a conta excluída fica só como `created_by` (contado
na prévia como retido, em `accountDeletion.js`); não vai na exportação.

### 15.8 Âncoras

Central: `federacao-secao-agenda`, `federacao-agenda`,
`federacao-agenda-novo`. Público: `federacao-agenda-publica` (bloco),
`federacao-agenda-pagina`, `federacao-agenda-assinar`. Artigo de ajuda e guia
`federacao-agenda`.

### 15.9 Reuniões e assembleias: convocação, pauta e resultado (PR 9b)

Vale para os tipos com `meeting` no catálogo (assembleias ordinária,
extraordinária e especial; diretoria; conselho fiscal; comissões). Tudo mora
no campo `meeting` do próprio evento — **nenhuma coleção nova, nenhuma regra
nova** (`federation_events` já é `write: if false`). Quem age é `docs` ou
`admin` (são tipos institucionais; `competitions` não convoca).

**Convocação** (ação `convene`): data do edital (não futura, não depois da
reunião), o **edital** — um ato **publicado** do acervo do tipo convocação ou
aviso, copiado com código, título e visibilidade —, quórum da primeira
chamada, horário e quórum da segunda e a **pauta** (até 40 itens, cada um
`deliberation`, `election` ou `information`, com id pela posição `p1…`). A
primeira convocação avisa quem segue, se a equipe pedir e o evento não for só
da equipe. Mudar a convocação de reunião já divulgada **pede motivo**, entra
no histórico (`agenda_changed`) e avisa. Não se convoca evento cancelado,
adiado ou com resultado.

**Prazo do estatuto**: `federations.rules.convocation_min_days` (padrão 8,
0–365; Configurações → Regras). Com menos antecedência a Central mostra um
aviso no evento e no formulário — **não bloqueia**, porque o estatuto pode
prever urgência e a federação responde por isso.

**Resultado** (ação `record`): só com convocação, evento confirmado e depois
do horário de início. Chamada (primeira ou segunda), horário de abertura,
presentes e aptos (presentes ≤ aptos), se houve quórum e, por item da pauta,
o resultado — aprovado ou rejeitado (deliberação), eleição realizada
(eleição), informado (informe), adiado ou retirado (qualquer um) —, os votos
(a favor, contra, abstenções; guardados só em aprovado, rejeitado e eleito),
um resumo e o **ato** do acervo que saiu do item. Documentos da reunião: ata,
lista de presença e registro de votação, cada um do tipo certo. **Sem quórum
nada se decide**: só adiado ou retirado. O primeiro registro avisa quem segue
(`recorded`); corrigir pede motivo, vai ao histórico (`record_corrected`) e
avisa. Auditoria `federation_event_convene|record`.

**Travas no `save`**: reunião convocada não vira outro tipo de evento; a data
não pode ficar antes da convocação; com resultado registrado a data não muda.

**Telas**: na Central, cada reunião mostra "Ainda sem convocação", "Convocada
· pauta com N itens" ou "Resultado publicado", o aviso de prazo e os botões
Convocar e Registrar/Corrigir o resultado (`manage/FedMeetingDialogs.jsx`).
Na página pública do evento, `agenda/MeetingBlock.jsx` mostra a convocação
(com quantos dias de antecedência saiu), a pauta e, depois, presença, chamada,
quórum e a decisão de cada item com os documentos (restrito com cadeado).

**Âncoras**: `federacao-reuniao-convocar`, `federacao-reuniao-resultado`
(Central), `federacao-reuniao-publica` (página do evento). Artigo de ajuda
`federacao-reuniao`.

**Testes**: `functions/federationMeeting.test.js` (servidor contra banco
falso), `functions/federationMeeting.parity.test.js` (cliente × servidor),
`domain/meeting.test.js`, `manage/FedMeetingDialogs.runtime.test.jsx` e a
página do evento em `agenda/AgendaPublic.runtime.test.jsx`.


## 16. Comentários nos documentos e eventos (Etapa 4 do acervo, PR 10)

Documento **publicado** do acervo e evento da agenda (não o torneio derivado)
têm, no fim da página, a seção de comentários
(`v2/components/federations/comments/CommentsSection.jsx`). Domínio em
`domain/comments.js`, servidor em `functions/federationComments.js`, régua
copiada em `functions/federationCommentsPolicy.js` (paridade em
`federationComments.parity.test.js`).

**Quem lê e quem comenta.** A lista vem da função **`federationCommentsList`**
(abre sem login), que confere a leitura do documento ou evento com a mesma
régua da regra (público: todos; só filiados: filiado ativo e equipe; só a
equipe: equipe; documento não publicado: ninguém) e **não entrega uid de
ninguém** — só o nome gravado e "é meu". Comentar, denunciar, apagar o
próprio, responder, ocultar, reabrir, mudar o modo e ver a fila passam pela
`federationComments` (com login). Os comentários ocultos só a moderação e o
próprio autor veem.

**Limites.** Texto de 3 a 1.000 caracteres (espaços e linhas em excesso são
limpos); 30 s entre comentários e no máximo 10 por dia, por pessoa, no mesmo
documento ou evento; a lista mostra os 300 mais recentes.

**Abertos, fechados ou consulta pública.** Cada documento ou evento guarda
`comments: { mode, until_date, until_ms }` (`open` | `closed` |
`consultation`; ausente ⇒ aberto). A consulta vai até o **fim do dia**
escolhido em Brasília (`endOfDayBr`) e não começa no passado; encerrada,
ninguém comenta e o que foi escrito fica. A federação inteira desliga em
Configurações → Regras (`rules.comments === false`, ausente ⇒ ligado);
desligado e sem nada escrito, a seção some.

**Moderação** (permissão `docs` ou `admin`):
- **resposta oficial** em nome da federação (`official: true`, `org_name`),
  só a comentário (não a resposta), avisa quem comentou;
- **denúncia** com motivo (`offensive`, `personal_data`, `spam`, `off_topic`,
  `other`), uma por pessoa (`federation_comment_reports/{comentário}_{uid}`,
  numa transação); **3 de pessoas diferentes ocultam** (`hidden_by:
  'reports'`). Não se denuncia o próprio comentário nem a resposta oficial (a
  ouvidoria é o caminho);
- **ocultar** com motivo (≥ 10 caracteres, `hidden_by: 'staff'`) avisa o
  autor com o motivo; **reabrir** zera as denúncias;
- **apagar** é só do autor e leva as respostas e as denúncias junto;
- a **fila** (`queue`) fica na Central → Acervo oficial → **Comentários**
  (sem o acervo, Agenda → Comentários): ocultos por denúncias, pela
  moderação e visíveis com denúncia (`manage/FedCommentsPanel.jsx`).
- Auditoria `federation_comment_reply|hide|restore|settings`.

**Regras.** `federation_comments`: só o autor lê o próprio (a exportação);
ninguém grava pelo navegador. `federation_comment_reports`: ninguém lê nem
grava. Provado em `tests/rules/federationComments.rules.test.js`.

**Exclusão de conta e exportação.** A exclusão apaga os comentários da pessoa
(`user_id`) e as denúncias que ela fez (`reporter_id`); a exportação leva os
comentários (`listMyFederationComments`). A denúncia fica fora da exportação
de propósito: é sobre o comentário de outra pessoa e serve à moderação.

**Âncoras**: `federacao-comentarios`, `federacao-comentarios-escrever`,
`federacao-comentarios-config` (página), `federacao-comentarios-moderacao`
(Central). Artigo de ajuda `federacao-comentarios`.

**Testes**: `functions/federationComments.test.js` (servidor contra banco
falso), `functions/federationComments.parity.test.js`,
`domain/comments.test.js`, `comments/CommentsSection.runtime.test.jsx` e a
regra no emulador.

Fora de propósito: editar comentário (apaga-se e escreve-se de novo, para a
resposta oficial nunca ficar respondendo a outro texto); curtidas; resposta de
quem não é da federação a outro comentário (a conversa fica entre a pessoa e
a federação, e a página oficial não vira fórum). Quando pedirem.

## 17. Publicação: a federação aprovada nasce oculta (2026-10-21)

Pedido do dono: a federação só fica pública quando o **admin dela** a torna
pública, nas configurações — para montar tudo antes de abrir aos demais.

### 17.1 O campo e a régua

- `federations.published` (opcional, booleano). **Ausente = oculta** — vale
  também para as federações aprovadas antes desta mudança: elas ficam ocultas
  até o admin delas publicar. Nenhum dado foi migrado.
- Pública = `status == 'approved'` **e** `published == true`. Uma régua em três
  lugares: `fedPublic()` na regra, `isFederationPublic()` no cliente
  (`domain/federation.js`; `isFederationOpen` é o mesmo) e `publicada(fed)` no
  servidor (`functions/federations.js`, exportada para as outras funções).
- Quem vê a federação oculta (`fedSees()` na regra): a equipe (qualquer
  permissão), o filiado ativo, quem pediu a abertura e o admin da plataforma
  (o documento da federação; nas outras coleções, com acesso justificado,
  §13.3). Ninguém mais.
- O diretório e a página por endereço consultam `status == 'approved'` +
  `published == true` (duas igualdades: a regra prova a consulta, zero índice).
  A conferência de endereço repetido no cliente olha só as publicadas; a
  aprovação no servidor segue conferindo todas as aprovadas.

### 17.2 O que a federação oculta faz e não faz

| | Oculta | Pública |
|---|---|---|
| Equipe estrutura tudo (planos, Pix, página, módulos, equipe, acervo, agenda, notícias) | ✅ | ✅ |
| Aparece no diretório e abre `/f/:slug` (e acervo/agenda públicos) | ❌ | ✅ |
| Planos, cursos, credenciais, notícias/atos/eventos públicos, clubes filiados para quem é de fora | ❌ | ✅ |
| Pedir filiação (`federationJoin`), transferência para ela, filiar clube ou arena, pedir chancela | ❌ | ✅ |
| Criar cupom ou campanha da federação, abrir a loja oficial (`market_sellers`) | ❌ | ✅ |
| Agenda assinável (`/api/agenda/{slug}.ics`) | ❌ | ✅ |
| Comentários: quem é de fora não lê nem escreve; filiado e equipe, sim | — | — |
| Resultados e ranking oficial | seguem públicos: só vêm de torneio chancelado, e a chancela exige federação publicada |

O que já existia segue valendo: tirar do ar **não** desfaz filiações (o
filiado continua vendo a federação e a carteirinha verifica), não apaga nada e
não derruba anúncios nem cupons já publicados — o diálogo de "Tirar do ar"
avisa para pausá-los antes; a loja some do "Vendendo como" da equipe até
publicar de novo (`storeFederations`).

### 17.3 Quem publica e onde

- **Central → Página pública → Publicação** (aba `?aba=publicacao`, só a
  permissão `admin`): selo Pública/Oculta, o endereço público, **"Tornar
  pública"** / **"Tirar do ar"** (cada um com confirmação) e a lista "Antes de
  publicar, confira" (`publicationChecklist`: página com "Sobre" e cidade,
  logo, contato público, plano ativo e Pix se houver plano pago). A lista
  **recomenda, não bloqueia**; plano que não carregou é "não deu para conferir",
  nunca "falta".
- A regra: só a permissão `admin` grava `published`, só como booleano e só com
  a federação **aprovada**; o pedido de abertura não pode nascer com o campo.
- `setFederationPublished` (serviço) grava `published` + `published_at/by` ou
  `unpublished_at/by`, confere endereço repetido entre as publicadas e audita
  (`federation_publish` / `federation_unpublish`).
- Enquanto oculta, a faixa âmbar `FedHiddenBanner` aparece no topo da Central
  e na página interna da federação para a equipe ("Revisar e publicar" para o
  admin). As abas Loja oficial e Divulgação dizem que abrem depois de publicar.
- Âncoras: `federacao-oculta`, `federacao-publicacao`, `federacao-publicar`,
  `federacao-aba-publicacao`. O guia `federacao-gerir` ganhou o passo "Por
  último, publicar" e o artigo do mesmo nome, o parágrafo sobre a publicação.

### 17.4 Federações no menu

- **Federações é um item próprio do menu lateral** (hub `federacoes`, ícone
  `Landmark`, âncora `menu-federacoes`), com a flag `federations`; saiu de
  dentro de Competir. Está nos três padrões (atleta, arena, professor), antes
  do Mercado, e em **Configurações → Menu** (`SidebarSettingsCard`) para ligar,
  desligar e mover (`papeis.federacoes`).
- Quem já tinha um menu personalizado salvo ganha o item uma vez, antes da
  Minha área (`SIDEBAR_ITEMS_ADDED_LATER`), e tira se não quiser. A escolha
  salva passou a guardar `known` (os itens que a pessoa podia ver): uma
  funcionalidade ligada depois entra sozinha; item de papel (Minha arena,
  Painel do professor) não — segue na Minha área (docs/41 §4.1).

**Testes**: `tests/rules/federation.rules.test.js`, `federationPr2` e
`federationPr4` (blocos "oculta"), `functions/federations.test.js`,
`federationComments.test.js`, `federationAgenda.test.js`,
`domain/federation.test.js`, `domain/staff.test.js`,
`core/domain/sidebarNav.test.js`, `core/lib/sidebarNavPreference.test.js`.

## 18. Página pública × filiado × equipe (2026-10-21)

**O defeito:** a página da federação misturava três públicos numa coluna só —
o que qualquer pessoa vê, a situação de quem é filiado (cobrança, carteirinha,
transferência) e o botão "Gerir" da equipe —, e a Central escondia o que muda
a página pública dentro de "Configurações", ao lado de Pix e regras. Quem
abria não sabia o que era público, o que era só dele e o que era da equipe.

**A separação**, em três camadas que nunca se misturam:

| Camada | Quem vê | Onde | Componente |
|---|---|---|---|
| Página pública | todo mundo | `/federacoes/:id` e `/f/:slug`, em abas | `FederationProfile` (`v2/components/federations/profile/`) |
| Área do filiado | só a própria pessoa | faixa no topo + aba **Minha filiação** (`?aba=minha`), com o selo "Só você vê" | `FedMemberStrip`, `FedMyMembership`, `useMyFederationStanding` (`FedMemberArea.jsx`) |
| Equipe | quem tem cargo e o suporte da plataforma | barra escura no topo ("Área da equipe", cargo, "Ver como visitante", "Abrir a Central"); toda a gestão na Central | `FedStaffBar` (`FedStaffBar.jsx`) |

- **Abas da página** (`profileTabs`, `domain/profile.js`, testado): Visão
  geral, Minha filiação (só filiado), Notícias, Agenda, Competições,
  Documentos, Cursos, Clubes e arenas, Contato — cada uma só com o módulo
  ligado. A aba mora na URL (`?aba=`); as âncoras antigas (`#fed-cursos`,
  `?ancora=fed-ouvidoria`, `?noticia=`…) abrem a aba certa
  (`resolveProfileTab`/`tabForAnchor`) — avisos antigos continuam levando ao
  lugar. Os valores de `PROFILE_TAB` e as âncoras `federacao-pub-*` das dicas
  são **contrato**: nunca renomeie.
- **Uma página só**: o app e o link público montam o MESMO `FederationProfile`;
  o que muda é a moldura (o link público tem o cabeçalho do PickleRush e
  "Entrar") e as ações do topo. Corrigir um bloco corrige os dois.
- **Prévia "como visitante"** (`?visao=publico`, `fedPreviewPath`): a equipe vê
  a página sem a barra e sem a área do filiado, com uma faixa tracejada "Sair da
  prévia · Voltar à Central". Oculta, a faixa lembra que ninguém de fora a vê.
- **Central**: a nova seção **Página pública** (grupo Gerir, só `admin`) junta
  Publicação, Conteúdo (o antigo "Página") e Transparência (a antiga
  "Governança"). Os valores `?aba=publicacao|pagina|governanca` não mudaram.
  Configurações ficou com o que é interno: Planos, Recebimento, Módulos,
  Regras, Loja.
- **Diretório**: "Na equipe" leva à Central; "Suas filiações" leva à aba
  Minha filiação. Antes os dois eram um botão "Gerir"/link genérico.
- **Zero banco, zero regra, zero função nova.** Só tela, domínio puro e textos.

## 19. Módulos que ligam e desligam de verdade, e convites pela lista de usuários (2026-10-22)

### 19.1 O interruptor de cada módulo

- **Configurações → Módulos** (`FedSettingsPanel` → `ModuloCard`): cada cartão diz
  **Ligado/Desligado** ao lado do interruptor (antes o selo dizia "Ligado"
  com o interruptor desligado), o que o módulo abre **na Central** e **na
  página** (`FED_MODULE_META[x].central/page/tab`, com "Abrir …" levando à aba)
  e o que acontece ao desligar. São os 11 do catálogo, todos `available`.
- **Grava só o módulo tocado**: `setFederationModule(id, x, on)` faz
  `updateDoc({ 'modules.x': on })` + auditoria `federation_modules_update`.
  🐞 Antes a tela regravava o mapa inteiro a partir de uma cópia: dois toques
  seguidos (ou duas pessoas) desfaziam o primeiro. A regra já deixava o admin
  mudar `modules` (provado em `tests/rules/federationInvites.rules.test.js`).
- **Dependência**: `ranking` tem `requires: 'tournaments'`; ligado sem o outro,
  o cartão avisa que nenhum resultado chega.
- **Desligar pergunta antes** (confirmação no próprio cartão) e:
  - `promos`: pausa os cupons ativos e os banners de campanha no ar;
  - `store`: pausa os anúncios ativos/esgotados da loja oficial;
  - nada é apagado; religar devolve o que estava gravado.
- **Decisão em aberto não fica órfã** (`residualModules`, `federationSections.js`):
  com `discipline` desligado e sanção em vigor/recurso, a aba **Sanções** fica
  (sem "Aplicar sanção", com aviso); com `tournaments` desligado e pedido de
  chancela pendente, a aba **Chancelas** fica. As abas de RECEBER coisa nova
  (Ouvidoria, Resultados) somem. A faixa "Precisa de você" só mostra itens de
  abas que existem.
- **Hoje** da Central: com a federação oculta, mostra "Ver como visitante" em
  vez do link público.

### 19.2 Escolher pessoas na lista de usuários (`FedPersonPicker`)

Nomear para a equipe, passar a administração e convidar para filiar usam o
mesmo seletor: a lista de usuários (`useAllAthletes`, sem perfil oculto) aparece
**já aberta**, em ordem alfabética, e a busca (nome ou cidade) só estreita;
mostra 50 por vez e diz quantos há. Quem não pode ser escolhido aparece com o
motivo ("Já na equipe", "Já filiado(a)", "Já convidado(a)") e sem clique.

### 19.3 Convite para filiar (`federation_invites/{fed}_{uid}`)

- **Ninguém vira filiado sem querer.** A secretaria (permissão `members`)
  escolhe pessoas e um plano em **Filiados → Convidar pessoas da plataforma**;
  o servidor (`federationMembership`, ação `invite`, até 50 por vez) grava o
  convite (30 dias), avisa cada pessoa e pula quem não tem conta, já tem
  filiação viva ou já tem convite em aberto. Federação oculta não convida.
- **Aceitar = pedir a filiação no plano do convite**: o pedido entra **sem
  esperar a secretaria** (plano pago gera a cobrança; gratuito ativa), a
  filiação ganha `invited: true` e o convite vira `accepted`. Pedido em outro
  plano segue o caminho normal; convite vencido não dispensa a aprovação.
- **Recusar** (`invite_decline`, a própria pessoa) e **cancelar**
  (`invite_cancel`, a secretaria) fecham o convite.
- **Onde aparece**: Minha área → Federações ("Convites para filiar", com
  Aceitar e Recusar, e na faixa "Precisa de você"); a página de filiação
  (`/federacoes/:id/filiar`) mostra o convite e já escolhe o plano; a
  secretaria vê "Convites esperando resposta" em Pedidos.
- **Regra**: lê a convidada e quem tem `members`/`admin` na federação; escrita
  só do servidor. Entra na exclusão de conta (apagado) e na exportação.
  Provado em `tests/rules/federationInvites.rules.test.js` e
  `functions/federations.test.js` ("convite para filiar").

## 20. Revisão de UX — Entrega 1: o que estava errado para quem usa (2026-10-22)

Plano completo da revisão (≈230 pontos, cinco entregas) em
`/mnt/project-files/federacao/plano-revisao-ux-2026-10-22.md` (fora do
repositório). A Entrega 1 corrige o que levava a pessoa a errar, perder
dinheiro ou bater numa porta fechada. Zero coleção, zero índice, zero regra.

### 20.1 Página pública (visitante sem conta)

- **Links que mandavam para o login**: torneio chancelado e evento de torneio
  na agenda levam a `/p/:id` (página pública do torneio) para quem não entrou e
  a `/torneios/:id` para quem entrou (`tournamentPath(id, { inApp })`,
  `domain/agenda.js`). Clube filiado leva a `/c/:id` (visitante) ou
  `/clubes/:id`; arena não tem página pública, então para o visitante a linha
  não é link (`orgLink`, `FedPublicBlocks.jsx`).
- **Cupons e loja só para quem entrou**: o visitante não lê `promo_*` nem o
  Mercado (a regra exige conta) — o bloco sumia com erro. Agora nem aparece; a
  loja também respeita a flag `marketplace`.
- **Torneios chancelados**: próximos primeiro (pela data de FIM, então o
  torneio de hoje segue em "próximos"), encerrados atrás de "Ver N torneios
  encerrados" (`splitSanctionedTournaments`, `domain/sanction.js`); data com o
  ano quando não é o corrente; textos de vazio escritos para o visitante.
- **Rodapé do ranking**: a frase "contam os N melhores" só aparece quando há
  limite, e "só filiados em dia" só quando a federação exige.

### 20.2 Filiação, pagamento e dependente

- **Dependente**: depois de enviar, a tela mostra a confirmação e o Pix DELE
  (antes voltava ao formulário vazio, parecendo que nada aconteceu), com "Ver
  em Minha área" e "Filiar outro dependente". O Pix diz "Para {nome}" quando
  quem paga é o responsável.
- **Pedido que paga depois**: plano pago sem aprovação automática diz "Pedir
  filiação" e "Você paga depois que a secretaria aprovar" (antes "Pagar" num
  passo em que não há o que pagar).
- **Erro do formulário**: a tela rola até ele e o anuncia (`role="alert"`).
  O estatuto (`governance.statute_url`) vira link no aceite; os Termos abrem em
  outra aba (o formulário não se perde).
- **Pix**: o código copia-e-cola vem antes do QR no celular (quem está no
  celular não lê o próprio QR) e as instruções de pagamento da federação
  (`payment.instructions`) aparecem junto.
- **Cancelar a filiação / desistir do pedido** (`FedCancelMembership`): na aba
  "Minha filiação" e, para dependentes, em Minha área → Federações, sempre com
  confirmação que diz o que acontece. Usa a ação `cancel` que o servidor já
  tinha.
- **Renovar** (Minha área) leva à aba "Minha filiação"; a renovação do
  dependente diz onde está o Pix. A cobrança em Minha área mostra o bloco Pix
  completo.
- 🐞 **Suspensão disciplinar sobrevivia a nada**: desistir e pedir de novo
  regravava a filiação sem `discipline_until_ms`, apagando a suspensão. O
  servidor agora carrega a suspensão em vigor para o pedido novo
  (`pedirFiliacao`, teste em `functions/federations.test.js`).

### 20.3 Central: nada irreversível sem perguntar

- **Cancelar curso** é do servidor (`federationCourse`, ação `cancel_course`,
  permissão `courses`, motivo obrigatório): cancela as inscrições vivas e as
  cobranças abertas/informadas do curso e avisa cada inscrito com o motivo;
  quem já pagou é lembrado de que a devolução é com a federação (o Pix foi
  direto a ela). 🐞 Antes o curso só mudava de situação pelo seletor, e os
  inscritos não ficavam sabendo. O seletor não oferece mais "Cancelado".
- **Apagar curso**, **avisar os filiados sobre uma notícia** (diz para quantos
  vai e que sai uma vez só), **apagar notícia**, **desfiliar clube/arena** e
  **cancelar cobrança** (com motivo próprio, que vai no aviso) agora confirmam
  — saiu o último `window.confirm`.
- **Aplicar sanção** mostra o resumo do efeito (suspensão de/até, valor da
  multa, exclusão encerra a filiação) antes de gravar.
- **Reintegrar** é só da suspensão ADMINISTRATIVA (`member.status ===
  'suspended'`); na disciplinar a linha diz até quando vai e que se encerra na
  Disciplina (antes o botão aparecia e o servidor recusava).
- **Documento do filiado** é BAIXADO (`baixarBlob`): abrir aba depois da
  espera do servidor o Safari bloqueava, e o botão parecia não fazer nada.
- **Equipe**: o motivo de "Prorrogar" não vaza mais para "Tirar" (e
  vice-versa); "Passar a administração" (e "Passar e sair") confirma, dizendo
  que a pessoa pode tirar você.
- `ConfirmDialog` ganhou `children` (um campo dentro da pergunta) e
  `confirmDisabled` — aditivo, os usos antigos não mudam.

## 21. Revisão de UX — Entregas 2 a 4: a Central, as páginas públicas e a área do filiado (2026-10-22)

Nada de banco novo além de um campo opcional (`federation_charges.overdue_notified`);
nenhuma regra mudou. As peças compartilhadas da Central ficam em
`src/v2/components/federations/manage/listTools.jsx` (`useBuscaLista`,
`useFiltroNaUrl`, `BuscaLista`, `MostrarMais` — 30 por vez) e
`manage/naoSalvo.js` (`useAvisoNaoSalvo`, `haAlteracaoNaoSalva`,
`descartarAlteracoes`, `baixarCsv`).

### 21.1 Central da equipe (Entrega 2)

- **Toda lista longa** (filiados, convites, secretaria, cobranças, clubes e
  arenas, cursos, disciplina, chancelas, notícias, comentários, acervo,
  agenda) tem busca por nome, "Mostrar mais" de 30 em 30 e filtros com a
  contagem ao lado; o filtro escolhido mora na URL (recarregar não perde, o
  link leva à mesma visão). `V2FilterChip` diz `aria-pressed`.
- **Alteração não salva** (configurações, regras, conteúdo, ranking, formulário
  do acervo e da agenda): trocar de aba ou fechar o diálogo pergunta "Sair sem
  salvar?"; o Ranking ganhou "Desfazer mudanças". Upload de arquivo
  descartado é apagado do Storage.
- **Toda ação irreversível confirma** (desfiliar, cancelar convite, tirar da
  equipe, retirar documento do ar, cancelar evento…), com o efeito escrito.
- **CSV** abre certo no Excel brasileiro (`;`, BOM, reais com vírgula, datas
  dd/mm/aaaa) — `chargesCsv`, `indicatorsCsv` e a lista de filiados.
- A faixa "Precisa de você" leva à aba **já filtrada** no que pede ação.

### 21.2 Páginas públicas, verificação e diretório (Entrega 3)

- As páginas `/f/:slug`, `/f/:slug/acervo` e `/f/:slug/agenda` usam a mesma
  barra (`PublicFedTopBar`: marca + "Entrar" / "Abrir no app") e a moldura de
  1200 px; documento e evento sozinhos ficam em 880 px.
- **"Filiar-se neste plano"** em cada plano: no app vai direto ao formulário
  com o plano escolhido (`/federacoes/:id/filiar?plano=`); no `/f/:slug` passa
  pelo login antes. Só aparece para quem pode pedir (sem filiação).
- O contato mostra **WhatsApp** quando o telefone é celular brasileiro
  (`whatsappLink`, `domain/profile.js`).
- "0 filiados" não aparece (capa e diretório). No diretório as federações
  **nacionais** passam por cima do filtro de região e vêm primeiro; lista
  vazia só por causa da região mostra a dica de ampliar, não "nenhuma
  federação".
- Acervo e agenda públicos paginam de 30 em 30 e têm "Limpar filtros"; o selo
  **"Em vigor"** só aparece em norma (`docHasValidity`: estatuto, regimentos,
  resoluções, portarias, deliberações, atos — não em edital nem ata).
- **Verificação** (`/f/verificar/:codigo`): diz "Código não encontrado" ou
  "Código inválido" com o que fazer, separa Carteirinha de Credencial e
  termina com "Consultado agora" + link para a página da federação.
- **Ouvidoria**: quem não entrou lê por que se pede conta (e que continua
  podendo ser anônimo); o login volta para a aba Contato; o protocolo tem
  botão de copiar (`CopyCodeButton`).
- **Ranking**: busca por nome com mais de 15 linhas; o nome leva ao perfil do
  atleta para quem entrou.
- Apagar o próprio comentário confirma.

### 21.3 Área do filiado e cobranças (Entrega 4)

- **Recibo** de cada cobrança paga (Minha filiação → Pagamentos → Recibo):
  `chargeReceipt` (`domain/charges.js`) monta número `REC-…`, federação com
  CNPJ mascarado, quem pagou, referente a, valor, data e quem confirmou;
  `FedReceipt.jsx` imprime/salva em PDF pelo mesmo caminho da declaração.
  Cobrança não paga não tem recibo.
- Filiação ativa fora da janela de renovação diz **quando a renovação abre**
  (`renewalOpensOn`, `domain/membership.js`).
- **Lembrete de cobrança vencida**: a varredura diária avisa quem paga no dia
  do vencimento e 7 dias depois, uma vez por marco
  (`federation_charges.overdue_notified`); só cobrança `open` — quem já
  informou o pagamento não é cobrado de novo.

## 22. Orçamento e prestação de contas (módulo `accounts`, 2026-10-22)

A Lei Geral do Esporte (Lei 14.597/2023) e a Lei Pelé (Lei 9.615/98, art.
18-A) pedem que a entidade que recebe recurso público tenha orçamento,
conselho fiscal com parecer sobre as contas, contas publicadas e a
remuneração dos dirigentes à vista. O módulo `accounts` (agora `available`)
faz isso dentro da Central, com o mesmo desenho do acervo: **só o servidor
grava**, o navegador lê pela regra.

**Quem faz o quê.** Permissão `finance` (ou `admin`) prepara: orçamento,
lançamentos, prestação. Permissão `fiscal` (cargo `fiscal_council`) lê tudo
em leitura e dá o **parecer**; o `admin` também pode, e fica registrado como
dele (`by_admin`). Secretaria, filiado e visitante não leem nada que não esteja
publicado.

**Coleções** (bloco depois de `federation_events` no `firestore.rules`,
`write: if false`, provado em `tests/rules/federationAccounts.rules.test.js`):

- `federation_budgets/{fed}_{ano}` — `lines` em centavos por `income.<cat>` /
  `expense.<cat>`, `notes`, `status` `draft → submitted → approved →
  published`, `approved_in { date, event_id, event_title, event_date, note }`
  (a reunião da agenda é opcional e conferida pelo servidor: tem de ser um
  tipo de reunião da própria federação), `history[]` e, ao publicar, a cópia
  `published { lines, notes, approved_in, at_ms }`. O público lê só o
  documento-cópia `{fed}_{ano}_pub` (`pub: true`, `copy_of`, `published`):
  o documento de trabalho **nunca** leva `pub`, então reformular não expõe o
  rascunho; a lista da equipe ignora as cópias (`copy_of`). Mexer no
  aprovado ou publicado é **reformular**: motivo ≥ 10, volta a rascunho, as
  linhas anteriores vão para o histórico e a cópia `published` continua na
  página até a nova publicação.
- `federation_ledger/{id}` — lançamento manual: `kind`, `category`, `date`
  (nunca no futuro), `amount_cents`, `description`, `counterparty`,
  `document` (anexo copiado para `federacao-contas-oficial/{fed}/ledger/…`,
  com SHA-256). Não se apaga: **estorna** (`status: 'void'`, motivo). Nunca é
  público.
- `federation_account_reports/{fed}_{período}` (o nome evita
  `federation_reports`, que é a ouvidoria) — período `2026` ou `2026-Q1`,
  `status` `draft → submitted → opinion → approved|rejected → published`,
  `statements[]` (balanço, DRE, fluxo de caixa, notas — PDF/imagem ≤ 9 MB,
  na pasta oficial), `notes`, `snapshot` (os totais **congelados** no envio
  ao conselho: por categoria, totais, quantos lançamentos manuais e
  automáticos e, na anual, o orçamento aprovado do ano), `fiscal_opinion
  { verdict, text, by_name, at_ms, by_admin }`, `assembly { date, result,
  event_*, note }`, `acervo { statements_doc_id, statements_code,
  opinion_doc_id }`, `pub`.

**Categorias fixas** (ids gravados — nunca renomeie): receitas `memberships`,
`courses`, `events`, `sponsorship`, `grants`, `donations`, `store`,
`other_income`; despesas `staff`, `referees`, `events`, `travel`, `admin`,
`communication`, `taxes`, `equipment`, `other_expense`.

**Receita derivada, não lançada.** A cobrança **paga** entra sozinha, pela
origem (`membership`/`renewal` → filiações, `course` → cursos, `fine` →
outras receitas), na data do pagamento em Brasília. O conselho fiscal ganhou
leitura de `federation_charges` para conferir. **Diárias da arbitragem**
(§23): com o módulo `referees` ligado, as diárias PAGAS (diária +
deslocamento, na data do pagamento) entram como despesa `referees` sem lançar
de novo — no servidor por `despesasDerivadas()` (lê `federation_assignments`
e usa `refereeFeesAsExpenses` da régua, com paridade) e no cliente por
`extraExpenses`. A prévia da tela só as mostra a quem lê as escalas
(`courses`/`admin`); para o financeiro e o conselho fiscal sem essa leitura,
a tela AVISA que a prévia está sem as diárias — o retrato congelado da
prestação sempre as inclui (a regra não abre as escalas ao financeiro, porque
elas guardam conflito de interesse declarado).

**Período fechado.** Com a prestação enviada, lançar ou estornar naquele
período é recusado (o retrato que o conselho examina não muda por baixo).
Reabrir (motivo) só antes do parecer; depois, não volta a rascunho.

**Publicar** exige o parecer; a assembleia é opcional. Com o acervo ligado,
saem **dois atos** (`financial_statements` com as demonstrações e
`fiscal_opinion` com o texto do parecer, `refers` ao primeiro) — os dois itens
do checklist de transparência. Sem o acervo, publica só a prestação.

**Na tela.** Central → Gerir → **Contas** (`data-dica="federacao-secao-contas"`):
Visão geral (`?aba=orcamento`: totais do ano, barras mês a mês em CSS,
orçado × realizado com alerta "perto do limite" ≥ 90%, "estourou", "sem
orçamento", e o prazo legal) · Orçamento (`orcamento-anual`: as categorias
ao lado do orçado e do realizado do ano anterior) · Lançamentos
(`lancamentos`: busca, filtros, anexo, estorno, planilha; os automáticos
marcados; **Importar extrato** lê o OFX ou a planilha CSV do banco na tela
— `domain/bankStatement.js`: valor com sinal nos formatos brasileiros,
cabeçalho achado depois das linhas da conta, saldo fora, Windows-1252 —,
mostra cada movimento com a categoria para conferir e manda os marcados à
ação `entry_import`; o já lançado, o do futuro e o de período fechado
chegam desmarcados, e o filtro "Do extrato bancário" mostra o importado) · Prestação de contas (`prestacao-contas`: linha do tempo, prévia
ao vivo até congelar, demonstrações, parecer, assembleia, publicação). Os
valores de `?aba=` são contrato de link (o aviso ao conselho leva a
`prestacao-contas`). **Precisa de você** (`accountsPendingItems`): prestação
esperando parecer (conselho), parecer recebido (financeiro) e, a partir de
1º de março, a prestação do ano anterior não publicada — o **prazo legal é o
último dia útil de abril** (`legalDeadline`), e passada a data o texto diz
"fora do prazo".

**Na página pública** (aba Documentos, âncora `#fed-contas`): os orçamentos
publicados, as prestações publicadas (totais congelados, parecer, assembleia,
links aos atos do acervo) e a execução resumida da última anual — sempre do
retrato congelado, nunca da conta ao vivo. **Remuneração dos dirigentes**:
`governance.board[].pay_cents` (0 = não remunerado; ausente = não informado)
e `pay_note`, editados em Página pública → Transparência e mostrados no bloco
de governança.

**Avisos** (servidor, `tx()`): ao enviar, quem tem `fiscal`; ao chegar o
parecer, `finance` e `admin` — nunca quem agiu.

**Paridade.** `src/modules/federations/domain/accounts.js` ×
`functions/federationAccountsPolicy.js` (`functions/federationAccounts.parity.test.js`):
categorias, mapa de origem, períodos, prazo, validações, totais e retrato.

**O que ficou de fora.** Orçamento mensal (só anual); importação de extrato;
conciliação bancária.
## 23. Arbitragem (módulo `referees`, 2026-10-22)

A federação mantém o **quadro de árbitros** por nível, **escala** quem apita
cada evento (convocação → confirmação), recebe a **súmula**, **avalia** a
atuação e registra o **pagamento das diárias**. Liga em Configurações →
Módulos (`referees`); a seção da Central é **Arbitragem** (permissão `courses`
— o cargo `referees` já a tinha — ou `admin`).

**Onde fica**

| Quem | Onde |
|---|---|
| Equipe | Central → Arbitragem: `?aba=arbitragem` (Escalas), `arbitragem-quadro`, `arbitragem-avaliacoes`, `arbitragem-diarias`, `arbitragem-regras` (contrato de link). Escalas filtra por `?filtro=proximos`, `sem-cobertura`, `sem-resposta` ou `anteriores` |
| Árbitro | Minha área → Federações → **Minhas escalas de arbitragem** (âncora `federacoes-escalas`): responder, próximas, histórico com avaliação e diária, súmula, equipe do evento, disponibilidade |
| Público (também sem conta) | Página da federação → Competições → **Quadro de arbitragem** (`#fed-arbitragem`) e, no torneio chancelado e público, o cartão **Arbitragem** acima das abas |

**Dados** (`docs/05-DATA-MODEL.md`): `federation_referees/{fed}_{uid}` (o
cadastro no quadro: nível, funções, situação, credenciais, disponibilidade,
`public_listing`, contadores) + `private/staff` (notas da equipe, que o
árbitro não lê); `federation_assignments/{id}` (a escala: evento copiado,
função, situação, prazo, diária, deslocamento, alertas, conflito, súmula,
avaliação, pagamento, substituição); `federations.referee_rules` (níveis,
nível mínimo e quantos por função, diária padrão, prazo de resposta,
`crew_visible`). **Tudo só o servidor grava** (`write: if false`); o árbitro
lê o próprio cadastro e as próprias escalas; a equipe com `courses`/`admin`
lê tudo. Zero índice (as consultas são de uma igualdade).

**Funções**: `referee`, `head_referee`, `line_judge`, `technical_delegate`,
`tournament_director` — gravadas, nunca renomeie. **Situações da escala**:
`invited` → `confirmed` ou `declined`; `replaced`; `cancelled`; e no
fechamento `done` (atuou) ou `no_show`. Os ids dos níveis também são
gravados: o rótulo muda, o código não.

**Eventos que se escalam** (`scalableEvents`, `domain/referees.js`): os
torneios **chancelados** (aprovados) por esta federação e, com o calendário
ligado, os eventos da agenda dos tipos `competition`, `selection` e
`sport_other` ainda marcados. Curso e reunião não. Nada é gravado no evento:
a escala copia nome, data, cidade e se é público.

**Escalar** (`federationReferees`, `functions/federationReferees.js`):
`assign` convoca até 20 por vez, mostrando **alertas** sem bloquear — marcou
que não pode, outra escala no mesmo dia, inscrito como atleta no torneio,
nível abaixo do mínimo da função. Bloqueia só o que não faz sentido: fora do
quadro, inativo/suspenso, função que não exerce, já escalado no evento. As
sugestões vêm sem alerta primeiro, depois por nível e por quem atuou menos
(`suggestReferees`). O prazo de resposta é o da regra contado da convocação,
nunca depois da véspera (`defaultRespondBy`). `reassign` troca a pessoa (a
antiga vira `replaced` e é avisada); `cancel` exige motivo; `close_event`
marca quem não veio, o resto confirmado vira `done` e as convocações sem
resposta são canceladas. A cobertura do evento é `referee_rules.needs` por
função (`eventCoverage`).

**O árbitro**: `respond` confirma ou recusa (motivo; **conflito de
interesse** declarado com o que é — fica só para a equipe); depois do evento
`report` envia a súmula (10 a 4.000 letras); `self` grava a disponibilidade
(dias em que não pode, até 60) e se aparece no quadro público; `crew` mostra
a equipe do evento (nome e função) só com `crew_visible`.

**Avaliação e diárias**: `evaluate` (cinco critérios de 1 a 5 + comentário
que o árbitro vê; média gravada) e `mark_paid` (em lote; desfazer é
`paid: false`). As diárias pagas viram despesa das contas da federação por
`refereeFeesAsExpenses(assignments)` → `{ date, amount_cents, category:
'referees', ref }` (só `done` com `paid_at_ms`; diária + deslocamento). CSV
em `feesCsv` (`;`, reais com vírgula, defesa contra fórmula).

**Lembrete**: a varredura diária (`federationMembershipSweep`) avisa o
convocado sem resposta na véspera do prazo, uma vez só (`reminded`).

**Precisa de você**: equipe — convocações sem resposta e eventos dos próximos
7 dias sem cobertura (`refereeStaffPending`, que levam aos filtros); árbitro —
convocações para responder (`myPendingAssignments`). Fonte que falhou não
vira zero.

**Privacidade** (não pode regredir): o público vê pela função
`federationRefereesPublic` (sem login) **só** quem está ativo e aceitou
aparecer (nome, nível, cidade, foto) e, nos eventos públicos a partir de 30
dias atrás, quem está **confirmado** (nome e função). Nunca valor, nota,
conflito, disponibilidade nem uid. Federação oculta (§17) só responde à
equipe e ao filiado ativo.

**Exclusão e exportação**: a exportação leva o próprio cadastro e as
próprias escalas; na exclusão de conta o cadastro e as notas saem, e as
escalas ficam pseudonimizadas ("Atleta removido", sem conflito nem motivo) —
as abertas são canceladas.

Régua pura em `domain/referees.js`, com cópia em
`functions/federationRefereesPolicy.js` e paridade em
`functions/federationReferees.parity.test.js`; regra provada em
`tests/rules/federationReferees.rules.test.js`; tela em
`src/v2/components/federations/referees/` + `manage/FedRefereesPanel.jsx`.
## 24. Eleições (módulo `elections`, 2026-10-22)

A federação conduz a eleição inteira na plataforma: edital, chapas, apoios,
impugnações com defesa, votação **secreta** pelo aplicativo (com peso por
categoria), votação presencial, apuração, ata e — se o admin quiser — os
eleitos indo para a governança da página.

**Onde mora.** Domínio puro em `functions/federationElectionsPolicy.js`
(servidor) com cópia em `src/modules/federations/domain/elections.js`
(cliente; paridade em `functions/federationElections.parity.test.js`).
Função `federationElections` (`functions/federationElections.js`). Telas em
`src/v2/components/federations/elections/` e Central → **Eleições**
(`manage/FedElectionsPanel.jsx`). Aba pública `PROFILE_TAB.ELECTIONS`
(`eleicoes`, âncora `#fed-eleicoes`).

### 24.1 Coleções (todas só o servidor grava)

| Coleção | Id | Quem lê |
|---|---|---|
| `federation_elections` | automático | a eleição publicada (`public == true`), quem pode ver a federação; a comissão; o admin |
| `federation_candidacies` | automático | a chapa aceita (`public == true`), quem vê a federação; quem está nela; quem conduz; o admin |
| `federation_election_voters` | `{eid}_{uid}` ou `{eid}_{club|arena}_{org}` | o próprio eleitor; quem conduz |
| `federation_election_endorsements` | `{eid}_{cargo}_{uid}` | só quem apoiou |
| `federation_ballots` | aleatório (16 bytes) | **ninguém** pelo cliente |

"Quem conduz" na regra é `fedElRun`: a comissão (`commission_uids`) ou, sem
comissão, o admin da federação. Zero índice composto.

### 24.2 O voto secreto (o que não pode regredir)

- A cédula (`federation_ballots`) leva **só** `election_id`, `choices` e
  `weight` — nenhum uid, nome, horário ou id de eleitor. O id é aleatório
  (`crypto.randomBytes`), nunca sequencial.
- A cédula e o `voted_at_ms` do eleitor são gravados **na mesma transação**:
  ou os dois entram, ou nenhum. Voto duplo é recusado dentro da transação.
- A auditoria do voto (`federation_election_vote`) leva só federação e
  eleição. O comprovante (`receipt`, aleatório) prova que o voto entrou,
  nunca em quem.
- Durante a votação a tela mostra só **percentual** de participação; não
  existe parcial. O resultado mostra **pesos**, nunca número de cédulas.
- O assistente avisa quando um grupo tem menos de 3 eleitores (o voto dele
  poderia ser deduzido pela apuração).
- Limite conhecido: os metadados do Firestore (hora de escrita) são visíveis
  para quem opera o projeto no console — não para quem usa a plataforma.

### 24.3 Fluxo

1. **Assistente** (admin): cargos (chapa ou individual, órgão, vagas,
   mínimo de cada sexo) → calendário (edital, registro, impugnação, defesa,
   votação com hora, resultado, posse; antecedência mínima configurável,
   padrão 30 dias) → colégio e pesos (meses mínimos de filiação; pesos de
   atletas, professores, árbitros, clubes e arenas, 0 a 6; **prévia do
   servidor** com a conta de 1/3 dos atletas e 1:6 entre pesos) → comissão
   (`FedPersonPicker`, até 7) → revisar e **publicar**.
2. **Publicar** grava o edital (texto gerado por `noticeText`) e, com o
   acervo ligado, um **edital numerado no acervo** (`publicarAtoDeTexto` em
   `federationAcervo.js`); avisa todos os filiados ativos. Depois de
   publicado, só calendário e colégio mudam, com motivo no histórico.
3. **Chapas**: o filiado registra no prazo (ele faz parte da chapa; todos
   com filiação ativa; ninguém da comissão; ninguém em duas chapas vivas).
   Alertas para a comissão: mulheres abaixo de 30% e recondução do
   presidente. **Apoio** (`endorsement_pct`, até 5% do colégio): pelo link
   da chapa (`?aba=eleicoes&eleicao=&apoiar=`), um por cargo, quem está na
   chapa não apoia a própria.
4. **Impugnação** só de chapa aceita, com motivo (≥ 20 caracteres); a chapa
   se defende no prazo; a comissão **julga depois da defesa** (ou do fim do
   prazo). Procedente ⇒ chapa indeferida.
5. **Abrir a votação** (quem conduz, a partir da data e hora do edital, sem
   chapa em análise): o colégio é **congelado** nesse momento
   (`federation_election_voters`); quem não estiver em dia ali não vota.
   Clubes e arenas votam pelo representante que pediu a filiação;
   dependentes não votam. Recusa se os atletas ficarem abaixo de 1/3.
6. **Votar**: um cargo por tela → revisão → confirmação → comprovante
   (`VoteFlow`). **Encerrar** depois da hora de fechamento.
7. **Presencial** (modo `presential`/`mixed`): a comissão marca quem votou
   na mesa e lança os totais por cargo, em peso; a soma de cada cargo tem de
   fechar com o peso de quem votou na mesa; lançado uma vez só.
8. **Apurar** (prévia só da comissão) e **publicar o resultado**: a apuração
   é refeita no servidor, empate segue a regra do edital (mais velho, chapa
   registrada primeiro, ou novo turno), o mínimo de cada sexo vale nos
   cargos individuais; a **ata** vai ao acervo; todos os filiados são
   avisados. O admin pode **levar os eleitos para a governança**
   (`governance.board`) junto ou depois (`apply_governance`), com fim de
   mandato opcional — as permissões da equipe não mudam.
9. **Cancelar** (admin, com motivo, avisa os filiados).

### 24.4 Telas

- Central → **Eleições** (admin, módulo ligado): lista, "Nova eleição"
  (assistente) e o painel de cada eleição (`ElectionConductPanel`: próximo
  passo, linha do tempo, chapas com aceitar/indeferir/julgar, participação,
  presencial, apuração com gráfico de barras acessível, resultado).
- Faixa **"Precisa de você"**: chapas para analisar e impugnações prontas
  para julgar (`federationPending`, itens `chapas` e `impugnacoes`).
- Página da federação → aba **Eleições** (`ElectionsPublic`): edital e ata
  (links do acervo), linha do tempo, cargos, chapas aceitas, resultado;
  logado, **"Sua participação"** (`ElectionMemberCard`: votar com o peso,
  comprovante, registrar e retirar chapa, defesa, link de apoio); para quem
  está na comissão, a **área da comissão** com o mesmo painel. Na página
  pública sem login no app, um botão leva ao app.
- Minha filiação: aviso **"Eleição em andamento"** (`FedElectionNotice`).
- Avisos levam a `/federacoes/{id}?aba=eleicoes` (no app, onde se age).

### 24.5 Exclusão e exportação

Entram na exportação: o colégio da pessoa (onde votou, peso, comprovante —
nunca em quem), as chapas de que participa e os apoios que deu. Na exclusão:
os apoios são apagados; nome no colégio, nas chapas e na comissão vira
"Atleta removido". A cédula não tem dono e fica. Limite: o nome de quem
impugnou fica na chapa impugnada (a lista não é consultável por pessoa).

Âncoras de dica: `federacao-secao-eleicoes`, `federacao-pub-eleicoes`,
`federacao-eleicao-*` (contrato). Enums gravados (situações, tipos de cargo,
órgãos, modos, regras de empate, categorias, chaves do calendário) — nunca
renomeie.

## 25. Conformidade com a Lei Geral do Esporte (Central → Indicadores → Conformidade, 2026-10-22)

Aba só do `admin`, ao lado de Indicadores. Confere, **sem gravar nada**, o que a
Lei 14.597/2023 e a boa governança pedem a uma entidade de administração do
esporte contra o que já está na plataforma. Domínio puro em
`domain/compliance.js` (`complianceChecklist`, `complianceSummary`), tela em
`manage/FedCompliancePanel.jsx` (anel com o placar e a lista, cada item com o
fundamento legal e o botão **Resolver**, que leva à aba que resolve).

Itens: estatuto publicado; mulheres na direção (≥ 30%); mandato informado, até
4 anos e em vigor; **eleição antes do fim do mandato** (com o módulo
`elections`: a 180 dias do fim, ou depois, precisa haver eleição publicada —
nem rascunho nem cancelada — com resultado/posse a partir dessa data);
conselho fiscal nomeado (cargo `fiscal_council`, ou permissão `fiscal` sem
`admin`); assembleia ordinária do ano convocada com a antecedência do estatuto;
**contas do ano anterior** (com `accounts` vale a prestação `published`, e o
texto diz em que fase ela parou; sem o módulo, o documento do acervo);
**orçamento do ano aprovado** (com `accounts`: `approved`/`published`);
página de transparência; ouvidoria e disciplina; atletas na direção.

Regras que não podem regredir: fonte que não carregou é `unknown` ("não deu
para conferir"), **nunca** reprovação — a plataforma não sabe o que a
federação guarda fora dela; é aviso, não trava. As consultas extras (agenda
pública, orçamentos) só saem com a aba aberta.


## 26. Tipos de filiação e clube/arena filiados por plano (Etapa 2 do cadastro estruturado, 2026-10-22)

Plano das cinco etapas em `/mnt/project-files/federacao/plano-cadastros-e-categorias.md`
(fora do repositório). Termos: **filiado** é quem tem vínculo pago (plano
`federated`); **cadastrado** é o vínculo gratuito (`registered`).

### 26.1 O catálogo de tipos (admin da plataforma)

**Painel admin → Federações → Configuração** (`AdminFederationsConfig`,
`data-dica="admin-federacoes-tipos"`) grava `platform_settings/federations.member_types[]`
(documento legível por todos, gravável só pelo admin da plataforma — regra que
já existia para `platform_settings`). Domínio em `domain/memberTypes.js`
(`memberTypeCatalog`, `memberTypeOf`, `planTypeFields`, `personTypeLabel`,
`validateMemberTypes`), cópia no servidor em `functions/federationMemberTypes.js`
com paridade (`federationMemberTypes.parity.test.js`).

- **Cinco prontos**: atleta, professor, árbitro (entidade `person`), clube e
  arena. O admin renomeia, descreve ou desliga; entidade e grupo não mudam e
  eles não saem da lista.
- **Tipos próprios** (até 30 no total): nome, descrição, código (sugerido do
  nome, gravado nos planos — não muda depois), **quem se filia** (`person`,
  `club`, `arena`) e **em que grupo conta** (`athlete`, `coach`, `referee` ou
  `none`, que não vota). Clube e arena contam como eles mesmos.
- **Desligar** um tipo só impede plano NOVO dele (`validatePlanInput` com
  `currentType`): planos e filiações que já existem continuam.
- O plano grava o tipo resolvido (`person_type`, `entity`, `person_category`,
  `person_type_label`) e vale mesmo se o tipo sair do catálogo. A regra de
  `federation_plans` confere só o FORMATO do código (`[a-z][a-z0-9_]{1,23}`) e
  `entity` conhecida; quem decide pessoa × clube × arena no pedido é o servidor
  (`resolveMemberType`, que relê o catálogo a cada pedido).
- O formulário do plano (Central → Configurações → Planos) só grava com o
  catálogo carregado. Plano de clube ou arena não tem faixa de idade nem
  descontos de pessoa e só pede documentos com nome ("Pedir documentos da
  entidade": estatuto social, ata de eleição, alvará…).

### 26.2 Clube e arena filiados por plano

Quem gere a entidade abre **Gestão do clube → Federação** ou **Central da arena
→ Federação** (`OrgAffiliationCard`): se a federação tem plano para aquele
tipo de entidade, o cartão leva a **`/federacoes/:id/filiar?entidade=club:ID`**
(ou `arena:ID`), que troca a tela pela filiação da entidade
(`OrgMembershipJoin`, `data-dica="federacao-filiar-entidade"`). Sem plano, o
pedido simples de antes (`federation_affiliations`, sem cobrança) segue igual.

- **Pedido** (`federationMembership`, ação `request` com `org: { kind, id }`):
  o servidor confere que a pessoa gere a entidade (`club_members/{club}_{uid}`
  com `role: 'admin'` ou `arena_managers/{arena}_{uid}`), que o plano é do tipo
  daquela entidade, e cria **`federation_members/{fed}_{club|arena}_{org}`** com
  `user_id: null`, `org_kind`, `org_id`, `org_name`/`org_city`/`org_state`/`org_logo`
  (copiados — a federação não lê `clubs`/`arenas`), `representative_uid`,
  `representative_name`, `representatives[{ uid, name, role }]` e o cargo
  obrigatório de quem pede. Uma filiação viva por entidade e federação. A
  filiação aprovada antes pelo pedido simples mantém a data
  (`affiliated_since_ms`).
- **Documentos**: os do plano sobem no próprio pedido (`DocumentsUploadList` +
  `uploadChosenDocuments`) com `org_kind`/`org_id` gravados; todos os gestores
  da entidade veem a lista, o arquivo só quem enviou e a secretaria (pela
  função `federationDocument`). O documento enviado por um representante cuja
  conta é excluída sai com a conta (o arquivo mora na pasta dele) — a secretaria pede de novo.
- **Cobrança e avisos** vão para o representante (`destinatario`: responsável,
  pessoa ou representante). Os outros gestores veem a situação e o aviso de
  para quem foi a cobrança.
- **Trocar o representante** (ação `represent`, botão "Passar a representar a
  entidade"): qualquer gestor da entidade assume, com o cargo; as cobranças em
  aberto passam a ele (`payer_uid`), o anterior é avisado e fica na lista
  `representatives`; auditoria `federation_membership_represent`.
- **Situação** (mesma tela): status, Pix, certificado de filiação (a
  carteirinha com o título "Certificado de filiação"), renovação,
  cancelamento e documentos. A verificação pública devolve `org_kind` e o nome do tipo.
- **O espelho**: ativa ⇒ `federation_affiliations/{fed}_{kind}_{org}` com
  `status: 'approved'` e `member_id`; vencida ou suspensa ⇒ `suspended`;
  cancelada ⇒ o espelho sai (só se o `member_id` for desta filiação). Pedido e
  aguardando pagamento não mexem no espelho. Assim a página pública, o selo
  "Filiado", a chancela e o colégio eleitoral seguem lendo o mesmo lugar. A
  regra recusa decidir ou apagar pelo navegador o espelho que tem `member_id`;
  a aba Clubes e arenas da Central mostra plano, número e validade e manda
  decidir em Filiados.

### 26.3 Quem lê (regra)

- `fedMemberOwner` aceita, além da pessoa e do responsável, **quem gere a
  entidade** da filiação (`fedOrgManager`). A filiação da entidade e a lista
  por `org_kind` + `org_id` são lidas pelos gestores dela; o membro comum do
  clube, não.
- `federation_documents_submitted`: os gestores da entidade leem; o envio tem
  de levar o `org_kind`/`org_id` da filiação (documento de pessoa não vira de
  entidade nem o contrário).
- Provado em `tests/rules/federationOrgMembers.rules.test.js`.

### 26.4 O que a filiação da entidade não faz

- Não pontua no ranking oficial, não entra em "minhas filiações" da pessoa nem
  conta como pessoa no colégio eleitoral (`user_id` nulo; a entidade vota pelo
  espelho, com `requested_by` = representante). Tipo de grupo `none` também não vota.
- Notícia "só filiados" não avisa o representante (ele não teria como abrir).
- **Exclusão da conta do representante**: a filiação continua (é da entidade),
  sem representante (`representative_uid: null`, nome "Usuário removido", sai
  de `representatives`); a cobrança da entidade perde só o pagador. Outro
  gestor assume por `represent`.
- Nada foi migrado: os pedidos simples de clube/arena seguem como estavam.

### 26.5 Âncoras

`admin-federacoes-tipos`, `federacao-filiar-entidade`, `federacao-filiar-entidade-situacao`.


## 27. Filiados e cadastrados por tipo, a pasta de cada um e o comprovante (Etapa 3 do cadastro estruturado, 2026-10-22)

A seção da Central que se chamava "Filiados" virou **Filiados e cadastrados**.
Os valores das abas (`pedidos`, `filiados`, `filiados-orgs`, `transferencias`,
`documentos`, `importar`) **não mudaram** — são contrato de link; só os rótulos:
`filiados` = **Cadastro**, `filiados-orgs` = **Vínculos de clubes e arenas**
(o pedido simples de clube/arena, sem plano). Zero coleção, zero índice.

### 27.1 O Cadastro por tipo

`FedMembersPanel` (aba `filiados`) monta uma **aba por tipo** do catálogo da
plataforma (§26.1), com a contagem, pela regra pura `registryTabs`
(`domain/registry.js`). Só aparecem os tipos com gente ou com plano, mais
"Todos"; o pedido pendente fica em Pedidos, fora da contagem.

- **Na URL**: `?tipo=<código>`, `?vinculo=federated|registered` (filiados ×
  cadastrados — filiado é o vínculo pagante, cadastrado o gratuito), `?filtro=`
  (os de sempre; `vencendo` é contrato de aviso) e a busca. Trocar de aba da
  Central limpa `tipo`, `vinculo` e `pasta`.
- **Configuração do tipo** (`data-dica="federacao-tipo-config"`): os planos
  daquele tipo, "Editar os planos" (só admin, leva a Configurações → Planos),
  aviso quando o tipo não tem plano (ninguém consegue pedir) ou foi desligado
  pela plataforma, e — em clube/arena — o atalho aos vínculos sem plano.
- Convidar pessoas da plataforma fica na aba "Todos".

### 27.2 A pasta (`?pasta=<id da filiação>`)

"Abrir pasta" (`data-dica="federacao-abrir-pasta"`, em Pedidos e no Cadastro)
abre `FedMemberFolder` (carregado sob demanda, `data-dica="federacao-pasta"`).
Abrir empurra uma entrada no histórico (o "voltar" do aparelho fecha a pasta);
"Voltar à lista" mantém tipo e filtros. Filiação que sumiu da lista diz que
pode ter sido encerrada ou recusada.

- **Cabeçalho**: nome/logo, situação, tipo · vínculo · plano · número, link ao
  perfil na plataforma (`/atleta/:uid`, `/clubes/:id`, `/arenas/:id`) e as
  ações de sempre (declaração, aprovar/recusar, suspender, reintegrar —
  `memberShared.jsx`, as mesmas da lista).
- **Partes**, escolhidas por `folderBlocks(tipo)` e pelos módulos ligados:
  Resumo (contagens, situação, representantes da entidade, dados reservados
  com motivo), Cobranças e recibos (com o comprovante), Documentos, Cursos e
  credenciais, Pontos (por ano, `pointsBySeason`), Arbitragem (quadro e
  escalas, só para árbitro), Pessoas e torneios (entidade: quem é do clube ou
  gere a arena, com o vínculo de cada um e "Abrir pasta", e os torneios da
  federação ligados a ela), Sanções e Histórico (transferências +
  `memberTimeline`).
- **Cada parte consulta só com a permissão que a regra exige**
  (`hooks/useMemberFolder.js`): cobranças `finance`/`members`/`fiscal`;
  sanções `discipline`; inscrições em curso `courses`/`finance`; credenciais
  `courses`; quadro e escalas `courses` (é o `fedRef` da regra); pontos
  qualquer pessoa da equipe (são públicos). Sem a permissão a tela não
  consulta e diz **quem vê aquela parte** — consulta recusada nunca vira "não
  carregou", e falha de verdade vira `V2ErrorState` com "Tentar de novo". Não
  há regra nova: a pasta lê as coleções pelas consultas de duas igualdades
  (`federation_id` + `member_id`/`user_id`), que a regra prova e dispensam
  índice composto. Provado em `tests/rules/federationRegistry.rules.test.js`.

### 27.3 O comprovante de pagamento

No "Já paguei" (`PixChargeBlock`) a pessoa pode anexar o **comprovante** (PDF,
JPG, PNG ou WebP até 5 MB, `ChargeProofField`; validado na hora). O arquivo
sobe para `federacao/{uid}/…` (só o dono lê no Storage) e a cobrança ganha
`declared_proof { path, name, content_type, size }`. Quem já informou o
pagamento pode voltar e anexar depois (a regra aceita re-declarar
`declared` → `declared`). A regra só aceita caminho da **própria** pasta do
pagador e as quatro extensões.

A equipe abre o comprovante pelo botão "Comprovante" (`ChargeProofButton`) no
Financeiro e na pasta, pela função `federationDocument` com `{ chargeId }`
(`chargeProof`): o pagador, ou `finance`/`members`/`fiscal`/`admin` da
federação da cobrança; cada abertura pela equipe grava
`federation_charge_proof_view` na auditoria (interna, como todo acesso de suporte).
O recibo da cobrança paga também sai da pasta.

### 27.4 Âncoras

`federacao-aba-cadastro`, `federacao-tipos`, `federacao-tipo-config`,
`federacao-vinculo`, `federacao-abrir-pasta`, `federacao-pasta`. Guia
"A pasta de cada filiado" (`federacao-pasta-filiado`).

## 28. Categorias de torneio e o torneio da própria federação (Etapa 4 do cadastro estruturado, 2026-10-22)

Cada federação define os **tipos de torneio** que chancela, com sigla, grupo e
a própria tabela de pontos — por exemplo **FGP 1000 (G1)**, **FGP 500 (G2)** —,
e pode **realizar** torneios em nome próprio. Zero coleção, zero índice, uma
linha de regra (o reenvio do resultado também confere a categoria).

### 28.1 As categorias (`ranking_config.tiers[]`)

- **Onde**: Central → Competições → Ranking, no topo (`FedTiersEditor`,
  `data-dica="federacao-categorias"`; o formulário é
  `federacao-categoria-form`). Até 30 categorias; cada uma tem `id` estável,
  sigla, grupo, nome, a tabela por colocação (até o 64º, não crescente), a
  participação (≤ última colocação), requisitos (mínimo de inscrições,
  premiação mínima, outras exigências) e o interruptor "Disponível para
  torneios novos" (desligada = arquivada: some da escolha, e quem já a usa
  segue igual). A última ativa não pode ser arquivada.
- **Gerar tabela**: pontos do campeão + até que colocação ⇒ vice 60%,
  semifinal 36%, quartas 18%, oitavas 9%… (`tierTableFromChampion`), e cada
  posição se ajusta à mão.
- **Sem categorias próprias** nada muda: as três padrão (Etapa regional,
  Etapa estadual, Campeonato principal) são derivadas de `points_by_place` ×
  `tier_multipliers` (`legacyTiers`). "Editar a partir das três padrão" as
  copia com os mesmos `id` — os torneios que já usam cada uma continuam
  ligados a ela; "Começar do zero" cria a primeira em branco.
- **A conta** (`normalizeRankingConfig`/`awardPoints`, com cópia no servidor e
  paridade): categoria própria encontrada ⇒ a tabela dela, multiplicador 1;
  não encontrada ⇒ a conta antiga. O lançamento grava a cópia `tier_code`,
  `tier_group` e `tier_name` — mudar ou arquivar a categoria depois não
  reescreve nada (§6.2, ano imutável). O que os lançamentos já têm aparece em
  "Meus pontos no ranking" e na pasta do filiado.
- **Validação**: `validateTiers` na tela e de novo no serviço
  (`updateRankingConfig`); sigla + grupo repetidos, pontos que sobem,
  participação acima da tabela e lista sem categoria ativa são recusados com o
  motivo ao lado da categoria.

### 28.2 Escolher a categoria

- **Quem pede a chancela** (`TournamentSanctionCard`) escolhe entre as
  categorias ATIVAS da federação escolhida, com os requisitos à vista
  (`FedTierRequirements`); a escolha é uma proposta.
- **A equipe** (`DecisaoDialog`, Competições → Chancelas) confirma ou troca a
  categoria ao aprovar e decide a **origem**: "Torneio realizado pela própria
  federação" grava `origin: 'federation'` (selo "Realizado pela SIGLA"); sem
  ela, `sanctioned` ("Chancelado · SIGLA"). `resolveSanctionTier` grava `tier`
  + `tier_code`/`tier_group`/`tier_name`; a categoria atual entra na lista
  mesmo arquivada, para não ser trocada à toa. O aviso da decisão vai a quem
  pediu e a quem criou o torneio (sem repetir, sem avisar quem decidiu).
- **O envio do resultado** usa a categoria da chancela (a regra confere no
  envio e no reenvio) e leva `tier_label` para exibir.

### 28.3 O torneio da federação

Central → Competições → Chancelas → **"Criar torneio da federação"**
(`data-dica="federacao-criar-torneio"`) abre `/torneios/criar?federacao=<id>`.
O bloco `FedTournamentOrigin` (carregado só com o parâmetro,
`data-dica="federacao-torneio-origem"`) pede a categoria e "só filiados" e,
sem condição de realizar, **diz por quê** e o torneio nasce comum: falta a
permissão `competitions`, a federação não está pública ou o módulo de torneios
está desligado. Ao criar, `startFederationTournament` grava o pedido
(silencioso — ninguém da equipe é avisado do que ela mesma faz) e aprova com
`origin: 'federation'`. Dois caminhos que a regra já tinha
(`tests/rules/federationPr2.rules.test.js`, "torneio DA federação"). Se a
segunda parte falhar, o torneio existe e o pedido fica em Chancelas.

### 28.4 Onde aparece

- Selo `TournamentSanctionBadge`: "Realizado pela FGP · FGP 1000 · G1" ou
  "Chancelado · FGP · FGP 500 · G2" (+ "só filiados").
- Página pública: os torneios trazem a sigla da categoria e "Da federação";
  o ranking ganha **"Quanto vale cada torneio"** (`FedTierList`,
  `data-dica="federacao-categorias-publicas"`), só com categorias próprias.
- Resultados enviados mostram a sigla.

### 28.5 Colocação no mata-mata

O envio ao ranking (`modalityPlacement(..., { allRounds: true })`) agora
coloca também quem caiu antes da semifinal: quartas = 5º, oitavas = 9º,
16 avos = 17º (perdedor da rodada `final − k` fica em `2^k + 1`). Antes,
categorias com tabela além do 4º lugar não pagavam ninguém dessas fases. O
pódio e os cartões seguem sem essa opção.

### 28.6 Defeito corrigido: Chancelas vazia

`listFederationTournaments` filtrava também `archived == false`, e torneio
novo nasce SEM o campo: nenhum pedido aparecia em Chancelas nem na página da
federação. Agora a consulta é só `federation_id ==` e o arquivado sai em
memória (emulador: "a lista de torneios da federação… traz o torneio criado
sem o campo `archived`").

### 28.7 Âncoras e guia

`federacao-categorias`, `federacao-categoria-form`, `federacao-criar-torneio`,
`federacao-torneio-origem`, `federacao-categorias-publicas` e as abas
`federacao-tab-chancelas`, `federacao-tab-resultados`, `federacao-tab-ranking`.
Guia "Criar as categorias de torneio e o torneio da federação"
(`federacao-categorias`), ligado ao artigo "Torneio chancelado por uma
federação".

## 29. Configuração geral das federações no painel do admin (Etapa 5 do cadastro estruturado, 2026-10-22)

Painel admin → Federações → **Configuração** ganhou quatro partes, numa barra
de abas (a parte aberta fica em `?parte=tipos|documentos|categorias|modulos`).
Tudo mora em `platform_settings/federations` (regra que já existia: só o admin
da plataforma grava, todo mundo lê) e cada parte grava só a sua chave
(`saveFederationPlatformCatalog`, validada pela mesma régua da tela). Nada
daqui obriga a federação: são pontos de partida que ela copia e muda — e mudar
aqui depois **não mexe** em plano, categoria ou federação que já existe.
Domínio em `domain/platformCatalog.js` (com teste).

### 29.1 Tipos de filiação

A tela da Etapa 2 (§26), agora a primeira aba.

### 29.2 Documentos sugeridos (`doc_kinds[]`)

- O admin mantém a lista (nome, para quem — pessoas, clubes e arenas ou todos —
  e "Sugerir" ligado/desligado), até 40. Sem nada gravado valem as sugestões
  padrão: foto 3x4, ficha de filiação assinada, termo de responsabilidade e uso
  de imagem, exame de vista, registro no CREF, certificado de curso de
  arbitragem (pessoas); estatuto social, cartão CNPJ, ata de eleição da
  diretoria, alvará de funcionamento, comprovante de endereço da sede
  (entidades). "Voltar às sugestões padrão" recoloca essas.
- No plano (Central → Configurações → Planos), abaixo dos documentos exigidos,
  aparecem **"Sugestões da plataforma (um toque acrescenta)"**
  (`data-dica="federacao-plano-sugestoes"`): só as ligadas, do público do plano
  e que o plano ainda não pede. O toque liga "Outro documento" e copia o nome
  para `other_docs[]` com id `c_<id>` — daí em diante é um documento próprio do
  plano, com o nome editável.
- Os quatro documentos de sempre (identidade, atestado, residência, autorização
  do responsável) continuam fixos no plano: são valores gravados e conferidos.

### 29.3 Modelos de categorias de torneio (`tournament_tier_templates[]`)

- Cada modelo tem nome, descrição e as categorias no mesmo formato da
  federação (§28.1), editadas com o mesmo editor (`FedTiersEditor` em modo
  `modelo`: sem arquivar, com "Tirar"). Até 12 modelos; cada um passa pela
  régua `validateTiers`.
- `{SIGLA}` na sigla ou no nome vira a sigla da federação ao copiar ("{SIGLA}
  1000" → "FGP 1000"; sem sigla, some com o espaço).
- Padrão: **Circuito em três grupos** ({SIGLA} 1000 · G1, 500 · G2, 250 · G3) e
  **Campeonato estadual e etapas** (2000 · G1, 1000 · G2, 500 · G3).
- A federação que ainda não criou categorias vê **"Ou comece de um modelo da
  plataforma"** em Competições → Ranking (`data-dica="federacao-categorias-modelos"`),
  com a prévia das siglas; o modelo vira a lista dela e só vale depois de
  salvar. Torneios que já usavam as três padrão seguem com a conta antiga
  (categoria desconhecida cai na conta de antes, §28.1).

### 29.4 Módulos iniciais (`default_modules`)

- O admin marca os módulos que já nascem ligados; ligar um que depende de outro
  leva o outro junto (ranking oficial ⇒ torneios chancelados) e desligar o
  exigido desliga o dependente (`normalizeDefaultModules`).
- Quem aplica é o **servidor**, em `federationReview`, na primeira aprovação
  (pendente ou recusada antes; a suspensa reaprovada mantém os dela): grava
  `modules.<id> = true` campo a campo, sem desligar o que já estiver ligado.
  Sem nada gravado, nenhum módulo nasce ligado — como sempre foi. Teste em
  `functions/federations.test.js`.

### 29.5 Âncoras e guia

`admin-federacoes-documentos`, `admin-federacoes-modelos`,
`admin-federacoes-modulos`, as abas `admin-federacoes-parte-{tipos,documentos,categorias,modulos}`,
`federacao-plano-sugestoes` e `federacao-categorias-modelos`. O guia
`federacoes-admin-tipos` virou "Configuração geral das federações (admin)",
com um passo por parte.

### 29.6 Revisão de uso das cinco etapas (2026-10-22)

O fluxo inteiro foi refeito por quem usa — filiado, cadastrado, clube, arena,
secretaria, competições e admin — e o que estava torto foi corrigido:

- **Filiado paga, cadastrado é gratuito** — a régua vale no plano
  (`validatePlanInput`): vínculo Cadastrado com valor, ou Filiado sem valor, é
  recusado com o motivo. Escolher "Cadastrado" no editor zera o valor; editar um
  plano não deixa abrir outro por cima (o formulário perdia o que estava
  digitado).
- **Plano de clube/arena não aparece para pessoa**: na lista pública ele diz
  "Quem administra o clube pede na gestão do clube" em vez de "Filiar-se neste
  plano", e o formulário de pessoa ignora `?plano=` de entidade. Na gestão do
  clube e na Central da arena (`OrgAffiliationCard`) entram **todas** as
  federações publicadas: a que tem plano para a entidade filia por plano mesmo
  com o módulo `affiliations` desligado; sem plano e sem o módulo, a tela diz
  que ela ainda não recebe clubes e arenas.
- **O selo diz o vínculo**: o espelho `federation_affiliations` passa a levar
  `tier` (servidor, `federationOrgMembers.espelhar`) e o selo do clube/arena é
  "Cadastrado · SIGLA" no plano gratuito; a filiação simples e a paga seguem
  "Filiado · SIGLA". Espelho antigo sem `tier` = "Filiado".
- **Formulário de pessoa**: o primeiro tipo oferecido já vem escolhido; o
  plano Cadastrado fala em "Pedir cadastro". Sem nascimento no perfil, o plano
  por **faixa de idade** some da lista com o link "Completar o perfil" — e o
  **servidor recusa** esse plano sem a idade (antes "idade desconhecida não
  barra" deixava qualquer conta pegar o Juvenil). Saíram os interruptores "selo
  no meu perfil" e "aparecer no diretório": nada na plataforma os lia. Os
  campos `public_badge`/`show_in_directory` seguem gravados com o padrão do
  servidor, reservados.
- **Nome do tipo**: `personTypeLabel(fonte, catálogo)` usa o nome ATUAL do
  catálogo da plataforma (renomear chega aos planos gravados); sem catálogo,
  vale o gravado no plano.
- **Pasta → Documentos**: lista o que o plano exige, um por um (falta enviar,
  em análise, aceito, recusado — `requiredDocsStatus`), com esqueleto enquanto
  carrega e "Tentar de novo" na falha.
- **Categorias sem o módulo de ranking**: com só `tournaments` ligado, a aba
  de Competições vira **Categorias** (mesmo valor `?aba=ranking`), com o editor
  de categorias e sem o que é só do ranking.
- **Avisos**: o documento aceito/recusado leva à filiação do clube/arena
  (`/federacoes/:id/filiar?entidade=…`) ou a "Minha filiação" da federação,
  onde se envia outro; o caminho dos módulos é "Central → Configurações →
  Módulos".

## 30. Regularidade do filiado (Bloco 1 das próximas frentes, 2026-10-22)

Quatro coisas dizem se o filiado está em dia além da anuidade. Tudo o que muda
a situação de alguém é gravado **pelo servidor**
(`functions/federationRegularity.js`, função `federationRegularity`), com
auditoria. A régua tem cópia em `functions/federationRegularityPolicy.js`, com
paridade contra `src/modules/federations/domain/regularity.js`
(`federationRegularity.parity.test.js`).

### 30.1 Validade dos documentos

- Em **Configurações → Planos**, cada documento exigido ganha um prazo
  (`federation_plans.doc_validity = { chave: meses }`, com meses em 3, 6, 12,
  24, 36 ou 60; ausente = não vence). Ao aceitar, a secretaria confirma a data
  sugerida (`federation_documents_submitted.valid_until`, texto `AAAA-MM-DD`).
  É a única chave nova que a regra deixa a secretaria gravar, além de estado e
  motivo.
- `requiredDocsStatus(plan, docs, hoje)` passa a dizer `expired`, `expiring`
  (até 30 dias), `valid_until` e `newer` (envio novo em análise). A pasta, a
  lista de filiados e "Minha filiação" mostram isso. Documento vencido ou
  vencendo, sem envio novo, oferece "Enviar o novo".
- O gatilho `federationDocumentsOnWrite` (escrita em
  `federation_documents_submitted`) refaz o resumo da filiação
  (`federation_members.docs_state`) e a trava `docs_block`. Só grava se algo
  mudou.
- A varredura diária (dentro de `federationMembershipSweep`) avisa quem enviou
  aos 30 e aos 7 dias e no próprio dia (`expiry_notified`, um aviso por marco),
  e aplica o vencimento (`expired_applied`).
- **Trava opcional**: `rules.block_expired_docs` (Configurações → Regras). Com
  ela ligada, documento vencido grava `docs_block: true`, e a regra da
  inscrição em torneio "só filiados" (`fedMemberOk`) recusa. Desligada, todos
  são avisados e nada trava.

### 30.2 Nível oficial

- A escala é da federação (`rules.levels`, padrão de 2.5 a 5.5+). Na pasta do
  filiado, "Definir o nível" (`level_set`, permissão `members` ou
  `competitions`) pede o motivo. Grava `official_level` e
  `official_level_history` (até 50 entradas) e avisa o atleta ou o responsável.
  A régua 2.0–8.0 da plataforma aparece só como sugestão (`suggestLevel`).
- O atleta pede revisão em Minha filiação (`level_review`: um pedido por vez,
  motivo com pelo menos 10 caracteres). A equipe aceita, definindo o nível, ou
  mantém, com motivo (`level_review_decide`). Clube e arena não têm nível.
- `rules.level_public` põe o nível na verificação pública da carteirinha
  (`official_level` em `publicVerification`, no cliente e no servidor).

### 30.3 Autorizações (LGPD)

- São três padrão: uso de imagem, novidades e compartilhamento com a
  confederação (`image`, `comms`, `share`). A federação pode criar até cinco
  próprias (`rules.extra_consents`).
- A pessoa marca no pedido de filiação (`pedirFiliacao` aplica
  `consentsPatch`) e muda quando quiser em Minha filiação (`consents`). Só o
  que MUDOU entra em `consents_log` (até 30 entradas), com a hora do servidor.
  A pasta do filiado mostra as autorizações em modo leitura.

### 30.4 Seguro e ocorrências (módulo `insurance`, aba `?aba=ocorrencias`)

- A presidência cadastra a apólice em `federations.insurance`: seguradora,
  apólice, vigência, quem está coberto (`active_members` ou `federated_only`) e
  como acionar.
- O filiado vê se está coberto e registra a ocorrência (lesão, acidente, mal
  súbito, outro). A equipe também registra e acompanha o andamento: `open` →
  `claim` (número do sinistro obrigatório) → `closed`, tudo em `history[]`.
- A ocorrência guarda `insured` e uma cópia da apólice do dia. Quando quem
  registra é o atleta, a equipe é avisada; quando é a equipe, o atleta ou o
  responsável é avisado.
- `federation_incidents`: só o servidor grava. Leem o atleta, o responsável,
  quem registrou e quem tem `members`, `competitions` ou `admin`. O financeiro
  não lê.
- Exclusão de conta: a ocorrência fica (pode haver sinistro em andamento), mas
  sem o nome, o relato e a parte do corpo. Na exportação, ela aparece como
  "Ocorrências registradas no seguro esportivo".

### 30.5 Não pode regredir

59. `docs_state`, `docs_block`, `official_level*`, `level_review` e
    `consents*` **só o servidor grava**; a regra recusa a gravação da própria
    pessoa.
60. Documento vencido só trava com `rules.block_expired_docs` ligado. O aviso
    sai sempre, um por marco.
61. A cobertura do seguro olha se a filiação está **ativa** pelo `status` de
    `membershipState`. 🐞 A primeira versão lia `.state`, que não existe, e
    toda ocorrência saía "sem cobertura"; o teste do servidor pegou.
62. Ocorrência não é lida pelo financeiro, nem por quem não é dono ou equipe.
    O relato de saúde sai na exclusão de conta.

### 30.6 Âncoras e guia

Âncoras: `federacao-aba-regras`, `federacao-pasta-regularidade`,
`federacao-minha-nivel`, `federacao-minha-autorizacoes`,
`federacao-minha-seguro`, `federacao-seguro-apolice`,
`federacao-seguro-ocorrencias`, `federacao-filiar-autorizacoes`.

Guias: `federacao-regularidade` (equipe) e `federacao-minha-regularidade`
(filiado). Artigo: `federacao-regularidade`.

## 31. Competições: chancela com prazo, diretor e taxa; relatório; final do circuito (Bloco 2 das próximas frentes, 2026-10-22)

Tudo o que muda o pedido de chancela além do que o organizador escreve, e tudo
do relatório e dos convites da final, é gravado **pelo servidor**
(`functions/federationCompetitions.js`: gatilho `federationSanctionSync` em
`tournaments/{id}`, callable `federationCompetition` e a varredura diária). A
régua tem cópia em `functions/federationCompetitionsPolicy.js`, com paridade
contra `src/modules/federations/domain/competitions.js`
(`federationCompetitions.parity.test.js`).

### 31.1 O pedido de chancela conferido pelo servidor

- Em **Configurações → Regras → Chancela de torneios** (só com o módulo
  `tournaments`): antecedência mínima (`rules.sanction_min_days`, 0 a 365;
  0 = sem prazo) e "exigir diretor credenciado"
  (`rules.sanction_requires_director`).
- O organizador informa, no pedido (`TournamentSanctionCard`), a premiação por
  gênero (`federation_sanction.prize = { female_cents, male_cents, note }`) e,
  se quiser ou se a federação exigir, o código da credencial de diretor
  (`director_code`). `requested_by_name` vai junto.
- O gatilho confere **uma vez por pedido** (`checked_at_ms = requested_at_ms`):
  sem data de início ou fora do prazo ⇒ recusado sozinho (`decided_by:
  'system'`, com o motivo); código que não é de uma credencial **ativa** de
  diretor (`kind: 'director'`) **desta** federação, com a exigência ligada ⇒
  recusado. Aprovado na conferência, grava `director_uid`, `director_name`,
  `director_credential_id`, `director_verified`, `days_ahead`, `fee_cents` e
  `fee_charge_id`. Sem diretor credenciado, o diretor é quem pediu.
- A equipe `competitions`/`admin` da própria federação não passa por prazo nem
  taxa (é o torneio da federação).
- A credencial de diretor sai de um curso do tipo "Diretor de torneio"
  (`director`), como as outras credenciais (§6.5).

### 31.2 A taxa de chancela

- Cada categoria pode ter a sua taxa (`ranking_config.tiers[].sanction_fee_cents`,
  editada em Competições → Ranking → Categorias; os modelos de categoria não
  levam taxa). `normalizeTier` a preserva.
- Pedido conferido com taxa ⇒ cobrança Pix para quem pediu
  (`federation_charges`, `origin: 'sanction'`, `tournament_id`, `tier`), aviso
  e o Pix na própria gestão do torneio. Uma taxa que já cobre o pedido (paga
  com valor suficiente, ou aberta com o mesmo valor) é reaproveitada; aberta
  com outro valor (mudou a categoria) é cancelada e sai outra.
- Pedido retirado, recusado ou trocado de federação cancela a taxa em aberto.
- `chargeConfirm` com `origin: 'sanction'` grava no torneio
  `fee_paid_at_ms` (confirmada) ou `fee_cancelled_at_ms` (dispensada) e avisa
  competições. O "Chancelar" da Central fica travado enquanto a taxa está
  aberta. A trava é **só da tela**, de propósito: a taxa é da própria
  federação, e quem aprovaria sem ela é a própria equipe.
- O financeiro lê a cobrança de chancela; quem tem só `competitions` também a
  lê (para ver se foi paga), mas não as anuidades.

### 31.3 Checklist e relatório do diretor

- Chancela aprovada ⇒ nasce `federation_tournament_reports/{tournamentId}`
  (federação, torneio, datas, `director_uid`/`director_name`/
  `director_verified`, `organizer_uid`) e o diretor é avisado (se não for quem
  pediu).
- `checklist` (diretor ou organizador): seguro, arbitragem, local,
  primeiros socorros e programação (`CHECKLIST_ITEMS`, gravados — nunca
  renomeie), observações e `complete`.
- `report`, a partir do primeiro dia do torneio: inscritos, W.O.,
  ocorrências, lesões e reclamações (com a descrição obrigatória quando há
  número), notas. Reenviar substitui o relatório e conta as revisões
  (`report.revisions`); só a
  primeira entrega avisa competições.
- Na Central, Chancelas → "Ver relatório" (leitura) e os selos "Checklist
  completo/pendente" e "Relatório entregue/pendente". Para o diretor, Minha
  área → Federações → "Torneios que você dirige" (`directorStage`).

### 31.4 Premiação

`prizeParity(prize)` compara feminino e masculino. Diferentes, o pedido e a
Central mostram a diferença e lembram a Lei 14.597/2023 (premiação igual
entre gêneros). É aviso, não trava.

### 31.5 Final do circuito

- Em uma chancela **aprovada**, "Final do circuito" (`final_send`, só
  `competitions`/`admin`): ano do ranking, vagas por categoria (1 a 64) e dias
  para responder (padrão 7). Convida os primeiros de cada categoria de
  `federation_rankings/{fed}_{ano}` que ainda não foram convidados
  (`federation_final_invites/{torneio}_{categoria}_{uid}`), avisa cada um e
  guarda as opções em `report.final`.
- O atleta confirma ou recusa em Minha área → Federações
  (`final_answer`). Recusar, vencer o prazo (varredura) ou ser cancelado pela
  equipe (`final_cancel`, com motivo) abre a vaga, e o próximo do ranking é
  chamado sozinho (`substitute: true`) — até o torneio começar.
- O convite não inscreve ninguém: confirmar só garante a vaga; a inscrição
  segue pelo torneio.

### 31.6 Leitura

- `federation_tournament_reports`: diretor, organizador e `competitions`/
  `admin` (e o admin da plataforma com acesso justificado). O financeiro não.
- `federation_final_invites`: o próprio atleta e `competitions`/`admin`.
- As duas coleções: só o servidor grava. Na exclusão de conta, o convite é
  apagado e o relatório fica sem o nome do diretor; na exportação, aparecem
  as duas.

### 31.7 Não pode regredir

63. O organizador **nunca** escreve as chaves que o servidor confere
    (`checked_at_ms`, `director_uid`, `director_name`,
    `director_credential_id`, `director_verified`, `days_ahead`, `fee_cents`,
    `fee_charge_id`, `fee_paid_at_ms`, `fee_cancelled_at_ms`) — a regra
    (`tournamentFederationOk`) recusa. Depois da conferência, `checked_at_ms`
    está no mapa e qualquer mudança do organizador nele é recusada; editar os
    outros campos do torneio segue livre.
64. **`fedAny(fid, [perms])`** é a forma de dizer "alguma destas permissões"
    na regra. Várias `fedHas` em sequência estouram o limite de 1.000
    expressões numa leitura recusada (o teste de regra da cobrança pegou).
65. A taxa só é criada pelo servidor e nunca duas vezes para o mesmo pedido.
66. Convite para a final só para torneio chancelado por esta federação, e
    suplente só antes do início.
67. A régua (prazo, taxa, premiação, checklist, relatório, convites) muda nos
    dois lados ao mesmo tempo, senão a paridade quebra.

### 31.8 Âncoras e guia

Âncoras: `federacao-regras-chancela`, `federacao-aba-chancelas`,
`federacoes-finais` e `federacoes-diretor` (Minha área).

Guias: `federacao-chancela` (atualizado) e `federacao-final-circuito`.
Artigo: `federacao-torneios`.

## 32. Seleção estadual e editais de apoio ao atleta (Bloco 3 das próximas frentes, 2026-10-22)

Dois módulos novos, ligáveis por federação: **Seleção e delegações**
(`selection`) e **Editais de apoio ao atleta** (`grants`). Na Central, a seção
**Seleção e editais** (abas Convocações e Editais) aparece para
`competitions`, `finance` e `admin` com ao menos um dos dois ligado. Na página
pública, os dois ficam na aba **Competições** (âncoras `fed-selecao` e
`fed-editais`). Tudo é gravado **pelo servidor**
(`functions/federationSelection.js`: callable `federationSelection` e a
varredura diária). A régua tem cópia em
`functions/federationSelectionPolicy.js`, com paridade contra
`src/modules/federations/domain/selection.js`
(`federationSelection.parity.test.js`).

### 32.1 Convocação da seleção

- **Montar** (`callup_save`, `competitions`/`admin`): campeonato, local,
  datas, critério — **pelo ranking oficial** de um ano (`season`, as
  categorias do ranking ou todas, e quantos por categoria) ou **a dedo** —,
  prazo para responder (`accept_days`), documentos de viagem pedidos
  (`travel_docs`), se pede o tamanho do uniforme e as orientações. Nasce
  rascunho.
- **Publicar** (`callup_publish`): pelo ranking, convida os primeiros de cada
  categoria de `federation_rankings/{fed}_{ano}` (o mesmo desenho dos convites
  da final, §31.5) e avisa cada um. Publicada, o **critério não muda** (ano,
  categorias, vagas); a logística segue editável. A dedo (`callup_add`), a
  equipe escolhe cada pessoa na lista de usuários (`FedPersonPicker`), com a
  categoria ou função (técnico, chefe de delegação).
- **Responder** (`callup_answer`): o próprio convocado, em Minha área →
  Federações, dentro do prazo, com o tamanho do uniforme se pedido. Recusar,
  vencer o prazo (varredura) ou ser cancelado pela equipe
  (`callup_cancel_member`, com motivo) chama o próximo do ranking sozinho
  (`substitute: true`) — só com a convocação aberta e o evento ainda não
  começado.
- **Acompanhar** (`callup_member_update`): a equipe marca os documentos de
  viagem conferidos (`docs_ok`) e escreve a anotação; o convocado só muda o
  próprio uniforme.
- **Encerrar**: `callup_close` fecha a delegação (convites em aberto são
  cancelados, ninguém mais é chamado, quem aceitou é avisado);
  `callup_cancel` cancela com motivo e avisa todos — o rascunho, que ninguém
  viu, é apagado.
- **Custos** (`callup_costs`): passagens, hospedagem, inscrição etc. (até 30,
  categoria de despesa das contas). Competições edita; **só o financeiro marca
  `paid_at`**. O custo pago entra nas contas como despesa **derivada**
  (`callupExpenses`, `ref: callup:{id}:{custo}`), sem lançamento duplicado —
  como as diárias da arbitragem (§23).
- **Lista pública**: `roster` guarda só os confirmados, com nome, categoria e
  função; a chave de cada linha é um hash do id do convite (**nunca o uid**).

### 32.2 Edital de apoio ao atleta

- **Montar** (`grant_save`): tipo (`travel|scholarship|equipment|other`),
  vagas, valor por contemplado (em branco se não for dinheiro), critérios,
  período de inscrição, documentos pedidos (`required_docs`, chaves `d1…`),
  dias para recurso e "só filiados em dia" (padrão sim). Publicado
  (`grant_publish`), **as regras não mudam**: só o fim das inscrições pode ser
  estendido, com motivo no `history`. Com o acervo oficial ligado, o edital
  publicado e o resultado viram atos numerados (`notice_code`,
  `result_code`). Filiados são avisados.
- **Inscrever-se** (`grant_apply`): conta logada (só filiado em dia, se
  `members_only`), justificativa e os arquivos — que ficam na pasta
  `federacao/{uid}/` da própria pessoa (`ownFilePath`). Reenviar substitui
  enquanto não analisada; `grant_withdraw` desiste.
- **Analisar**: no fim do prazo a varredura passa o edital para `review` e
  avisa competições. Cada inscrição recebe decisão (`grant_decide`:
  contemplada, lista de espera ou não contemplada, com motivo quando não
  contempla, nota opcional; o teto de vagas é conferido). Com todas
  decididas, `grant_result` publica os contemplados (`result`, **sem uid**),
  avisa todos e abre o prazo de recurso (`appeal_until`).
- **Recurso** (`grant_appeal`, a pessoa, até `appeal_until`, uma vez) e
  julgamento (`grant_appeal_decide`, com motivo; provido, entra no resultado
  se houver vaga). Com o prazo vencido e nenhum recurso pendente, a varredura
  (ou `grant_finalize`) encerra o edital (`final`).
- **Pagamento** (`grant_pay`, `finance`/`admin`): valor e data por
  contemplado; `undo` desfaz. Entra nas contas como despesa derivada
  (`grantExpenses`, categoria do tipo de apoio) e, pela prestação de contas,
  na transparência.
- **Arquivos**: a equipe `competitions`/`admin` abre pela função
  `federationDocument` com `applicationId` (auditado em
  `federation_grant_file_view`); a regra do Storage não consulta o banco.

### 32.3 Leitura, exclusão e exportação

- Convocação e edital **publicados** são públicos na federação pública
  (`fedSees`); o rascunho, só `competitions`/`finance`/`admin`.
- O **convite** (documentos, uniforme, anotação) só o convocado e
  `competitions`/`admin` — o financeiro **não**. A **inscrição** no edital, a
  pessoa e `competitions`/`finance`/`admin`.
- As quatro coleções: só o servidor grava.
- Exclusão de conta: o convite é apagado e o nome sai da `roster`; a inscrição
  contemplada ou paga fica sem nome, texto e arquivos (é registro contábil da
  federação), as demais são apagadas, e o nome sai de `result`/`payments`.
  Exportação: os convites e as inscrições da pessoa.
- Minha área → Federações: "Minhas convocações" (abertas e as aceitas cujo
  evento não passou) e "Minhas inscrições em editais" (último ano); a faixa
  "Precisa de você" conta as convocações esperando resposta.

### 32.4 Não pode regredir

68. A régua (validação, convidados pelo ranking, custos, despesas, prazo de
    recurso, resultado público) muda nos dois lados ao mesmo tempo, senão a
    paridade quebra.
69. A lista pública da delegação e o resultado do edital **nunca levam uid**
    (`rosterKey`, `grantPublicResult`).
70. O custo da convocação só vira despesa com `paid_at`, e só o financeiro o
    marca; o servidor reaplica o `paid_at` anterior quando quem salva não é do
    financeiro.
71. Publicada, a convocação não troca de critério e o edital não troca de
    regra; só o prazo de inscrição do edital estende, com motivo.
72. O financeiro não lê `federation_callup_members` (teste de regra).
73. Arquivo da inscrição só da pasta de quem se inscreve, e só competições ou
    a própria pessoa o abrem.
74. Os enums gravados (`travel_docs`, `GRANT_KINDS`, status, `UNIFORM_SIZES`,
    `CALLUP_COST_CATEGORIES`) e os valores `?aba=convocacoes|editais` são
    contrato — nunca renomeie.

### 32.5 Âncoras e guias

Âncoras: `federacao-secao-selecao`, `federacao-tab-convocacoes`,
`federacao-tab-editais`, `federacao-aba-convocacoes`, `federacao-aba-editais`,
`federacao-nova-convocacao`, `federacao-novo-edital`,
`federacao-pub-selecao`, `federacao-pub-editais`,
`federacao-edital-inscrever`.

Guias: `federacao-convocacao`, `federacao-editais` e
`federacao-edital-inscricao`. Artigo: `federacao-selecao`.

## 33. Licença de professor e proteção de menores (Bloco 4 das próximas frentes, 2026-10-22)

Dois módulos novos, ligáveis por federação: **Licença de professor**
(`coach_licenses`) e **Proteção de menores** (`safeguarding`, no modelo
SafeSport/Safe Play). Uma permissão nova da equipe, **`safeguarding`**, que vai a um cargo
próprio (`federations.staff_roles`) — a presidência, a diretoria e o admin
master têm todas, como sempre. Tudo é gravado **pelo servidor** (`functions/federationCoaching.js`:
callable `federationCoaching`, o gatilho `federationMinorReportNotify` e a
varredura diária). A régua tem cópia em
`functions/federationCoachingPolicy.js`, com paridade contra
`src/modules/federations/domain/coachLicenses.js` e `safeguarding.js`
(`federationCoaching.parity.test.js`).

### 33.1 Licença de professor

- **Níveis** (`federations.coach_rules.levels[]`, `license_rules`, equipe
  `courses`/`admin`): até 8, cada um com `id` (gravado), nome, se exige a
  **credencial do curso de formação** (`requires_credential`: credencial
  `kind: 'coach'` da federação cujo `level` é o nome ou o id do nível), as
  **horas de atualização** dos últimos 12 meses (`update_hours`, somadas das
  inscrições aprovadas em cursos da federação, pelas `hours` do curso) e a
  validade em meses (1–60). Sem níveis gravados valem três padrão (Nível 1, 2
  e 3: 8, 12 e 16 h, 12 meses). Mudar um nível não muda licença concedida.
- **Pedir** (`license_apply`): o professor, em Minha área → Federações →
  "Licença de professor e proteção de menores", vê os requisitos de cada nível
  (`me`) e pede com um recado opcional; licenciado, pede a **renovação**
  (`renewal_requested_at_ms`). A equipe é avisada.
- **Conceder** (`license_check` + `license_grant`): o servidor confere os três
  requisitos. Falta de credencial ou horas só passa com **dispensa e motivo**
  (≥ 10 letras, gravado na licença e na auditoria); falta de proteção de
  menores **nunca** se dispensa. Ninguém concede a própria licença. A validade
  conta da data atual ou, numa renovação em dia, do vencimento anterior.
- **Decidir**: `license_decline`, `license_suspend`, `license_reinstate` e
  `license_revoke` (motivo obrigatório, menos na reativação), com o professor
  avisado; o `history` guarda os últimos 30 eventos.
- **O selo** (`federation_coach_badges/{uid}`, leitura pública): as licenças
  **válidas** de federações **publicadas** que o professor deixou aparecer
  (`license_prefs` → `public_listing`). Aparece no perfil do professor
  (`CoachFederationBadges`, "Professor credenciado pela {sigla}") e na aba
  **Cursos** da página da federação (`FedCredentialedCoaches`). Recalculado a
  cada decisão e pela varredura, que tira o selo vencido.
- **Avisos da varredura**: 30 dias antes do vencimento e no vencimento.

### 33.2 Proteção de menores

- **Regras** (`federations.safeguarding_rules`, `sg_rules`): quem precisa
  estar em dia (`required_for` entre `coach`, `referee`, `director`, `staff`;
  padrão os três primeiros) e a validade da certidão em meses a partir da
  emissão (`background_months`, padrão 12).
- **Em dia** = **curso de proteção** válido (credencial `kind:
  'safeguarding'` da federação, emitida ao aprovar um curso desse tipo) **e**
  **certidão de antecedentes conferida** dentro da validade
  (`federation_safeguarding/{fed}_{uid}.cleared_until`, recalculado por
  `refreshClearance` ao aprovar o curso, ao conferir ou revogar a certidão e
  na varredura).
- **A certidão**: a pessoa envia em Minha área (`sg_submit`, arquivo da pasta
  `federacao/{uid}/` dela, PDF ou foto). O responsável (`safeguarding`) abre
  pelo `sg_file` (auditado em `federation_safeguarding_file_view`) e decide
  (`sg_verify`: conferida, com a validade, ou não aceita, com motivo; ninguém
  confere a própria). Na
  decisão o **arquivo é apagado** do Storage: fica a data de emissão, a
  validade e quem conferiu. `sg_revoke` revoga com motivo. A pessoa é avisada
  em cada passo e 30 dias antes de vencer.
- **O efeito** (`clearanceBlocker`): sem estar em dia, o servidor recusa a
  **escala de arbitragem** (`federationReferees`), a **licença de professor**
  e a **chancela com diretor de torneio credenciado**
  (`federationCompetitions`), com a mensagem do que falta.
- **Quem trabalha com menores** (`sg_overview`): professores licenciados,
  árbitros do quadro, diretores de torneio e quem enviou certidão, com o
  curso, a certidão e se pode trabalhar.

### 33.3 Denúncia de proteção de menor

- A ouvidoria (§6.6) ganha o assunto **`minor_protection`** ("Proteção de
  criança ou adolescente"), oferecido só com `safeguarding` ligado (a regra
  também exige). O formulário mostra o 190, o Disque 100 e o Conselho
  Tutelar.
- **Acesso restrito**: só a permissão `safeguarding` lê e trata
  (`fedRepStaff`); a disciplina, `admin` comum e a ouvidoria comum **não**.
  A lista da disciplina consulta `kind in [conduct, referee, organization,
  other]` e a de proteção `kind == 'minor_protection'` (a consulta precisa
  ser provável pela regra).
- **Prioridade**: o gatilho `federationMinorReportNotify` avisa o responsável
  na hora (sem o conteúdo, que fica só na Central), e a faixa "Precisa de
  você" conta as denúncias em aberto e as certidões para conferir.
- Desligar `safeguarding` com denúncia em aberto mantém a aba Denúncias
  (`residualModules`) até concluir.

### 33.4 Leitura, exclusão e exportação

- `federation_coach_licenses`: o professor e `courses`/`admin`.
  `federation_safeguarding`: a pessoa e `safeguarding`. As três coleções:
  `allow write: if false`.
- Exclusão de conta: licença, selo e registro da proteção são **apagados**
  (o arquivo da certidão sai com a pasta). Exportação: os três.

### 33.5 Não pode regredir

75. A régua (requisitos da licença, estado, selo, clearance, validade da
    certidão) muda nos dois lados ao mesmo tempo, senão a paridade quebra.
76. A proteção de menores **nunca** entra nas dispensas da licença.
77. O arquivo da certidão é apagado na decisão; o registro guarda só datas,
    status e quem conferiu.
78. A denúncia `minor_protection` só é lida por `safeguarding` (teste de
    regra); a disciplina não a vê nem por consulta sem filtro de `kind`.
79. O selo só mostra licença válida de federação publicada que o professor
    deixou aparecer.
80. Os ids gravados (níveis, `LICENSE_STATUS`, `BACKGROUND_STATUS`,
    `SG_ROLES`, `minor_protection`) e os valores
    `?aba=licencas|licencas-niveis|protecao|protecao-denuncias|protecao-regras`
    são contrato — nunca renomeie.

### 33.6 Âncoras e guias

Âncoras: `federacao-secao-professores`, `federacao-aba-licencas`,
`federacao-aba-licencas-niveis`, `federacao-licencas`,
`federacao-licencas-niveis`, `federacao-licencas-conceder`,
`federacao-professores`, `federacao-professores-credenciados`,
`professor-selo-federacao`, `federacao-secao-protecao`,
`federacao-aba-protecao`, `federacao-aba-protecao-denuncias`,
`federacao-aba-protecao-regras`, `federacao-protecao`,
`federacao-protecao-conferir`, `federacao-protecao-denuncias`,
`federacao-protecao-regras`, `federacao-protecao-painel`,
`minha-area-licenca-pedir`, `minha-area-certidao`.

Guias: `federacao-licencas`, `federacao-protecao` e
`federacao-minha-licenca`. Artigos: `federacao-licencas` e
`federacao-protecao-menores`.

## 34. Conformidade, relatório anual, planilhas, contratos de patrocínio e patrimônio (Bloco 5 das próximas frentes, 2026-10-23)

Cinco entregas da administração da federação. Duas são **zero banco**
(relatório anual e planilhas), uma estende a Conformidade (§25) e duas usam
coleções novas, gravadas **só pelo servidor** (`functions/federationManagement.js`:
callable `federationManagement` + varredura diária dentro de
`federationMembershipSweep`). A régua tem cópia em
`functions/federationManagementPolicy.js`, gerada de
`src/modules/federations/domain/management.js`, com paridade em
`functions/federationManagement.parity.test.js`.

### 34.1 Conformidade: dois itens novos

`complianceChecklist` (`domain/compliance.js`) ganhou:

- **Premiação igual entre gêneros** (`prize_equality`, Lei 14.597/2023 art.
  36, IX; Lei 14.611/2023): os torneios chancelados (aprovados) que começam no
  ano e cuja chancela declarou a premiação (`prizeParity`). Algum desigual ⇒
  atenção, com até três nomes; todos iguais ⇒ em dia; ninguém declarou (ou
  nenhum torneio) ⇒ "não deu para conferir", nunca reprovação. A Central
  passa os torneios que já lê (`tournamentsQ`); falhando, o item diz isso.
- **Proteção de crianças e adolescentes** (`safeguarding`, boa prática ECA):
  em dia com o módulo de proteção de menores (§33.2) ligado; senão leva à aba
  de módulos.

### 34.2 Relatório anual de atividades

Central → Indicadores → **Relatório anual** (`?aba=relatorio-anual`, só a
administração). `annualReport` (`domain/annualReport.js`) monta, para um dos
cinco últimos anos (`annualReportYears`), as seções: diretoria e governança,
filiados (em dia hoje, entraram no ano pelo número da filiação, venceram no
ano sem renovar, dependentes, por tipo), competições (chancelados, realizados
pela federação, premiação igual, categorias com resultado, atletas com
colocação), ranking (os cinco primeiros do geral), cursos, disciplina e
ouvidoria (**só contagens**), finanças e conformidade. Módulo desligado ⇒ a
seção não aparece.

- **Finanças**: com a prestação de contas do ano **enviada** (não rascunho),
  valem os números congelados no `snapshot`; sem ela, o que entrou pela
  plataforma (cobranças pagas no ano, por origem), dizendo que a prestação
  não foi enviada.
- **Fonte que não carregou** entra em `missing` da seção e aparece como "Não
  deu para conferir: …", nunca zero (docs/27).
- **Imprimir ou salvar em PDF** (`FedAnnualReportPanel`): `window.print()`
  com a folha num portal claro (`imprimindo-cartao` + `recibo-folha
  tema-claro`), o mesmo padrão do recibo e da carteirinha.

### 34.3 Planilhas (CSV)

`domain/exports.js`, todas com `csvCell` (separador `;`, fórmula neutralizada
com `'`) e `baixarCsv`:

- `membersCsv` — Filiados → Cadastro, a lista **filtrada** (nome, número,
  filiado/cadastrado, tipo, plano, situação de hoje, validade).
- `resultsCsv` — Competições → Resultados, uma linha por atleta, por
  colocação.
- `rankingCsv` — aba Ranking da página, para a equipe: o geral e cada classe.
- `assetsCsv` — Administração → Patrimônio.

Nenhuma leva telefone, e-mail, CPF ou documento.

### 34.4 Contratos de patrocínio (módulo `sponsors`)

Coleção `federation_sponsor_contracts` (leitura `fedAcc`: financeiro, conselho
fiscal, admin; escrita `false`). A aba **Administração → Contratos de
patrocínio** (`?aba=contratos-patrocinio`) aparece com o módulo `sponsors`;
quem grava é o **financeiro e a administração** (`canManageContracts`).

- **O contrato** (`validateContract`): patrocinador, CNPJ, cota
  (`main`/`support`/`partner`), vigência, até 60 **parcelas**
  (vencimento + valor; o total é a soma) e até 30 **contrapartidas** (texto +
  prazo). Ids das linhas estáveis (`comIds`: a linha nova não toma o id de
  uma que já existe). `splitInstallments` divide o total em parcelas mensais
  sem perder centavos.
- **Ações** (`contract_save`, `contract_receive`, `contract_unreceive` com
  motivo, `contract_deliver` com `undo`, `contract_cancel`): parcela recebida
  **não muda** de data nem de valor nem some numa edição
  (`mergeContractEdit`); recebimento com data no futuro é recusado; com o
  módulo de contas ligado, **período com prestação enviada fica fechado**
  (`closedPeriodFor`) para receber e desfazer. Cancelar e apagar só `admin`;
  apagar só sem parcela recebida.
- **Receita nas contas**: cada parcela recebida vira item derivado de receita
  `sponsorship` (`sponsorIncome` → `accountItems({ extraIncome })`, rótulo
  "Parcela de patrocínio", ref `sponsor:{contrato}:{parcela}`), nos dois lados:
  a prévia da tela (`FedAccountsPanel`) e a prestação congelada no servidor
  (`federationAccounts.itensDaConta` → `federationManagement.receitas`).
- **Avisos da varredura** (`contractAlerts`, uma vez cada, em `warned`): fim
  da vigência a 30 dias (admin + financeiro; mudar o `end` reabre o aviso),
  parcela vencida sem receber (financeiro) e contrapartida com prazo vencido
  (admin).

### 34.5 Patrimônio (módulo `assets`)

Módulo novo `assets` ("Patrimônio", `FED_MODULE.ASSETS`, controle interno, não
aparece na página). Coleção `federation_assets` (leitura `fedAcc` ou
`competitions`; escrita `false`). Aba **Administração → Patrimônio**
(`?aba=patrimonio`); grava quem tem financeiro, competições ou admin
(`canManageAssets`).

- **O bem** (`validateAsset`): nome, categoria (`nets`, `scoreboards`,
  `balls`, `paddles`, `court_kits`, `electronics`, `furniture`, `uniforms`,
  `other`), quantidade (1–9999, nunca abaixo do que está emprestado), código,
  local, estado (`new`, `good`, `fair`, `damaged`), aquisição e valor.
- **Empréstimo** (`asset_loan`, `validateLoan`): quantidade disponível, quem
  recebe (`club`/`arena`/`event`/`other`, **nome escrito à mão — nunca uma
  pessoa da plataforma**), saída e devolução combinada. **Devolução**
  (`asset_return`): data e estado; voltou danificado ⇒ o bem fica
  `damaged`. Ficam os últimos 100 empréstimos (`trimLoans`, os abertos
  sempre).
- **Baixa** (`asset_retire`): com motivo, sem empréstimo aberto; `undo`
  reativa; `remove` apaga (só admin, nunca emprestado).
- **Aviso**: empréstimo vencido avisa quem emprestou (ou a administração),
  uma vez por data combinada (`warned_for`).

### 34.6 Exclusão e exportação

Contratos e bens são dados da **federação**, não da pessoa: a exclusão de
conta só tira `created_by` (`functions/accountDeletion.js`) e a exportação não
os inclui (isenção no guarda `exclusaoCobreColecoes`).

### 34.7 Não pode regredir

81. `federation_sponsor_contracts` e `federation_assets` só o servidor grava
    (teste de regra `tests/rules/federationManagement.rules.test.js`).
82. A régua de contratos e patrimônio muda nos dois lados ao mesmo tempo
    (paridade `functions/federationManagement.parity.test.js`).
83. Parcela recebida entra nas contas **uma vez**, derivada — nunca como
    lançamento manual — e não muda nem some numa edição; período fechado não
    aceita receber nem desfazer.
84. Quem recebe um empréstimo é texto livre, nunca uid.
85. Relatório anual e planilhas são **zero banco**; fonte que falhou é dita,
    nunca zero; disciplina e ouvidoria só como contagens.
86. Os ids gravados (`CONTRACT_TIERS`, `CONTRACT_STATUS`, `ASSET_CATEGORIES`,
    `ASSET_CONDITIONS`, `ASSET_STATUS`, `BORROWER_KINDS`, `assets`,
    `prize_equality`, `safeguarding`) e os valores
    `?aba=relatorio-anual|contratos-patrocinio|patrimonio` são contrato.

### 34.8 Âncoras e guias

Âncoras: `federacao-aba-relatorio-anual`, `federacao-relatorio-anual`,
`federacao-relatorio-imprimir`, `federacao-filiados-csv`,
`federacao-resultados-csv`, `federacao-ranking-csv`,
`federacao-secao-administracao`, `federacao-aba-contratos`,
`federacao-aba-patrimonio`, `federacao-contratos`, `federacao-contrato-novo`,
`federacao-patrimonio`, `federacao-patrimonio-novo`.

Guias: `federacao-administracao` e `federacao-relatorio-anual`. Artigos:
`federacao-administracao`, `federacao-relatorio-anual` e
`federacao-conformidade` (atualizado).

## 35. Confederação e rede nacional (Bloco 6 das próximas frentes, 2026-10-23)

A camada nacional: a **confederação** tem as federações estaduais como
filiadas. Quem marca uma federação como confederação é o **admin da
plataforma** (Painel admin → Federações → "Marcar confederação", ações
`confederation`/`unconfederation` da revisão; tirar a marca de quem tem
filiadas o servidor recusa). Tudo é gravado **só pelo servidor**
(`functions/federationNational.js`: callable `federationNational` + varredura
diária dentro de `federationMembershipSweep`). A régua tem cópia em
`functions/federationNationalPolicy.js`, gerada de
`src/modules/federations/domain/national.js` (do `export const DUES_AMOUNT_MAX`
em diante), com paridade em `functions/federationNational.parity.test.js`.

Campos novos (todos opcionais, travados em `fedLocked()` — a federação não os
grava pelo navegador, nem na criação):

- `federations.confederation` (`true` = confederação);
- `federations.national_body` `{ id, name, acronym, slug, since_ms }` — o
  espelho do vínculo aprovado, de onde saem o selo "Filiada à {sigla}" e a
  lista pública das filiadas (consulta `national_body.id ==` + aprovada +
  publicada, sem login);
- `federations.national_config` — as regras da rede (§35.4).

### 35.1 Vínculo (`federation_national_links/{conf}_{fed}`)

A estadual **pede** (Central → Confederação → "Pedir filiação") ou a
confederação **convida** (Rede nacional → Filiadas → "Convidar"); o outro lado
aceita ou recusa. Só a administração (`admin`) de cada lado age. Estados
(`LINK_STATUS`): `pending` (pedido), `invited` (convite), `approved`,
`rejected`, `cancelled`, `left` (a estadual saiu) e `removed` (a confederação
desligou) — sair e desligar exigem motivo. Uma estadual tem **uma**
confederação só (`canOpenLink`), uma confederação não se filia a outra, e as
duas precisam estar aprovadas. Cada passo entra em `history[]` (até 50) e avisa
a administração do outro lado. Lê o vínculo qualquer cargo das duas
federações.

### 35.2 Ranking nacional (`federation_rankings/{conf}_nacional_{ano}`)

Soma os pontos **lançados** (`federation_points`) pela confederação e por cada
filiada aprovada, pela mesma `aggregateSeason` do ranking oficial, com
`scope: 'national'` e a lista das federações que entraram. É refeito quando
qualquer uma delas soma o ano (`recomputeSeason` → `afterSeason`) e quando uma
estadual entra ou sai (os anos abertos). Valem as regras do §6.2: o ano fecha
em 31/01 do ano seguinte e não muda depois; mudar a tabela não é retroativo.
Na página pública a confederação mostra o nacional por padrão e, com o módulo
`ranking` ligado, "Só os torneios da {sigla}" a um toque; cada linha de
resultado leva a sigla da federação que lançou.

### 35.3 Homologação da transferência entre estados

Quando a troca é entre duas estaduais da **mesma** confederação e a regra dela
pede (`national_config.homologate_transfers`, padrão sim), a liberação da
federação de origem passa a transferência a `homologation`
(`homologation_by`, `homologation_conf_acronym`, `homologation_deadline` =
hoje + `homologation_days`, padrão 15, máximo 60). A confederação (`members` ou
`admin`) homologa (`homologated_by`, `auto_homologated`) ou nega com motivo
(`denied`, `deny_reason`). Sem resposta no prazo, a varredura de
`federationTransfers` homologa. Lê a transferência também quem homologa
(`homologation_by` na regra). Na tela, `TRANSFER_OPEN` = `pending` +
`homologation` e `TRANSFER_STATUS_TONE` dá a cor em todo lugar.

### 35.4 Regras da rede e anuidade (`federation_dues/{conf}_{fed}_{ano}`)

Rede nacional → Regras (só `admin`): homologar ou não, prazo, valor fixo por
federação, valor por filiado ativo e o dia/mês do vencimento (padrão 31/03). O
financeiro da confederação lança o ano (anterior, atual ou próximo): cada
filiada recebe a sua, com a contagem de filiados ativos do dia
(`member_count`); quem já tem a do ano não recebe outra. A estadual declara o
pagamento (`declared`); a confederação confirma com a data (`paid`), reabre ou
dispensa (`waived`) — os dois últimos com motivo. Confirmar, reabrir ou
dispensar uma paga respeita o período fechado (prestação enviada) **das duas**.
A paga vira item DERIVADO das contas (`duesIncome` na confederação,
`duesExpenses` na estadual, rótulo "Anuidade da confederação"), na prévia da
tela e no retrato congelado da prestação (`contas`, lido por
`federationAccounts`). A varredura avisa uma vez a anuidade vencida
(`warned_for`). Lê a anuidade o financeiro, o conselho fiscal e a
administração das duas.

### 35.5 Central, página e pendências

- Confederação: seção **Rede nacional** (`?aba=rede-filiadas`,
  `rede-homologacoes`, `rede-anuidades`, `rede-regras`).
- Estadual: seção **Confederação** (`?aba=confederacao`,
  `confederacao-anuidades`).
- "Precisa de você" (`nationalPendingItems`): pedidos de filiação, convites,
  homologações, anuidades declaradas para confirmar e anuidades vencidas.
  Fonte que não carregou some, nunca vira zero.
- Página pública: aba "Federações filiadas" (`PROFILE_TAB.NETWORK`, âncora
  `fed-rede`) e selos "Confederação" / "Filiada à {sigla}" (`FedBadges`).

### 35.6 Exclusão e exportação

Vínculos e anuidades são entre **federações**, não da pessoa: a exclusão de
conta só tira `opened_by`/`issued_by` (`functions/accountDeletion.js`) e a
exportação não os inclui (isenção no guarda `exclusaoCobreColecoes`).

### 35.7 Não pode regredir

87. `federation_national_links` e `federation_dues` só o servidor grava, e a
    federação não grava `confederation`/`national_body`/`national_config`
    (teste de regra `tests/rules/federationNational.rules.test.js`).
88. A régua da rede muda nos dois lados ao mesmo tempo (paridade
    `functions/federationNational.parity.test.js`); código novo em
    `national.js` depois de `DUES_AMOUNT_MAX` vai junto para a cópia.
89. Uma estadual tem uma confederação; o ranking nacional soma lançamentos,
    nunca recalcula pontos, e ano fechado não muda.
90. A anuidade paga entra nas contas **uma vez**, derivada, nas duas
    federações; período fechado não aceita confirmar, reabrir nem dispensar.
91. Os ids gravados (`LINK_STATUS`, `DUES_STATUS`, `homologation`, `denied`,
    `scope: 'national'`) e os valores `?aba=` acima são contrato.

### 35.8 Âncoras e guias

Âncoras: `federacao-secao-rede`, `federacao-secao-confederacao`,
`federacao-aba-rede-filiadas`, `federacao-aba-rede-homologacoes`,
`federacao-aba-rede-anuidades`, `federacao-aba-rede-regras`,
`federacao-aba-confederacao`, `federacao-aba-confederacao-anuidades`,
`federacao-pub-rede`, `federacao-rede-publica`.

Guia `federacao-confederacao`; artigo `federacao-confederacao` (com pergunta
frequente).

## 36. Jogo limpo: equipamentos homologados e antidopagem (rodada 3, Bloco 1, 2026-10-23)

Dois módulos novos em `FED_MODULE_META`, ambos `available` e desligados por
padrão: **`equipment`** (Equipamentos homologados) e **`antidoping`**
(Antidopagem). Com qualquer um ligado, a página pública ganha a aba
**"Jogo limpo"** (`PROFILE_TAB.INTEGRITY = 'jogo-limpo'`, âncoras
`fed-equipamentos` e `fed-antidopagem`) e a Central, a seção **Jogo limpo**
(grupo "Atender").

### 36.1 Equipamentos homologados (`federation_equipment`)

- Coleção nova, **só o servidor grava** (`functions/federationIntegrity.js`,
  callable `federationIntegrity`; régua em `federationIntegrityPolicy.js` com
  paridade contra `src/modules/federations/domain/integrity.js`).
- Leitura **pública** (até sem conta) com a federação visível e o módulo
  ligado; com o módulo desligado ou a federação oculta, só `competitions` e
  `admin`. A consulta é `federation_id ==` (é o campo que a regra confere).
- Campos: `kind` (`paddle`/`ball`/`net`/`other`), `brand`, `model`,
  `reference`, `source` (o ensaio/certificação), `notes` (interno), `status`
  (`approved`/`rejected`/`decertified`), `status_at` (data), `status_reason`,
  `history[]` (até 30 mudanças), `created_by`.
- Ações: `equipment_save` (cria com a situação inicial ou edita só os dados),
  `equipment_status` (muda a situação: data não futura nem anterior à atual;
  reprovar e descertificar pedem motivo, que é público) e `equipment_delete`
  (**só `admin`**; o caminho normal é descertificar, que fica na lista).
- Quem: `competitions` e `admin` (`canManageEquipment`). Toda escrita audita.
- **Rede nacional**: a estadual filiada mostra também a lista da
  confederação (lida pelo `national_body.id`, só com o módulo ligado lá),
  marcada "lista da {sigla}". A aba aparece pelos módulos da PRÓPRIA
  federação — a estadual liga `equipment` para exibir a lista da rede.
- Lista: homologados primeiro, depois descertificados e reprovados; busca
  sem acento por marca, modelo e referência, filtros de tipo e situação.

### 36.2 Antidopagem (`federations.antidoping`)

- Campo opcional do documento da federação, gravado pelo **admin** da
  federação pela regra de update que já existia (não está em `fedLocked()`):
  `{ note (≤ 2000), contact (≤ 160), show_clauses (padrão true), links[] (≤ 5, https) }`.
  Auditoria `federation_antidoping_update`.
- A página mostra o texto (em branco = o padrão do #JogoLimpo), o contato, os
  links oficiais **sempre** (ABCD, lista proibida da WADA, ADEL) e os da
  federação, e as cláusulas-padrão (`ANTIDOPING_CLAUSES`): controle pela
  ABCD, declaração de conhecer a lista, AUT antes do evento, **lista de
  inscritos publicada até 30 dias antes** e atleta suspenso por violação
  barrado.
- **Torneio chancelado**: `TournamentIntegrityNotice` (página do torneio e
  `/p/:id`) mostra o link para a lista de equipamentos e as cláusulas, só com
  o módulo ligado na federação que chancelou; se a federação não carregar,
  não mostra nada (o selo de chancela segue no cabeçalho).

### 36.3 Relatório do diretor, disciplina e curso

- O relatório do evento (`federation_tournament_reports.report`) ganha dois
  booleanos opcionais, validados nos dois lados (`validateEventReport`):
  `equipment_checked` e `antidoping_clauses`. O formulário só os pede com o
  módulo correspondente ligado.
- A sanção ganha `basis` opcional (`DISCIPLINE_BASIS.ANTIDOPING`), aceito só
  em suspensão e exclusão: registra que a sanção cumpre decisão da Justiça
  Desportiva Antidopagem. **O efeito é o da suspensão de sempre**
  (`discipline_until_ms` na regra da inscrição "só filiados") — nada novo
  barra a inscrição. Selo "Antidopagem" nas listas de sanções.
- Curso: novo tipo `antidoping` ("Antidopagem (ADEL)"), aceito pela regra de
  `federation_courses`; vira credencial com validade como os outros
  (`credential_months`).

### 36.4 O que não pode regredir

92. `federation_equipment` só o servidor grava; apagar só `admin`;
    descertificar mantém o item público com a data.
93. Os ids `kind`, `status`, `basis` e o tipo de curso `antidoping` são
    gravados — nunca renomeie. `?aba=equipamentos`/`?aba=antidopagem` (Central)
    e `?aba=jogo-limpo` (página pública) são contrato de link.
94. O texto e os links da antidopagem só aceitam `https`; os links oficiais
    não dependem do que a federação grava.
95. `federation_equipment` entra na exclusão de conta (por `created_by`, como
    equipe).

### 36.5 Âncoras e guias

Âncoras: `federacao-secao-jogo-limpo`, `federacao-aba-equipamentos`,
`federacao-aba-antidopagem`, `federacao-pub-jogo-limpo`,
`federacao-pub-equipamentos`, `federacao-pub-antidopagem`,
`torneio-jogo-limpo`.

Guia `federacao-jogo-limpo`; artigo `federacao-jogo-limpo`.

## 37. Certidões, dossiê do art. 36, relatório de proteção e Lei de Incentivo (rodada 3, Bloco 2, 2026-10-23)

Para receber verba pública (convênio, loteria, Lei de Incentivo), a federação
precisa **provar** que está regular: é o que exigem a Lei 14.597/2023, art. 36,
e o Acórdão TCU 2331/2025. Para isso há dois módulos novos em `FED_MODULE_META`,
desligados por padrão: `certificates` ("Certidões da federação") e
`incentive_projects` ("Lei de Incentivo ao Esporte"). Com qualquer um deles
ligado, a Central ganha a seção **Certidões e incentivo** (`institucional`),
com as abas `certidoes` e `lei-incentivo`. O financeiro e o admin gerem, o
conselho fiscal (`fiscal`) só lê e apenas o `admin` apaga.

### 37.1 Cofre de certidões (`federation_certificates`)

- **Tipos gravados:** `cnd_federal`, `fgts`, `cndt`, `state`, `municipal` e
  `other` (este com `label`). Cada certidão guarda número, emissão, validade,
  observação e o **arquivo** (PDF ou imagem de até 9 MB).
- **Onde o arquivo fica:** ele sobe para a pasta de quem envia
  (`federacao-contas/{uid}/`, a mesma das contas) e o servidor o **move** para
  `federacao-certidoes/{fed}/{cert}/`. Essa pasta é fechada à regra do
  Storage: o arquivo só abre pela ação `cert_file`, para o financeiro, o admin
  e o conselho fiscal.
- **Certidão atual:** é a mais recente de cada tipo (`currentCertificates`).
  As anteriores ficam no histórico como "Substituída". Renovar é anexar a nova.
- **Avisos:** os gestores (admin e financeiro) são avisados **30, 7 e 1 dia
  antes** do vencimento e no próprio dia, uma vez em cada passo
  (`warned_steps`). Uma validade nova recomeça os passos. Quem avisa é a
  varredura diária `federationInstitutional.sweep`.
- **Conformidade:** ganha o item `certificates`, que só aparece com o módulo
  ligado. Fica em "atenção" quando há certidão vencida ou quando falta a CND
  federal, o FGTS ou a CNDT. Se a fonte não carregou, mostra "não deu para
  conferir".

### 37.2 Dossiê do art. 36 (zero banco)

Na aba Conformidade, o botão "Dossiê do art. 36" monta uma folha com cada item
cuja base cita o art. 36. Para cada um, a folha mostra a exigência, a situação
e **onde ela está na Central** (seção e aba, lidas das próprias seções).
"Imprimir / PDF" usa a folha comum `PrintSheet`, com cabeçalho de logo, nome e
CNPJ. "Sem dado para conferir" não significa reprovação.

### 37.3 Relatório anual de proteção da infância (zero banco)

Fica em Proteção de menores → **Relatório anual** (`?aba=protecao-relatorio`).
A função `safeguardingAnnualReport` trabalha sobre o quadro de quem trabalha
com menores e sobre as denúncias `minor_protection` do ano escolhido. O
relatório traz **só números**, sem nenhum nome e sem nenhum relato. Quando uma
fonte falha, aparece um aviso no lugar dos números, nunca um zero. Imprimir o
relatório e publicá-lo no acervo é decisão da federação.

### 37.4 Lei de Incentivo (`federation_incentive_projects`)

- **Dados do projeto:** nome, processo, manifestação, valor aprovado, data
  final da captação, período de execução (opcional), conta vinculada e
  observações.
- **Etapas:** `capturing` → `executing` → `reporting` (com `sent_at` e
  `protocol`) → `closed`. O encerramento registra o `result` (`approved`,
  `approved_caveats` ou `rejected`), a data e uma nota. O projeto avança uma
  etapa por vez, e voltar ou cancelar exige motivo. Projeto que já recebeu
  aporte não pode ser cancelado nem apagado.
- **Aportes (`receipts[]`, até 300):** cada um registra se é patrocínio ou
  doação incentivada, quem aportou, CPF/CNPJ (opcional), valor e data do
  depósito. Estornar exige motivo e mantém o aporte na lista, riscado.
- **Nas contas:** o aporte recebido vira **receita DERIVADA**
  (`incentiveIncome`), na categoria de convênios e repasses, com o rótulo
  "Aporte da Lei de Incentivo". A conta é a mesma nos dois lados:
  `federationAccounts` lê `federationInstitutional.receitas`. Depois que a
  prestação do período é enviada ao conselho fiscal, aporte novo e estorno
  naquele período são recusados.
- **Aviso de captação:** os gestores são avisados 30 dias antes do fim da
  captação, uma vez por data (`warned_capture_for`).

### 37.5 O que não pode regredir

96. `federation_certificates` e `federation_incentive_projects` **só o
    servidor grava**, em `functions/federationInstitutional.js`. A régua mora
    em `domain/institutional.js`, com cópia e paridade em
    `functions/federationInstitutionalPolicy.js`. A leitura é `fedAcc`.
97. O arquivo da certidão só pode vir da pasta de quem salva e mora numa pasta
    fechada. Nunca gere link público para ele.
98. Os ids `kind`, `status`, `result` e o tipo de aporte são gravados no banco:
    nunca os renomeie. `?aba=certidoes`, `?aba=lei-incentivo` e
    `?aba=protecao-relatorio` são contrato de link.
99. O relatório de proteção e o dossiê não usam banco próprio e não levam nome
    nem relato. Fonte que falhou é dita na tela.
100. As duas coleções entram na exclusão de conta (por `created_by`, como as
     da equipe).

### 37.6 Âncoras e guias

- **Âncoras:** `federacao-secao-institucional`, `federacao-aba-certidoes`,
  `federacao-aba-lei-incentivo`, `federacao-aba-protecao-relatorio`,
  `federacao-dossie-art36`, `federacao-lei-incentivo` e
  `federacao-projeto-novo`.
- **Guia:** `federacao-certidoes-incentivo`.
- **Artigo:** `federacao-certidoes-incentivo`.

## 38. Embaixadores regionais e selo de clube certificado (rodada 3, Bloco 3a, 2026-10-23)

Duas ferramentas para a federação crescer fora da capital, cada uma com o seu
módulo em `FED_MODULE_META`, desligado por padrão: `ambassadors`
("Embaixadores regionais") e `club_seal` ("Selo de clube certificado"). Com
qualquer um deles ligado, a Central ganha a seção **Rede e desenvolvimento**
(`desenvolvimento`), com as abas `embaixadores` e `selo-clubes`. Quem cuida é
a secretaria (permissão `members`) e o admin. As **regras** dos dois programas
(`federations.ambassador_rules` e `federations.club_seal`) o admin grava
direto, com auditoria; todo o resto passa pela função `federationDevelopment`.

### 38.1 Embaixadores (`federation_ambassadors/{fed}_{uid}`)

- **Regras:** candidaturas abertas ou fechadas, relatório a cada 1, 3, 6 ou 12
  meses e o código de conduta (texto da federação; em branco, vale o padrão).
  Mudar o texto sobe a `conduct_version` (`ambassadorRulesToSave`), e cada
  embaixador nomeado vê "Falta aceitar o código novo" até aceitar (`amb_accept`).
- **Candidatura:** só filiado em dia, pela aba "Minha filiação" da página da
  federação (`MyAmbassadorship`). Ele diz a região, a motivação (mínimo de 20
  letras) e aceita o código; ficam registrados a versão e o momento.
  Desistir apaga a candidatura.
- **Nomeação:** a equipe nomeia com a região que vai a público e, se quiser, o
  fim do mandato. Na hora, o servidor confere a filiação em dia e a **proteção
  de menores** (`clearanceBlocker(…, 'ambassador')`). O papel `ambassador`
  entrou em `safeguarding.required_for` e vem marcado por padrão. **Ninguém
  nomeia a si mesmo.** Recusar e encerrar exigem motivo e avisam a pessoa.
- **Relatório:** vence `report_months` depois da nomeação e de cada envio
  (`next_report_due`). A varredura avisa o embaixador uma vez por vencimento
  (`warned_for`). A equipe lê na Central, e o atrasado aparece em destaque.
- **Fim do mandato:** com `term_until` vencido, a varredura encerra o mandato
  e agradece. A pessoa também pode deixar o mandato; os relatórios ficam.
- **Página pública:** a lista `federations.ambassadors_public` (nome, foto,
  região e `key` = `rosterKey(id)`, **sem uid nem contato**, até 60) é refeita
  pelo servidor a cada nomeação, edição ou encerramento e aparece na Visão
  geral (`AmbassadorsPublic`). O campo está em `fedLocked()`.

### 38.2 Selo de clube certificado (`federation_club_seals/{fed}_{kind}_{org}`)

- **Regras:** o nome do selo, a validade (6 a 36 meses) e até 12 critérios,
  cada um obrigatório ou opcional. O critério pode ter **conferência
  automática**, que só vale para arena porque é o que a plataforma sabe dela:
  `hosted_event` (sediou torneio chancelado nos últimos 12 meses) e
  `licensed_coach` (tem professor de `arena_coaches` com licença da federação
  em dia). Mudar os critérios não mexe nos selos já concedidos, porque cada
  pedido guarda uma cópia (`criteria`, `seal_name`).
- **Pedido:** quem gere o clube ou a arena **filiado** (`federation_affiliations`
  aprovado) pede pelo cartão "Federação" da organização (`OrgSealBlock`). Para
  cada critério manda uma explicação e/ou um arquivo. O arquivo fica em
  `federacao/{uid}/` de quem envia e abre pela ação `seal_file`, para a equipe
  (com auditoria) e para quem gere a organização. A renovação abre 60 dias
  antes do fim; retirar a renovação mantém o selo até a validade.
- **Decisão:** a equipe vê as evidências, refaz a conferência automática
  (`seal_recheck`), marca o que atende e concede. Faltando critério
  obrigatório, o servidor recusa (`sealDecision`). Também pode recusar ou
  cassar, sempre com motivo. **Quem gere a organização não decide o próprio
  selo** (`gereOrg`).
- **Na página:** o selo concedido é copiado para a filiação
  (`federation_affiliations.seal = { name, valid_until, granted_at }`), que a
  aba "Clubes e arenas" já lê. Ao lado do nome aparece o selo enquanto
  `valid_until ≥ hoje` (`affiliationSealValid`). Cassar limpa a cópia. O
  pedido de filiação feito pelo navegador **não pode trazer `seal`** (regra).
- **Aviso de vencimento:** 30 dias antes, a varredura avisa quem pediu, uma
  vez por validade (`warned_until`), dizendo se a renovação já está em análise.

### 38.3 O que não pode regredir

100. `federation_ambassadors` e `federation_club_seals` **só o servidor
     grava** (`functions/federationDevelopment.js`; régua em
     `domain/development.js` com cópia e paridade em
     `functions/federationDevelopmentPolicy.js`). Leitura: a própria pessoa
     (ou quem gere a organização), a secretaria e o admin.
101. A lista pública de embaixadores e o selo copiado na filiação **nunca
     levam uid nem contato**. `ambassadors_public` está em `fedLocked()`, e
     `seal` só o servidor grava na filiação.
102. Ninguém nomeia a si mesmo, e quem gere a organização não decide o próprio
     selo. A proteção de menores do embaixador é conferida na nomeação.
103. Os status (`applied|appointed|rejected|ended` e
     `applied|granted|rejected|revoked`), os ids dos critérios e os valores
     `?aba=embaixadores` e `?aba=selo-clubes` são gravados ou contrato de link:
     nunca os renomeie.
104. Na exclusão de conta, a candidatura/mandato sai (e a pessoa sai da lista
     pública). O pedido de selo é da organização: fica, e só os arquivos da
     pasta de quem enviou somem com ela.

### 38.4 Âncoras e guias

- **Âncoras:** `federacao-secao-desenvolvimento`, `federacao-aba-embaixadores`,
  `federacao-aba-selo-clubes`, `federacao-embaixadores`,
  `federacao-selo-clubes`, `federacao-meu-embaixador`, `org-selo-clube`,
  `federacao-pub-embaixadores` e `federacao-pub-selo`.
- **Guia:** `federacao-embaixadores-selo`.
- **Artigo:** `federacao-embaixadores-selo`.

## 39. Edital de sede e Copa das Federações (rodada 3, Bloco 3b, 2026-10-23)

Dois módulos novos em `FED_MODULE_META`, desligados por padrão: `host_bids`
("Edital de sede", para qualquer federação) e `federation_cup` ("Copa das
Federações", com `confederationOnly: true` — a aba Módulos só o oferece a uma
confederação). Toda escrita é da função `federationHosting`
(`functions/federationHosting.js`, régua em `domain/hosting.js` com cópia e
paridade em `functions/federationHostingPolicy.js`). Quem conduz é a equipe de
competições (permissão `competitions`) e o admin (`canManageHosting`; na regra,
`fedComp`).

### 39.1 Edital de sede (`federation_host_bids`, `_entries`, `_scores`)

- **Onde:** Central → Seleção e editais → **Sedes** (`?aba=sedes`,
  `HostBidsManager`). A seção Seleção e editais aparece também só com este
  módulo ligado.
- **Edital:** título, evento, datas, prazo das cartas (`intent_until`), prazo
  das propostas (`proposal_until`), descrição, o que a sede precisa ter e até
  10 critérios com peso de 1 a 10 (padrão: quadras, acesso, apoio local,
  experiência e contrapartida — `DEFAULT_HOST_CRITERIA`). Nasce `draft`; só o
  rascunho se edita ou apaga. **Publicado, as regras não mudam**: só os prazos
  se estendem (`bid_extend`, nunca para trás, com motivo, e quem se candidatou
  é avisado). Publicar avisa quem gere os clubes e arenas filiados (na
  confederação, as equipes das estaduais da rede).
- **Carta de intenção** (`entry_intent`, mínimo de 20 letras): quem gere um
  clube ou arena **filiado** manda pelo cartão "Federação" da organização
  (`OrgHostBidsBlock`). No edital de uma **confederação** vale a filiação a
  uma estadual com vínculo aprovado à confederação. Uma candidatura por
  organização (`{bid}_{kind}_{org}`); desistir (`entry_withdraw`) permite
  mandar de novo enquanto as cartas estão abertas.
- **Seleção** (`bid_shortlist`): na fase das cartas, a equipe marca quem segue.
  O edital passa a `proposal`; os escolhidos são avisados com o prazo, os
  demais de que não seguiram. A varredura avisa a equipe quando o prazo das
  cartas passa (`warned_intent`).
- **Proposta** (`entry_proposal`, mínimo de 50 letras e até 6 arquivos): os
  arquivos ficam em `federacao/{uid}/` de quem manda e abrem pela ação
  `entry_file` — para a equipe (com auditoria) e para quem gere a organização.
  Mandar de novo substitui a proposta anterior.
- **Avaliação:** no prazo das propostas a varredura passa o edital a `review`
  (a equipe pode fechar antes, `bid_review`). Cada avaliador dá nota inteira de
  0 a 10 por critério (`bid_score`, um documento por avaliador e proposta); a
  nota é a média ponderada (`weightedScore`) e a classificação, a média dos
  avaliadores (`hostRanking`). **Quem gere a organização não avalia a proposta
  dela.**
- **Resultado** (`bid_result`): toda proposta precisa de ao menos uma nota.
  Escolher outra que não a maior nota **exige justificativa**, que sai
  publicada. O edital guarda `result` (sede, cidade, classificação com nome,
  cidade e nota — **sem uid**) e quem mandou proposta é avisado.
- **Cancelar** (`bid_cancel`) só depois de publicado, com motivo, que vai para
  a página e para o aviso.
- **Página pública:** aba Competições, bloco "Editais de sede"
  (`HostBidsPublic`, `#fed-sedes`): prazos, requisitos, critérios com o peso em
  porcentagem, quantas candidaturas e o resultado.

### 39.2 Copa das Federações (`federation_cups`, `federation_cup_teams`)

- **Na confederação:** Rede nacional → **Copa** (`?aba=copa`, `CupManager`):
  título, ano (atual ou um dos dois próximos), datas, local, regulamento
  resumido, prazo de inscrição e até 12 categorias com o tamanho do elenco (até
  20). Nasce rascunho; **aberta, as categorias não mudam** — só o prazo de
  inscrição se estende, com motivo. Abrir avisa as equipes de competições das
  estaduais da rede. A varredura encerra as inscrições no prazo; a equipe
  também pode encerrar ou cancelar (com motivo, avisando as federações
  inscritas e os atletas aprovados).
- **Na estadual:** Confederação → **Copa das Federações**
  (`?aba=copa-inscricao`, `CupTeamEntry`): o elenco com os **seus filiados em
  dia**, por categoria, até o teto de cada uma (`team_save`), e o envio
  (`team_submit`). Enviado, não muda até a confederação decidir; devolvido,
  ajusta e manda de novo; pode retirar a inscrição.
- **Decisão:** a confederação aprova (`team_approve`) ou devolve com motivo
  (`team_return`). O elenco aprovado entra em `federation_cups.teams_public`
  (federação, categoria e nome do atleta — **sem uid**) e cada atleta é
  avisado. Retirar ou devolver um elenco aprovado refaz a lista pública.
- **Página pública da confederação:** aba Competições, bloco "Copa das
  Federações" (`CupPublic`, `#fed-copa`).

### 39.3 O que não pode regredir

105. As cinco coleções (`federation_host_bids`, `federation_host_entries`,
     `federation_host_scores`, `federation_cups`, `federation_cup_teams`) **só
     o servidor grava** (`functions/federationHosting.js`, paridade
     `federationHosting.parity.test.js`). Leitura: edital e Copa publicados por
     quem lê a federação (`fedSees`), o rascunho só por `fedComp`; candidatura
     por quem gere a organização e `fedComp`; **notas só `fedComp`**; elenco
     pelos atletas dele e por `fedComp` da confederação ou da estadual.
106. Publicado, o edital não troca de critério nem de peso, e a Copa não troca
     de categoria: só os prazos se estendem, com motivo e aviso.
107. O resultado do edital e a lista pública da Copa **nunca levam uid**; o
     resultado fora da maior nota sempre traz a justificativa.
108. Quem gere a organização não avalia a proposta dela; o elenco só leva
     filiados da própria estadual em dia (conferido no servidor).
109. Status (`draft|intent|proposal|review|result|cancelled`,
     `intent|shortlisted|not_shortlisted|proposal|withdrawn|winner|not_selected`,
     `draft|open|closed|cancelled`, `draft|submitted|approved|returned|withdrawn`),
     ids dos critérios e categorias e os valores `?aba=sedes`, `?aba=copa` e
     `?aba=copa-inscricao` são gravados ou contrato de link: nunca os renomeie.
110. Na exclusão de conta, o elenco da Copa troca o atleta por "Atleta
     removido" (no documento e na lista pública) e o uid sai de
     `athlete_uids`; editais, candidaturas e notas são da federação ou da
     organização e ficam. Os elencos em que a pessoa foi inscrita entram na
     exportação (`listMyCupTeams`).

### 39.4 Âncoras e guias

- **Âncoras:** `federacao-tab-sedes`, `federacao-aba-sedes`,
  `federacao-novo-edital-sede`, `federacao-aba-copa`, `federacao-copa-lista`,
  `federacao-aba-copa-inscricao`, `federacao-copa-elenco`, `org-editais-sede`,
  `federacao-pub-sedes` e `federacao-pub-copa`.
- **Guias:** `federacao-sedes` e `federacao-copa`.
- **Artigo:** `federacao-sedes-copa`.

## 40. Arbitragem: avaliador, progressão de nível e vencimento da credencial (rodada 3, Bloco 4a, 2026-10-23)

Tudo dentro do módulo `referees` (§22), sem coleção nova: campos opcionais em
`federation_referees`, em `federation_assignments.evaluation` e em
`federations.referee_rules`, todos gravados só por `federationReferees`. A
régua mora em `domain/referees.js` com cópia em
`functions/federationRefereesPolicy.js` (paridade em
`federationReferees.parity.test.js`).

### 40.1 Avaliador de arbitragem

- Função nova `evaluator` ("Avaliador(a) de arbitragem"), escalada como
  qualquer outra (cobertura, alertas, diária).
- O avaliador confirmado avalia, a partir do início do evento, a equipe de
  arbitragem confirmada **daquele evento** (`event_key`), pela mesma ficha da
  Central (`AvaliacaoForm`): Minha área → escalas → **"Avaliar a equipe"**
  (`evaluator_crew` lista quem atuou; `evaluate` grava). Não avalia a si mesmo
  nem outro avaliador, só avalia escala `done` e **não corrige a avaliação de
  outra pessoa** (a equipe pode sempre). A avaliação guarda
  `by_role: 'staff' | 'evaluator'`, e a Central mostra "Por {nome}
  (avaliador)".

### 40.2 Progressão de nível

- **Regras e níveis → Progressão de nível** (`referee_rules.promotion`): para
  cada nível acima do primeiro, o que o árbitro precisa no nível de baixo —
  atuações (`events`), média mínima das avaliações (`avg`, 1 a 5) e meses no
  nível (`months`). Em branco, sem requisito: a equipe decide.
- A conta é `promotionProgress`: conta as atuações `done` e as avaliações
  desde `level_since` (na falta, `since`). O servidor guarda uma cópia em
  `federation_referees.promotion_progress` (refeita a cada escala fechada,
  avaliação, troca de nível e regra) porque o árbitro não lê as regras.
- O árbitro vê quanto falta (Minha área → "Nível, credencial e
  disponibilidade") e, cumprindo (ou sem requisito), **pede a promoção**
  (`promotion_request`, um pedido aberto por vez; avisa a equipe).
- **Quem promove é sempre a equipe**: no Quadro, "Promover" abre o cadastro no
  nível pedido; "Recusar" pede motivo (`promotion_decline`, avisa o árbitro).
  Toda troca de nível grava `level_since`, limpa o pedido, entra em
  `level_history` (até 20: de, para, quando, quem, motivo, se cumpria) e avisa
  o árbitro.

### 40.3 Vencimento da credencial

- **Regras e níveis → Vencimento da credencial**
  (`referee_rules.credential_policy`): exigir credencial de árbitro em dia
  (`required`, padrão não), avisar antes (`warn_days`, até 120), carência
  (`grace_days`, até 180) e o que acontece depois (`on_expire`: `warn` só
  avisa; `block_new` não convoca; `block_and_release` não convoca e tira das
  escalas futuras).
- A validade é a da **melhor credencial de árbitro ativa** da pessoa naquela
  federação (`refereeCredentialUntil`), não só as ligadas ao cadastro:
  renovar é passar num curso de reciclagem, que emite credencial nova.
  `credentialStanding` dá `ok | expiring | grace | lapsed | none`.
- **Vale no servidor**: com `required` e `on_expire` diferente de `warn`, a
  convocação, a substituição e a confirmação do árbitro são recusadas nas
  funções de arbitragem (`CREDENTIAL_FUNCTIONS`: árbitro, árbitro geral, juiz
  de linha, avaliador).
- **Varredura diária**: avisa uma vez por validade quem está para vencer
  (`cred_warned_for`); com `block_and_release`, cancela as escalas futuras em
  aberto (`cancel_reason: 'Credencial de árbitro vencida.'`), avisa o árbitro
  e a equipe, uma vez por validade (`cred_released_for`).
- O cadastro guarda `credential_until` e `credential_policy` para o árbitro
  ver a situação; a Central mostra o selo da credencial no Quadro.

### 40.4 O que não pode regredir

111. Avaliador só avalia a equipe confirmada do próprio evento, nunca a si
     mesmo, e não sobrescreve avaliação de outra pessoa (`evaluate` confere no
     servidor).
112. Promoção é decisão da equipe: o árbitro só pede, e o pedido exige que os
     requisitos estejam cumpridos (`met !== false`). Toda troca de nível vai
     para `level_history` e avisa o árbitro.
113. O bloqueio da credencial vale no servidor (`assign`, `reassign`,
     `respond`) e na varredura; `required` desligado nunca barra nada.
114. `evaluator`, `on_expire` (`warn|block_new|block_and_release`) e as chaves
     de `promotion` (ids de nível) são gravados: nunca os renomeie.

### 40.5 Âncoras e guias

- **Âncoras:** `federacao-arbitragem-credencial`,
  `federacao-arbitragem-progressao`.
- **Guia:** `federacao-arbitragem` (passo da seção cita as regras novas).
- **Artigo:** `federacao-arbitragem` (avaliador, progressão, vencimento).

## 41. Pickleball adaptado: categorias, classificação e laudo (rodada 3, Bloco 4b, 2026-10-23)

Módulo novo `adapted` ("Pickleball adaptado"), ligável em Configurações →
Módulos. Uma coleção nova, `federation_adapted_classifications/{fed}_{uid}`,
gravada só por `federationAdapted` (`functions/federationAdapted.js`). A régua
mora em `domain/adapted.js` com cópia em `functions/federationAdaptedPolicy.js`
(paridade em `federationAdapted.parity.test.js`).

### 41.1 As categorias da federação

- `federations.adapted_classes[] { id, label, description }`, até 10, travado
  em `fedLocked()` — só o servidor grava (ação `classes_save`, equipe
  `competitions`/`admin`).
- Ausente, valem as três padrão (`DEFAULT_ADAPTED_CLASSES`): `wheelchair`
  (cadeira de rodas), `standing` (em pé, deficiência física) e `intellectual`
  (deficiência intelectual). O `id` nasce do nome (sem acento) e é gravado nas
  classificações e nas modalidades: renomear mantém o código; tirar uma
  categoria não apaga quem já foi classificado nela.
- **Central → Competições → Adaptado** (`AdaptedManager`): editor das
  categorias e os pedidos, os classificados e o histórico. A seção
  Competições aparece também só com este módulo, para quem vê competições.

### 41.2 O pedido do atleta e a decisão da comissão

- **Minha filiação → Pickleball adaptado** (`MyAdaptedClassification`, "Só
  você vê"): o filiado **em dia** escolhe a categoria e envia o laudo médico
  ou funcional (PDF, JPEG, PNG ou WebP, até 5 MB). O navegador sobe o arquivo
  para a própria pasta `federacao/{uid}/`; o servidor (`request`) **move** o
  arquivo para `federacao-laudos/{uid}/{fed}_{nome}.{ext}`, pasta que nenhum
  cliente lê (catch-all do `storage.rules`), e apaga o original. Um pedido em
  análise por vez; a comissão é avisada pelo sino.
- A comissão decide (`decide`): **classificar** (categoria e data de revisão
  opcional, depois de hoje) ou **recusar** com motivo (3+ letras). Quem pediu
  não decide o próprio pedido. Classificar troca o laudo vigente e apaga o
  antigo; recusar apaga o laudo do pedido e **mantém** a classificação que a
  pessoa já tinha. **Cancelar** (`revoke`) exige motivo e apaga o laudo. O
  atleta é avisado em cada caso.
- O laudo abre só pelo servidor (`report_file`, base64): o próprio atleta ou a
  comissão. Cada abertura da equipe vai para a auditoria
  (`federation_adapted_report_view`).
- O atleta pode **desistir** do pedido (`withdraw`): o laudo enviado é
  apagado e a classificação anterior continua.
- `classificationState` responde `active`, `expired`, `pending`, `expiring`
  (30 dias) e `daysLeft`; pedido em análise não tira a classificação vigente.
- **Varredura diária** (`federationAdapted.sweep`): avisa antes da revisão
  (uma vez por data, `warned_for`) e quando ela passa (`expired_notified_for`).

### 41.3 No torneio chancelado

- `tournament_modalities.adapted_class` / `adapted_class_label` (opcionais;
  ausente = não é adaptada). O seletor aparece no formulário da modalidade só
  num torneio de federação com o módulo ligado (`useAdaptedOptions`); o valor
  já gravado continua aparecendo mesmo sem a lista.
- O cartão da modalidade mostra o selo "Adaptada: {categoria}" e, para quem
  organiza, **"Conferir classificação"** (`check`, sem `contexto`): o servidor
  aceita o criador do torneio, quem está em `tournament_admins` ou a comissão,
  e devolve por inscrição ativa a situação de cada atleta (`ok`,
  `other_class`, `expired`, `pending`, `missing`, `no_account`) — **nunca** o
  laudo. Retirar ou manter a inscrição é decisão de quem organiza.
- O resumo da modalidade para o atleta (`V2ModalityInfoContent`) diz que ela é
  adaptada e onde pedir a classificação.

### 41.4 Na página pública

- A aba Competições mostra as categorias e como pedir (`AdaptedPublic`,
  âncora `#fed-adaptado`). Nenhuma classificação é pública.

### 41.5 Dados pessoais

- O laudo é dado de saúde: fica em pasta fechada, só o titular e a comissão
  abrem, pelo servidor, com auditoria.
- Exclusão de conta: as classificações do titular são apagadas e a pasta
  `federacao-laudos/{uid}/` sai do Storage. Exportação: sim
  (`listMyAdaptedClassifications`, sem o arquivo).

### 41.6 O que não pode regredir

115. `federation_adapted_classifications` só o servidor grava; lê só o próprio
     atleta e `competitions`/`admin` da federação (o financeiro não).
116. O laudo nunca fica na pasta do atleta depois do pedido nem aparece para
     quem organiza o torneio; a conferência devolve só a situação.
117. Recusar ou desistir nunca tira a classificação vigente; quem pediu não
     decide o próprio pedido.
118. Os ids das categorias (`wheelchair`, `standing`, `intellectual` e os da
     federação), `CLASS_STATUS` e `ADAPTED_CHECK` são gravados: nunca os
     renomeie.

### 41.7 Âncoras e guias

- **Âncoras:** `federacao-aba-adaptado`, `federacao-adaptado`,
  `federacao-adaptado-categorias`, `federacao-meu-adaptado`,
  `federacao-modalidade-adaptada`, `federacao-pub-adaptado`.
- **Guia:** `federacao-adaptado`. **Artigo:** `federacao-adaptado`.
