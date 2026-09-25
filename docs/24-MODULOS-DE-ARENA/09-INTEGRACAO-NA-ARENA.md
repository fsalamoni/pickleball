# Integração dos módulos à arena — plano e estado

> **Pedido** (2026-09-24): *"os módulos da arena V3 estão um tanto separados
> do restante da arena. Eu preciso que os módulos sejam integrados à arena e à
> gestão da arena em si. Vamos iniciar pelos módulos de membros, aulas e
> instrutores e torneios internos. […] Eles ainda precisam ser ativados pelo
> admin da plataforma e ativados pelo gestor da arena, se assim ele quiser.
> Mas as funcionalidades precisam ser integradas junto com as demais
> funcionalidades das arenas."*
>
> **O que NÃO muda**: as três camadas. A plataforma libera, a arena ativa, e
> só então a funcionalidade aparece. Módulo desligado = nada muda na arena.

---

## 1. O diagnóstico — por que parecia "algo adicional"

Levantamento de ponta a ponta (2026-09-24). Cinco causas, e só a primeira é
de aparência:

1. **Cada módulo era uma página separada**, alcançada por um botão de atalho
   no topo (`ArenaModuleShortcuts`). A gestão tem seções e abas
   (`buildArenaSections` em `V2ArenaManage.jsx`); os módulos ficavam fora
   delas. A página pública é uma coluna única com seções; os módulos, de novo,
   eram botões para fora.
2. **Dois cadastros de professor para a mesma arena.** O "Sistema A"
   (`coaches/{uid}` + `coach_arenas`: professor da plataforma, parceiro da
   arena, aba *Equipe → Professores*) e o do módulo de aulas
   (`arena_coaches`). O formulário de aulas buscava no diretório de ATLETAS,
   então o mesmo professor parceiro virava dois registros sem ligação.
3. **Dois lugares de torneio que não se viam.** Torneio da plataforma com
   `arena_id` aparece na página pública e em lugar nenhum da gestão; torneio
   interno só na página do módulo.
4. **O atleta não encontrava o que é dele.** Matrícula em aula só aparecia em
   `/arenas/:id/aulas`; inscrição em torneio interno, só em `/arenas/:id/torneios`.
   `/minhas-aulas` mostra só as aulas particulares do Sistema A; o professor
   vinculado a uma arena não via as aulas dela em `/aulas`.
5. **Membro e cliente eram dois mundos.** A aba *Clientes* (CRM) sai das
   reservas; `arena_members` é outro cadastro. Nenhum dos dois mostrava o
   outro.

### Defeitos encontrados no caminho

| # | Defeito | Onde |
|---|---|---|
| D1 | A gestão **não lê `?secao=&aba=`**: quatro links internos ("abrir os módulos", "abrir o mercado") caíam em *Reservas* | `V2ArenaManage.jsx`; links em Marketing, Avançado, Operações |
| D2 | A matrícula grava `partner: true` **fixo**: professor da casa paga comissão | `V2ArenaClasses.jsx` (divisão e matrícula) |
| D3 | `useArenaTournaments` e `useArenaCoaches` existem **duas vezes**, com dados diferentes, e a chave de cache do torneio interno é prefixo da do torneio da plataforma | `useArenaV3.js` × `useTournament.js` / `useCoaches.js` |
| D4 | "Encerrar torneio" (que pontua o ladder) **não tem botão**: `useFinishTournament` não é usado por tela nenhuma | `V2ArenaLeagues.jsx` |
| D5 | Parceria **pendente** aparece como "Ativo"; e pausar → retomar grava `active` pulando o aceite do professor | `V2ArenaCoaches.jsx`, `coachService.js` |
| D6 | Aula marcada como **"dada" SUMIA** da agenda (a lista trazia só `scheduled`) — e com ela o botão de registrar o pagamento de quem esteve lá; a aula cancelada também sumia, e o aviso de cancelamento levava o aluno a uma tela sem ela | `classesService.listArenaClasses` |
| D7 | O **professor não lia os alunos** da própria aula: a regra de `arena_class_bookings` só deixava o aluno e a arena lerem, e o erro virava "ninguém matriculado" com a turma cheia | `firestore.rules`, `V2ArenaClasses.jsx` |
| D8 | Comissão configurada em **0% virava 20%** (`Number(x) \|\| 20`: zero é falso) | `V2ArenaClasses.jsx` |
| D9 | O corte da lista de aulas levava as **FUTURAS**: passando de 100 aulas nunca marcadas como dadas, a aula de amanhã deixava de ocupar a quadra no calendário | `classesService.listArenaClasses` |
| D12 | O **atleta não conseguia se inscrever** num torneio da casa (nem sair): a inscrição grava no documento do torneio e a regra só deixava a arena atualizá-lo — o botão "Quero jogar" nunca funcionou | `firestore.rules` |
| D13 | Encerrar o torneio duas vezes (dois cliques, duas abas) **somaria os pontos duas vezes** no ladder | `leaguesService.finishInternalTournament` |
| D14 | A página da arena mostrava o **status cru** do torneio da plataforma (`registrations_open`) e listava **rascunhos** | `V2ArenaDetail.jsx` |
| D11 | A **arena também não via os alunos**: a lista filtrava só por `class_id`, e a regra confere a arena — o Firestore recusava a consulta inteira. Cancelar a aula quebrava no meio: a aula ficava cancelada e **ninguém era avisado** | `classesService.listClassBookings`, `cancelArenaClass` |
| D10 | O aluno podia se **matricular já "pago"**, marcar a própria matrícula como paga e plantar matrícula na lista de outra arena (a regra só conferia `user_id`) | `firestore.rules` |

---

## 2. O desenho

### 2.1 A gestão da arena (Central)

As abas passam a ser **endereçáveis por URL** (`?aba=`, com `?secao=` aceito
por compatibilidade) — isso corrige D1 e permite que as rotas antigas dos
módulos virem atalhos para a aba certa, sem quebrar notificação antiga.

