# Dia de jogo da arena

> **Flag**: `arena_game_day` (default **OFF**) ·
> **Rotas**: `/arenas/:arenaId/gerir/dia-de-jogo[/:gameDayId]` (arena) e
> `/dia-de-jogo/:id` (atleta, a de sempre) ·
> **Coleções novas**: nenhuma.

---

## 1. O que é

A arena marca o próprio dia de jogo **no calendário**. Ao marcar, a data e as
quadras escolhidas **ficam fechadas para reserva**. Os atletas veem o dia na
página da arena (e marcado no calendário) e **confirmam presença** ali. A arena
define horário do dia todo ou por quadra, quantos atletas cabem (no dia, por
quadra, ou sem limite) e se só a equipe conduz as partidas.

Depois disso, é **o dia de jogo de sempre**: sorteio, fila do Play, placar do
Americano, ranking do dia, telão, publicação no ranking da plataforma.

## 2. A decisão que sustenta tudo: nenhuma coleção nova

Um dia de jogo de arena **é um `game_days`** com campos aditivos:

| Campo | O quê |
|---|---|
| `arena_id` | a arena dona. **Ausente ⇒ dia de jogo do atleta**, idêntico ao de antes |
| `arena_name`, `arena_city`, `arena_state` | desnormalizados, para cartões |
| `arena_slots` | `[{ court_id, court_name, start_time, end_time, capacity }]` |
| `signup_mode` | `'day'` (uma lista) ou `'court'` (uma lista por quadra) |
| `capacity` | teto do dia; `null` = sem limite |

A tentação era criar `arena_game_days` e recomeçar. Seria um erro caro:
participantes, sorteio, Play, Americano aprimorado, ranking do dia, telão,
publicação no ranking e os tutoriais **já existem e são testados**. Duas
implementações divergiriam na primeira correção — e o pedido foi exatamente "o
dia de jogo, **como existe**, dentro das arenas".

O corolário prático: **o ambiente do atleta não precisou de nada novo.** Quem
marca presença passa a ver o dia em `/dia-de-jogo`, abre a mesma tela e — se a
arena abriu a gestão — conduz as partidas com os mesmos comandos.

## 3. Como o calendário fecha

Nada foi ensinado ao calendário. O dia de jogo grava uma
**`arena_unavailabilities` por quadra/faixa**, marcada com `source: 'game_day'`
e `game_day_id`. A partir daí, o que já existia passa a valer sozinho:

- `checkBookingConflict` recusa reserva que bate com o dia de jogo;
- `getSlotStatus` marca o slot como indisponível;
- o calendário mensal (admin e atleta) mostra o dia ocupado.

Arquivar o dia **apaga os bloqueios** e as quadras voltam a ficar livres.
`syncArenaGameDayBlocks` só toca documentos com `game_day_id` — um bloqueio
manual da arena nunca é mexido.

Em cima disso, a tela acrescenta o que faltava: o **motivo**. O calendário do
atleta ganha o selo "Dia de jogo" no dia, e o diálogo do dia abre com o nome e
o horário — sem isso, quem clicasse veria "indisponível" e concluiria que a
arena fechou sem razão.

## 4. Mais de um dia de jogo na mesma quadra

Permitido, desde que em **horários diferentes**. `findGameDayOverlaps` confere
quadra a quadra, e **encostar não é sobrepor**: 18h–20h e 20h–22h convivem.
A mesma conferência roda contra as **reservas** já existentes
(`checkBookingConflict`), antes de gravar.

## 5. Inscrição

| Modo | Onde o atleta entra | Teto |
|---|---|---|
| `day` | no dia | `capacity` (null = sem limite) |
| `court` | na quadra que escolher | `capacity` de cada slot |

No modo por quadra, o dia só está **lotado** quando **todas** as quadras estão —
e uma quadra sem limite nunca enche, então o dia também não.

Quando não dá para entrar, a tela **diz o motivo** (`canSignUpToArenaGameDay`
devolve `{ ok, reason, message }`). Botão desabilitado sem explicação é a pior
resposta possível.

> **O teto não é barreira de segurança.** A regra do Firestore não conta
> documentos de subcoleção. O limite é conferido no domínio e **reconferido no
> serviço** lendo a lista no instante da inscrição — o que fecha o uso normal e
> o clique repetido, mas duas inscrições exatamente simultâneas podem estourar
> o teto em um. A arena vê e remove quem sobrar.

## 6. Quem pode o quê

Três caminhos, somados em `gameDayRoles.js` e repetidos na regra:

