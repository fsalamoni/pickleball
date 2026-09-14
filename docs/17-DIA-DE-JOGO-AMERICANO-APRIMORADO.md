# Americano aprimorado — o dia de jogo partida a partida, com placar

> **Flag**: `gameday_americano_live` (default **OFF**) · **Formato gravado**:
> `americano_live` · **Regras do Firestore**: nenhuma linha nova.
>
> Este documento é a fonte única do formato. Se você vai mexer em dia de jogo,
> leia também `14-DIA-DE-JOGO-TELAO.md` (telão), `15-DIA-DE-JOGO-PERMISSOES.md`
> (quem pode o quê) e `16-DIA-DE-JOGO-RODIZIO.md` (rodízio do Play).

---

## 1. O que é, em uma frase

É o **Americano** — todos jogam com todos e contra todos — **organizado como o
Play**: as partidas nascem **uma a uma, quadra por quadra**, em vez de saírem
todas de uma vez em rodadas.

## 2. Por que existe

O Americano em grade sorteia a rodada inteira: todo mundo entra junto e sai
junto. Isso funciona quando o grupo é fechado e o horário é o mesmo para todos.
Na quadra de verdade não é assim — gente chega atrasada, sai cedo, senta uma
partida, quer jogar com o parceiro de sempre. O Play resolveu isso com fila e
sorteio sob demanda, mas o Play **não grava placar**: não há resultado, ranking
do dia, nem publicação no ranking da plataforma.

O Americano aprimorado é a interseção: a **flexibilidade do Play** com o
**placar do Americano**.

| | Americano (grade) | Play | **Americano aprimorado** |
|---|---|---|---|
| Como as partidas nascem | rodada inteira, de uma vez | uma a uma, por quadra | **uma a uma, por quadra** |
| Placar | sim | **não** | **sim** |
| Ranking do dia | sim | não | **sim** |
| Publicar no ranking/rating/DUPR | sim | não | **sim** |
| Fila, pausa, dupla fixa, entrar/sair a qualquer hora | não | sim | **sim** |
| Campo `round` nos jogos | preenchido | `null` | **`null`** |

## 3. O fluxo que dá nome ao formato: DOIS PASSOS

Na seção de quadras do Play há um botão só, **"Criar próxima partida"**, que
encerra a atual **e** já sorteia a seguinte. Aqui são dois:

```
   [ QUADRA 1 — em quadra ]              [ QUADRA 1 — livre ]
     Ana · Bia  vs  Caio · Davi            Pronta para a próxima partida
     Lado A [ 11 ]   Lado B [ 9 ]
     ▸ Lançar resultado          ───────▶  ▸ Gerar próxima partida
```

1. **Lançar resultado** grava o placar, marca a partida como concluída, devolve
   os quatro ao fim da ordem de participação e **libera a quadra**.
2. Só então a quadra oferece **Gerar próxima partida**.

Isso é deliberado, não um passo a mais por acidente: entre um e outro o
organizador confere que o resultado entrou. Um clique só seria o Play.

> Há teste preso nisso nas duas telas (`americanoLiveOrganizer.runtime.test.jsx`
> e `V2GameDayTelao.runtime.test.jsx`): lançar o resultado **não** pode chamar o
> sorteio. Se alguém "simplificar" para um clique, os testes quebram.

## 4. Como o sorteio escolhe os quatro

`drawNextAmericanoLiveMatch` (`src/modules/games/domain/americanoLive.js`)
funde as duas heranças:

1. **Quem é o primeiro da fila entra, sempre.** A escolha estrita do Play
   (`buildPlayNextMatch`) define o primeiro elegível, e ele **tem** de estar na
   partida. Sem isso, quem espera há mais tempo veria os outros passarem na
   frente em nome do equilíbrio — é o defeito que o rodízio do Play já corrigiu.
2. **Os outros três saem de uma JANELA**, não da fila inteira: os primeiros
   `4 + AMERICANO_LIVE_WINDOW_EXTRA` (hoje 8). Enumeramos as combinações de 4
   dentro dela.
3. **Cada combinação é pareada pelo motor do Americano** (`pairFourBalanced`,
   exportado de `clubs/domain/gameDayDraw.js`), que pesa: parceria repetida
   (peso 10), confronto repetido (peso 3) e diferença de nível (peso 2).
