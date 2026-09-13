# Arena: calendário, reserva e prontidão

> **Flags**: nenhuma nova · **Banco de dados**: nada tocado (nem regra, nem
> índice, nem coleção) · **Rotas**: as de sempre.

Auditoria de ponta a ponta da experiência de arena — o que o atleta vê para
reservar e o que a arena vê para gerenciar. Este documento registra **o que
estava errado e por quê**, para que as correções não sejam desfeitas por
engano.

---

## 1. 🐞 O bug que gerava reserva de nove horas

**Onde**: `V2DaySlotsDialog`, ao selecionar um horário.

O fim do slot era calculado como **"o próximo horário da grade"**. Numa arena
com horário **partido** — manhã e noite, que é o caso comum — a grade do dia é:

```
08:00  09:00  18:00  19:00  20:00  21:00
        └── selecionar aqui dava fim às 18:00
```

Ou seja: quem clicasse nas 09:00 pedia uma reserva **das 09:00 às 18:00**. Nove
horas, com o preço e a ocupação de quadra correspondentes.

Havia um segundo erro, mais silencioso, nos dois calendários (atleta e admin):
`hora + 1` cego. Numa janela que fecha às **21:30**, a grade termina em 21:00 e
o slot ia até 22:00 — meia hora **além** do fechamento da arena.

**Correção**: a conta virou domínio testado —
`slotEndTime(time, { date, schedules })` em
`src/modules/arenas/domain/slot_status.js`. Uma passada do passo, **limitada
pelo fim da janela** que cobre aquele horário, sem nunca virar o dia. Usada nos
três lugares que faziam a conta à mão.

> **Ao mexer**: nunca derive o fim de um slot da posição na lista. A lista tem
> buracos.

## 2. "2 de 3 quadras livres" — livres QUAIS?

O calendário do atleta só sabia mostrar uma lista de **horários**. Com "Todas
as quadras", um horário livre aparecia como `2/3 quadras` — um número que não
diz onde. Quem quisesse a quadra coberta, ou a quadra 1 de sempre, tinha de
trocar o filtro do topo **uma vez por quadra** e comparar de cabeça.

O admin já tinha a matriz quadra × horário (`CourtDayGrid`). O atleta, não.

**Correção**: `CourtTimePicker` — a matriz do atleta, com um seletor
**Por horário / Por quadra** no diálogo do dia (aparece só com mais de uma
quadra e sem filtro de quadra, porque aí ela seria uma coluna só).

A matriz do atleta **não é a do admin**, e a diferença não é cosmética:

| | admin (`CourtDayGrid`) | atleta (`CourtTimePicker`) |
|---|---|---|
| nome de quem reservou | mostra | **não mostra** — para reservar basta saber que está ocupado |
| o que é clicável | tudo (é operação) | **só o que está livre** |
| efeito do clique | seleciona célula | **escolhe a quadra** e o horário |

**Uma reserva, uma quadra.** Escolher um horário em outra quadra recomeça a
seleção, com aviso — misturar quadras produziria um pedido que a arena não
teria como atender inteiro. A quadra escolhida na matriz agora **chega ao
pedido de reserva e ao preço**; antes o pedido abria em "qualquer quadra" e a
escolha se perdia no último passo.

## 3. O diálogo do dia pedia para rolar antes de reservar

A ordem era: resumo → **reservas de outras pessoas** → indisponibilidades →
grade de horários. Quem abriu o diálogo veio **reservar**; num dia movimentado,
precisava rolar por uma lista de reservas alheias para chegar ao que
interessava.

**Correção**: a grade vem logo depois do resumo. As listas viraram contexto,
abaixo.

Junto:

- **"Sem horários livres" deixou de ser uma parede.** Antes, a grade inteira
  sumia e sobrava um aviso. Agora o aviso fica **acima** da grade, que
  continua visível: ver a forma do dia (o que está reservado, o que está
  bloqueado) é meio caminho para escolher outro dia com consciência.