1. **o criador** — quem clicou em criar;
2. **os administradores nomeados** (`admin_uids`);
3. **quem gerencia a ARENA** — só quando o dia tem `arena_id`.

O terceiro é o que faz a arena ser dona do evento: quem virou gestor **depois**
administra o dia, e o dia não fica órfão se quem o criou sair da equipe.
Gerenciar uma arena **não** dá poder nenhum sobre o rachão de um atleta — a
conferência está no domínio E na regra.

Além disso, a arena escolhe o **modo de gestão** (o mesmo dos outros dias):

- `owner_only` (padrão) — só a equipe da arena e quem ela nomear;
- `participants` — os inscritos também conduzem, **no ambiente deles**.

A tela pergunta uma vez só: `useGameDayRoles(gameDay, participants)` devolve
`podeGerenciar` / `podeConfigurar` para as cinco telas que precisavam disso.
Não custa consulta: `useMyManagedArenas` já é buscado pelo `V2Layout`.

## 7. Onde cada coisa mora

```
src/modules/games/domain/arenaGameDay.js        # regras puras (94 asserções)
src/modules/games/services/arenaGameDayService.js
src/modules/games/hooks/useArenaGameDays.js
src/modules/games/hooks/useGameDayRoles.js      # quem pode o quê, num lugar só
src/v2/pages/V2ArenaGameDays.jsx                # AMBIENTE DA ARENA (18 testes)
src/v2/components/games/ArenaGameDayDialog.jsx  # marcar/corrigir no calendário
src/v2/components/arenas/ArenaGameDaysSection.jsx  # AMBIENTE DO ATLETA (18 testes)
```

Entrada na arena: **Central da arena → Dia de jogo** (atalho no topo, junto de
Módulos e Open Match). Entrada do atleta: a **página da arena**, seção "Dias de
jogo", acima do calendário de reservas.

## 8. Banco de dados

**Nenhuma coleção nova, nenhum índice novo, nenhuma migração.** Campos novos e
opcionais em `game_days`, e documentos comuns em `arena_unavailabilities`.

As regras mudaram em **quatro pontos**, todos aditivos menos um (que era um
bug):

1. `isArenaGameDayManagerOf(gdId)` — helper novo; falso quando não há
   `arena_id`, então **nenhum dia de jogo existente muda de comportamento**;
2. `game_days` (update/delete) e `isGameDayAdminOf` passam a reconhecê-lo;
3. `club_event_games` também — sem isso, só quem clicou em criar conseguiria
   publicar o resultado da arena no ranking;
4. **`arena_unavailabilities` estava quebrada**: a regra era uma só para
   create/update/delete e olhava `request.resource.data.arena_id`, que **não
   existe num delete**. Na prática nenhum gestor conseguia apagar o próprio
   bloqueio, embora a tela oferecesse o botão. Separada em três.

E duas correções na condição de dia de jogo **público**, encontradas ao
implementar a saída da lista:

- **sair era recusado.** Ao remover o participante, o serviço recalcula
  `member_uids`, e a lista nova não tem mais quem saiu — o que reprovava na
  condição "eu tenho de estar na lista nova". A inscrição sumia e a associação
  ficava, com erro na tela. Agora há uma condição exata para sair;
- **entrar era permissivo demais.** Bastava "eu estou na lista nova", então
  qualquer membro podia reescrever `member_uids` e **remover os outros**. Agora
  a lista nova tem de ser exatamente a antiga mais (ou menos) quem pediu.

Tudo isso está preso por **57 asserções no emulador**
(`tests/rules/gameDayRoles.rules.emulator.mjs`), das quais 30 são as que já
existiam.

## 9. Ao mexer, cuidado com

1. **`arena_id` ausente é contrato.** Toda função deste domínio devolve vazio
   ou falso sem ele. É o que garante que o dia de jogo do atleta não mudou.
2. **Dia de jogo de arena é sempre `visibility: 'public'`** — é assim que o
   atleta o enxerga e é o que faz a listagem por `arena_id` passar pela regra
   de leitura. `normalizeArenaGameDayInput` **não devolve** `visibility`, de
   propósito, e há teste travando isso.
3. **A ordem dos dois passos ao arquivar**: arquiva e só então apaga os
   bloqueios. Invertido, uma falha no meio deixaria a quadra livre com o dia
   de jogo ainda de pé.
4. **A ajuda (`/ajuda`) não documenta isto ainda** — a flag está desligada, e
   documentar o que não abre manda a pessoa para uma porta fechada. Ao ligar a
   flag: escrever os artigos da seção **Arena** e a pista de rota em
   `HELP_ROUTE_HINTS`.
