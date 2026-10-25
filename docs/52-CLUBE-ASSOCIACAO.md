# 52 — Clube como associação (flag `club_association`)

> Estado: **Bloco A** (filiação, planos, Pix, carteirinha, página pública e
> Central do clube) e **Bloco B** (diretoria com cargos e mandatos, indicadores,
> importação de associados, declaração de associação) estão no código. Os blocos
> C–G (vantagens e cupons, financeiro completo e documentos, atletas e seleção,
> torneios do clube, assembleias e eleições, patrocínio, mercado do clube)
> estão no plano (`/mnt/project-files/clubes/plano-clube-associacao.md`) e
> **ainda não existem** — este documento só descreve o que há no código.

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
- **Página pública** `/c/:clubId`: seção "Associe-se" com os planos (a
  filiação exige login); `/c/verificar/:codigo?` — verificação pública da
  carteirinha (QR), com campo para digitar.
- **Central do clube** `/clubes/:clubId/gerir`, dois grupos como a federação e a
  arena (Atender · Gerir). `?aba=` e `?secao=` na URL; os valores são **contrato
  de link** — nunca renomeie: `hoje`, `associados`, `cobrancas`, `planos`,
  `pix`, `equipe`, `cargos`, `indicadores`, `config`. `?filtro=` filtra os associados.
  - **Hoje** — o que precisa de você + prontidão (ligar, criar plano, informar Pix, abrir ao público) + **mandatos acabando** (a quem tem `staff`).
  - **Associados** — pedidos, filtros, busca, aprovar/recusar/suspender/reativar, "Associar uma pessoa", **"Importar lista"** (CSV) e **"Declaração"** de cada associado em dia.
  - **Financeiro → Cobranças** — recebido no mês/total, vencidas, confirmar/cancelar.
  - **Planos** — criar/editar/pausar, aplicar plano gratuito a todos os membros; **Pix do clube**.
  - **Diretoria → Equipe e mandatos** — quem está na diretoria, cargo e mandato (aberto, vigente, acabando, encerrado), nomear (escolhendo entre os membros do clube), trocar de cargo, prorrogar com motivo, tirar ou sair. **Cargos** (só o master) — montar os cargos do clube, com o que cada permissão abre.
  - **Indicadores** — 12 meses de pedidos, taxa de renovação, em dia por plano e por categoria, recebido por mês e por origem, atraso; baixa a planilha CSV. Cada bloco depende da própria fonte e, sem ela, diz "não deu para medir" — nunca zero.
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

## 7. Testes

`functions/clubAssociation.test.js` (ciclo completo no servidor, incluindo a
importação), `functions/clubStaff.test.js` (diretoria, mandato, varredura) e
`functions/clubStaff.parity.test.js`, `functions/accountDeletion.clubes.test.js`,
`src/modules/clubs/domain/association.test.js` e
`staffDeclarationIndicators.test.js`,
`tests/rules/clubAssociation.rules.test.js` (emulador) e as guardas de
catálogo (`i18nCatalogos`, `i18nAvisos`) e de flags (`flagsIncorporadas`).
Idiomas: pt-BR, en e es em `src/modules/clubs/i18n/`.
