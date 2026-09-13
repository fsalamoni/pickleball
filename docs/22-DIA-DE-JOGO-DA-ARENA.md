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

## 🐞 O dia de jogo que não fechava a quadra (2026-09-13)

**O sintoma.** Um dia de jogo marcado das 18h às 22h nas três quadras, e o
calendário da arena oferecendo 18h, 19h, 20h e 21h como **livres** nas três.
O aviso aparecia ("as quadras usadas ficam fechadas para reserva neste
horário") e a grade dizia o contrário — o pior dos dois mundos.

**A causa de fundo.** Marcar um dia de jogo GRAVA uma cópia em
`arena_unavailabilities` (`source: 'game_day'`), e era **só essa cópia** que o
calendário olhava. Cópia é ótima para compatibilidade — conflito de reserva,
status de slot e calendário mensal passaram a respeitar o dia de jogo sem uma
linha de código nova — e péssima como ÚNICA verdade: se a gravação não chegou,
nada no sistema sabe do dia de jogo, e ninguém percebe até alguém aparecer na
arena com uma reserva inútil.

**A correção, em três alturas.**

1. **O dia de jogo é a FONTE.** `gameDayBlocks` / `mergeGameDayBlocks`
   (domínio, testados) derivam os bloqueios do próprio dia de jogo, no mesmo
   formato de `arena_unavailabilities`. O calendário mensal, a grade do dia e a
   matriz quadra × horário passam a somar os gravados **com** os derivados,
   sem duplicar o que já existe. Se a cópia falhar, a tela ainda acerta.
2. **O pedido de reserva confere.** O serviço só olhava outras RESERVAS —
   nunca os bloqueios. O calendário escondia o horário fechado, mas o
   formulário completo ("Solicitar reserva", em que a pessoa digita data e
   hora) não passa pelo calendário: dava para pedir exatamente a quadra
   fechada. Agora `checkUnavailabilityConflict` recusa, **dizendo o motivo** —
   e, quando é dia de jogo, apontando a saída ("marque presença").
   Vale nos três caminhos: reserva simples, seleção múltipla e a reserva
   manual que a própria arena lança.
3. **A flag não decide ocupação.** O calendário só carregava os dias de jogo
   com `arena_game_day` ligada. Um dia de jogo existe ou não existe; condicionar
   o BLOQUEIO a uma flag é oferecer para reserva uma quadra que já tem gente
   marcada nela. A flag voltou a gatear só o que se MOSTRA (o selo no dia, a
   legenda).

**Cuidado que veio junto.** O bloqueio derivado não tem documento no banco, e
a tela da arena tinha um botão "Remover indisponibilidade" que apagaria o nada
— com a agravante de que apagar a cópia GRAVADA abriria a quadra com o dia de
jogo ainda marcado nela. Agora a arena vê "Dia de jogo da arena", a explicação
e um caminho para o dia de jogo; apagar à mão, só o que ela marcou à mão.

## Uma tela, uma lista (2026-09-13)

A página do dia de jogo da arena mostrava **o mesmo card "Organização" duas
vezes** (a página renderizava o seu, e o organizador — o mesmo miolo do
ambiente do atleta — renderizava outro) e **duas listas das mesmas pessoas**:
"Inscritos", em cima, que só sabia remover, e "Participantes", embaixo e
recolhido, que é onde moram formar dupla, pausar e excluir. Quem chegava
parava na primeira e concluía que a plataforma não fazia o resto.

- o card de organização sai **só do organizador**, para quem
  `useGameDayRoles` diz que pode configurar — o que já inclui o gestor da
  arena, então ninguém perdeu acesso;
- "Inscritos" virou **"Vagas"**: números, limite por dia ou por quadra, quem
  está em cada quadra no modo por quadra (informação da arena que não existe
  em nenhum outro lugar) e uma linha dizendo onde estão as ações;
- e `20/18 inscrito(s)` — que acontece de verdade, porque a arena pode
  INSERIR atletas pela lista de participantes sem passar pelo limite — passou
  a dizer `2 acima do limite` em vez de deixar a conta estranha no ar.
