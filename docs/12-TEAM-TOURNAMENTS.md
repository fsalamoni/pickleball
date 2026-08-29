# 12 — Torneios por Equipes (formato "Equipes")

> A antiga flag `team_tournaments` **virou código** (como as demais 137): o
> formato de equipes está sempre disponível e é ativado por modalidade, ao ligar
> "Modalidade por equipes" na criação/edição da modalidade (`team_config`).
> Continua **aditivo**: modalidades sem `team_config` seguem exatamente como antes.

Status: **Fases 1–5 entregues e ligadas**. Ver §5 para os pontos de integração.

---

## 1. O que é

Uma modalidade de torneio em que cada **inscrição é uma EQUIPE** (um elenco de
atletas). Duas equipes se enfrentam num **CONFRONTO**, decidido por várias
**ETAPAS** (sub-jogos): dupla masculina, dupla feminina, dupla mista e/ou
simples. O criador define livremente o tamanho da equipe, a composição
(masculina/feminina/mista), quais e quantas etapas compõem um confronto, e se
vale **"disputar todas"** ou **"melhor de X"**.

As **fases** (pontos corridos, grupos, chaves, mata-mata, suíço…) reaproveitam o
motor de fases atual — a única diferença é que o "participante" é uma equipe e
cada "jogo" da fase é um **confronto** de equipes.

Exemplo (do pedido): equipes de 4 (2M + 2F); confronto de 5 etapas — dupla
masculina, dupla feminina, mista 1, mista 2 e simples; vence a 1ª equipe a
ganhar 3 etapas. Registram-se vitórias e placares de cada etapa.

---

## 2. Regras-chave

- **Composição**: masculina, feminina ou mista. Mista exige nº par de vagas
  (metade M, metade F) — validado.
- **Etapas por gênero**: dupla masculina × masculina; feminina × feminina; a
  mista e o simples são definidos na hora do confronto.
- **Escalação (lineup)**: a formação das duplas e a ordem das mistas/simples são
  definidas **pela equipe** e informadas pelo **admin** no momento do confronto.
  Se a equipe tiver mais atletas que o mínimo, define-se quem joga cada etapa.
- **Duplas mistas não repetem jogadores** entre si (no mesmo lado).
- **Simples**: (a) um jogador por equipe; ou (b) todos jogam em rodízio, trocando
  a cada X pontos (independe de quem pontua) — a ordem é a escalação.
- **Vitória do confronto**: "todas as etapas" (maioria) ou "melhor de X"
  (primeira a atingir o alvo; não precisa jogar as demais).
- **Placar de cada etapa**: cada etapa é um jogo de verdade — decidido em
  **game único** ou em **melhor de 3/5 games**, com **11/15/21 pontos** por
  game. O padrão é da modalidade e **cada etapa pode sobrescrever** (ex.: duplas
  em melhor de 3 e o simples em game único).
- **Estrutura da competição**: o sorteio usa o formato definido na modalidade —
  **grupo único** (pontos corridos), **grupos** ou **chave** (mata-mata / dupla
  eliminação / suíço) — com as EQUIPES como participantes. Cada jogo da fase é
  um confronto.

### Classificação (pontos corridos) e desempate
1. **Vitórias de confronto** (equipe × equipe) — cada confronto vale 1, não
   importa quantas etapas foram vencidas.
2. **Saldo de etapas** (vitórias − derrotas de etapas de confronto).
3. **Saldo de pontos** (pontos a favor − contra) das etapas.
4. **Confronto direto** entre as empatadas.

Em chaves/mata-mata, o confronto é decidido da mesma forma; avança o vencedor.

---

## 3. Motor de domínio (Fase 1 — entregue)

`src/modules/tournament/domain/teamFormat.js` (+ `teamFormat.test.js`, 75 testes),
100% puro (sem Firebase/React):

- Constantes: `TEAM_GENDER`, `TEAM_ETAPA_TYPE`, `TEAM_WIN_RULE`,
  `TEAM_SINGLES_MODE`, `TEAM_LIMITS`.
