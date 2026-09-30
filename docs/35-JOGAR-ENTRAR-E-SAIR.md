# 35 — O "Jogar": abrir no Dia de jogo, os dias do clube e o botão de entrar em todo lugar

> Uma onda de UX sobre o "Jogar" (menu, início, Procura-se jogo, Dia de jogo),
> sempre ligada. **Banco: zero** — nenhuma coleção, campo, índice ou regra. A
> leitura nova (os dias de jogo do clube) usa a regra de sempre, provada no
> emulador com contas que não são admin.

## O pedido

*"Em jogar, a ordem de abas deve ser a seguinte: dia de jogo, procura-se jogo,
encontrar jogadores. Em regra, ao clicar em jogar, o usuário deve entrar direto
na aba dia de jogo. Em procura-se jogo, deve aparecer os dias de jogo públicos
(criados por clubes, arenas ou usuários) que estejam abertos, para que os
usuários possam entrar e participar/sair. Para os membros de clubes e arenas,
também deve aparecer os dias de jogo privados do clube e da arena dos quais o
usuário é membro. Todos esses […] devem aparecer na página início na seção
jogar […] para os quais o usuário preencha os requisitos de participação,
podendo nesse local indicar que deseja participar e/ou entrar no próprio jogo
ou dia de jogo. Em todos os locais que existe a possibilidade de um usuário
ingressar e participar, deve haver o botão respectivo."*

## 1. O menu

- Abas do "Jogar", nesta ordem: **Dia de jogo → Procura-se jogo → Encontrar
  jogadores** (`V2Layout.jsx`, hub `jogar`).
- Tocar em "Jogar" abre **`/dia-de-jogo`** (`jogarHubTo`: sem o dia de jogo,
  Procura-se jogo; sem os dois, Encontrar jogadores).
- Guarda de fonte: `src/core/guards/jogarAbas.test.js`.

## 2. O Dia de jogo virou a porta do "Jogar"

Antes a tela mostrava só os dias da própria pessoa; quem não tinha nenhum via
um "Nenhum dia de jogo ainda" com dias abertos esperando gente em outra aba.
Agora ela tem **"Com vaga para você"** (`OpenGameDaysForMe`): os dias em que a
pessoa pode entrar, com o botão ali mesmo, e "Ver todos" para o Procura-se jogo.
Sem dia próprio, os com vaga vêm **primeiro** e o convite para criar fica
compacto — um cartão vazio do tamanho da tela os empurraria para baixo da dobra.

## 3. A lista: os dias do CLUBE entram, e o que você já tem fica

`buildPlayList` (`modules/games/domain/playDiscovery.js`) ganhou:

| fonte | quem vê | botão |
|---|---|---|
| `game_days` públicos (atleta, arena) | todo mundo | "Participar" / "Marcar presença" |
| ⭐ `game_days` do **clube** (privados) | **quem é do clube** | "Participar" |
| jogos abertos das arenas | todo mundo, com a faixa de nível | entrar, fila ou "fora da sua faixa" |
| convites | todo mundo | "Chamar para jogar" |

Cada item diz agora `origem` (decide o botão), `estou` (já estou nele), `cabe` +
`motivo` (preencho os requisitos?), `porQuadra` e `fonte` (o documento).

- **O que a pessoa já tem fica na lista**, com "Você vai" e o botão de sair —
  sumir no mesmo clique que entrou parece que a entrada falhou. O que ela
  CRIOU continua fora (ela organiza).
- **Requisitos**: o jogo aberto confere a faixa de nível na régua 2.0–8.0
  (nível desconhecido CABE — a plataforma não inventa nível); o dia da arena
  lotado não aparece (a não ser para quem está nele); o dia do clube só chega a
  quem é do clube, porque é a própria consulta que recorta. O **início** mostra
  só o que cabe (`playItemsForMe`); o **Procura-se jogo** mostra tudo, com o
  motivo escrito.
- **Quem agendou a data do clube** pode entrar para jogar (quem agenda não vira
  jogador — um evento semanal cria dezenas de datas). Para ele, "estou" sai da
  lista de inscritos, que o hook lê só para esses dias.

### A consulta dos dias do clube — sem índice e sem regra nova

```js
where('club_id', '==', clubId), where('date', 'in', [hoje … +29 dias])
```

- `club_id` fixo é o que deixa a regra de `game_days` provar
  `isClubMember(resource.data.club_id)` para a consulta inteira. Uma consulta
  por clube da pessoa (até 10), em cache.
- Data numa lista (`in`), igualdades — sem índice composto, como a dos públicos.
- Guarda de fonte: `listUpcomingPublicGameDays.guard.test.js`. Emulador:
  `tests/rules/clubGameDaysAhead.rules.test.js` — o membro lista; quem não é do
  clube é recusado; sem o filtro de clube, recusada.