| Seção | Abas | Aparece quando |
|---|---|---|
| Reservas | … + **Clientes** (com selo de membro e "incluir como membro") | sempre (selo só com Membros) |
| **Membros** | **Membros** · **Planos e pacotes** | módulo `members` ativo |
| **Aulas** | **Agenda de aulas** · **Professores** (lista única: parceiros + quem dá aula) | módulo `classes` ativo |
| **Torneios** | **Da casa** (internos + ladder) · **Da plataforma** (torneios com `arena_id`) | internos: `leagues`; plataforma: sempre que houver |
| Equipe e parceiros | Administradores · Professores (quando Aulas está desligado) · Clubes | sempre |

Com o módulo desligado, a gestão fica **idêntica** ao que era.

### 2.2 A página pública da arena

Os botões de atalho dos três módulos saem; entram **seções nativas**, no
fluxo da página, com a ação principal ali mesmo (matricular, inscrever,
comprar pacote) e "ver tudo" para a página completa:

- **Planos e vantagens** — minha situação (nível, horas, saldo) e os pacotes.
- **Aulas e professores** — próximas aulas + professores (a seção
  "Professores parceiros" que já existia vira parte dela).
- **Torneios** — os da casa com inscrição aberta + ladder, junto dos da
  plataforma que já apareciam.

### 2.3 O lado do atleta e do professor

- `/minhas-aulas` ganha **Aulas nas arenas** (matrículas de todas as arenas).
- `/aulas` (agenda do professor) ganha **Aulas que você dá nas arenas**.
- As inscrições em torneio interno aparecem junto dos outros torneios da
  pessoa.

### 2.4 Banco

Mesma regra das ondas anteriores: **nenhuma coleção nova, nenhum índice
novo**; consultas com um `where` só e ordenação em memória.

---

## 3. Ordem de entrega

| PR | Conteúdo | Estado |
|---|---|---|
| I-1 | Abas por URL (D1) + seção **Membros** na gestão + membros na página pública + selo no CRM | ✅ §4 |
| I-2 | Seção **Aulas**, lista única de professores (Sistema A + aulas), D2, D5–D11, aulas no lado do atleta e do professor | ✅ §5 |
| I-3 | Seção **Torneios** (casa + plataforma), D3, D4, D12–D14, torneios na página pública e no lado do atleta | ✅ §6 |
| I-4 | Receita de aulas, planos e torneios no painel de métricas | ✅ §7 |
| I-5 | **Jogo aberto, buscar parceiro e fila** — seção na Central, seção na página da arena, Minhas reservas e Procura-se jogo | ✅ §8 |
| I-6 | **Loja do app unificada com o Mercado** — um cadastro de produto só | ✅ §9 |
| I-7 | **Marketing** dentro da arena — seção na Central, promoções e indicação na página da arena, e o defeito do documento que ainda não existe | ✅ §10 |
| I-8 | **Operação, presença e avançado** dentro da arena — seção Operação, Presença em Reservas, Marca em Perfil, Rede e Inteligência em Desempenho, Plantão em Equipe; a página "Avançado" deixa de existir | ✅ §11 |

---

## 4. I-1 — Membros dentro da arena (entregue)

### A Central passa a ter endereço

`?aba=` escolhe a aba (e `?secao=` abre a primeira aba da seção, pelos links
antigos). Clicar numa aba grava o lugar na URL — recarregar não devolve a
pessoa para Reservas. **Isso corrigiu D1**: "abrir os módulos" (Marketing,
Avançado, Operações) e "abrir o mercado" caíam sempre em Reservas.

Duas regras que a navegação depende:

- **O valor de cada aba é único em toda a Central.** A seção ativa é achada
  pela aba; um valor repetido tornaria a segunda inalcançável. A estrutura
  mora em `v2/components/arenas/arenaManageSections.js` e há teste travando.
- **Aba de módulo desligado cai em Reservas** — nunca tela em branco. Enquanto
  os módulos ainda CARREGAM, a aba pedida espera (esqueleto) em vez de mostrar
  Reservas por meio segundo e trocar.

### Onde os membros estão agora

| Lugar | O quê |
|---|---|
| Central → **Membros** → *Membros* | quem é membro, incluir, pontos, carteira, mensalidade |
| Central → **Membros** → *Pacotes de horas* | a vitrine de pacotes (só com o módulo de pacotes) |
| Central → Reservas → **Clientes** | selo do nível de quem é membro; **"Tornar membro"** para quem reservou 3+ vezes confirmadas e ainda não é; filtro "Ver só esses" |
| Página da arena → **Planos e vantagens** | membro: nível, desconto, horas que restam, saldo, mensalidade em atraso; quem não é: até 2 pacotes, compra ali mesmo |

- A seção pública fica **logo depois dos Preços** — é olhando o preço da hora
  avulsa que se decide comprar pacote.
- Sem ser membro e sem pacote à venda, a seção **não aparece** (uma caixa
  dizendo "fale com a arena" no meio da página não ajuda ninguém).
- Cliente **avulso** (reserva manual, sem conta) nunca é candidato a membro:
  não há a quem dar o benefício.

### O que deixou de existir

- O **botão de atalho** de Membros, nos dois lados: o catálogo marca o módulo
  como `native` e `ArenaModuleShortcuts` não gera atalho para ele.
- A **tela avulsa** `/gerir/membros`: a rota continua (notificações antigas
  apontam para ela) e leva à aba da Central.

### De quebra

- A data da última reserva na aba Clientes e as datas especiais de preço na
  página da arena saíam em ISO cru (`2026-09-01`); agora em pt-BR.
- **Correção posterior (Onda BI)**: o "comprar" do pacote nesta seção falhava
  sempre — a carteira só a arena escreve. Virou **pedido** que a arena confirma
  na Central (ver `02-MEMBROS.md`, atualização 2026-09-24).
- O cartão de pacote virou componente compartilhado
  (`PackageForSaleCard`): importá-lo da página de membros traria a página
  inteira para o pacote da página da arena.

---