4. **O custo final soma a posição na fila** (`AMERICANO_LIVE_ORDER_WEIGHT`),
   para que "variedade" nunca vire "furar a fila".
5. **Duplas fixas** valem aqui igual ao Play: parceiro mútuo disponível só entra
   junto; parceiro indisponível faz os dois aguardarem.
6. Se nada passar pelos filtros, a rede é a escolha estrita do Play, pareada
   pelo motor do Americano.

O **nível** vem da régua unificada 2.0–8.0 (`docs/13-NIVEL-UNIFICADO.md`), pelo
mesmo `fetchUnifiedLevelsByParticipant` dos outros formatos. A leitura é
best-effort: se falhar, o sorteio acontece sem o critério de nível em vez de
travar o dia de jogo.

### Quantas partidas o dia "pede"

`suggestAmericanoLiveTotal(n) = ceil(n(n-1)/4)` — o número que faria todos
formarem dupla com todos e enfrentarem todos duas vezes. É **referência, não
compromisso**: gente entrando, saindo e pausando muda o número real. A seção
"Como o dia está indo" mostra isso como bússola, com **os dois alvos lado a
lado**: duplas formadas / possíveis ("todos com todos") e confrontos já
repetidos duas vezes / possíveis ("contra todos duas vezes"), além de quem
menos e quem mais jogou. Mostrar só o primeiro escondia metade do que o
sorteio persegue.

> Os dois alvos custam **o mesmo número de partidas**, e é por isso que faz
> sentido persegui-los juntos: com `n` atletas há `C(n,2)` duplas possíveis e
> cada jogo forma 2 ⇒ `n(n-1)/4` jogos; cada jogo cria 4 confrontos e
> enfrentar todos duas vezes pede `2·C(n,2)` ⇒ os mesmos `n(n-1)/4`.

### 4b. A RODADA é escolhida como um todo — e por que isso importa tanto

Sortear **quadra a quadra** é guloso: a primeira quadra fica com o melhor
quarteto possível e a última herda o que sobrou. Com 8 na fila e 2 quadras,
escolher os 4 da quadra 1 já **determina** os 4 da quadra 2 — e o custo desse
grupo que sobra nunca entrou em conta nenhuma.

O efeito é exatamente o que se vê na quadra: **os mesmos jogando entre si a
noite inteira**. Medido em simulação de dia inteiro, elenco estável, com o
número de partidas que o formato pede:

| Atletas | Quadras | Quadra a quadra | Rodada inteira |
|---|---|---|---|
| 8 | 2 | **12** de 28 duplas | **28** de 28 |
| 12 | 3 | **18** de 66 | **66** de 66 |
| 16 | 4 | **24** de 120 | **120** de 120 |
| 16 | 3 | 116 de 120 | 119 de 120 |
| 20 | 2 | 172 de 190 | 183 de 190 |

Os casos catastróficos são os de **número exato** (atletas = 4 × quadras): ali
a fila nunca tem mais de 4 pessoas quando uma quadra libera, e com quatro
pessoas só existe um grupo possível. Não é defeito do motor de pareamento — é
o **momento** em que ele é chamado.

`bestAmericanoLiveRound` (privada, em `americanoLive.js`) resolve escolhendo a
divisão da fila em `k` grupos de 4 que minimiza o custo da **rodada**:

1. **Semente**: o sorteio guloso de hoje, quadra a quadra. Assim a rodada
   nunca sai pior que a de antes, e já nasce respeitando duplas fixas e o
   primeiro elegível.
2. **Melhoria**: trocas de dois em dois — um jogador de um grupo por um de
   outro, ou por alguém que ficou de fora da janela da rodada — enquanto
   baixarem o custo total. Para quando nenhuma troca melhora.

Os grupos de uma rodada são **disjuntos**, então as duplas e confrontos que a
quadra 1 cria envolvem só gente da quadra 1: o custo da rodada é a **soma** dos
custos dos grupos sobre o mesmo histórico, sem interação para modelar. É o que
torna a otimização barata.

Três restrições que nenhuma troca viola: **duplas fixas** em cada grupo, o
**primeiro elegível** da fila continua jogando, e a **frente da fila**
(`k·4 − windowExtra` primeiros) continua dentro da rodada. Sem a terceira,
buscar variedade no fundo da fila empurraria sempre a mesma pessoa para fora, e
ao longo da noite isso vira gente com partidas a menos que os outros.