- `normalizeTeamConfig(input)` — valida tamanho/gênero/etapas/regra e devolve a
  config normalizada (`male_slots`/`female_slots`, `win_target`, etc.).
- `validateTeamRoster(members, config)` — elenco bate com tamanho e composição.
- **Vagas do elenco (inscrição)**: `buildRosterSlots(config)` deriva as VAGAS que
  o formulário mostra (quantidade + gênero de cada uma, na composição da
  modalidade); `assignMembersToSlots(members, config)` recoloca um elenco já
  gravado nas vagas (para edição, devolvendo em `extras` quem não cabe mais);
  `membersFromSlots(values, config)` volta para `members[]` já com o gênero da
  vaga; `rosterProgress(values, config)` resume o que falta preencher.
- `validateTeamAgainstExisting({ teamName, members, existingTeams, currentTeamId })`
  — nome de equipe único na modalidade e nenhum atleta com conta em duas equipes;
  `uidsInOtherTeams(teams, currentTeamId)` alimenta a exclusão na busca.
- `registrationIncludesUid(registration, uid)` — o usuário participa da
  inscrição? Cobre individual (`user_id`), dupla (`player_a/b_user_id`) e
  **equipe** (`member_uids`/`members[]`).
- **Placar por etapa**: `resolveEtapaScoring(config, etapa)` (games e pontos
  efetivos, com herança do padrão da modalidade), `etapaGames(etapa)` (lê
  `games[]` e também o formato antigo `score_a`/`score_b`),
  `computeEtapaResult(etapa, config)` (sets, pontos, vencedor, decidido) e
  `etapaScoreIssues` (avisos de game fora da regra, sem travar o lançamento).
- **Escalação**: `etapaLineupSlots(spec, config, rosterSize)` — as vagas de cada
  etapa por lado (2 masculinas, 2 femininas, 1M+1F na mista, 1 no simples, ou a
  ORDEM do rodízio); `suggestSideLineup(config, roster)` — escalação sugerida
  que respeita gênero, distribui minutos e não repete atleta entre as mistas;
  `buildEtapaDrafts(config, match)` / `etapasToPayload(drafts, config)` — a
  ponte entre o formulário e o que é gravado.
- **Estrutura**: `buildConfrontationStructure(matches, stages)` — organiza os
  confrontos por fase e, dentro dela, por grupo ou rodada (nomeando Final,
  Semifinais, Quartas…); `buildTeamGroupTables({ matches, teamRegistrations,
  config })` — a tabela de classificação de CADA grupo.
- `validateConfrontationLineup(lineup, config, rosterA, rosterB, genderById)` —
  gênero por etapa, pertencimento ao elenco, mistas sem repetição, ordem do
  rodízio; etapas ainda intocadas não são erro (lançamento parcial).
- `etapaWinner` / `etapaDecided` / `computeConfrontationResult` — apura o
  confronto (regra "todas"/"melhor de X"), etapas vencidas e pontos.
- `buildTeamStandings` / `rankTeamStandings` / `buildTeamRanking` /
  `headToHeadWinner` — classificação de equipes com os desempates de §2.

---

## 4. Modelo de dados (Fases 2+) — **aditivo**

- `tournament_modalities/{id}.team_config` (novo campo, opcional/null) — a config
  normalizada (§3). Presença de `team_config` marca a modalidade como "equipes".
  `format` continua `doubles` (compat) e a UI/serviço tratam por `team_config`.
- `tournament_registrations/{id}` (equipe) — campos aditivos: `kind: 'team'`,
  `team_name`, `members: [{ user_id, name, gender, photo_url }]`. Uma equipe é
  **uma** inscrição (representa vários atletas).