## 5. I-2 — Aulas e professores dentro da arena (entregue)

### Onde as aulas estão agora

| Lugar | O quê |
|---|---|
| Central → **Aulas** → *Agenda* | a agenda inteira: criar, editar, cancelar, marcar como dada, **alunos e pagamento** — inclusive das aulas que já aconteceram |
| Central → **Aulas** → *Professores* | a lista ÚNICA: parceiros da plataforma + quem dá aula na agenda, um cartão por pessoa |
| Página da arena → **Aulas e professores** | as 3 próximas aulas com vaga (matrícula ali mesmo), os professores e, para quem dá aula ali, o atalho para a própria agenda |
| `/arenas/:id/aulas` | a agenda completa — o atleta se matricula, o professor vê as aulas DELE com os alunos |
| `/minhas-aulas` | **Aulas nas arenas**: as matrículas de todas as arenas, a próxima primeiro |
| `/aulas` (painel do professor) | **Aulas que você dá nas arenas** — aparece até para quem não tem perfil de professor da plataforma |

- Com Aulas ligado, **"Professores" sai de Equipe** e vem para a seção Aulas.
  O valor da aba continua `professores`: `?aba=professores` segue levando ao
  lugar certo. Desligado, Equipe → Professores é a de parceiros, como era.
- `/arenas/:id/gerir/aulas` continua existindo (notificação antiga aponta
  para ela) e leva a `?aba=aulas`. O catálogo marca `classes` como `native`:
  sem botão de atalho nos dois lados.

### A lista única de professores

`mergeCoachRoster` (`arenas/domain/coachRoster.js`) junta os dois cadastros
pela conta da pessoa (`arena_coaches.user_id` = `coach_arenas.coach_id`). Cada
cartão diz o que a pessoa é:

- **parceiro da plataforma**, com a parceria (ativa, pausada, aguardando);
- **dá aula aqui** — *da casa* (não paga comissão) ou *paga comissão*;
- parceiro com parceria ATIVA que ainda não dá aula: **"Colocar nas aulas"**,
  um toque (`arenaCoachFromPartner`: nome, foto, valor/hora do perfil,
  conta vinculada, `partner: true`). Convite pendente não — o professor nem
  aceitou.

O formulário "Professor das aulas" oferece esses parceiros primeiro. E quem
é cadastrado sem conta é avisado: sem o vínculo, o professor não vê a própria
agenda.

Na página pública, `publicCoachRoster` divulga só parceria ATIVA e professor
das aulas ATIVO; o parceiro leva ao perfil, o professor só das aulas não tem
perfil para onde levar.

### A divisão do dinheiro sai do banco (D2, D8)

A matrícula não recebe mais comissão nem "é parceiro" da tela. O serviço
(`bookClass`) lê:

- o cadastro do professor da aula → `partner`;
- a configuração do módulo `classes_marketplace` →
  `commissionPctFrom(config)`, **zero inclusive**.

A tela usa as mesmas fontes só para MOSTRAR a divisão.

### O professor vê os alunos (D7) — a única mudança de regra

`arena_class_bookings` ganhou, na **leitura**, o professor da aula:
`get(arena_coaches/{coach_id}).data.user_id == request.auth.uid`. Ninguém se
faz professor — o cadastro é da arena, que só a arena escreve. A consulta do
professor filtra por `coach_id` (`listCoachClassBookings`), que é o que deixa
o Firestore provar a condição para a lista inteira; por aula (`class_id`) ele
recusaria. O professor **lê**: pagamento e "tirar da aula" continuam da arena.

Trocar o professor de uma aula leva o novo `coach_id` às matrículas
(`updateArenaClass`) — senão o novo professor abriria a aula vazia.

### A arena vê os alunos (D11)

A arena lia as matrículas de uma aula com `where('class_id', '==', …)`. A
regra deixa a arena ler conferindo `resource.data.arena_id` — e o Firestore
só aceita uma consulta quando consegue provar a regra para TUDO o que ela pode
devolver: `class_id` não prova nada sobre a arena, e a consulta era recusada
sempre. Agora é `arena_id` + `class_id` (só igualdades: o Firestore junta os
índices de campo único, sem índice composto). E cancelar a aula não depende
mais de conseguir ler os alunos: se a leitura falhar, a aula continua
cancelada e o erro vai para o log.

**Vale para o projeto todo**: consulta em coleção de leitura restrita tem de
filtrar pelo campo que a regra confere (`arena_id` para a arena, `user_id`
para o dono, `coach_id` para o professor). A mesma família apareceu em PDV,
fila de espera e indicações — tratada à parte.

### A matrícula não decide o que é da arena (D10)

Na mesma regra, **fechando** o que estava aberto:

- criar: `paid` não pode vir `true`, e o `arena_id` tem de ser o da AULA;
- atualizar (aluno): não mexe em `paid`, `paid_at`, valores, comissão,
  `arena_id`, `class_id`, `user_id`, `coach_id`;
- apagar (desmarcar): igual a antes.

Nenhum caminho do aplicativo fazia isso — a regra só não impedia. Quinze
asserções novas no emulador (233 no total): metade prova o que passou a
funcionar, metade o que continua ou passou a ser barrado.

### Agenda por quem olha (D6)

`splitClassAgenda` (`arenas/domain/classAgenda.js`):

| Quem | Próximas | Passadas |
|---|---|---|
| Arena | todas (as canceladas com o selo) | todas — é onde se registra o pagamento |
| Professor | as DELE | as DELE |
| Atleta | as abertas + as suas (a cancelada aparece com o motivo) | só as suas |

`listArenaClasses(arenaId, { includeClosed: true })` é a agenda; sem a opção
(calendários) continua trazendo só as de pé — só aula de pé ocupa quadra. E o
corte por limite passou a levar as MAIS ANTIGAS (D9).

### Sem conta

Aulas, professores das aulas e torneios da casa só são legíveis por quem tem
conta. Sem login, `/arenas/:id/aulas` e `/arenas/:id/torneios` não consultam
nada e **convidam a entrar** — antes a consulta era recusada e a tela dizia
"não foi possível carregar", como se a plataforma estivesse com problema.