Com **uma** quadra livre, nada disso roda: o caminho é exatamente o de antes,
partida a partida (há teste travando a igualdade).

## 5. A previsão

`forecastAmericanoLiveMatches` responde "quem entra em cada quadra a seguir".
Diferença importante para a previsão do Play: **aqui as duplas já aparecem**,
porque este sorteio decide os quatro **e** o pareamento na mesma conta.

- Quadras **livres** primeiro, na ordem.
- Quadras **ocupadas** depois, marcadas `conditional: true` ("quando liberar"):
  quem está jogando volta ao fim da fila ao terminar. A hipótese é "termina
  primeiro quem começou primeiro" — não dá para saber sem o placar.
- O parâmetro opcional `participants` existe **só para nomear**: quem está em
  quadra não está na fila, e sem essa lista a previsão condicional imprimiria o
  **id cru** no lugar do nome. Foi um defeito real, pego por teste de runtime.

A previsão é uma fotografia: quem entra, pausa, sai ou vincula dupla refaz a
conta. As duas telas dizem isso com todas as letras.

**A previsão e o sorteio da rodada são a MESMA conta.**
`drawAmericanoLiveRoundForFreeCourts` é literalmente a previsão das quadras
livres — o que a tela anuncia é o que o serviço cria. Não sorteie a rodada por
outro caminho: duas implementações divergem na primeira vez que uma delas
muda, e o sintoma é a tela mostrar uma partida e a quadra receber outra. Há
teste travando a igualdade.

## 6. Onde está cada coisa

| Camada | Arquivo |
|---|---|
| Formato + helpers | `src/modules/clubs/domain/gameDayFormats.js` (`AMERICANO_LIVE`, `isAmericanoLiveFormat`, `isCourtByCourtFormat`, `formatHasScores`) |
| Flag | `src/core/featureFlags.js` (`GAMEDAY_AMERICANO_LIVE`) |
| Sorteio, previsão, progresso | `src/modules/games/domain/americanoLive.js` (+ `.test.js`) |
| Motor de pareamento (reuso) | `src/modules/clubs/domain/gameDayDraw.js` → `pairFourBalanced` |
| Serviço (I/O) | `src/modules/games/services/gameDayService.js` → `createNextAmericanoLiveGame`, `createAmericanoLiveRoundForFreeCourts`, `submitAmericanoLiveResult`, `updateAmericanoLiveResult`, `createManualAmericanoLiveGame` (esta reconfere a regra "ninguém em duas quadras") |
| Desfazer / trocar (reuso do Play) | `cancelPlayGame`, `noShowSwapPlayGame` — o mesmo serviço dos dois formatos |
| Hooks | `src/modules/games/hooks/useGameDays.js` (5 hooks `...AmericanoLive...` + `useCancelPlayGame`, `useNoShowSwapPlayGame`) |
| Painel | `src/v2/components/games/AthleteAmericanoLiveOrganizer.jsx` |
| Telão | `src/v2/pages/V2GameDayTelao.jsx` (terceiro ramo) |
| Painel do telão (agrupamento) | `src/modules/games/domain/gameDayBoard.js` (opção `format`) |
| Criação do dia | `src/v2/components/games/CreateGameDayDialog.jsx` |
| Roteamento | `src/v2/pages/V2GameDays.jsx` |

### O que foi REAPROVEITADO (e por quê importa)

O painel não reimplementa nada que já existia — ele **compõe**:

- do Play: `PlayParticipantsSection`, `PlayOrderSection`, `CourtPlayerDialog`,
  `SkipDialog`, `PartnerDialog`, `computePlayOrder`, `freePlayCourts`;
- do Americano: `DailyRankingSection`, `RankingSection` (publicação), o
  espelhamento em `club_event_games`;
- do dia de jogo em geral: `GameDayAdminsCard`, `canManageGameDay`,
  `V2CollapsibleCard`.

Consequência prática: uma correção no diálogo de substituição vale nos três
formatos de uma vez. Se você for tentado a copiar um componente para "ajustar
só neste formato", **não copie** — parametrize o original.

## 6b. Corrigir a quadra: substituir e CANCELAR

