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

### Classificação (pontos corridos) e desempate
1. **Vitórias de confronto** (equipe × equipe) — cada confronto vale 1, não
   importa quantas etapas foram vencidas.
2. **Saldo de etapas** (vitórias − derrotas de etapas de confronto).
3. **Saldo de pontos** (pontos a favor − contra) das etapas.
4. **Confronto direto** entre as empatadas.

Em chaves/mata-mata, o confronto é decidido da mesma forma; avança o vencedor.

---

## 3. Motor de domínio (Fase 1 — entregue)

`src/modules/tournament/domain/teamFormat.js` (+ `teamFormat.test.js`, 39 testes),
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
- `validateConfrontationLineup(lineup, config, rosterA, rosterB, genderById)` —
  gênero por etapa, pertencimento ao elenco, mistas sem repetição.
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
  `team_confrontation: true` e `etapas: [{ id, type, side_a:[uid], side_b:[uid],
  score_a, score_b }]` (escalação + placares). Nada muda para jogos não-equipe.

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

Efeito colateral saudável: como `registrationIncludesUid` passou a reconhecer
`member_uids`, **todo atleta do elenco** (não só quem inscreveu) aparece como
inscrito no card da modalidade, na página da modalidade e na aba de inscrições —
que agora também lista os nomes/avatares dos membros da equipe.

---

## 6. Decisões confirmadas

- **Desempate #2 (etapas)** = **saldo simples** (vitórias − derrotas de etapas).
  Ex.: 5V-1D (saldo +4) fica à frente de 3V-0D (saldo +3).

---

## 7. Onde achar

- Motor: `src/modules/tournament/domain/teamFormat.js`
- Modal de inscrição: `src/v2/components/tournament/TeamRegistrationDialog.jsx`
  (+ `TeamRegistrationForm.jsx`, corpo do formulário)
- Este doc: `docs/12-TEAM-TOURNAMENTS.md`