### Banco

**Zero coleção, zero índice, zero campo novo.** Uma regra alterada
(`arena_class_bookings`: leitura do professor + criação/atualização mais
fechadas), provada no emulador.

---

## 6. I-3 — Torneios dentro da arena (entregue)

### Onde os torneios estão agora

| Lugar | O quê |
|---|---|
| Central → **Torneios** → *Da casa* | publicar, editar, cancelar, **Começar** (vira dia de jogo) e **Encerrar e pontuar**; a classificação da casa (ladder) em cima |
| Central → **Torneios** → *Da plataforma* | os torneios da plataforma sediados na arena, com status em pt-BR, e **"Criar torneio aqui"** (a arena já chega escolhida como sede) |
| Página da arena → **Torneios da casa** | os próximos com inscrição aberta (a inscrição ali mesmo), o que está rolando (o caminho para o jogo) e o topo da classificação |
| `/arenas/:id/torneios` | a página completa — o atleta se inscreve e sai |
| Torneios → **Meus torneios** | os torneios da casa em que a pessoa está inscrita, de todas as arenas |

- A seção Torneios existe se o módulo `leagues` estiver ligado **ou** se
  houver torneio da plataforma sediado ali (não arquivado) — o segundo caso
  não depende de módulo: é da arena desde sempre, só não tinha lugar na
  gestão. Nenhum dos dois: a Central fica como era.
- `/arenas/:id/gerir/torneios` leva a `?aba=torneios`; `leagues` é `native`.

### O ciclo agora fecha (D4, D12, D13)

publicar → **inscrição** → Começar (dia de jogo) → **Encerrar e pontuar**.

Os dois extremos estavam quebrados, e o ciclo nunca tinha fechado uma vez:

- **Inscrição (D12).** A regra de `arena_internal_tournaments` ganhou o
  atleta, no desenho do dia de jogo: só entra ou sai **a si mesmo**
  (`participants` = antes ∪ {eu} / antes ∖ {eu}), só enquanto o torneio está
  `scheduled` e sem `game_day_id`, sem tocar em nada além de
  `participants`/`roster`/`enrolled`/`updated_at`, sem apagar o roster dos
  outros, sem inflar a contagem e respeitando o limite de vagas. Dez
  asserções novas no emulador.
- **Encerramento (D4).** "Encerrar e pontuar" abre o diálogo que monta o
  pódio a partir do **ranking do dia** (`tournamentStandings`, sobre
  `computeGameDayLeaderboard`); formato sem placar (Play) começa sem pódio e a
  arena escolhe. Antes de confirmar, a arena vê **quantos pontos cada um
  leva** (100/70/50/35, presença 10). Convidado sem conta não entra no ladder.
- **Encerrar duas vezes (D13).** O serviço confere o status **no banco**:
  já encerrado → recusa; não começou → recusa. E avisa quem jogou, com o
  campeão.
- O torneio encerrado mostra o **pódio** no cartão.

### D3 — duas listas, uma chave

`useArenaTournaments` existia em dois lugares, com chaves encaixadas
(`['arena-tournaments', id]` para os da plataforma, `['arena-tournaments', id,
filtros]` para os da casa). Os da casa agora são `useArenaInternalTournaments`,
com chave própria em `arenaKeys.torneiosDaCasa` (há teste de que não
compartilham prefixo); o nome antigo segue exportado como alias.

### Banco

**Zero coleção, zero índice, zero campo novo.** Uma regra ampliada
(`arena_internal_tournaments`: a inscrição do próprio atleta), provada no
emulador — metade das asserções prova o que passou a funcionar, metade o que
continua barrado.

---

## 7. I-4 — O dinheiro dos módulos nas métricas (entregue)

Central → Desempenho → **Métricas** ganhou, com os módulos ligados, a linha
**Planos (membros) · Aulas · Torneios da casa**, e o **total do mês** passou a
somar o que entrou por eles. A regra do que conta mora em `moduleRevenue`
(`arenas/domain/moduleRevenue.js`), pura e testada:

| Origem | O que entra no TOTAL | Pela data de |
|---|---|---|
| Aulas | só a parte que **fica com a arena** (`arena_amount`) das matrículas **pagas**; o "a receber" aparece à parte | a aula |
| Pacotes | o valor da venda registrada na carteira (quem registra é a arena, ao confirmar o pagamento) | a venda |
| Mensalidades | o mês marcado como pago × o valor do plano | o mês |
| Torneios da casa | **nada** — aparece como *previsto* (inscritos × inscrição), porque a plataforma não registra o pagamento da inscrição | o torneio |

- Cada consulta só sai com o módulo ligado; sem nenhum, o painel é o de antes.
- As consultas novas (`listArenaClassBookings`, `listArenaWallets`) filtram
  por `arena_id`, o campo que a regra confere para a arena ler.

---

## 8. I-5 — Jogo aberto, buscar parceiro e fila dentro da arena (entregue)

> **Pedido** (2026-09-24): *"Vamos fazer o mesmo tipo de integração para os
> demais módulos v3 de arena […] tanto no ambiente admin da arena, quanto no
> ambiente de visualização pública (dos usuários) da arena […] Verifique
> também todas as demais nuances e integrações."*

### Onde o jogo aberto está agora

| Lugar | O quê |
|---|---|
| Central → **Jogo aberto** | publicar, cancelar, excluir — e, **novo**, **quem vem jogar** (nome e foto) e **a fila de cada jogo** (quantos esperam, quem foi chamado) |
| Página da arena → **Jogos abertos** | a chamada da fila em destaque, os jogos em que estou, até 3 jogos (os do meu nível primeiro) com **"Quero jogar" ali mesmo**, e a porta do buscar parceiro |
| `/arenas/:id/open-match` | a lista completa (continua) |
| **Minhas reservas** | os jogos abertos em que estou, **de todas as arenas**; a chamada da fila com "Confirmar minha vaga"; as filas em que espero, com "Sair da fila" |
| **Procura-se jogo** | **"Jogos abertos nas arenas"**: as vagas publicadas pelas arenas, com entrada direta |