- **As legendas mostram só as cores que estão na tela.** Listar "Concluído" e
  "Fechado" num dia que não tem nem um nem outro é ruído — e ruído ensina a
  ignorar a legenda. Vale para o diálogo do dia e para o calendário mensal.

## 4. 🐞 A quadra invisível

**O pior problema operacional da arena, e o mais silencioso.**

Uma quadra **sem janela de horário** não existe para o atleta: não entra no
calendário, não aceita reserva, não entra em dia de jogo. E **nada dizia isso
ao dono**. Ele cadastrava a quadra, ela sumia da página pública, e a única
forma de descobrir era alguém reclamar de não conseguir reservar.

**Correção**, em três alturas — porque um aviso que ninguém vê não é aviso:

1. **Na linha da quadra** (Estrutura → Quadras): o resumo do horário
   (`Seg–Sex 18:00–22:00`) ou, quando não há, um link em âmbar
   **"Sem horário — defina para aceitar reservas"** que abre o modal certo;
2. **No topo da aba Quadras**: quantas quadras estão nessa situação e quais;
3. **No topo da Central da arena**, antes das abas: um painel
   **"Falta isto para a arena receber reservas"**, que também cobre o caso de
   não haver nenhuma quadra ativa. Some quando não há pendência — um painel
   verde permanente de "está tudo certo" só ocuparia espaço.

Domínio: `courtScheduleStatus(schedules, courtId)` e
`courtsWithoutSchedule(courts, schedules)` em `court_schedule.js`. Uma janela
**sem `court_id` vale para a arena inteira** (é como o resto do sistema já lê),
e quadra **inativa nunca vira alarme** — a arena a desligou de propósito.

Do outro lado do balcão, o atleta também deixou de ver um mês cinza sem
explicação: o calendário diz **"esta arena ainda não publicou os horários"** ou
**"ainda não cadastrou quadras"**, conforme o caso.

## 5. O calendário da arena não mostrava o que a arena marcou

O **dia de jogo da arena** (`docs/22-DIA-DE-JOGO-DA-ARENA.md`) ocupa quadra e
fecha horário. Ele aparecia no calendário do **atleta** e não no da **arena** —
que via um mês de reservas sem o que ela mesma tinha marcado, com dias
aparentemente vazios que na verdade estavam tomados.

**Correção**: o calendário da arena (Reservas → Calendário) marca o dia com o
horário do dia de jogo, pinta a célula e conta os dias de jogo no resumo do mês.

## 6. O fluxo de reserva: duas telas, nenhuma pergunta repetida

**O problema.** Reservar eram duas telas, e a segunda **re-perguntava tudo o
que a primeira já tinha respondido**. A pessoa escolhia o dia no calendário e
os horários na grade; então abria um formulário pedindo **de novo** data,
horário, modo de quadra (*qualquer / específicas / todas*) e tipo (*avulso /
recorrente*) — num vocabulário diferente, e com as duas respostas podendo se
contradizer. Era o ponto em que reservar ficava confuso e difícil.

**E uma limitação escondida.** `createBooking` grava uma reserva por quadra,
mas **todas compartilham a mesma lista de horários**. Então "Quadra 1 às 19h e
Quadra 2 às 20h" não cabia num pedido: ou virava duas chamadas (com o risco de
a segunda falhar depois de a primeira já existir), ou obrigava a pedir o mesmo
horário em todas as quadras. Não era limitação de banco — era uma conta que
faltava.

### O fluxo hoje

```
calendário (o DIA) → grade (QUADRA e HORÁRIOS) → confirmar
(avulsa ou recorrente, observações, convidados) → pedido enviado
```

A segunda tela **confirma**, não re-pergunta: mostra a escolha agrupada por
quadra e faz só as perguntas que sobraram. Passa a receber `selection` em vez
de `preselectedSlots` + modo de quadra + ids.

> O caminho do botão **"Solicitar reserva"** da página da arena (sem seleção
> prévia) continua com o formulário completo, **idêntico** — lá nada foi
> escolhido ainda. Há teste travando os dois modos.