Duas coisas dão errado no meio de um dia de jogo, e as duas têm de ter saída na
tela onde a pessoa está:

**1. Alguém em quadra não vai jogar.** Tocar no nome de quem está em quadra
abre `CourtPlayerDialog` — o mesmo componente do Play e do telão — com as duas
opções de sempre: *indisponível para esta partida* (entra automaticamente o
próximo da ordem) ou *substituir por outro jogador* (você escolhe quem entra,
entre os elegíveis da fila). Os dois trocam de posição na ordem de participação.
A elegibilidade é **reconferida no serviço** (`noShowSwapPlayGame`): a tela
filtra por conveniência, quem decide é o serviço.

**2. A partida sorteada não serve.** "Cancelar partida" remove o jogo da
quadra, **sem placar nenhum**, e devolve os quatro à fila. Nada vai para o
ranking do dia. Depois disso a quadra volta a oferecer "Gerar próxima partida",
com sorteio e pareamento novos.

> 🐞 **O defeito que isso corrigiu.** As duas ações existiam no telão e **não**
> na visão normal do dia de jogo. Para desfazer um sorteio, quem organizava
> tinha de **lançar um resultado que não aconteceu** e depois apagá-lo na lista
> de partidas concluídas — um placar falso passando pelo ranking do dia só para
> liberar a quadra. E substituir um atleta em quadra simplesmente não tinha
> caminho: ou se ia ao telão, ou não se fazia.

**Cancelar não é excluir um resultado.** `cancelPlayGame` **recusa** uma partida
que já tem `score_a`/`score_b` ou está `finished`, dizendo onde é o caminho
certo (a lista de partidas concluídas, que re-sincroniza o ranking). A guarda
vale pela corrida real: entre abrir a confirmação e confirmar, outra pessoa
pode ter lançado o placar da mesma quadra — e aí "cancelar a partida" apagaria
em silêncio um resultado já publicado.

E o cancelamento **pede confirmação**: um toque não desfaz um sorteio na frente
de oito pessoas que já foram para a quadra.

## 7. Telão

O telão (`/dia-de-jogo/:id/telao`) ganhou um terceiro arranjo:

```
 ┌──────────────────────────────────────┬─────────────────┐
 │ EM QUADRA AGORA (cards por quadra)   │ RANKING DO DIA  │
 │  ▸ Lançar resultado / Gerar próxima  │                 │
 ├──────────────────────────────────────┤ ORDEM DE        │
 │ PRÓXIMOS JOGOS (previsão com duplas) │ PARTICIPAÇÃO    │
 ├──────────────────────────────────────┤                 │
 │ PARTIDAS CONCLUÍDAS (com placar)     │                 │
 └──────────────────────────────────────┴─────────────────┘
```

- A partida **em andamento nunca mostra placar** — ele só nasce quando o
  organizador lança o resultado.
- Quem **organiza** conduz o dia pelo próprio telão: lançar resultado (com os
  nomes das duas duplas em cima dos campos, para não trocar o lado A pelo B),
  gerar a próxima, cancelar, clicar num nome em quadra (indisponível ×
  substituir), pausar e vincular dupla. Para todos os outros, o telão é leitura.
- As partidas concluídas ficam limitadas a `RECENTES_AO_VIVO` (12); o que passa
  aparece como contagem, com o recado de que o histórico completo está no painel.

### `buildGameDayBoard` e o `format`

O painel do telão separava os jogos olhando só os dados: jogo com `status` =
Play, sem `status` = grade. O Americano aprimorado tem **as duas marcas**
(`status` **e** placar) e seria confundido com o Play — escondendo resultado e
ranking. Por isso `buildGameDayBoard` passou a aceitar `format`:

- **informado** → ele decide `isCourtByCourt` e `hasScores`;
- **omitido** → a inferência antiga, **bit a bit**. Nenhum chamador existente
  mudou de comportamento (há teste preso nisso).

## 8. Permissões

Quem opera é quem já operava: **o criador**, quem ele nomeou em `admin_uids`, e
qualquer inscrito se ele pôs o dia em `manage_mode: 'participants'`.
`canManageGameDay` é a fonte única, como nos outros formatos (veja
`15-DIA-DE-JOGO-PERMISSOES.md`).