- A seção da Central vem **logo depois de Reservas**: jogo aberto é vender
  horário de quadra, e ocupa a quadra como uma reserva.
- A seção da página pública vem **depois do Dia de jogo e antes do calendário**
  — entrar num jogo pronto é decisão mais simples que montar uma reserva.
- `/arenas/:id/gerir/open-match` leva a `?aba=jogo-aberto`; `matchmaking_open_match`
  e `matchmaking_partner_finder` são `native` no catálogo (sem botão de atalho).

### Os defeitos e lacunas do caminho

| # | O que havia | O que ficou |
|---|---|---|
| D15 | A arena via "3 de 4" e **não sabia quem eram os três** | cada vaga lista quem vem (diretório de atletas; quem não está nele aparece como "Atleta") |
| D16 | A arena **não via a fila** de nenhum jogo | quantos esperam, os primeiros nomes e quem foi chamado — **uma consulta para a arena inteira** (`listArenaWaitlist`, por `arena_id`) |
| D17 | A **chamada da fila** (que tem prazo) só podia ser aceita abrindo a arena certa | aparece também em Minhas reservas, com o nome da arena |
| D18 | Quem entrou num jogo precisava **lembrar em que arena foi** para ver o horário | Minhas reservas lista os jogos de todas as arenas (`listMyOpenSlots`, `participants array-contains`) |
| D19 | Os jogos das arenas **não apareciam em Procura-se jogo** — o hook global existia e nenhuma tela o usava | "Jogos abertos nas arenas", só de arenas que mantêm o módulo ligado (`useModuleOnInArenas`, mesmo cache da página da arena) |
| D20 | O aviso à arena dizia `entrou no slot de 2026-09-24 19:00` e apontava para a tela antiga | `entrou no jogo aberto de Qui, 24/09 · 19:00–21:00`, direto na aba |
| D21 | Fora da faixa de nível, o botão era "Quero jogar" **apagado, sem dizer por quê** | o botão diz **"Fora da sua faixa"**, e a linha ao lado diz a faixa |

### Uma regra só para "tem vaga"

`arenas/domain/openMatchView.js` (puro, testado) responde o que cada tela pergunta
— `openMatchSectionModel` (a seção da arena), `myUpcomingOpenSlots` e
`pendingWaitlistCalls` (Minhas reservas), `openSlotsForDiscovery` (Procura-se
jogo), `waitlistBySlot` (Central) — e **`slotActionState`** decide o botão
(entrar / fila / na fila / sair / encerrado / fora da faixa) para o cartão
grande e para a linha compacta. O cartão, a chamada da fila e as ações
(`useOpenSlotActions`) viraram peças compartilhadas em
`v2/components/arenas/openMatch/`: a mesma frase em todas as telas.

Duas regras que vêm de antes e continuam valendo: **LOTADO não é ENCERRADO**
(lotado oferece a fila) e **nível desconhecido não barra ninguém**.

### Banco

**Zero coleção, zero índice, zero campo, zero regra.** As duas consultas novas
são de igualdade ou `array-contains` num campo só (índice de campo único) e
passam pelas regras que já existiam (`arena_open_slots` é pública; a fila é
legível por quem tem conta desde a Onda BH).

---

## 9. I-6 — A loja do app vira um canal do Mercado (entregue)

### O problema: dois cadastros de produto

A arena tinha **dois** lugares para cadastrar produto, sem ligação nenhuma:

| | Mercado (Central → Pagamentos e loja) | Loja do PDV (`/gerir/pdv`) |
|---|---|---|
| coleção | `arena_inventory_products` + entradas + saídas | `arena_products` |
| estoque | entradas − saídas, com validade e mínimo | um número solto no produto |
| financeiro | compras, vendas e lucro por período | nenhum |

A mesma garrafa de água seria cadastrada duas vezes, com dois estoques que
divergiriam no primeiro dia — a doença de sempre dos cadastros duplicados (foi
o que aconteceu com os professores, §5). Em produção a loja do PDV **não tinha
produto nenhum**: o momento de unificar era antes de existir dado nos dois.

### O desenho: o Mercado é o cadastro; a loja do app é um canal

```
Mercado: produto com "Vender pelo app"  ──► vitrine da loja (página da arena, /loja)
atleta pede pelo app                    ──► arena_sales (catalog: 'mercado'), preço DO BANCO
                                            + aviso à arena → Central → Pedidos do app
arena toca "Entreguei"                  ──► SAÍDA do Mercado (tipo venda, com o comprador)
                                            → estoque, vendas e financeiro do Mercado
arena cancela                           ──► apaga as saídas daquele pedido, devolve o estoque
```

- O produto ganha **`sell_online`** ("Vender pelo app") e usa o `sale_price`
  que o Mercado já tinha. Sem preço de venda, não aparece na loja — e o
  editor avisa.
- O atleta não lê entradas e saídas (são da arena), então o produto à venda
  carrega **`stock_qty`**, uma cópia do estoque. A conta verdadeira continua
  sendo entradas − saídas: a cópia é refeita a cada entrada e saída do
  Mercado (`refreshShopStock`), a cada entrega/cancelamento, e conferida de
  uma vez quando a arena abre os pedidos (`syncShopStock`).
- **Produto sem controle de estoque.** Nem tudo tem estoque: aluguel de
  raquete é serviço, e muita arena nunca registrou uma compra no Mercado. Se a
  conta fosse sempre entradas − saídas, todo produto assim nasceria
  **esgotado** na loja e o primeiro pedido entregue o deixaria negativo. A
  regra (`trackedStock`) é a do PDV antigo, dita pelo que a arena FEZ:
  produto **com pelo menos uma entrada** tem estoque controlado; sem nenhuma,
  o app vende sem limite (`stock_qty` vazio). O editor do Mercado diz isso ao
  lado do "Vender pelo app".