### Escolher quantas quadras e horários quiser

A matriz quadra × horário virou o **padrão** quando há mais de uma quadra (é o
que a pessoa vem fazer: escolher onde e quando). Cada célula liga e desliga
sozinha — inclusive horários diferentes em quadras diferentes.

A conta que faltava mora em `domain/bookingSelection.js`. A escolha vira uma
lista de **células** (`{ court_id, date, start, end }`, com `court_id: null`
significando "tanto faz"), e `groupSelectionByCourt` a traduz para o que o
serviço grava:

| escolha | grupos | resultado |
|---|---|---|
| 1 quadra, 2 horários | 1 | 1 reserva com 2 horários |
| 2 quadras, os mesmos horários | 1 | 2 reservas (uma por quadra) |
| 2 quadras, horários diferentes | 2 | 2 reservas, cada uma com o seu |
| "tanto faz" + quadra escolhida | 2 | nunca se misturam |

`createBookingsForSelection` (serviço) carrega reservas/quadras/janelas **uma
vez**, valida **todos** os pares quadra × horário **antes de escrever nada** e
grava num **único lote** com um `booking_group_id` comum. Tudo ou nada: nunca
sobra meia reserva. O documento gravado tem exatamente a forma de sempre —
**nenhum campo novo, nenhuma coleção nova**.

Duas linhas de "tanto faz" no mesmo horário não caem na mesma quadra: a
atribuição automática considera o que o próprio lote já vai ocupar.

### Recorrência: repete o que foi escolhido

"Toda semana, por N semanas" repete **a escolha inteira** (+7, +14… dias), não
um horário só. O metadado `recurrence` (que tem um `start`/`end` único) só é
gravado quando é **verdade** — um horário só, numa quadra só. Com vários, fica
`null`, e a verdade completa vai na lista de horários, que é o que as telas já
leem. Inventar um `start` ali seria mentir num campo que alguém vai exibir.

## 7. O que foi conferido e está certo

Vale registrar para a próxima auditoria não refazer o caminho:

- o filtro de quadra do diálogo já recebe **só as quadras ativas**;
- indisponibilidade sem `court_id` bloqueia **todas** as quadras, e os três
  leitores (status de slot, calendário, conflito de reserva) concordam nisso;
- dia passado não é clicável em nenhum calendário;
- o dia de jogo fecha a quadra por `arena_unavailabilities`, então o conflito
  de reserva já o respeita sem código novo.

## 8. 🐞 O preço de UMA hora gravado como total

Selecionar três horários somava na tela — e a reserva chegava à arena valendo
**uma hora**. Depois o mesmo número reaparecia na lista do dia: várias quadras
pendentes, todas com o preço de uma hora.

Não era erro de exibição. `resolveArenaPrice` devolve o valor **por hora**, e
era esse número que as telas mandavam como `proposed_price`. O que estava
**gravado** estava errado.

A conta virou domínio:

```js
totalBookingPrice(arena, { courtId, slots, clientId })
// → { total, hours, minutes, hourlyRates, breakdown }
```

Cada horário é cobrado pela **sua** faixa (das 18h às 20h com tabela diferente
às 19h, a soma respeita as duas), e o serviço a **refaz antes de escrever** —
a tela pode estimar, quem grava confere. Vale para os dois caminhos:
`createBooking` e `createBookingsForSelection`, documento a documento.

Para o que já estava gravado, `bookingPriceInfo(booking, { arena })` recalcula
na leitura: o valor acordado vence sempre; havendo arena em mãos, o total sai
da tabela; sem ela, sai o gravado — **nunca sem a duração ao lado**, porque
"R$ 80" sozinho pode ser lido como a hora ou como o total. A linha de reserva
do atleta busca a arena por conta própria (consulta por id, cacheada e
compartilhada entre as linhas da mesma arena), para que a MESMA reserva mostre
o MESMO número dos dois lados do balcão.