- Confrontos = **jogos** da fase (reuso de `tournament_matches`): `side_a_ids` /
  `side_b_ids` guardam o **id da inscrição-equipe**; campos aditivos
  `team_confrontation: true` (gravado já no SORTEIO) e
  `etapas: [{ id, type, side_a:[uid], side_b:[uid], games:[{a,b}], score_a,
  score_b, sets_a, sets_b, winner_side }]` (escalação + placares), mais os
  agregados `etapa_wins_a/b`, `sets_a/b` e `points_a/b`. `score_a`/`score_b`
  seguem preenchidos (soma dos games) para quem lê o confronto sem conhecer
  games. Nada muda para jogos não-equipe.
- `team_config` ganhou `sets_per_etapa` (1/3/5) e `target_score` (11/15/21), e
  cada etapa aceita `sets_per_match`/`target_score` opcionais (null = herda).

Sem novas coleções obrigatórias; tudo cabe como campo aditivo. As regras do
Firestore para `tournament_modalities`/`tournament_registrations`/
`tournament_matches` já permitem os campos (não há validação por campo);
confirmar no PR.

---

## 5. Camadas entregues (Fases 2–5) e pontos de integração

- **Fase 2 — Serviços/hooks** ✅
  - `services/modalityService.js` normaliza/grava `team_config` (aditivo).
  - `services/teamService.js`: `registerTeam`, `updateTeamRoster`,
    `listTeamRegistrations`, `recordConfrontation` (escala + placares → apura),
    `buildTeamStandingsFromMatches`.
  - `hooks/useTeams.js`: `useTeamRegistrations`, `useRegisterTeam`,
    `useUpdateTeamRoster`, `useRecordConfrontation`.
- **Fase 3 — Criação (admin)** ✅ `components/tournament/TeamModalityConfig.jsx`
  dentro de `V2TournamentModalitiesTab` (toggle "Modalidade por equipes" + editor
  de tamanho/gênero/etapas/regra/simples). Só aparece com a flag.
- **Fase 4 — Gestão de confrontos (admin)** ✅
  `components/tournament/TeamConfrontationPanel.jsx` (escala cada etapa com
  seletores por gênero + placares, apura ao vivo e salva) e
  `TeamStandingsTable.jsx` (classificação).
- **Fase 5 — Visão pública (atleta)** ✅ `TeamRegistrationDialog.jsx` (MODAL de
  inscrição) + `TeamRegistrationForm.jsx` (corpo do formulário: nome da equipe e
  as vagas do elenco) e `TeamModalityView.jsx` (abas
  Equipes/Confrontos/Classificação), montado em `V2ModalityPage` conforme
  `isAdmin` — edição para admin, leitura para o público, independentes.

**Integração**: `V2ModalityPage` troca o conteúdo padrão pela `TeamModalityView`
quando `modality.team_config`; o CTA "Inscrever equipe" existe tanto no card do
torneio (`V2OverviewBlock`, ao lado de "Ver equipes") quanto no herói da página
da modalidade e na aba Equipes. O **pareamento** dos confrontos (pontos
corridos/grupos/chaves) usa o **sorteio existente** (equipes como participantes)
— nada de novo no motor de fases.

### Evoluções entregues (#111)

- **Elenco pelo padrão da plataforma**: `TeamRegistrationForm` busca atletas no
  diretório (`listAthletes` + `filterPartnerCandidates`, com `user_id`), como no
  fluxo de duplas; "convidado" avulso (nome + gênero) segue disponível.
- **Etapas alimentam o ranking INDIVIDUAL**: ao salvar um confronto,
  `recordConfrontation` espelha cada etapa decidida (com jogadores com conta) em
  `club_event_games` — a MESMA base do ELO e do ranking de duplas —, com `kind`
  `singles` (1×1) ou `doubles` (2×2), `source: 'team_confrontation'`. Assim as
  duplas caem no ranking de duplas e o simples/duplas somam no ELO individual e
  em "Meu desempenho". Puro/testado em `buildConfrontationRankingMirror`
  (idempotente: grava as válidas, remove as que deixaram de valer). O confronto
  agregado (`tournament_matches` com `team_confrontation`) é **ignorado** pelo
  motor de rating (para não duplicar). Convidados sem conta contam só p/ a equipe.