- Vendas antigas (sem `catalog`) seguem o caminho de sempre, em
  `arena_products`. Nada foi migrado.

### Onde a loja está agora

| Lugar | O quê |
|---|---|
| Central → Pagamentos e loja → **Pedidos do app** (primeira aba da seção) | o BALCÃO: a entregar, pedidos e vendido hoje; "Entreguei"; cada parte da conta dividida (quem registrou, quem pagou, quem não fez nada) com **"Confirmar recebimento"** e **"Recebi no balcão"**; cancelar com motivo; o valor conferido contra a tabela de hoje |
| Central → Pagamentos e loja → **Mercado** | o cadastro único: **"Vender pelo app"** no produto (novo e edição), selo **"No app"**, e as saídas geradas pela loja com o selo **"Pedido pelo app"** |
| Página da arena → **Loja** | os meus pedidos para retirar ali; a vitrine com preço (módulo `pdv_catalog`); "Fazer um pedido" |
| `/arenas/:id/loja` | a vitrine inteira, por categoria, com o carrinho e a divisão da conta; as minhas compras ali, com "Desistir" e a chave Pix |
| **Minhas reservas** → **Compras nas arenas** | o que retirar e a parte de conta a pagar, **de todas as arenas**; o histórico recolhido |
| Métricas | o pedido do app entregue conta **pelo Mercado** ("R$ X pelo app"), e o cartão "Pedidos do app" diz quantos foram entregues e pagos |

`/arenas/:id/gerir/pdv` leva a `?aba=pedidos`; `pdv` é `native` no catálogo
(sem botão de atalho). Quem gere a arena e abre `/loja` vê a loja como o atleta
vê, com o caminho para o balcão no topo.

### Os defeitos do caminho

| # | O que havia | O que ficou |
|---|---|---|
| D22 | Dois cadastros de produto, dois estoques | um só (Mercado); a loja é um canal dele |
| D23 | `createSale` **confiava no preço da tela** | o pedido manda só produto e quantidade; o preço é o `sale_price` do banco, e só de produtos DESTA arena |
| D24 | A arena **não era avisada** de pedido nenhum — o pedido só aparecia se alguém abrisse a tela da loja por acaso | aviso na hora, com o caminho direto para a aba de pedidos |
| D25 | 🐞 Quem **dividia** a conta sem ser o comprador **não conseguia ler a venda**: não via a própria parte, e `payMyShare` quebrava no primeiro `getDoc` — e o aviso de "sua parte" levava a uma tela que não mostrava a conta | a regra deixa ler quem está em `split_with`; a parte aparece em Minhas reservas e na loja, com "Registrar a minha parte" |
| D26 | 🐞 O comprador podia **criar a venda já "paga" e "entregue"** — e ela entrava assim no caixa e nos números | o comprador só cria PEDIDO: em aberto e não entregue |
| D27 | 🐞 Quem pagava podia **marcar o próprio pagamento como pago** — o registro que a arena usa para saber se recebeu | quem paga só troca a forma de pagamento ou desiste; "pago" é a arena quem marca |
| D28 | 🐞 Qualquer conta podia **semear "pagamentos" na lista de qualquer arena** | o pagamento tem de ser de uma venda de que a pessoa FAZ PARTE, da mesma arena |
| D29 | 🐞 **A conta dividida fechava como paga com gente devendo**: bastava confirmar o pagamento do comprador, porque só se contavam os documentos existentes | quem deve sai do PEDIDO (`saleShares`), e a conta só fecha com TODAS as partes pagas |
| D30 | 🐞 **Métricas contavam a venda da loja duas vezes** — `revenue.confirmed` já incluía as vendas pagas, e o total somava `revenue_by_source.sales` por cima. Com a entrega virando saída do Mercado, seriam três | o total é reservas + PDV antigo + Mercado + planos e aulas, cada venda uma vez |
| D31 | 🐞 **O pedido de pacote e a entrada no jogo aberto nunca chegavam à arena**: `listArenaManagers` devolve DOCUMENTOS de gestor, e os dois avisos os passavam como destinatários — o aviso era gravado para `"[object Object]"` | `listArenaManagerIds` (uids), com teste que trava a diferença |
| D32 | Não havia como **desistir** de um pedido nem **receber no balcão** a parte de quem não usa o app | "Desistir" (enquanto não foi entregue e não é dividido — a regra confere) e "Recebi no balcão" |
| D33 | Dois cliques em "Entreguei" podiam baixar o estoque duas vezes | a entrega é uma transação que confere se o pedido já foi entregue |

### Banco

**Zero coleção, zero índice.** Campos **opcionais**:

- `arena_inventory_products.sell_online` (só gravado quando marcado) e
  `stock_qty` (a cópia do estoque; vazio = sem controle);
- `arena_inventory_exits.sale_id` e `channel` (só nas saídas geradas pela
  entrega de um pedido — é pelo `sale_id` que o cancelamento acha o que
  desfazer);
- `arena_sales.catalog`, `arena_name`, `delivered_by`, `cancelled_by`;
- `arena_payments.confirmed_by`, `received_at_counter`.

**Regras endurecidas** em `arena_sales` e `arena_payments` (ver D25–D28), com
**20 asserções novas no emulador** em `tests/rules/arenaModules.rules.test.js`
— metade provando o que passou a funcionar (quem divide lê e paga a parte,
quem pediu desiste, a arena segue podendo tudo) e metade o que ficou barrado.
A consulta `split_with array-contains` é provável pela regra (provado no
emulador) e não pede índice composto.


---

## 10. I-7 — Marketing dentro da arena (entregue)

### Onde o marketing está agora

