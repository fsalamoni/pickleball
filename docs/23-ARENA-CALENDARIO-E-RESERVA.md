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

## 6. O que foi conferido e está certo

Vale registrar para a próxima auditoria não refazer o caminho:

- o filtro de quadra do diálogo já recebe **só as quadras ativas**;
- indisponibilidade sem `court_id` bloqueia **todas** as quadras, e os três
  leitores (status de slot, calendário, conflito de reserva) concordam nisso;
- dia passado não é clicável em nenhum calendário;
- o dia de jogo fecha a quadra por `arena_unavailabilities`, então o conflito
  de reserva já o respeita sem código novo.

## 7. Onde mexer

```
src/modules/arenas/domain/slot_status.js      # slotEndTime (+12 asserções)
src/modules/arenas/domain/court_schedule.js   # courtScheduleStatus (+10)
src/v2/components/arenas/CourtTimePicker.jsx  # a matriz do atleta (+14 testes)
src/v2/components/arenas/V2DaySlotsDialog.jsx # ordem, visões, legenda
src/v2/components/arenas/V2BookingCalendar.jsx# legenda viva, arena sem horário
src/v2/components/arenas/V2ArenaCalendar.jsx  # dia de jogo no mês da arena
src/v2/components/arenas/V2CourtsTab.jsx      # horário na linha + aviso
src/v2/pages/V2ArenaManage.jsx                # painel de prontidão
```

**Banco de dados: nada.** Nenhuma regra, coleção, índice, Cloud Function ou
configuração foi tocada nesta rodada — só leitura do que já existia.
