# 52 — Clube como associação (flag `club_association`)

> Estado: **Bloco A** (filiação, planos, Pix, carteirinha, página pública e
> Central do clube), **Bloco B** (diretoria com cargos e mandatos, indicadores,
> importação de associados, declaração de associação), **Bloco C1**
> (vantagens do associado, comunicados e patrocinadores), **C2** (cupons e
> campanhas), **C3** (loja do clube no Mercado) e **D1** (contas: orçamento,
> lançamentos e prestação de contas), **D2a** (documentos oficiais do clube) e
> **D2b** (agenda oficial do clube) estão no código. Os blocos D2c–G (atletas e
> seleção, torneios do clube, assembleias e eleições) estão no plano
> (`/mnt/project-files/clubes/plano-clube-associacao.md`) e **ainda não
> existem** — este documento só descreve o que há no código.

## 1. O que é

Cada clube pode **ligar para si** uma camada de associação: planos de filiação
gratuitos, mensais ou anuais; pedido de filiação pela página do clube; cobrança
por Pix direto para a chave do clube; carteirinha digital com verificação
pública; e uma **Central do clube** (`/clubes/:clubId/gerir`) para a gestão.

É **opt-in e aditiva**. A flag `club_association` (default OFF, só o admin da
plataforma liga, Funcionalidades → "Associação de clubes") é o interruptor
geral e é **imposta na regra** (`cxOn()`), não só na tela. Cada clube liga a sua
(`clubs/{id}.association.enabled`) e decide quando abrir ao público
(`association.published`). Desligada, qualquer nível: clubes, membros, eventos e
dia de jogo seguem exatamente como eram. Entrar no clube continua sendo por
criador, convite ou código (#199/#200) — **associar-se não substitui isso**: a
filiação é uma camada em cima do `club_members`, e perder a filiação não tira a
pessoa do clube.

## 2. Dados

Árvore única, regra única: `club_x/{clubId}/{kind}/{id}`.

| `kind` | Conteúdo | Quem lê | Quem escreve |
|---|---|---|---|
| `plans` | planos (nome, preço em centavos, periodicidade `monthly`/`yearly`, vantagens, descontos por idade, aprovação automática, público) | público lê os planos públicos de clube publicado; `finance`/admin leem todos | admin ou `finance` |
| `aff` | filiação de uma pessoa (`{clubId}_{uid}`): status, plano, número, validade, código da carteirinha | a própria pessoa, `members`/`finance` do clube | **só o servidor** |
| `charges` | cobranças (Pix copiado da configuração, "Já paguei", confirmação) | o dono, `finance` | **só o servidor** |
| `staff` | a pessoa na diretoria (`{uid}`): cargo, cópia das `perms`, `is_master`, mandato (`term_start`, `term_end_ms`, 0 = sem prazo), `term_history` | o próprio e quem tem `staff` | **só o servidor** (`clubStaff`) |
| `roles` | os cargos do clube num documento só (`roles/list` = `{ roles: [...] }`); sem ele valem os oito modelos | quem tem `staff` | **só o servidor** (`clubStaff`, só o cargo master) |
| `imports` | cada lote de importação: plano, quem entrou, quem foi pulado e **quem ficou sem conta** | `members` | **só o servidor** (ação `import`) |
| `cfg` | Pix do clube e instruções | admin e `finance` | admin |
| `benefits` | a **vitrine** da vantagem (título, resumo, tipo, parceiro, validade, planos, `public`, `active`, `has_secret`) | público lê as `public: true` de clube publicado; `comms`/`members` leem todas | `comms` |
| `bsec` | o que é **só do associado em dia**: "como usar" e código da vantagem (mesmo id de `benefits`) | `comms` — o associado em dia recebe pelo servidor | `comms` |
| `news` | comunicado (rascunho/publicado/arquivado; `audience` público ou só associados; `public` derivado) | público lê os `public: true` de clube publicado; **qualquer membro do clube** lê os "só associados" publicados; `comms` lê tudo | `comms` |
| `sponsors` | um documento por patrocinador (até 12): nome, faixa, logo, site, `public`, `active` | público lê os `public: true` de clube publicado; `comms` lê tudo | `comms` |
| `budgets` | orçamento do ano (`{ano}`, rascunho → enviado → aprovado) e a **cópia publicada** (`{ano}_pub`, `pub: true`, `copy_of`) | `finance`/`fiscal`/admin; o público lê só `pub: true` de clube publicado | **só o servidor** (`clubAccounts`) |
| `ledger` | lançamento financeiro (receita/despesa, categoria, valor em centavos, anexo, `status` lançado/estornado) | `finance`/`fiscal`/admin | **só o servidor** |
| `reports` | prestação de contas do período (`{ano}` ou `{ano}-S1`…): retrato **congelado**, parecer do conselho fiscal, assembleia; a cópia pública tem `pub: true` | `finance`/`fiscal`/admin; o público lê só `pub: true` de clube publicado | **só o servidor** |
| `docs` | documento oficial (estatuto, regimento, atas, resoluções…): número do ato, versão, arquivos, `visibility` (público / só associados / só equipe), `pub` e `members` (marcas de leitura mantidas pelo servidor) | público lê `pub == true` de clube publicado; **qualquer membro do clube** lê `members == true`; `docs`/admin leem tudo (rascunho inclusive) | **só o servidor** (`clubDocs`) |
| `seq` | contador de numeração dos atos (`seq/docs`) | ninguém | **só o servidor** |
| `cases` | sanção disciplinar (advertência, suspensão, multa, exclusão): motivo, prazo, valor, `status`, recurso e decisão | `discipline`/admin; **a própria pessoa** (consulta com `user_id == eu`) | **só o servidor** (`clubDiscipline`) |
| `ombud` | manifestação da ouvidoria: assunto, texto, `anonymous`, `reporter_uid` (nulo se anônima), `status`, anotações internas. **O id é o protocolo** (10 letras e números maiúsculos) | só `discipline`/admin; quem enviou acompanha o ESTADO pelo servidor | **só o servidor** |
| `assets` | bem do patrimônio (nome, categoria, quantidade, estado, local, valor) com os **empréstimos** (`loans[]`: quem recebeu, quantidade, saída, devolução combinada, devolução e estado em que voltou) e o `history[]` | `finance`/`sports`/`fiscal`/admin | **só o servidor** (`clubManagement`) |
| `safeguard` | a proteção de menores de uma pessoa (`{uid}`): versão do compromisso aceito, certidão de antecedentes conferida (`background`: status, emissão, validade, quem conferiu), a certidão **pendente** (`pending_background`, com o caminho do arquivo), última recusa, `designated`/`designated_label`, `cleared_until` | `discipline`/admin (a pessoa lê o próprio pela ação `me`, que não devolve o caminho do arquivo) | **só o servidor** (`clubSafeguarding`) |
| `minors` | o **responsável legal** do associado menor de idade (`{uid}`): nome, parentesco, telefone, autorização de participação e de uso de imagem, observações | `discipline`/admin | **só o servidor** (`clubSafeguarding`); apagado aos 18 anos |
| `events` | evento da agenda oficial (competição, curso, assembleia, reunião, prazo…): data, horário, local, `status` (marcado/adiado/cancelado), motivo, `history[]`, `ever_visible`, `visibility`, `pub` e `members` (marcas de leitura mantidas pelo servidor), documentos ligados | público lê `pub == true` de clube publicado; **qualquer membro do clube** lê `members == true`; `docs`/`sports`/admin leem tudo | **só o servidor** (`clubAgenda`) |

`club_card_index/{codigo}` (só o servidor) liga o código da carteirinha à
filiação; **o código gira** a cada ativação, renovação e suspensão. Campos novos
em coleção existente: apenas `clubs/{id}.association` (`enabled`, `published`,
`intro`, `color`), opcional. Zero índice composto.

## 3. Servidor

Funções em `functions/clubAssociation.js` (testes ao lado):

- `clubAssociation` (callable) — ações `request`, `declare` ("Já paguei"),
  `charge_confirm` (`confirm`/`cancel`), `grant` (associar um membro do clube),
  `adopt` (aplicar um plano gratuito a todos os membros, até 200 por vez),
  `approve`, `reject`, `renew`, `cancel`, `leave`, `suspend`, `reinstate`,
  `import` (lista de sócios, ver §3.1).
  Quem pode o quê é conferido **dentro da função**; toda mudança de status
  grava auditoria e avisa a pessoa (`origin: 'server'`).
- `clubStaff` (callable, `functions/clubStaff.js`) — a diretoria: `role_save` e
  `role_delete` (montar os cargos; só o cargo master), `appoint` (nomear um
  membro do clube num cargo, com mandato), `extend` (prorrogar, com motivo e
  data depois da atual; guarda `term_history`) e `remove` (tirar, ou sair da
  diretoria). A régua de quem pode mexer em quem (`allowed`) tem cópia em
  `functions/clubStaffPolicy.js`, com paridade contra `domain/staff.js`.
- `clubAssociationSweep` também roda `clubStaff.sweep`: avisa a pessoa e quem
  tem `staff` a 30, 7 e 1 dia do fim do mandato e **desfaz** o cargo vencido.

- `clubContent` (callable, `functions/clubContent.js`) — duas ações:
  - `benefits`: as vantagens do **associado em dia** (`membershipState` = ativo, a
    mesma conta da carteirinha), já filtradas por `active`, validade e plano, **com**
    o "como usar" e o código lidos de `bsec`. Vencido, suspenso, sem filiação ou
    associação desligada devolve `{ eligible: false, items: [] }` — nada do segredo;
  - `news_notify` (permissão `comms`): o aviso do comunicado publicado aos
    associados em dia, em lotes de 400, **uma vez só** (`notified_at`,
    `notified_count`, `notified_by`) e com link `/clubes/{id}?tab=comunicados&noticia={id}`
    (sem `#`). A comunicação não lê a lista de filiados — por isso o aviso é do servidor.

- `clubDocs` (callable, `functions/clubDocs.js`, política em `functions/clubDocsPolicy.js`) —
  os documentos oficiais (§5.4): `save`, `delete` (só rascunho), `publish`,
  `rectify`, `visibility`, `withdraw`, `notify` e `file`. Reaproveita a régua do
  acervo da federação (`federationAcervoPolicy.js`, `oficializar`) com a lista de
  tipos do clube.

- `clubDiscipline` (callable, `functions/clubDiscipline.js`) — a disciplina e a ouvidoria (§5.6):
  `apply` (permissão `discipline`), `appeal` (a própria pessoa, uma vez), `decide_appeal`,
  `end`, `report` (qualquer conta, associação aberta), `report_status` (por protocolo) e
  `report_update` (`discipline`). Reaproveita da associação `novaCobranca`, `encerrar` e
  `novoCodigo` e o cálculo de suspensão da federação (`membershipState`).
- `clubManagement` (callable, `functions/clubManagement.js`) — o patrimônio (§5.7):
  `asset_save`, `asset_loan`, `asset_return`, `asset_retire` (cargo `finance`, `sports` ou
  `admin`). Reaproveita a régua da federação (`federationManagementPolicy.js`); a varredura
  diária da associação avisa o empréstimo atrasado.

### 3.1 Importar associados

`import` (permissão `members`): até **100 linhas por chamada** (a tela fatia
listas maiores). Quem **tem conta** com aquele e-mail entra **ativo** no plano
escolhido, com o número e a validade da lista (ou os do plano), numa transação
por pessoa; quem já tem filiação viva é pulado; quem **não tem conta** fica no
lote em `imports` para a secretaria convidar por fora — **o servidor não manda
convite**. Nenhum e-mail vai para a filiação.
- `clubAssociationVerify` (callable, sem login) — devolve o mínimo: nome, clube,
  plano, número, validade e situação. Código inexistente, substituído por uma
  renovação ou clube sem associação ativa = "não encontrado", sem detalhe.
- `clubAssociationSweep` (agendada, diária) — marca vencidas e avisa 7 dias
  antes, no dia e depois do vencimento.

O dinheiro **vai direto para o Pix do clube**; a plataforma não toca no valor.
Cada cobrança leva uma cópia da chave (o associado paga pelo app do banco) e o
financeiro do clube confere no extrato antes de confirmar.

## 4. Permissões

`CLUB_PERM` (`admin`, `members`, `finance`, `comms`, `docs`, `sports`,
`discipline`, `fiscal`, `staff`). O **administrador do clube** (`club_members.role
== 'admin'`) tem todas; quem tem cargo tem as gravadas em `staff/{uid}` enquanto
o mandato vale. A conta é a mesma no cliente (`clubPermsOf`/`staffPerms`), na
regra (`cxPerms`) e no servidor (`permsDe`/`S.permsOf`).

- **Cargo = permissões + mandato.** O cargo é montado pelo clube
  (`roles/list`) ou vem dos oito modelos (Presidente, Vice-presidente,
  Secretaria, Tesouraria, Esportes, Disciplina, Comunicação, Conselho fiscal). A
  pessoa leva a **cópia** das permissões e o mandato; mudar o cargo atualiza quem
  o ocupa. Mandato vencido não dá permissão (e a varredura desfaz o cargo).
- **Master** (Presidente): todas as permissões, inclusive montar os cargos —
  `admin` só existe em cargo master; o cargo comum nunca leva `admin`.
- **Só vale enquanto a pessoa é membro do clube** — na regra, no servidor e na
  tela. Sair do clube apaga o cargo; só se nomeia quem já é membro.
- **Quem nomeia quem** (`staffActionAllowed`): master e a administração do clube,
  tudo; quem tem `staff`, só cargos cujas permissões já tem, nunca master e nunca
  a si mesmo.

Na Central, cada pessoa vê só as seções que a sua permissão alcança. A chave Pix
é **só do administrador** (a regra de `cfg` não deixa `finance` gravar).
Detalhe por perfil em [`48`](./48-PERMISSOES-POR-PERFIL.md) §4.8b.

## 5. Telas

- **Página do clube** (`V2ClubDetail`): aba **Associação** (planos, "Minha
  associação", carteirinha, renovar, encerrar) e, para o administrador, o botão
  "Central do clube". Quem não é membro vê os planos acima do convite.
- Para o associado, a página do clube ganha as abas **Vantagens** (as dele, com
  o "como usar" e o código copiável; em atraso, a tela diz que são de quem está em
  dia) e **Comunicados** (públicos + "só associados"; `?noticia=` abre e rola até
  o do aviso). Quem visita vê, abaixo dos planos, "O que o associado ganha" (só a
  vitrine), os comunicados públicos e os patrocinadores (`ClubShowcase.jsx`).
- **Página pública** `/c/:clubId`: seção "Associe-se" com os planos (a
  filiação exige login), a vitrine de vantagens, os comunicados e os patrocinadores; `/c/verificar/:codigo?` — verificação pública da
  carteirinha (QR), com campo para digitar.
- **Central do clube** `/clubes/:clubId/gerir`, dois grupos como a federação e a
  arena (Atender · Gerir). `?aba=` e `?secao=` na URL; os valores são **contrato
  de link** — nunca renomeie: `hoje`, `associados`, `cobrancas`, `planos`,
  `pix`, `equipe`, `cargos`, `indicadores`, `config`, `comunicados`, `vantagens`,
  `patrocinadores`, `divulgacao`. `?filtro=` filtra os associados.
  - **Hoje** — o que precisa de você + prontidão (ligar, criar plano, informar Pix, abrir ao público) + **mandatos acabando** (a quem tem `staff`).
  - **Associados** — pedidos, filtros, busca, aprovar/recusar/suspender/reativar, "Associar uma pessoa", **"Importar lista"** (CSV) e **"Declaração"** de cada associado em dia.
  - **Financeiro → Cobranças** — recebido no mês/total, vencidas, confirmar/cancelar.
  - **Planos** — criar/editar/pausar, aplicar plano gratuito a todos os membros; **Pix do clube**.
  - **Diretoria → Equipe e mandatos** — quem está na diretoria, cargo e mandato (aberto, vigente, acabando, encerrado), nomear (escolhendo entre os membros do clube), trocar de cargo, prorrogar com motivo, tirar ou sair. **Cargos** (só o master) — montar os cargos do clube, com o que cada permissão abre.
  - **Indicadores** — 12 meses de pedidos, taxa de renovação, em dia por plano e por categoria, recebido por mês e por origem, atraso; baixa a planilha CSV. Cada bloco depende da própria fonte e, sem ela, diz "não deu para medir" — nunca zero.
  - **Comunicação** (`comms`) — **Comunicados** (escrever, publicar para todos ou só associados, fixar, "Avisar os associados" uma vez só), **Vantagens** (vitrine + "como usar"/código, planos que alcança, validade, pausar) **Patrocinadores** (até 12, por faixa) e **Cupons e campanhas** (o console de divulgação com o clube como emissor, ver §5.1).
  - **Configurações** — ligar, abrir ao público, apresentação e cor.
- **Declaração de associação** — a folha para escola, empregador ou patrocinador
  (`buildClubDeclaration`, `ClubDeclarationDialog`): só sai com a associação em dia
  e com código; leva o QR da verificação pública; imprime/salva em PDF. Quem
  recebe confere pelo QR, sem conta. O código gira na renovação/suspensão, então
  a declaração antiga deixa de verificar — a folha avisa. Zero banco. Entrada: o
  próprio associado (aba Associação) e a secretaria (linha do associado).

Reuso da federação: carteirinha (`MemberCardDialog` com `cardOverride`), selos
de situação, QR, `CopyCodeButton`, `ConfirmDialog` e as contas de cobrança
(`domain/charges.js`: resumo financeiro, vencida, "pode declarar", valor em reais).

### 5.1 Cupons e campanhas do clube (Bloco C2)

O clube é o **quarto emissor** do módulo `promo` (`PROMO_ISSUER.CLUB`, `issuer_id`
= id do clube): as mesmas ferramentas da plataforma, do professor e da federação
(`PromoMarketingConsole`, arte do cupom, cinco modelos de banner, controle de uso,
recepção do código), sem copiar uma linha. Fica na Central → Comunicação →
**Cupons e campanhas** e aparece na página do clube como **Promoções do clube**
(`ClubPromosSection`, dentro do app — cupom e campanha só a conta logada lê).

Diferenças do clube, todas de propósito:

- **Só na página do clube.** O cupom e o banner do clube nunca vão à tela inicial
  nem à vitrine geral de promoções: `normalizePromoPlacement(…, { home: false })`
  e `normalizePromoCouponInput` forçam `show_home = false`, `homePromoItems` não
  conhece o emissor `club` e `V2Promotions` o ignora. Alcance por região não existe.
- **Não há "só associados".** `promo_*` é legível por toda conta logada (o
  associado confere o código), então esconder ali seria só aparência — e
  aparência que parece segurança é pior que nada. O benefício **exclusivo** de
  associado fica em **Vantagens** (§3, `bsec` + servidor); o cupom do clube é
  para atrair e para eventos/parceiros (inscrição, brinde, aluguel, comida, bebida).
- **Sem aviso pela campanha** (`PROMO_AUDIENCES_BY_ISSUER.club = []`): o canal é o
  comunicado ("Avisar os associados", uma vez só).
- **Destinos** (lista fechada): detalhes da campanha, página do clube, torneios,
  um torneio, jogos abertos, a loja do clube (§5.2), vitrine e Mercado.
- **Regra**: emite quem tem `comms` (ou administra o clube), só com a flag
  `club_association` ligada **e** a associação publicada (`promoPageOk`); o
  emissor não muda no update; `promo_settings/{clubId}` (custo interno do vale,
  modelos) é só dessa equipe. Auditoria: `club_promo_*`.

### 5.2 Loja do clube no Mercado (Bloco C3)

O clube vende uniforme, material e inscrições pelo **Mercado** como vendedor
próprio, de chave `club_{clubId}` (`SELLER_TYPE.CLUB`), a mesma ideia da loja
oficial da federação (`federation_{id}`). Nenhum catálogo novo: anúncio, pedido,
oferta, avaliação e disputa são o Mercado de sempre, com Pix direto ao vendedor.

- **Quem opera**: a administração do clube e o cargo com `finance` — a mesma
  resposta em três lugares: `isMarketOperator` (regra), `operatorUids`
  (`functions/marketplace.js`, que recebe os avisos de pedido) e `storeClubs`
  (`modules/clubs/domain/association.js`, que alimenta "Vendendo como").
- **Quando abre**: com a flag `club_association` ligada **e** a associação
  publicada (`cxPub`); o vendedor nasce `active`, sem selo, e não pode ser
  criado em nome de outro clube. Depois de criado, despublicar a associação não
  tira o poder de editar/pausar os anúncios (o cargo e o mandato seguem valendo
  — `cxHas` exige o vínculo ao clube).
- **Onde se vê**: Central do clube → **Loja** (`?aba=loja`, permissão
  `finance`): estado da loja e o caminho para o painel `/mercado/vender?como=club_{id}`;
  na página do clube (dentro do app), o cartão **Loja do clube** quando a loja
  está no ar; a divulgação (§5.1) ganhou o destino **Minha loja** (`store`).
- **Falha não é vazio**: a Central diz que a loja não carregou; o cartão da
  página simplesmente não aparece (não há o que afirmar nem oferecer).

### 5.3 Contas do clube (Bloco D1)

Central do clube → **Contas** (`?aba=contas|orcamento|lancamentos|prestacao`,
permissão `finance` ou `fiscal`): **Visão geral**, **Orçamento**,
**Lançamentos** (com importação de extrato OFX/CSV e estorno com motivo) e
**Prestação de contas**. São as **mesmas abas da federação** (`federations/manage/accounts`)
com o clube no lugar dela: `accountsScope.js` troca só a função do servidor
(`clubAccounts`), a invalidação (árvore `assocKeys.all`) e a pasta do anexo
(`clube-contas/{uid}/`). A conta é a mesma — `functions/federationAccountsPolicy.js`
↔ `domain/accounts.js` — e a receita das **mensalidades pagas** (`charges`) entra
sozinha, sem lançar.

- **Quem faz o quê**: o financeiro (ou a administração) prepara; o **conselho
  fiscal** vê tudo em leitura (lê também `charges` para conferir a receita) e dá
  o parecer depois do envio; o aviso do envio e do parecer é do servidor.
- **Prestação**: o envio **congela** o retrato; reformular reabre um rascunho que
  nunca vai a público; publicar copia para `{id}_pub` (`pub: true`). Publicado não
  sai. Período fechado não aceita lançamento nem estorno.
- **Transparência**: a página do clube (e a aba Comunicados do associado) mostra,
  com a associação aberta ao público, o **publicado** — execução do último ano,
  prestações com o parecer e orçamentos aprovados (`ClubAccountsPublic`, carregada
  sob demanda). Sem nada publicado a seção não aparece; consulta que falhou diz
  que não carregou.
- **Conta excluída**: lançamentos, orçamentos e prestações ficam (o clube presta
  contas), sem o nome de quem os preparou (`created_by_name`/`opened_by_name` →
  "Usuário removido").

### 5.4 Documentos oficiais do clube (Bloco D2a)

Central do clube → **Documentos** (`?aba=documentos`, permissão `docs`): o
**acervo oficial** do clube — estatuto, regimento, atas, resoluções, editais,
regulamentos, modelos e vídeos por link (33 tipos, `CLUB_DOC_TYPES`). Não é um
segundo acervo: é a **mesma tela da federação** com o clube no lugar dela. O
`acervoScope.js` troca a entidade (`clubDocsEntity(club)`, `kind: 'club'`), a
função do servidor (`clubDocs`), a invalidação, a pasta de envio
(`clube-acervo/{uid}/`) e os rótulos; a lista de tipos e categorias é a do clube
e o resto — formulário, histórico de versões, visão do documento, verificação de
integridade (SHA-256), compartilhar — é código único (`AcervoPecas`,
`AcervoListagem`).

- **Ciclo**: rascunho → **publicar** (o servidor numera o ato — `Resolução nº
  1/2027` — numa transação sobre `seq/docs`, copia o arquivo para
  `clube-acervo-oficial/{clube}/{doc}/v1/` e calcula o SHA-256) → **retificar**
  (motivo ≥ 10 caracteres; a versão anterior fica em `versions[]`, até 10) →
  **mudar a visibilidade** (os links dos arquivos giram) → **retirar do ar**
  (só a administração, motivo ≥ 20, nada é apagado).
- **Visibilidade**: público (página do clube e vitrine `/c/:id`), só associados
  (qualquer membro do clube) ou só equipe. As marcas `pub`/`members` são
  gravadas pelo servidor e são o que a regra e as consultas leem — uma igualdade
  só, zero índice composto.
- **Aviso**: `notify` avisa os associados em dia **uma vez por versão**
  (`notified_version`), com link `/clubes/{id}?tab=documentos&doc={docId}`.
- **Arquivo**: baixa pela ação `file` (≤ 9 MB, base64) para quem pode ler o
  documento; o do público é aberto por quem não tem conta.
- **Página**: aba **Documentos** do clube (`V2ClubDetail`) e seção na vitrine
  pública (`PublicClub`), por `ClubDocsPublic`. Documento inexistente e
  documento que a regra não deixa ver dizem a mesma coisa ("Documento
  indisponível"). O clube **não** oferece "Seguir" nem comentários (são da
  federação).
- **Conta excluída**: o ato publicado é registro do clube e fica; sai só o nome
  de quem o preparou e publicou (`created_by_name`/`published_by_name` →
  "Usuário removido").

### 5.5 Agenda oficial do clube (Bloco D2b)

Central do clube → **Agenda** (`?aba=agenda`, permissão `docs` ou `sports`): o
calendário do clube — competições, treinos e cursos, assembleias, reuniões de
diretoria e conselhos, prazos e eventos (14 tipos, os da federação). Como nos
documentos, não é uma segunda agenda: é a **mesma tela da federação**
(`FedAgendaPanel`, `AgendaBrowser`, `AgendaEventView`) com o clube no lugar dela.
O `agendaScope.js` troca a entidade (`clubAgendaEntity(club)`, `kind: 'club'`), a
função do servidor (`clubAgenda`), de onde vêm os eventos e os documentos
ligados, os endereços e a invalidação; o clube **ainda não** tem convocação/ata de
reunião, "Seguir" nem comentários (`hasMeetings`/`hasFollow`/`hasComments`
escondem — reunião de verdade é o Bloco F).

- **Quem marca o quê**: a secretaria (`docs`) e a administração, qualquer evento;
  a diretoria esportiva (`sports`), só a agenda esportiva (competição, seleção,
  curso, outro esporte). A régua tem cópia no servidor (`podeTipo`), com
  paridade (`clubAgenda.parity.test.js`).
- **Evento divulgado não some calado**: depois que alguém além da equipe viu
  (`ever_visible`), mudar data ou horário é **remarcar**, e remarcar, reabrir,
  adiar e cancelar pedem motivo (≥ 10 caracteres), entram em `history[]` (até 20) e
  avisam. Apagar só o que só a equipe viu.
- **Aviso**: os associados em dia (menos quem agiu) recebem um aviso com link
  `/clubes/{id}?tab=agenda&evento={id}` (sem `#`).
- **Visibilidade**: público (página do clube, vitrine `/c/:id` e agenda
  assinável), só associados (qualquer membro) ou só equipe; as marcas
  `pub`/`members` são do servidor, uma igualdade por consulta, zero índice.
- **Agenda assinável**: `/api/agenda/clube/{clubId}.ics`, servida pela mesma
  função HTTP da federação (`federationAgendaFeed`, despachada pelo prefixo
  `clube/`); leva **só o público** de clube com a associação aberta; horário de
  Brasília.
- **Páginas**: aba **Agenda** do clube (`V2ClubDetail`, para membro de clube com
  associação ligada), bloco "Agenda oficial" para o visitante e na vitrine
  (`PublicClub`: `?evento=`, `?agenda=1`), por `ClubAgendaPublic`. Evento
  inexistente e evento que a regra não deixa ver dizem a mesma coisa ("Evento
  indisponível").
- **Conta excluída**: o evento fica; sai só o nome de quem o marcou
  (`created_by_name` → "Usuário removido").

### 5.6 Disciplina e ouvidoria do clube (Bloco E1)

Central do clube → **Disciplina** (`?aba=sancoes` e `?aba=ouvidoria`, permissão
`discipline` ou `admin`). Também é a **mesma tela da federação** (`FedDisciplinePanel`)
com o clube no lugar dela (`disciplineScope.js`: `clubDisciplineEntity(club)`,
`callDiscipline`, `callReportUpdate`, `useDisciplineMutation`). Os textos que falam
"filiado/torneio/federação" trocam por `pick(entity, …)`; o clube não tem início de
suspensão (vale a partir de hoje), "ficar fora de torneio chancelado" nem a base
de antidopagem.

- **Quatro sanções**: advertência; suspensão (com prazo, não pode ser no passado); multa
  (vira uma **cobrança** da associação com `origin: 'fine'` — pagar a multa **não renova**
  a filiação); exclusão (encerra a filiação, cancela as cobranças abertas e **mantém a
  pessoa no clube**, sem as vantagens). Motivo com ≥ 10 caracteres; a pessoa precisa ter
  filiação viva; ninguém sanciona a si mesmo.
- **Efeito na carteirinha**: a suspensão grava `discipline_until_ms` na filiação e a
  verificação pública passa a dizer "Suspensa" (mesma conta `membershipState` da
  federação); as vantagens e o voto (Bloco F) ficam suspensos.
- **Recurso — uma vez só**, pela própria pessoa (Minha associação → "Recorrer", ≥ 20
  caracteres). A diretoria **mantém** ou **anula**; anular desfaz o efeito (recalcula a
  suspensão, devolve a filiação excluída com **código novo** e cancela a multa aberta).
  Encerrar a sanção antes do prazo (`end`) faz o mesmo.
- **Quem vê**: só a pessoa e quem tem `discipline`. A aba de associados e a lista de
  filiações são lidas também por `discipline` (para escolher o alvo).
- **Ouvidoria**: um botão na aba Associação da página do clube (conta obrigatória, barra
  mensagem falsa em massa) com assunto, texto (20–2000), evento relacionado e **enviar
  anonimamente** (`reporter_uid: null` — nem a plataforma sabe quem). **O id do documento é
  o protocolo**: 10 letras e números maiúsculos, copiável; quem enviou vê só o ESTADO
  (recebida / em apuração / concluída), nunca o texto nem as anotações. Protocolo
  inexistente e protocolo de outra pessoa dizem o mesmo ("não encontrado"). Concluída não
  volta a ser editada. A proteção de menores é do Bloco E2.
- **Hoje**: a Central mostra "Recursos para decidir" e "Manifestações abertas" para quem
  tem `discipline`, com as mesmas consultas (mesmas chaves) das abas.
- **Conta excluída**: a sanção fica no histórico do clube, sem o nome; a manifestação
  identificada vira anônima (`reporter_uid → null`).
- **Avisos** (`origin: 'server'`, link sem `#`): à pessoa quando é sancionada, quando o
  recurso é decidido ou a sanção é encerrada; à disciplina quando chega recurso ou
  manifestação.

### 5.7 Patrimônio do clube (Bloco E2a)

Central do clube → **Patrimônio** (`?aba=patrimonio`; o financeiro, a diretoria esportiva e a
administração gerem, o conselho fiscal só lê). É o **patrimônio da federação**
(`AssetsManager`) com o clube no lugar dela (`managementScope.js`: `clubManagementEntity(club)`,
`useScopedAssets`, `useScopedManagementAction`, `pick`). A régua (validação do bem, conta de
disponível/emprestado/atrasado, validação do empréstimo) é a MESMA da federação
(`federationManagementPolicy.js`); o clube não copia nem bifurca nada.

- **Inventário**: bem com categoria, quantidade (bens iguais num cadastro só), estado, local,
  código, data e valor; resumo (itens, emprestados, devoluções atrasadas, valor registrado) e
  planilha CSV.
- **Empréstimo** a outro clube, arena ou evento, com devolução combinada. Não empresta mais do
  que há disponível; a quantidade do bem não fica abaixo do que está emprestado.
- **Devolução** registrada com data e o estado em que voltou: voltou danificado, o bem passa a
  dizer isso. **Baixa** (perdido, doado, vendido) pede motivo e não vale com empréstimo aberto;
  reativar desfaz; só a administração apaga, e só o bem que nunca foi emprestado.
- **Avisos**: a varredura diária da associação avisa, **uma vez** por empréstimo, quem emprestou
  (na falta dele, a administração) quando a devolução combinada passa. A faixa **Hoje** mostra
  "Devoluções atrasadas" a quem cuida do patrimônio.
- **Conta excluída**: o bem fica (é do clube); o nome de quem a pessoa era sai do histórico e
  de "quem emprestou".

### 5.8 Proteção de menores do clube (Bloco E2b)

Central do clube → **Proteção de menores** (`?aba=protecao`, `menores`, `protecao-regras`;
permissão `discipline` ou administração). É a **proteção de menores da federação** com o
clube no lugar dela: a régua da certidão (`federationCoachingPolicy.js`: validade, vencendo em
30 dias, conferida por outra pessoa) é a MESMA, e o clube acrescenta o **compromisso de
conduta** no lugar do curso (`clubSafeguardingPolicy.js`, `functions/clubSafeguarding.js`).

- **Quem precisa estar em dia** (regras do clube; padrão: diretoria e designados): cargo na
  diretoria com mandato valendo e quem a disciplina **inclui no quadro** (treinador, monitor,
  voluntário — a pessoa é avisada). Em dia = compromisso aceito na versão em vigor **e**
  certidão de antecedentes conferida e válida.
- **A pessoa** (Minha filiação → card "Proteção de menores", `ClubMyProtection`) aceita o
  compromisso e envia a certidão (PDF ou foto, até 5 MB, para `clube-protecao/{uid}/`; só ela
  lê). A disciplina é avisada; **ninguém confere a própria certidão**; ao registrar a decisão
  o servidor **apaga o arquivo** (o clube guarda data, validade e quem conferiu). Recusa leva
  o motivo à pessoa, que envia outra; revogar tira o "em dia" na hora.
- **Subir a versão do compromisso** ("Pedir novo aceite de todos") faz todos aceitarem de novo;
  a versão só sobe, nunca desce.
- **Associados menores**: quem tem menos de 18 anos pela data de nascimento do cadastro. O
  próprio menor, a secretaria (`members`) ou a disciplina registram o **responsável legal**
  (nome, parentesco, telefone, autorização de participação e de uso de imagem, observações de
  saúde); os dados só a disciplina lê e **somem quando o associado faz 18 anos** (a varredura
  diária). Sem data de nascimento o servidor recusa registrar (não dá para saber se é menor).
- **Denúncia**: a ouvidoria ganhou o assunto "Proteção de criança ou adolescente"; o aviso
  é de prioridade e **nunca leva o texto** (o conteúdo fica na Ouvidoria).
- **Avisos**: a varredura avisa **uma vez** quem tem a certidão vencendo em 30 dias; a faixa
  **Hoje** mostra "Certidões para conferir" e "Menores sem responsável" (fonte que falhou é "—",
  nunca zero).
- **Conta excluída**: o registro, o responsável e os arquivos (`clube-protecao/{uid}/`) saem.

## 6. O que não pode regredir

1. **Filiação, cobrança, aprovação, confirmação e o código da carteirinha são do
   servidor** (`write: if false` no cliente). Nenhuma tela grava `aff`/`charges`.
2. **Perder a filiação não tira do clube** — `club_members` não é tocado.
3. O código da carteirinha **gira**; a verificação pública devolve o mínimo.
4. A flag é imposta na regra (`cxOn()`); com ela desligada o clube se comporta
   como antes e a regra recusa toda escrita da camada.
5. Consulta que falha **não** vira "não há associados": cada painel usa
   `V2ErrorState` e só consulta o que a permissão alcança (consulta recusada
   pela regra apareceria como "não carregou").
6. Coleção nova de clube entra na exclusão **e** na exportação de conta
   (`functions/accountDeletion.js`, guarda `exclusaoCobreColecoes`).
7. Os valores de `?aba=`, os ids de plano e os status gravados são contrato; os
   ids dos cargos-modelo (`president`, `vice`, …) também.
8. **Cargo só vale para quem ainda é membro do clube** (`cxPerms` na regra,
   `permsDe` no servidor, `useMyClubRole` na tela) e **sair do clube apaga o
   cargo**. O cargo comum nunca leva `admin`; nomear exige ser membro.
9. `staff`, `roles` e `imports` são **só do servidor** (`write: if false`); o
   cliente nunca grava cargo nem importação.
10. Os indicadores e a declaração são **zero banco**: reusam as leituras da
    Central; fonte que falhou é "—"/"não deu para medir", nunca zero.
11. A conta pura da diretoria tem **cópia** no servidor
    (`functions/clubStaffPolicy.js`) com teste de paridade
    (`clubStaff.parity.test.js`) — mexer num lado só quebra o teste.
12. **O "como usar" e o código da vantagem nunca estão no documento público**:
    moram em `bsec` (só `comms` lê) e o associado em dia os recebe do servidor
    (`clubContent` / `benefits`). A vitrine só leva `has_secret`.
13. **O aviso do comunicado é do servidor e sai uma vez só** (`notified_at`); a
    comunicação não lê a lista de associados. O link do aviso nunca leva `#`.
14. A consulta dos comunicados "só associados" precisa das **duas igualdades**
    (`status == 'published'` e `audience == 'members'`) — só uma não é provável
    para a regra. Com a associação fechada ao público, a tela do associado **não**
    consulta os públicos (seria recusada) — `ClubNewsSection publicOn={…}`.
15. Os ids de tipo de vantagem (`discount`, `partner`…) e de faixa de patrocinador
    são gravados: nunca renomeie.
16. **Cupom e banner do clube só na página dele** (§5.1): nunca na tela inicial,
    nunca na vitrine geral; e nunca ofereça "só associados" neles — a leitura é
    de qualquer conta logada. Benefício exclusivo é Vantagem.
17. **A loja do clube tem uma chave só, `club_{id}`, e a mesma resposta em três
    lugares** (§5.2): `isMarketOperator`, `operatorUids` e `storeClubs`. Mexer num
    só deixa o aviso do pedido indo para quem não opera, ou a loja oferecida a
    quem a regra recusa.
18. **Orçamento, lançamentos e prestação são só do servidor** (`clubAccounts`,
    `write: if false`); a receita das mensalidades é DERIVADA das cobranças
    pagas, nunca digitada; o retrato da prestação é congelado no envio; o
    publicado não sai (reformulação aprovada substitui). A conta é uma só para
    federação e clube: mexer em `federationAccountsPolicy.js` sem `domain/accounts.js`
    (ou o contrário) quebra a paridade.
19. **O anexo do clube vive em `clube-contas/{uid}/`** (Storage; o servidor só
    aceita o da pasta de quem salva e o move para `clube-contas-oficial/`). As abas
    compartilhadas recebem a entidade pelo escopo (`accountsScope`) — não
    escreva `accountsAction` direto nelas: use `callAccounts`/`useAccountsMutation`.
20. **Documento do clube é só do servidor** (`clubDocs`, `docs` e `seq` com
    `write: if false`): a numeração, a cópia oficial do arquivo, o SHA-256 e as
    marcas `pub`/`members` nascem lá. Publicado **não se edita nem se apaga** —
    retifica (com motivo, a versão anterior fica) ou retira do ar (só a
    administração, sem apagar).
21. **A lista de tipos do clube tem cópia** (`functions/clubDocsPolicy.js` ↔
    `domain/docs.js`) e a validação é a da federação com `allowedTypes`: paridade
    em `clubDocs.parity.test.js`. Ids de tipo e de categoria são gravados — nunca
    renomeie. O caminho de envio aceita só `federacao-acervo/` e `clube-acervo/`
    (a mesma expressão nos dois lados).
22. **A tela do acervo recebe a entidade, não a copia**: não bifurque
    `FedAcervoPanel`/`AcervoDocView` para o clube — passe `clubDocsEntity(club)`
    e use `callAcervo`/`useAcervoMutation`/`docPathFor` do `acervoScope`.
23. O **"só associados"** é lido por qualquer membro do clube (`isClubMember`)
    e a consulta leva a igualdade `members == true`; o público, `pub == true`.
    Sem filtro a consulta é recusada — a tela da equipe lê a coleção inteira e
    a do associado/público, a filtrada.
24. **Evento da agenda do clube é só do servidor** (`clubAgenda`, `events` com
    `write: if false`); a régua (tipos, validação, horário, ICS) é a da federação
    — a lista "quem marca o quê" tem cópia (`podeTipo`) com paridade. Evento
    **já divulgado** (`ever_visible`) não muda de data nem some calado: remarcar,
    reabrir, adiar e cancelar pedem motivo e entram em `history[]`. Ids de tipo e
    de situação são gravados — nunca renomeie.
25. **A agenda do clube recebe a entidade, não a copia**: não bifurque
    `FedAgendaPanel`/`AgendaEventView`/`AgendaBrowser` — passe
    `clubAgendaEntity(club)` e use `callAgenda`/`useAgendaMutation`/`agendaPathFor`/
    `eventPathFor`/`feedPathFor` do `agendaScope`. Reunião, seguir e comentários só
    existem no clube quando o Bloco F os trouxer (hoje `hasMeetings`/`hasFollow`/
    `hasComments` são falsos).
26. **A agenda assinável do clube não tem função própria**: o prefixo
    `/api/agenda/clube/` é despachado dentro de `federationAgendaFeed` — não
    crie um segundo endpoint HTTP.
27. **Sanção e manifestação são só do servidor** (`clubDiscipline`, `cases` e `ombud` com
    `write: if false`). A pessoa lê as PRÓPRIAS sanções com a consulta
    `user_id == eu` (é o que a regra consegue provar); a ouvidoria só a disciplina lê.
28. **A manifestação anônima nunca guarda quem enviou** (`reporter_uid: null`) e o
    acompanhamento devolve só `{ id, status, kind, created_at_ms, anonymous }` — nunca o
    texto. O id é o protocolo em maiúsculas; mexer na geração sem `reportProtocol`/
    `protocolToId` quebra o "Acompanhar".
29. **Multa não renova a filiação**: a cobrança de origem `fine` é paga pela mesma
    confirmação (`confirmarCobranca`), mas pula `plano(...)`. Anular o recurso cancela a
    multa aberta; a paga fica (devolver dinheiro é decisão do clube).
30. **A disciplina do clube recebe a entidade, não a copia**: não bifurque
    `FedDisciplinePanel` — passe `clubDisciplineEntity(club)` e use `callDiscipline`/
    `useDisciplineMutation`. Os ids `kind`/`status` da sanção e do assunto são gravados.
31. **O patrimônio do clube é só do servidor** (`clubManagement`, `assets` com `write: if false`)
    e usa a **régua da federação** (`federationManagementPolicy.js`, sem cópia): mexer no cálculo
    de disponível/atrasado é mexer nos dois. A tela é `AssetsManager` com a entidade do clube
    (`managementScope.js`) — não a bifurque. O conselho fiscal lê, não edita; o `value` das
    abas e os ids de categoria/estado/tipo de quem recebe são gravados.
32. **A proteção de menores do clube é só do servidor** (`clubSafeguarding`; `safeguard` e `minors`
    com `write: if false`, leitura só `discipline`/admin — nem o dono lê direto). A régua da
    certidão é a da federação (`federationCoachingPolicy.js`) e a do clube é `clubSafeguardingPolicy.js`,
    com **cópia no cliente** (`modules/clubs/domain/safeguarding.js`) e teste de paridade
    (`functions/clubSafeguarding.parity.test.js`): mexer num lado só quebra o teste. Quatro
    regras: (a) **o arquivo da certidão é apagado na decisão** e só o servidor o abre (ação
    `sg_file`, a pessoa só pelo próprio); (b) **ninguém verifica a própria certidão**; (c) o
    responsável legal é apagado aos 18 anos e só se registra com a data de nascimento
    conhecida; (d) o aviso da denúncia `minor_protection` não leva o texto. O helper exportado
    `situacao` é o que a convocação de atletas (Bloco E3) deve usar para recusar quem atuaria com
    menores sem estar em dia. Os ids de `roles` (`staff`/`designated`) e de parentesco são gravados.

## 7. Testes

`functions/clubContent.test.js` (vantagens do associado em dia, aviso uma vez
só), `src/modules/clubs/domain/content.test.js`,
`tests/rules/clubContent.rules.test.js` (emulador: vitrine pública, segredo só da
comunicação, comunicado "só associados" para o membro),
`tests/rules/clubStore.rules.test.js` (emulador: quem abre e opera a loja do clube, Pix só da equipe) e `functions/clubStore.test.js`,
`tests/rules/clubPromo.rules.test.js` (emulador: cupom e campanha do clube — quem emite, página publicada, emissor imutável) e o bloco "clube como emissor" de `src/modules/promo/domain/promo.test.js`,
`functions/clubDocs.test.js` (ciclo do documento, numeração, retificação, aviso uma vez só, arquivo),
`functions/clubDocs.parity.test.js`, `tests/rules/clubDocs.rules.test.js` (emulador:
equipe lê tudo, ninguém grava, público `pub`, associado `members`, cargo de quem saiu),
`ClubDocsPublic.runtime.test.jsx`,
`functions/clubAgenda.test.js` (marcar, remarcar, adiar, cancelar, aviso, ICS),
`functions/clubAgenda.parity.test.js`, `tests/rules/clubAgenda.rules.test.js`
(emulador: equipe lê tudo, ninguém grava, público `pub`, associado `members`, cargo de
quem saiu) e `ClubAgendaPublic.runtime.test.jsx`,
`functions/clubSafeguarding.test.js` (compromisso, certidão, conferência apaga o arquivo, ninguém confere a própria, designação, responsável do menor, varredura),
`functions/clubSafeguarding.parity.test.js`, `tests/rules/clubSafeguarding.rules.test.js` (emulador: só a disciplina lê, ninguém grava),
`src/modules/clubs/domain/safeguarding.test.js`, `ClubSafeguardingPanel.runtime.test.jsx`,
`functions/clubManagement.test.js` (cargo, empréstimo, devolução, baixa, varredura uma vez só),
`tests/rules/clubManagement.rules.test.js` (emulador: quem lê, ninguém grava),
`functions/clubDiscipline.test.js` (as quatro sanções, recurso uma vez, anular desfaz, multa não renova, ouvidoria anônima e protocolo),
`tests/rules/clubDiscipline.rules.test.js` (emulador: a pessoa lê só as suas, a ouvidoria só a disciplina, ninguém grava),
`functions/clubAccounts.test.js` (orçamento, lançamentos, prestação, parecer, anexo),
`tests/rules/clubAccounts.rules.test.js` (emulador: quem lê, ninguém grava, consulta
pública `pub == true`, conselho fiscal lê cobranças) e
`ClubAccountsPanel.runtime.test.jsx`,
`functions/clubAssociation.test.js` (ciclo completo no servidor, incluindo a
importação), `functions/clubStaff.test.js` (diretoria, mandato, varredura) e
`functions/clubStaff.parity.test.js`, `functions/accountDeletion.clubes.test.js`,
`src/modules/clubs/domain/association.test.js` e
`staffDeclarationIndicators.test.js`,
`tests/rules/clubAssociation.rules.test.js` (emulador) e as guardas de
catálogo (`i18nCatalogos`, `i18nAvisos`) e de flags (`flagsIncorporadas`).
Idiomas: pt-BR, en e es em `src/modules/clubs/i18n/`.