## 9. A ocupação que a bolinha não contava

Duas coisas erradas no calendário mensal da página da arena:

**1. Uma reserva lotava a arena inteira.** A agregação do dia tratava a arena
como se fosse UMA quadra: bastava uma reserva às 19h numa quadra para as 19h
contarem como ocupadas — com as outras duas livres. Num mês cheio de reservas
esparsas, a arena aparecia vermelha estando quase vazia.

Agora `aggregateDayStatus` aceita `courts` e conta em **horas-quadra**: cada
par (quadra, horário) vale um. `freeTimes` diz em quantos HORÁRIOS ainda há ao
menos uma quadra livre — é a pergunta de quem está marcando — e `occupancy` é
a fração ocupada. Sem `courts`, o retorno é bit a bit o de antes (há teste).

**2. "Tem vaga" e "está quase vazio" eram a mesma bolinha.** Um dia com um
horário livre e um dia inteiro livre saíam idênticos, e a pessoa tinha de abrir
um por um. Cada dia passou a mostrar uma **barra proporcional** (verde livre,
âmbar pendente, vermelho reservado, laranja bloqueado) e o rótulo `4h livres` —
ou `Lotado`, ou `Bloqueado`, que **não** é a mesma coisa. Os dois números que
havia ali antes saíram: eram horas contadas como se fossem reservas.

E o mês ganhou resumo: *"2 dias com horário livre em julho"*. Quando não há
nenhum, a tela deixa de ser um beco — diz que não há e oferece **o próximo dia
livre** (`findFirstFreeDate`, até 180 dias), em vez de deixar a pessoa clicando
"próximo mês" no escuro.

De quebra, as reservas e os bloqueios passaram a ser indexados por data
(`indexBookingsByDate`). A grade faz 42 dias × quadras consultas de status, e
cada uma varria a lista inteira da arena; o resultado é o mesmo, o custo não.

## 10. O resumo do dia contava horários e dizia "solicitações"

No diálogo do dia, `2 solicitações em andamento` eram na verdade DOIS
HORÁRIOS — com várias quadras, um horário ocupado não é uma reserva. Agora
tudo ali é contado e dito em horários (`2 horários com solicitação em
andamento`), e com mais de uma quadra o verde diz `com quadra livre`, que é o
que ele mede.

## 11. Onde mexer

```
src/modules/arenas/domain/bookingSelection.js # a escolha como dado (+33)
src/modules/arenas/services/bookingService.js # createBookingsForSelection
src/modules/arenas/components/BookingRequestDialog.jsx  # modo confirmação (+12)
src/modules/arenas/domain/slot_status.js      # slotEndTime (+12 asserções)
src/modules/arenas/domain/court_schedule.js   # courtScheduleStatus (+10)
src/v2/components/arenas/CourtTimePicker.jsx  # a matriz do atleta (+14 testes)
src/v2/components/arenas/V2DaySlotsDialog.jsx # ordem, visões, legenda
src/v2/components/arenas/V2BookingCalendar.jsx# ocupação do mês, próximo dia livre
src/modules/arenas/domain/calendar_aggregate.js# conta por quadra, índices (+20)
src/modules/arenas/domain/pricing.js           # totalBookingPrice (+14)
src/v2/components/arenas/V2BookingRow.jsx      # valor total, com duração
src/v2/components/arenas/V2AdminBookingCalendar.jsx # idem, no slot da arena
src/v2/components/arenas/V2ArenaCalendar.jsx  # dia de jogo no mês da arena
src/v2/components/arenas/V2CourtsTab.jsx      # horário na linha + aviso
src/v2/pages/V2ArenaManage.jsx                # painel de prontidão
```

**Banco de dados: nada.** Nenhuma regra, coleção, índice, Cloud Function ou
configuração foi tocada em nenhuma destas rodadas — só leitura do que já
existia. O preço corrigido é gravado no campo que **já** existia
(`proposed_price`), com o valor certo; nenhum dado histórico foi reescrito.