### E o dia de "membros da arena"?

**Não existe.** Todo dia de jogo de arena nasce público (e o jogo aberto também
não tem restrição de membro). Então quem é membro de uma arena já vê todos os
dias dela — pela consulta dos públicos.

## 4. O botão de entrar e sair, igual em todo lugar

`PlayItemAction` (`v2/components/games/play/`) decide pela origem, e é o mesmo
no início, no Procura-se jogo e no Dia de jogo:

| origem | entrar | sair |
|---|---|---|
| dia do atleta / do clube | "Participar" → `joinPublicGameDay` | `leaveGameDay` |
| dia da arena (no dia) | "Marcar presença" → `signUpToArenaGameDay` (teto) | `leaveGameDay` |
| dia da arena (por quadra) | "Escolher a quadra" → abre o dia | — |
| jogo aberto | `slotActionState` (entrar, fila, fora da faixa) | sair do jogo |
| convite | "Chamar para jogar" | — |

Cada botão diz DE QUAL jogo é (`aria-label` "Participar de Racha de sábado").
O título leva para dentro do jogo; o botão nunca fica dentro do link.

### Dentro do dia de jogo

`GameDayJoinPanel` passou a valer no **dia do clube** para quem é do clube
(`useJoinPanelApplies`, que lê os clubes da pessoa do cache) — inclusive para
quem organiza. A aba de jogos do evento do clube usa o MESMO painel (antes
tinha um cartão próprio, que gravava o gênero do perfil em vez da categoria de
jogo — `playGenderOf`).

## 5. 🐞 Sair podia falhar

Sair passava por `removeGameDayParticipant`, que **recalcula** a lista de
membros inteira (criador + convidados + inscritos). A regra só deixa quem sai
gravar a lista antiga **menos ele mesmo** — e a recontagem tirava também o
administrador nomeado que não estava inscrito: a regra recusava, com a inscrição
já apagada e um erro na tela. Agora `leaveGameDay` apaga a própria inscrição e
tira **só** a própria pessoa (`arrayRemove`); quem é mais que jogador (criador,
administrador, convidado) continua membro. O jogo aberto segue saindo pela
vitrine (libera a vaga, chama a fila). Provado no emulador.

`joinPublicGameDay` também passou a dizer, no dia privado que não é de clube,
*"Este dia de jogo é privado — só entra quem foi convidado"*, em vez de deixar a
regra recusar com um "permissão negada" genérico. E abrir um dia privado que não
é seu diz isso — antes dizia *"a conexão falhou, tente de novo"*, para sempre.

## 6. A auditoria: onde mais dá para entrar

| lugar | antes | agora |
|---|---|---|
| Início → Jogar | linhas que só levavam ao jogo | botão de entrar/sair em cada linha |
| Procura-se jogo → dias de jogo | cartão-link "Ver e participar" | botão de entrar/sair no cartão |
| Dia de jogo | só os meus dias | + "Com vaga para você" |
| Dia do clube aberto pelo "Jogar" | sem botão | "Participar" |
| Calendário da arena → dia com dia de jogo | "marque presença na página da arena" | "Participar" (leva ao dia) |
| Início → eventos dos clubes | linha-link | "Participar" / "Aceitar convite" |
| Início → torneios abertos | sem pista | selo "Inscreva-se" |
| Torneios → cartão com inscrição aberta | "Abrir torneio" | "Ver modalidades e se inscrever" |
| Página da arena (dias, jogos abertos, aulas, torneios da casa), eventos do clube, convites | já tinham | — |

O que **não** entra no "Jogar": as datas LEGADAS de evento de clube (anteriores
à Onda AS, fora de `game_days`). Elas seguem na página do evento, com o "Vou"
de sempre, e encolhem sozinhas.

## Código

- Menu: `src/v2/components/V2Layout.jsx` (`jogarHubTo`).
- Lista: `modules/games/domain/playDiscovery.js` (`PLAY_ORIGIN`, `playItemsForMe`),
  `modules/games/hooks/usePlayDiscovery.js` (`useClubGameDaysAhead`),
  `listUpcomingClubGameDays` (`gameDayService.js`).
- Entrar e sair: `joinPublicGameDay`, `leaveGameDay` (`gameDayService.js`),
  `useLeaveGameDay`, `useJoinPanelApplies`, `modules/games/domain/gameDayJoin.js`.
- Telas: `v2/components/games/play/` (`PlayItemAction`, `PlayGameDayCard`,
  `OpenGameDaysForMe`), `HomePlaySection`, `V2OpenGames`, `V2GameDays`,
  `GameDayJoinPanel`, `ClubGameDayTab`, `V2DaySlotsDialog`, `HomeClubsSection`.