O que este formato **NÃO** herda é o atalho colaborativo do Play. A função
`isPlayGameDayMember` do `firestore.rules` é confinada a `format == 'play'` — e
continua sendo. Se o Americano aprimorado a herdasse, qualquer inscrito poderia
reescrever um resultado que alimenta o ranking da plataforma.

**Nenhuma regra nova foi escrita.** As regras de `game_days`, `participants` e
`games` já eram agnósticas ao formato. Seis asserções em
`tests/rules/gameDayRoles.rules.emulator.mjs` prendem isso.

## 9. Banco de dados: o que mudou

**Nada de estrutura.** Nenhuma coleção nova, nenhum índice novo, nenhuma regra
nova, nenhuma migração.

- `game_days/{id}.format` passa a aceitar mais um valor: `'americano_live'`.
  O campo já existia e não é validado por whitelist em regra.
- `game_days/{id}/games/{gid}.format` já era gravado pelo Play (`'play'`); agora
  também recebe `'americano_live'`. `writePlayGame` ganhou o parâmetro `format`
  com **default `'play'`** — quem já chamava não mudou.
- Os jogos têm `round: null`, como os do Play.

Dia de jogo antigo, de qualquer formato, **não muda de comportamento**: a flag
nasce OFF, o formato só aparece na criação quando ligada, e um dia já criado
continua sendo roteado pelo `format` que gravou.

A rodada otimizada, a substituição em quadra e o cancelamento também **não
tocam no banco**: a rodada é conta em memória e grava os mesmos documentos de
sempre, num lote só; substituir reescreve `side_a`/`side_b` do jogo aberto (e
`swapped_out_ids`, campo que já existia); cancelar **apaga** o documento do
jogo aberto — que é o que ele sempre fez no Play. Nenhum campo novo, nenhum
status novo, nenhuma coleção, índice, regra ou migração.

## 10. Publicação no ranking / rating / DUPR

Funciona igual ao Americano, **sem nenhum ajuste**: `buildGameDayMatch` só olha
`score_a`/`score_b` e os lados; não conhece `round` nem `format`. As partidas
concluídas espelham em `club_event_games` com `source = 'game_day'`, entram no
ranking geral, no rating (ELO e escala 2.0–8.0) e na exportação para o DUPR.
Editar ou excluir uma partida já publicada re-sincroniza o espelho
(`syncGameDayRankingIfPublished`).

Há teste de domínio prendendo isso em `gameDayRanking.test.js`.

## 11. Ao mexer neste formato, cuidado com

1. **Não transforme o fluxo em um clique.** Lançar resultado ≠ criar próxima.
2. **Não copie componente do Play para "ajustar aqui".** Parametrize o original,
   ou as telas divergem em silêncio.
3. **Não deixe o mesmo atleta em duas quadras.** No sorteio isso é grátis: a
   fila (`computePlayOrder`) já exclui quem está jogando. O caminho por onde a
   regra pode furar é a criação **manual** — e lá a trava está no serviço
   (`createManualAmericanoLiveGame`), não só na tela. A exceção deliberada é a
   partida lançada **já com placar**: ela registra um jogo que aconteceu antes
   e não ocupa quadra nenhuma, então não é barrada. Se você criar um caminho
   novo de criação de partida, reconfira também.
4. **Não faça `isPlayGameDayMember` valer aqui.** Veja §8.
5. **Não presuma placar na partida em andamento.** Ele é `null` até o
   lançamento; a tela trava isso explicitamente (`comPlacar={false}`) em vez de
   confiar no dado.
6. **Não sorteie a rodada por um caminho paralelo.** Ela sai da PREVISÃO
   (`forecastAmericanoLiveMatches`); qualquer outra implementação divergiria e
   a tela anunciaria uma partida enquanto a quadra recebe outra.
7. **Não deixe uma tela sem as saídas que a outra tem.** Substituir e cancelar
   existiam só no telão, e o custo foi um placar falso no ranking do dia. Ao
   acrescentar um comando de partida, pergunte-se em quais das TRÊS telas ele
   precisa existir (painel do atleta, painel da arena, telão).
8. **Não torne "cancelar a partida" um atalho para apagar resultado.** São
   ações diferentes, com consequências diferentes no ranking — o serviço
   recusa a confusão de propósito.
