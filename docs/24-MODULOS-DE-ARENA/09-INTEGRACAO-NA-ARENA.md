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
| I-4 | Receita de aulas, planos e torneios no painel de métricas | ⏳ |

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

