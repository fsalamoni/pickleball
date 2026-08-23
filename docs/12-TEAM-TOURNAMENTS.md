# 12 — Torneios por Equipes (formato "Equipes")

> Flag: `team_tournaments` (default **OFF**). Enquanto desligada, nada aparece e
> nada muda nos torneios existentes. Feature **aditiva**: novas coleções/campos,
> sem alterar o schema nem o comportamento atual.

Status: **Fases 1–5 entregues** atrás da flag (OFF). Falta apenas ligar a flag
para validar em produção. Ver §5 para os pontos de integração.

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

`src/modules/tournament/domain/teamFormat.js` (+ `teamFormat.test.js`, 19 testes),
100% puro (sem Firebase/React):

- Constantes: `TEAM_GENDER`, `TEAM_ETAPA_TYPE`, `TEAM_WIN_RULE`,
  `TEAM_SINGLES_MODE`, `TEAM_LIMITS`.
- `normalizeTeamConfig(input)` — valida tamanho/gênero/etapas/regra e devolve a
  config normalizada (`male_slots`/`female_slots`, `win_target`, etc.).
- `validateTeamRoster(members, config)` — elenco bate com tamanho e composição.
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
- **Fase 5 — Visão pública (atleta)** ✅ `TeamRegistrationForm.jsx` (inscrição do
  elenco) e `TeamModalityView.jsx` (abas Equipes/Confrontos/Classificação),
  montado em `V2ModalityPage` conforme `isAdmin` — edição para admin, leitura
  para o público, independentes.

**Integração**: `V2ModalityPage` troca o conteúdo padrão pela `TeamModalityView`
quando `modality.team_config` (flag on); `V2OverviewBlock` aponta o CTA da
modalidade de equipes para a página da modalidade (aba Equipes). O **pareamento**
dos confrontos (pontos corridos/grupos/chaves) usa o **sorteio existente**
(equipes como participantes) — nada de novo no motor de fases.

**Pendências conhecidas / evoluções**: vincular membros do elenco a **contas**
da plataforma (hoje é nome + gênero, padrão "convidado"); espelhar confrontos de
equipes no ranking geral/“Meu desempenho” (hoje o formato de equipes tem
classificação própria e não alimenta o ELO individual).

---

## 6. Decisões confirmadas

- **Desempate #2 (etapas)** = **saldo simples** (vitórias − derrotas de etapas).
  Ex.: 5V-1D (saldo +4) fica à frente de 3V-0D (saldo +3).

---

## 7. Onde achar

- Motor: `src/modules/tournament/domain/teamFormat.js`
- Flag: `src/core/featureFlags.js` (`TEAM_TOURNAMENTS`)
- Este doc: `docs/12-TEAM-TOURNAMENTS.md`
