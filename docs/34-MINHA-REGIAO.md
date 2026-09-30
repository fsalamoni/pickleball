# 34 — O "Jogar" que mostra os dias de jogo, e a Minha região

> Duas partes. **(1) Consertos, sempre ligados**: o "Jogar" do início e o
> Procura-se jogo passam a mostrar os dias de jogo das ARENAS; tocar num dia de
> jogo abre o próprio dia, com "Participar"; e o que já passou sai das listas.
> **(2) Minha região** (flag `my_region`, default OFF): o que a plataforma
> mostra segue a região de cada pessoa. **Banco: zero** — nenhuma coleção,
> campo, índice ou regra; a escolha fica no navegador, por usuário.

## O pedido

*"Para muitos usuários na página início, na sessão 'jogar', não estão
aparecendo os dias de jogo abertos e com vaga. Nessa sessão deve aparecer todos
os dias de jogo disponíveis, especialmente na localização do usuário… Que leve
em consideração primeiro a sua cidade, mas também que tenha uma margem de raio
(configurável) para cidades próximas, e até a possibilidade de ver em outros
estados, cidades, países… em toda plataforma… que elas sempre mostrem o que há
no dia ou nos próximos dias, conforme a funcionalidade. E o que já passou, não
mostre mais."*

E, no meio do trabalho: *"clicando no dia de jogo, deve levar para dentro dele
(não para a arena), local em que o usuário pode se inserir como participante
(se público)"*.

## 1. O diagnóstico

O "Jogar" lia **duas** fontes: os convites de Procura-se jogo (`open_games`) e
os jogos abertos das arenas (`arena_open_slots`). O **dia de jogo que a arena
marca no calendário** (`game_days` com `arena_id`, flag `arena_game_day`,
ligada em produção) é público e tem vagas — mas **nunca cria convite**, de
propósito (o canal dele era a página da arena). Resultado: ele não aparecia no
início nem no Procura-se jogo, e o card prometia *"Dias de jogo e jogos com
vaga perto de você, das arenas e dos atletas"*. Mais três coisas:

- **limite de 3** por fonte, sem "ver todos";
- **convite sem data nunca expirava** ("sábado de manhã" de três meses atrás);
- **o jogo de hoje que já terminou** continuava na lista (e na página da arena).

Medido na produção pela leitura pública: das vagas abertas de arena havia uma,
já vencida — os dias de jogo com vaga estavam, de fato, só em `game_days`.

## 2. A lista única de "onde dá para jogar"

`buildPlayList` (`modules/games/domain/playDiscovery.js`) junta as três fontes
numa lista, do mais cedo para o mais tarde, e é a MESMA no início e no
Procura-se jogo (`usePlayDiscovery`):

| fonte | vira | leva para |
|---|---|---|
| `game_days` públicos dos próximos 30 dias (atleta e arena) | "dia de jogo", com as vagas que sobram | **`/dia-de-jogo/:id`** |
| `arena_open_slots` (módulo ligado na arena) | "jogo aberto" | `/dia-de-jogo/:id` (o jogo aberto é um dia de jogo) |
| `open_games` (convite solto) | "convite" | `/procura-jogo` |

Um jogo, um item: o dia que nasceu de um jogo aberto aparece pela vitrine dele;
o espelho em `open_games` do dia do atleta só aparece se o dia não veio na
consulta (sem data) — e o espelho **órfão** (dia arquivado ou que virou
privado) não aparece. Não aparece o que a pessoa já tem (o dia em que ela está
mora na agenda) nem o que ela criou. Dia de arena lotado não aparece.

**"O que já passou":** dia de jogo some quando TERMINA (a faixa da arena; o do
atleta informa só o início — contamos 3 horas; sem hora, vale até o fim do
dia); jogo aberto some quando começa; convite com data vale até o fim do dia;
sem data, vale **14 dias** desde a última atualização.

### A consulta — sem índice novo

```js
where('visibility', '==', 'public'), where('date', 'in', [hoje … +29 dias])
```

- `visibility == 'public'` é o que torna a consulta **provável** pela regra de
  `game_days` (sem ele, recusada para todo mundo menos o admin — a lição da
  Onda CB). Provado no emulador com contas que NÃO são admin
  (`tests/rules/publicGameDaysAhead.rules.test.js`).
- A data vai numa **lista** (`in`): igualdades são servidas juntando os índices
  de campo único, **sem índice composto**. Uma faixa (`date >= hoje`) com a
  igualdade exigiria índice novo. **Conferido na produção** com a mesma forma de
  consulta sobre uma coleção de leitura pública (a lista passa; a faixa pede
  índice). Guarda de fonte: `listUpcomingPublicGameDays.guard.test.js`.
- As vagas de um dia de arena com teto saem dos inscritos (a mesma chave de
  cache da página do dia), só para os 12 mais próximos.

## 3. Dentro do dia de jogo: "Participar"

`GameDayJoinPanel` (na página `/dia-de-jogo/:id`, logo abaixo do cabeçalho):

- **dia da arena**: o mesmo cartão da página da arena
  (`ArenaGameDaySignupCard`, extraído de `ArenaGameDaysSection`) — vagas,
  quadra quando a inscrição é por quadra, "Marcar presença"/"Desmarcar";
- **dia público do atleta**: "Participar do dia de jogo" / "Sair";
- não aparece para quem organiza, no dia privado, no de clube, no do jogo
  aberto (que tem o painel próprio) nem no arquivado (`joinPanelApplies`,
  `modules/games/domain/gameDayJoin.js`); o que **já terminou** diz que a
  inscrição está encerrada.

