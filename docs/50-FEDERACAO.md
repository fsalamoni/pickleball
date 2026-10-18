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
   federação** liga para si. Hoje nenhum módulo tem tela (`status: 'planned'`),
   então a aba só mostra o catálogo com "Em breve". Quando um módulo ficar
   `available`, a federação liga ali e a tela dele passa a perguntar
   `federation.modules[x]`.

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
| `/federacoes/:id` | `V2FederationDetail` | Marca, selos, contagem, planos (`PlansList`), sobre, contato e **a situação da pessoa** (`MinhaSituacao`: filiar-se, cobrança Pix, renovar, carteirinha); "Gerir" para a equipe |
| `/federacoes/:id/filiar` | `V2FederationJoin` | 1. tipo de filiação → 2. plano (preço com o desconto da pessoa; faixa de idade exige nascimento no perfil) → 3. preferências, clube, observação, termos → pedido |
| `/federacoes/:id/gerir?aba=` | `V2FederationManage` | A Central: **Atender** (Hoje · Filiados: Pedidos, Filiados · Financeiro: Cobranças, Recebidos) e **Gerir** (Equipe · Configurações: Planos, Recebimento, Página, Módulos). A seção só existe para quem tem a permissão; a aba mora na URL (`?aba=`; `?secao=` abre a primeira). Faixa "Precisa de você" (`FederationPendencias` ← `federationPendingItems`) no topo |
| `/f/:slug` | `PublicFederation` (V1, fora do V2Layout) | A página pública: marca, planos, chamada para entrar/filiar-se |
| `/f/verificar/:codigo?` | `PublicFederationVerify` | Digitar/ler o código → em dia / irregular / não encontrada |
| Minha área → Federações | `FederacoesSecao` | Cobranças para pagar, filiações (carteirinha, renovar), equipe; pendências na faixa (`myFederationPending`) |
| Painel admin → Federações | `AdminFederationsPanel` | Filtros por estado, aprovar/recusar/suspender com motivo, selos, dados da entidade; na caixa de entrada do admin, "Federações esperando aprovação" |

Os valores de `?aba=` da Central (`pedidos`, `filiados`, `cobrancas`,
`recebidos`, `equipe`, `planos`, `pix`, `pagina`, `modulos`, `hoje`) são
**contrato de link**: os avisos levam a eles. Nunca renomeie.

## 7. Dados (resumo; esquema completo em `docs/05-DATA-MODEL.md` § Federações)

Seis coleções novas, todas com prefixo `federation` e **zero índice composto**
(consultas de uma igualdade; ordenação em memória): `federations` (+
`private/data`), `federation_staff`, `federation_plans`, `federation_members`
(+ `private/data`, reservado ao PR 3), `federation_charges`,
`federation_card_index`. Nenhum campo novo em coleção existente; os avisos
são `notifications` com `type: 'federation'`, `origin: 'server'`, `essential`.

**Dado pessoal** (princípio 10): CNPJ completo, razão social e telefone da
entidade ficam em `federations/{id}/private/data` (quem pediu, a equipe
`admin`, o admin da plataforma); em público só `cnpj_masked`. A filiação
**nunca** é pública: só o próprio, a equipe que atende e o admin. A
verificação pública mostra o mínimo. O que vai no pedido está em §5.2.

**Exclusão de conta**: filiações e cobranças **ficam sem o nome**
(`coletarFederacoes`), os códigos de carteirinha são apagados, os papéis em
equipe saem, a federação que a pessoa pediu fica com "Usuário removido";
**presidente de federação não exclui a conta** (bloqueio, como dono de arena —
passa a presidência antes). **Exportação**: bloco `federations`
(`collectFederationExport`: filiações, cobranças, papéis, federações que pediu).
`exclusaoCobreColecoes.test.js` reprova coleção `federation_*` nova fora dos dois.

## 8. Servidor (detalhe em `docs/47-BACKEND-CLOUD-FUNCTIONS.md` §8a)

| Função | Tipo | Quem | Faz |
|---|---|---|---|
| `federationReview` | callable | admin da plataforma | approve / reject / suspend / verify / unverify / official / unofficial |
| `federationMembership` | callable | a pessoa (`request`, `renew`, `cancel`) ou `members` (`approve`, `reject`, `suspend`, `reinstate`) | o ciclo da filiação (§5.2) |
| `federationChargeConfirm` | callable | `finance` | `confirm` / `cancel` da cobrança |
| `federationVerify` | callable **sem login** | qualquer um | o mínimo da carteirinha por código |
| `federationMembershipSweep` | agendada 06:00 | — | vencimentos, avisos 30/7/1, contagem |

Toda função confere a flag, grava `audit_logs` (`federation_*`) e avisa por
`notifications` (`origin: 'server'`, textos em `tx()` → `functions/i18n/avisos.json`).

## 9. Ajuda, dicas, idiomas e termos

- **Central de ajuda** (`helpCenter.js`, parte Atleta, `flags: ['federations']`):
  "Filiar-se a uma federação" e "Abrir e administrar uma federação"; pistas de
  rota para `/federacoes*`; duas perguntas no FAQ.
- **Guias com seta** (`guias.js`, área **Federações**): `federacao-filiar`
  (buscar → filiar → plano → enviar → carteirinha) e `federacao-gerir`
  (Central: seções, configurações, filiados, financeiro, pendências).
  **Pontos de dica** (`pontosDeDica.js`): abrir, minhas, filiar, carteirinha,
  seções, pendências, Pix e o do admin. Âncoras `data-dica="federacao-…"` são
  contrato (guarda `dicas.test.js`).
- **Idiomas**: catálogo `src/modules/federations/i18n/locales/{en,es}.js`
  (491 chaves, inclusive os avisos do servidor); `npm run i18n:avisos`
  regravou `functions/i18n/avisos.json`.
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

## 11. Pendências e próximas fases

- Flavio: ligar a flag `federations` em Painel admin → Funcionalidades;
  revisão jurídica dos dois termos.
- **PR 2** — clubes e arenas filiados (`affiliations`), chancela de torneios
  (`tournaments`) e ranking oficial (`ranking`).
- **PR 3** — `federation_members/{id}/private/data` (CPF, responsável do
  menor), transferências, importação de filiados, cursos e credenciais
  (`courses`), disciplina e ouvidoria (`discipline`).
- **PR 4** — notícias e avisos (`news`), patrocinadores (`sponsors`), cupons e
  vantagens (emissor `federation` no `promo/`), loja no Mercado (`store`),
  governança e card no início.