| Lugar | O quê |
|---|---|
| Central → **Marketing** (seção nova, antes de "Pagamentos e loja") | uma aba por ferramenta ligada: **Cupons · Campanhas · Satisfação · Indicações**. Com o módulo pai ligado e nenhuma ferramenta, uma aba só, dizendo onde ligar |
| Central → Marketing → **Cupons** | o cupom ganhou **"Divulgar na página da arena"** — marcado, ele vira PROMOÇÃO; a lista mostra o selo "Na página da arena" |
| Página da arena → **Promoções** | as promoções que ainda valem (ligadas, no prazo, com uso disponível), com a regra em uma linha e o código para copiar — logo depois dos preços, que é onde se decide |
| Pedido de reserva | as promoções em botões ("Promoções: …"): um toque preenche o código e o confere contra o banco com o valor da conta |
| Página da arena → **Indique e ganhe** | o código de quem está logado, criado **quando a pessoa pede** ("Quero meu código"), com copiar e convidar |
| **Você nesta arena** (`/arenas/:id/membros`) | o mesmo cartão de indicação — agora para qualquer pessoa, não só membro |

- `/arenas/:id/gerir/marketing` e `/arenas/:id/marketing` levam a
  `?secao=marketing`; `marketing` é `native` no catálogo (sem botão de atalho).
- A pesquisa de satisfação ao atleta já morava na página da arena
  (`ArenaNpsAsk`, Onda AJ) e continua lá; os pontos, em "Você nesta arena".
- Cupom **não divulgado** continua sendo o que era: um código que a arena
  entrega a quem quiser. Ele nunca aparece na página nem no pedido.

### Por que "divulgar" não expõe nada novo

`arena_coupons` já era legível por qualquer conta logada — é assim que o pedido
de reserva confere o código digitado. `show_public` não abre leitura nenhuma:
só diz à TELA quais cupons ela pode oferecer. A conferência continua no
serviço, contra o banco, antes de gravar (Onda AJ).

### 🐞 O documento que ainda não existe

Ao ligar o "Indique e ganhe" à página da arena, o código não aparecia — nunca.
A causa não era da tela, e não era só da indicação:

Membro, carteira, mensalidade e indicação têm **id determinístico**
(`{arena}_{uid}`), e o código pergunta "já existe?" com um `get` antes de
criar. A regra de leitura dessas quatro coleções olha `resource.data` — e num
documento que não existe `resource` é **nulo**. O `get` não devolvia "não
existe": dava **erro de permissão**, para o próprio atleta **e para a arena**.
Medido no emulador antes de corrigir:

| # | O que quebrava | Onde |
|---|---|---|
| D34 | 🐞 O código "Indique e ganhe" **nunca era criado**, para ninguém — a tela sumia sem aviso | `getOrCreateReferralCode` lia antes de criar |
| D35 | 🐞 **A arena não conseguia vender pacote a quem ainda não era membro** — o caso normal do pedido de pacote da Onda BI | `sellPackageToMember` → `getArenaMember` |
| D36 | 🐞 **O primeiro crédito em carteira era recusado** (indicação, resgate de pontos, crédito manual) — duas vezes: a leitura prévia, e a carteira nova era gravada **sem `arena_id`**, que é o campo que a regra de criação confere | `creditWallet` |
| D37 | 🐞 **Quem não era membro e usava saldo numa reserva não tinha o saldo debitado**: na confirmação, os pontos da visita tentavam criar um documento de membro sem `arena_id`, a regra recusava, e o lote inteiro caía — a baixa do saldo junto | `consumeMemberBenefit` |
| D38 | 🐞 **Tornar membro zerava a carteira**: os dois `setDoc` eram sem `merge`, então o saldo e as horas pagas de quem voltava (ou de quem ganhou crédito de indicação antes) eram regravados como zero — e incluir de novo quem já era membro zerava os pontos | `addArenaMember` |
| D39 | Toda visita de não membro à página de uma arena com membros gerava **três leituras recusadas** (membro, carteira, mensalidade), com as novas tentativas do React Query por cima | `useArenaMember`, `useArenaWallet`, `useMemberSubscription` |

**A correção é uma regra aditiva**, `canGetMissingArenaUserDoc`, nas quatro
coleções: o `get` de um documento **que não existe** é permitido ao dono do uid
do id, à arena do prefixo e ao admin — e a ninguém mais. Documento ausente não
tem dado para vazar; mesmo assim a regra não serve a estranhos, não abre
documento EXISTENTE de ninguém e não muda nenhuma consulta (lista). Os ids de
arena são automáticos (sem `_`); se um dia não forem, a conta **nega** — nunca
libera. **28 asserções novas no emulador**
(`tests/rules/arenaUserDocs.rules.test.js`), metade provando o que passou a
funcionar e metade provando o que continua barrado.

E três correções de código, com teste: a carteira nova nasce com `arena_id` e
`user_id`; os pontos da reserva só vão para quem **já é** membro (virar membro
é decisão da arena, não efeito de uma reserva); e `addArenaMember` ficou
idempotente — não regrava membro existente nem carteira existente.

> **A lição.** Os testes de serviço usam um banco falso que nunca recusa
> nada, e por isso seis fluxos "prontos" passavam em verde sem nunca terem
> funcionado. Leitura por id determinístico **antes de criar** é o padrão que
> esconde isso: sempre que o documento pode não existir, a regra precisa dizer
> quem pode perguntar — e isso só se prova no emulador.

### Banco

**Zero coleção, zero índice.** Um campo **opcional**:
`arena_coupons.show_public` (só `true` divulga; ausente = não divulgado, que é
como todo cupom anterior continua). **Uma regra aditiva** em `arena_members`,
`arena_wallets`, `arena_subscriptions` e `arena_referrals` (`allow get` de
documento inexistente, ver acima). Nada foi migrado.

---

## 11. I-8 — Operação, presença e avançado dentro da arena (entregue)

Com esta parte, **todo módulo de arena que tem tela está integrado**: nenhum
vira mais botão para fora da arena.

### Onde cada ferramenta está agora