🐞 **E um furo fechado de passagem**: o "Iniciar minha participação" do Play
chamava `joinPublicGameDay`, que gravava a inscrição direto — num dia de arena
**lotado** entrava assim mesmo, e no dia de um jogo aberto gravava só uma das
duas listas. Agora `joinPublicGameDay` confere o dia no banco e, se for de
arena, entra por `signUpToArenaGameDay` (teto, quadra, jogo aberto). No Play, o
cartão "Minha participação" aponta para o "Participar" em vez de repetir o
botão, e sair de um dia de arena passa pelo caminho da arena.

## 4. Minha região (flag `my_region`)

**Os quatro jeitos** (`core/domain/region.js`):

| modo | entra | padrão? |
|---|---|---|
| cidade | só a cidade | |
| raio | a cidade e as vizinhas a até 10/25/50/100/200 km | ⭐ **a cidade do perfil + 50 km** |
| estado | o estado inteiro | |
| todos | todo lugar (outros estados e países), o mais perto primeiro | |

O centro vem do **perfil** (lido na hora, nunca copiado), de **outro lugar**
(quem vai viajar: cidade com sugestões do mapa, ou só a UF) ou da
**localização do aparelho** — que vira a cidade mais próxima; as coordenadas
não saem do aparelho nem são guardadas. Sem cidade no perfil, cai para o estado;
sem nada, mostra tudo e **pede a cidade**.

**A distância** é medida entre CIDADES, pelo mapa do IBGE: 5.571 cidades com
latitude e longitude (`core/geo/cidadesBR.data.js`, gerado por
`scripts/gerar-cidades-br.mjs` a partir de kelvins/municipios-brasileiros, MIT).
São 57 kB compactados, baixados **só** com a flag ligada e um centro conhecido,
uma vez por sessão (guarda: só import dinâmico). Nada disso vai para o banco:
nem arena, nem torneio, nem perfil ganham coordenadas.

**Onde vale** (cada tela com a barra "📍 Porto Alegre + 50 km" e o "Alterar"):

- Início: **Jogar**, **Torneios** (inscrições abertas), **Destaques** (os
  banners passam a seguir a MESMA região, inclusive o raio — o seletor próprio
  deles some com a flag) e **Horários da arena** (sem arena de sempre, as mais
  perto);
- **Procura-se jogo** (dias de jogo, jogos abertos das arenas e convites);
- **Torneios** (aba Públicos), **Arenas**, **Professores** (o "onde atende"
  em texto vira lugares — basta um dentro), **Clubes**, **Promoções** (as
  nacionais sempre entram), **Encontrar jogadores** ("Na minha região");
- **Configurações → Minha região** (`#minha-regiao`) e uma linha no perfil,
  junto da cidade.

Regras que valem em todas:

- **O que fica de fora não some**: "3 em outras regiões · Ver também" (vale só
  naquela tela, naquela visita), e o vazio causado pela região oferece "ver os
  de outras regiões" e "aumentar a região" em vez de uma parede;
- **buscar pelo nome** (arena, clube) ou digitar um lugar (professores) procura
  em todo lugar;
- com a região ligada, a ordem é **do mais perto ao mais longe** (e "a 13 km"
  aparece ao lado).

**Sem a flag**, as telas seguem como estavam — com os consertos da parte 1.

## 5. "O que já passou, não mostre mais" — o resto da plataforma

- **Torneios → Públicos**: agora só acontecendo, com inscrição aberta e por
  começar (o mais próximo primeiro). Encerrados, cancelados e os "esquecidos"
  (data passou sem encerrar) ficam atrás de "Ver os N torneios encerrados" —
  o resultado continua a um toque. Rascunho de outra pessoa não é vitrine.
  "Meus torneios" continua com tudo, o que pede atenção primeiro
  (`tournamentDiscovery.js`).
- **Procura-se jogo**: o convite vencido de outra pessoa não aparece mais (antes
  ficava numa seção de "passados"); o SEU continua na sua caixa, marcado
  "Data passada — encerre".
- **Página da arena → Dias de jogo**: o de hoje que já terminou sai.

## 6. Segurança e privacidade

- `Permissions-Policy`: `geolocation=()` → `geolocation=(self)`, como o plano
  P1-04 já previa ("perto de mim"). Só o próprio site pode pedir; o navegador
  pergunta à pessoa; o resto da política segue fechado (guarda em
  `src/core/guards/minhaRegiao.test.js`).
- A escolha da região: `v2:view:<uid>:regiao` no `localStorage` — por usuário,
  nunca no banco. Da localização, só o nome da cidade.

## 7. Ligar

Painel admin → Funcionalidades → grupo **Atleta, rating e social** → **Minha
região (cidade + raio, estado ou todo lugar)**. Os consertos da parte 1 já
valem sem ligar nada.

## Código

- Região: `core/domain/region.js`, `core/domain/locality.js`,
  `core/geo/cidadesBR.js` (+ `.data.js`), `core/lib/regionPreference.js`,
  `core/lib/useMyRegion.js` (`useMyRegion`, `useRegionalList`, `useCityGeo`),
  `v2/components/region/` (`RegionPicker`, `RegionBar`, `RegionForaNote`,
  `RegionEmptyHint`, `RegionDialog`, `RegionSettingsCard`).
- Jogar: `modules/games/domain/playDiscovery.js`,
  `modules/games/hooks/usePlayDiscovery.js`,
  `listUpcomingPublicGameDays` (`gameDayService.js`).
- Participar: `v2/components/games/GameDayJoinPanel.jsx`,
  `modules/games/domain/gameDayJoin.js`,
  `v2/components/arenas/ArenaGameDaySignupCard.jsx`.
- Torneios: `modules/tournament/domain/tournamentDiscovery.js`.