- **Ranking de equipes**: a aba "Ranking de equipes" (`TeamStandingsTable`) usa
  `buildTeamRanking` (vitórias de confronto → saldo de etapas → saldo de pontos →
  confronto direto).
- **Regras**: `firestore.rules` ganhou um ramo ADITIVO em `club_event_games`
  (create/update/delete) permitindo o **admin do torneio** gravar o espelho
  quando `source == 'team_confrontation'`.

---

### Modal de inscrição de equipes (nome + elenco por vagas)

A inscrição de equipe é um **modal** (`TeamRegistrationDialog`), com **um ponto
de entrada único**: `ModalityRegistrationDialog` — usado pelo card do torneio,
pela aba de inscrições, pelo painel do organizador e pela página da modalidade —
delega para ele sempre que a modalidade tem `team_config`. Antes, esses caminhos
abriam o formulário de simples/dupla (Jogador A/B), que não se aplica a equipes.

O que o modal faz:

- Mostra, no topo, **o que a modalidade define**: composição (masculina/feminina/
  mista), tamanho do elenco, `xM + yF` quando mista, nº de etapas e regra de
  vitória.
- **Nome da equipe** (obrigatório, até 80 caracteres) — é o rótulo nos confrontos
  e na classificação.
- **Uma vaga por atleta do elenco**, exatamente as de `buildRosterSlots(config)`:
  em equipe mista as vagas já vêm rotuladas ("Atleta masculino 1", "Atleta
  feminina 2"), então a composição sai correta por construção — o gênero do
  membro vem da vaga, não de um seletor solto.
- Cada vaga é preenchida por **atleta do diretório** (busca por nome/cidade,
  vinculando `user_id`) ou por **convidado** avulso (só o nome). A busca oculta
  quem já está no elenco, quem está em **outra equipe da modalidade** e quem não
  serve ao gênero da vaga. Atalho "Sou eu" ocupa a 1ª vaga compatível.
- **Salvar só com o elenco completo**; conflitos (nome repetido, atleta em duas
  equipes) aparecem antes e são revalidados no serviço (`registerTeam` e
  `updateTeamRoster`), não só na UI.
- Na **edição**, o elenco gravado é redistribuído nas vagas atuais; se a
  modalidade mudou de composição, quem não cabe mais é listado num aviso em vez
  de sumir em silêncio.

Testes: `teamFormat.test.js` cobre as vagas/validações (domínio) e
`TeamRegistrationForm.runtime.test.jsx` monta o formulário de verdade (React DOM
em jsdom, Firebase mockado) — vagas rotuladas, salvar travado até o elenco
completo, payload gravado com o gênero da vaga, edição e exclusão da busca.
`TeamConfrontationDialogs.runtime.test.jsx`, `TeamConfrontationCard.runtime.test.jsx`
e `TeamModalityView.runtime.test.jsx` cobrem os dois momentos do admin
(escalação por gênero/ordem e games por etapa, com o payload salvo), o cartão
público (mostra tudo, não edita nada) e a estrutura (grupos, chave, tabelas).

Efeito colateral saudável: como `registrationIncludesUid` passou a reconhecer
`member_uids`, **todo atleta do elenco** (não só quem inscreveu) aparece como
inscrito no card da modalidade, na página da modalidade e na aba de inscrições —
que agora também lista os nomes/avatares dos membros da equipe.

---

### Sorteio, estrutura e resultados por etapa

Esta onda fechou o ciclo completo da modalidade de equipes — do sorteio ao
resultado —, **reaproveitando o motor existente** em vez de duplicá-lo.

**1. Sorteio no formato da modalidade.** `runDraw` (fase única) e `runPhaseDraw`
(multi-fase) tratam a inscrição-equipe como participante: montam **grupo único**,
**grupos** ou **chave** exatamente como nos torneios comuns. O que muda para
equipes:
- Americano e Mexicano são recusados com mensagem própria (são rotações de
  duplas entre atletas, não entre equipes);
- não há equilíbrio por nível/gênero de jogador — o sorteio é aleatório com
  semente, salvo cabeças-de-chave definidas pelo admin;
- todo jogo nasce com `team_confrontation: true` (também nas rodadas geradas por
  `advanceStage` e nos re-sorteios que mantêm grupos);
- as "vagas fictícias (Atleta N)" e a substituição de jogador ficam ocultas — o
  elenco se edita na inscrição da equipe.

**2. O confronto conta como jogo para todo o motor.** `getMatchResult`
(scoring.js) reconhece `team_confrontation` e devolve o resultado a partir do
que o confronto gravou: vencedor (`winner_side`), "sets" = **etapas vencidas** e
saldo = **pontos das etapas**; `buildStandings` (ranking.js) usa `points_a/b`
como pontos a favor/contra. Com isso, classificação, **progressão entre fases**,
chave e ranking estruturado funcionam sem caso especial. A classificação de
grupo usa os critérios de equipes (`rankEntrantsInGroup` com `teamConfig`):
vitórias de confronto → saldo de etapas → saldo de pontos → confronto direto.

**3. Tabelas e chave.** `TeamModalityView` mostra, por fase: os confrontos
agrupados como foram sorteados (Grupo A/B…, ou Semifinais/Final) e, na
classificação, **uma tabela por grupo** (`TeamStandingsTable`) ou a **árvore do
mata-mata** (`V2BracketTree`, que exibe etapas vencidas como placar). O ranking
do torneio (`V2RankingBlock`) troca "Participante/Sets" por "Equipe/Etapas".

**4. Duas visões separadas, com vocabulário próprio.** O confronto tem partes
distintas e a UI trata cada uma pelo nome: o **CONFRONTO** é equipe × equipe (o
"jogo" da fase); ele se divide em **ETAPAS** (as partidas: dupla masculina,
feminina, mista, simples); e cada etapa é disputada em **GAMES** (sets).

- **Visão pública** (página da modalidade): `TeamConfrontationCard` —
  confronto por confronto, cada um **ampliável** para ver etapa a etapa quem
  jogou, os games e quem venceu. **Zero campos editáveis**, inclusive para o
  admin do torneio, que recebe ali um atalho para o painel. A aba Equipes
  segue sendo do atleta (inscreve/edita a SUA equipe).
- **Visão admin** (painel → aba **Resultados**): cada confronto tem os dois
  momentos do jogo, na ordem em que acontecem na quadra —
  1. **Iniciar partida** (`TeamLineupDialog`): a ESCALAÇÃO de cada etapa, com
     uma vaga por posição e cada vaga oferecendo só quem serve a ela (2
     masculinos, 2 femininas, 1M+1F na mista); no simples em rodízio, a
     **ordem de entrada** (1º, 2º, …) com o lembrete "troca a cada X pontos".
     Tem **escalação sugerida** e vira "Editar escalação" depois de salva.
  2. **Lançar resultado** (`TeamResultDialog`): os **GAMES** de cada etapa (1,
     3 ou 5 campos, conforme a regra da etapa), com a escalação em leitura,
     apuração ao vivo (etapas, games, pontos, vencedor ou empate), aviso
     quando o game não fecha a regra e **lançamento parcial**.

  `confrontationLineupStatus` / `confrontationSnapshot` (domínio) dizem em que
  ponto o confronto está — é o que decide o rótulo do botão e o aviso de
  "ainda não escalado".
- Ao salvar, cada etapa decidida continua espelhada no **ranking individual**
  (`club_event_games`) com os games reais.

**5. Rodadas x fases finais.** A mesma visão em colunas serve a dois casos
diferentes, e `buildBracketColumns` agora distingue pelo TIPO da fase: numa
**chave** as colunas são as fases finais (Oitavas → Final); num **grupo único /
pontos corridos** são **rodadas** ("Rodada 1", "Rodada 2"…) — chamar de "Final"
a última rodada de um grupo seria mentira, já que quem termina em 1º é decidido
pela tabela. O botão da aba Resultados acompanha: "Chave (árvore)" ou
"Rodadas".

**6. Onde o organizador faz cada coisa.** Modalidade e formato na aba
**Modalidades**; inscrição/edição de equipes na aba **Inscrições** (o lápis de
uma inscrição-equipe abre o modal de equipe, não o de jogador A/B); sorteio na
aba **Sorteio**; escalação e resultado na aba **Resultados**. A página da
modalidade é a vitrine do atleta.

### Ajustes de exibição e ranking (#... — grupo único, placar por etapa, rodízio)

Três correções que alinham a exibição pública e o ranking da plataforma ao que
foi **definido na modalidade** (e uma rotina de manutenção, D, para dados
antigos):

**A. "Grupo único" exibe UM grupo — segue a modalidade.** Quando a fase é
definida como grupo único (`division_mode: 'single'`), a **classificação** —
tanto no ranking do torneio (`computeModalityRankingStructured` →
`V2RankingBlock`) quanto na aba Classificação da página da modalidade
(`TeamStandingsTable` → `buildTeamGroupStandings` → `buildTeamGroupTables`) —
mostra **uma única tabela**, combinando todos os confrontos, mesmo que um
sorteio antigo tenha gravado grupos ou marcado `m.group`. A aba **Confrontos**
(`buildConfrontationStructure` → `TeamModalityView`) também colapsa: em grupo
único os confrontos aparecem agrupados por **rodada** (uma seção só), não por
grupo. O colapso só ocorre
quando a fase **declara explicitamente** `division_mode: 'single'` (o
`PhasesEditor` sempre grava o modo); uma fase de grupos legada e mínima
(`{ type: 'groups' }`, sem o campo) **mantém** os grupos sorteados — não se
presume grupo único por omissão. Na origem, o **sorteio** também passou a
honrar o modo: `runDraw` usa `plannedGroupCount(normalizePhase(stage), n)` em
vez do `group_count` cru, então "grupo único" gera 1 grupo mesmo com um
`group_count > 1` antigo ainda gravado.

**B. Placar público mostra TODAS as etapas, com os pontos de cada game.** Na
aba **Jogos** (visão do público), o placar de um confronto de equipes exibe uma
**linha por etapa** (dupla masculina, feminina, mista, simples…) com os games de
cada uma e, ao final, o agregado "X–Y etapas" — não apenas o total de etapas
vencidas. Componente `TeamConfrontationScore` (`V2MatchesBlock.jsx`), alimentado
por `buildEtapaDrafts(config, match)` + `computeEtapaResult`; aparece no desktop
(coluna de placar) e no card mobile. Sem a config da modalidade, cai no resumo
agregado.

**C. Ranking da plataforma: duplas sempre; simples só com responsável único.**
Cada etapa decidida é espelhada por jogador em `club_event_games` (a base do
ranking individual/ELO), como se fosse um jogo autônomo — **duplas contra
duplas**, **não** equipe contra equipe. Regra do simples: só entra no ranking
quando há **um único responsável** pela equipe
(`config.singles_mode === 'single_player'`). No **rodízio por pontos**
(`rotating_points`), o simples é dividido entre todos os atletas e **não** é
espelhado — segue contando apenas para a equipe. A exclusão do rodízio usa o
**modo configurado** (não só o tamanho do lado), cobrindo elencos pequenos onde
o rodízio poderia chegar com 1–2 jogadores por lado. Ver
`buildConfrontationRankingMirror` (`teamFormat.js`); os confrontos crus
(`tournament_matches` com `team_confrontation`) são ignorados pelo
`ratingService` justamente porque já entram por etapa em `club_event_games`.

**D. Rotina de limpeza de marcadores de grupo (grupo único).** A exibição já
colapsa grupo único (ponto A), mas dados de sorteios antigos podem ter deixado
`m.group` gravado nos jogos de uma fase que hoje é grupo único. Isso não muda a
classificação (que colapsa), mas polui a origem e reativa botões indevidos
("Editar grupos", coluna de grupo). Há uma rotina **idempotente** e **aditiva**
que remove só o rótulo de grupo — sem tocar em confrontos, escalações ou
resultados:

- **Domínio (puro):** `matchesWithStaleSingleGroup(matches, stages)` retorna os
  IDs dos jogos com `m.group` numa fase `division_mode: 'single'` (usa o modo
  **declarado**, respeitando o `stage_index` de cada jogo; fases legadas sem o
  campo são ignoradas). Em `domain/phases.js`.
- **Serviço (I/O):** `clearStaleSingleGroupMarkers(modalityId, modality, actor)`
  (`services/matchService.js`) lê **todos** os jogos da modalidade, zera o
  `group` em lote e registra auditoria `tournament_group_markers_cleared`.
  Retorna `{ cleared: n }` e não escreve nada quando não há o que corrigir.
- **Hook:** `useClearStaleSingleGroupMarkers(modalityId)`
  (`hooks/useTournament.js`).
- **UI (admin):** na aba **Sorteio** (`V2TournamentDrawTab`), quando há
  marcadores obsoletos, aparece o botão **"Corrigir grupos (N)"**; nessa
  situação os botões de grupo ("Editar grupos", "Re-sortear mantendo grupos")
  ficam ocultos, pois não fazem sentido em grupo único.

Observação: a rotina não remove os metadados de `tournament_groups` de fases de
grupo único — a exibição já os ignora (o ranking colapsa antes de lê-los). Se um
dia quiser removê-los também, é um passo separado e opcional.

---

## 6. Decisões confirmadas

- **Desempate #2 (etapas)** = **saldo simples** (vitórias − derrotas de etapas).
  Ex.: 5V-1D (saldo +4) fica à frente de 3V-0D (saldo +3).

---

## 7. Onde achar

- Motor: `src/modules/tournament/domain/teamFormat.js`
- Modal de inscrição: `src/v2/components/tournament/TeamRegistrationDialog.jsx`
  (+ `TeamRegistrationForm.jsx`, corpo do formulário)
- Confronto na visão pública (leitura): `TeamConfrontationCard.jsx`
- Confronto na visão admin (escalação e placar): `TeamConfrontationDialogs.jsx`
  (`TeamLineupDialog` + `TeamResultDialog`), abertos pela aba Resultados
  (`V2MatchesBlock.jsx`)
- Placar público por etapa (aba Jogos): `TeamConfrontationScore` em
  `V2MatchesBlock.jsx`
- Estrutura/tabelas/chave: `TeamModalityView.jsx`, `TeamStandingsTable.jsx`,
  `V2BracketTree.jsx`
- Aba Confrontos (estrutura, colapso de grupo único): `buildConfrontationStructure`
  em `domain/teamFormat.js` → `TeamModalityView.jsx`
- Classificação do torneio / grupo único: `services/rankingService.js`
  (`computeModalityRankingStructured`)
- Limpeza de marcadores de grupo (grupo único): `matchesWithStaleSingleGroup`
  (`domain/phases.js`) + `clearStaleSingleGroupMarkers` (`services/matchService.js`)
  + `useClearStaleSingleGroupMarkers` (`hooks/useTournament.js`) + botão
  "Corrigir grupos" em `V2TournamentDrawTab.jsx`
- Espelho no ranking individual (duplas/simples): `buildConfrontationRankingMirror`
  em `domain/teamFormat.js`, gravado por `services/teamService.js`
- Sorteio: `services/drawService.js`, `services/phaseService.js`
- Ponte com o motor genérico: `domain/scoring.js`, `domain/ranking.js`,
  `domain/phaseProgression.js`
- Este doc: `docs/12-TEAM-TOURNAMENTS.md`