| Ferramenta | Antes | Agora |
|---|---|---|
| Resumo do dia, rotinas, manutenção, alerta de estoque (`operations`) | página `/gerir/operacoes` | seção **Operação** da Central: **Hoje · Rotinas · Manutenção** |
| Equipamentos (`iot`) | página "Avançado" | Operação → **Equipamentos** |
| Plantão — quem trabalha na arena (`operations_staff`) | página de operações | Equipe e parceiros → **Plantão** |
| Presença e faltas (`iot_qr_kiosk`) | página `/gerir/presenca` | Reservas → **Presença** ("Abrir o totem" ali mesmo) |
| Marca (`white_label`) | página "Avançado" | Perfil → **Marca** |
| Inteligência (`ai`) | página "Avançado" | Desempenho → **Inteligência** |
| Rede (`multi_unit`) | página "Avançado" | Desempenho → **Rede** — e, para o atleta, **"Outras unidades da rede"** na página da arena |

- A página **"Avançado" deixou de existir**: era uma gaveta de quatro coisas
  sem nada em comum além de terem chegado por último. `/gerir/avancado` e
  `/avancado` levam à primeira dessas ferramentas que estiver ligada (ou aos
  módulos, se nenhuma estiver).
- `/gerir/operacoes` → `?secao=operacao`; `/gerir/presenca` → `?aba=presenca`.
  O totem aponta direto para a aba.
- "Hoje" existe sempre que o módulo de operação está ligado. Cada número do
  resumo **leva à aba que resolve** (rotinas, manutenção, mercado, plantão), e
  cada aba só busca o que mostra — abrir Rotinas não consulta a manutenção nem
  a equipe.
- A seção Operação existe também só com os equipamentos ligados.
- O lado do atleta já tinha "Chegou?" (`ArenaCheckinAsk`) e a marca na página
  da arena; o que faltava era a **rede**: agora a página mostra as outras
  unidades, com link. Ela **não** promete que o plano vale nas outras
  unidades — o benefício cruzado é outro módulo, e a reserva não faz essa conta.
- `operations`, `iot`, `iot_qr_kiosk`, `multi_unit`, `white_label` e `ai` são
  `native` no catálogo. `ArenaModuleShortcuts` fica como **rede de segurança**:
  com o catálogo de hoje ele não mostra nada, e módulo NOVO com rota ganha a
  porta sozinho em vez de nascer inalcançável. Um teste reprova módulo com
  tela que não esteja marcado como integrado.

### 🐞 Falha não é vazio — e na equipe, era apagar

As telas levadas para a Central tratavam falha de leitura como lista vazia.
Na operação, isso é pior que em qualquer outro lugar, porque quem abre de
manhã confia no que lê e não confere a arena:

| # | O que a tela dizia com a consulta falhando | Consequência |
|---|---|---|
| D40 | **"Nada pendente. A rotina do dia está em dia."** | a abertura não é conferida |
| D41 | 🐞 **"Ninguém cadastrado"** no plantão, com "Cadastrar a equipe" | a equipe é UMA lista gravada inteira: salvar regravaria só a pessoa nova, **apagando a equipe existente** |
| D42 | "Nenhuma rotina ainda" com "Criar a primeira" | rotina duplicada |
| D43 | "Esta arena não faz parte de uma rede" com "Criar rede" | rede duplicada |
| D44 | "Nenhum produto abaixo do mínimo" | a água acaba no sábado |
| D45 | "Ainda não há histórico para ler", "Nenhum equipamento", "Nenhuma reserva confirmada neste dia" (com taxa de falta de um dia vazio) | números de um dia que não aconteceu |

Agora cada uma mostra `V2ErrorState` com "Tentar de novo", e os comandos que
dependem de ver o estado (editar a equipe, criar rotina, criar rede, marcar
faltas) **não aparecem** enquanto a leitura não voltar. Há teste para cada caso.

### Banco

**Zero.** Nenhuma coleção, campo, índice, regra ou função.

## 12. "Nesta página" — o índice da página da arena (Onda BT, 2026-09-25)

A integração (I-1 a I-8) trouxe os módulos para dentro da página da arena, e
ela ficou longa: dia de jogo, jogos abertos, reserva, regras, contato, torneios
da casa e da plataforma, aulas, preços, promoções, planos, loja, fotos,
avaliações e quadras. Quem chegava procurando a aula ou a loja rolava a página
inteira, e boa parte do que a integração trouxe ficava abaixo da dobra.

Agora há um índice **"Nesta página"** logo abaixo do cabeçalho
(`v2/components/arenas/ArenaPageIndex.jsx`):

- **Só aparece o que renderizou.** Cada seção vem num envoltório com um `id`
  estável e o rótulo em `data-secao-arena`, e o índice lê o DOM. Envoltório sem
  texto (módulo desligado, seção sem o que mostrar) não vira atalho. Assim o
  índice não promete o que a página não tem, e não precisa perguntar a cada
  módulo se ele está ligado: as seções já decidem isso sozinhas.
- **Seção que chega depois entra.** Cada módulo tem a sua consulta; um
  `MutationObserver` junta as mudanças de um quadro numa leitura só.
- Com menos de 3 seções, o índice some. Tocar num atalho rola até a seção,
  sem criar entrada no histórico.
- **Âncoras servem a links de fora.** `/arenas/:id#arena-planos` rola até a
  seção quando ela aparece, uma vez por âncora (uma âncora nova na mesma página
  rola de novo). O aviso "Pacote de horas creditado" já leva direto a Planos.

Ids: `arena-dia-de-jogo`, `arena-jogos-abertos`, `arena-reservar`,
`arena-regras`, `arena-contato`, `arena-torneios-da-casa`, `arena-torneios`,
`arena-aulas`, `arena-precos`, `arena-promocoes`, `arena-planos`, `arena-loja`,
`arena-fotos`, `arena-avaliacoes`, `arena-quadras`. **Um id publicado em
link é contrato**: renomear quebra o link sem erro nenhum. Há guarda de fonte
em `ArenaPageIndex.runtime.test.jsx`.

**Ao acrescentar uma seção à página da arena**: envolva-a com
`<div id="arena-…" data-secao-arena="Rótulo" className="scroll-mt-4">`. Sem
isso ela funciona, mas não entra no índice.

Zero banco.
