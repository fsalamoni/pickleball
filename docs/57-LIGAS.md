# 57 — Ligas

> Flags `leagues_athletes`, `leagues_clubs`, `leagues_arenas`, `leagues_coaches`
> e `leagues_federations` — todas **desligadas** por padrão, ligadas pelo admin
> em **Painel admin → Funcionalidades → Ligas**. Módulo `src/modules/leagues/`
> (README lá), função `leagues` (`functions/leagues.js`).

## 1. O que é, e o que NÃO é

O **torneio** acontece num fim de semana: inscrições, sorteio, chave, pódio. A
**liga** é uma **temporada**: semanas, meses, um semestre ou um ano, com rodadas
no calendário e classificação acumulada. As duas ficam **lado a lado** e **não se
misturam** (pedido do dono, 2026-11-12):

- coleção própria (`leagues/**`), telas próprias (`/ligas`), função própria;
- nada do torneio foi tocado — `tournaments`, `tournament_*`, sorteio, ranking e
  as telas de torneio seguem bit a bit;
- a única ponte é um **atalho**: a lista de torneios mostra "Criar liga" (quando
  alguma flag de ligas está ligada) e a criação de liga oferece "Crie um torneio".
- o que as duas competições **dividem** mora no NÚCLEO, não num dos módulos (§9):
  a lista oficial de faixas (`core/domain/levelBrackets.js`), a regra de desempate
  (`core/domain/tiebreak.js`) e o editor da ordem
  (`v2/components/competition/TiebreakOrderEditor.jsx`). A liga não importa nada
  de `modules/tournament`, e o torneio nada de `modules/leagues`.

## 2. As cinco flags

Uma por **grupo de quem cria** (`LEAGUE_FLAG_BY_ORGANIZER`, `domain/leagueFlags.js`):

| Organizador | Flag | Quem pode criar em nome dele |
|---|---|---|
| Atleta | `leagues_athletes` | a própria pessoa |
| Clube | `leagues_clubs` | quem administra o clube (`my_role === 'admin'`) |
| Arena | `leagues_arenas` | quem gere a arena |
| Professor | `leagues_coaches` | quem tem perfil de professor |
| Federação | `leagues_federations` | a equipe com a permissão `competitions` |

- **Qualquer** flag ligada mostra a área **Ligas** (menu lateral + `/ligas`) para
  todos verem e se inscreverem (`leaguesVisible`). O admin da plataforma sempre vê.
- A flag gateia **criar**. Desligar não apaga nem esconde liga já criada: quem tem
  o link continua vendo, e a organização continua lançando placar.
- O servidor confere a flag do grupo na criação (`create`), lendo
  `platform_settings/global.feature_flags` — a tela não é a defesa.

## 3. Formatos

`LEAGUE_FORMAT_META` (`domain/leagueFormats.js`, cópia em `functions/leaguePolicy.js`
com paridade). **Disponíveis no PR 1:**

| Formato | Inscrição | Como joga |
|---|---|---|
| `divisional_pairs` — Duplas por divisão (padrão DUPR) | dupla fixa | pontos corridos dentro da divisão, uma rodada por data |
| `flex_pairs` — Liga flexível (DUPR Flex) | dupla fixa | idem, mas cada rodada tem prazo, as duplas combinam dia e local e quem joga lança o placar, que o outro lado confirma (§13) |
| `divisional_singles` — Simples por divisão | atleta | pontos corridos em simples |
| `ladder_individual` — Escada individual (King of the Court) | atleta | por SESSÃO: quadras de 4 ou 5 pela posição, um Americano em cada; o 1º sobe e o último desce (§10) |
| `ladder_pairs` — Escada de duplas | dupla fixa | por SESSÃO: grupos de 3 a 5 duplas pela posição, todos contra todos no grupo; a 1ª sobe e a última desce (§10) |
| `team_milp` — Equipes 4×4 mista (MiLP) | equipe de 2 homens e 2 mulheres | pontos corridos entre equipes; o confronto tem 4 jogos (feminina, masculina, mista 1, mista 2), um game cada; em 2 a 2, DreamBreaker (§11) |
| `team_milp_v3` — Equipes 3×3 (MiLP v3) | equipe de 3 | idem, com 3 jogos (A+B, B+C, A+C); não empata (§11) |
| `team_v4_gendered` — Equipes 4×4 do mesmo gênero | equipe de 4 da mesma categoria | idem, com 4 jogos de parceiros diferentes e DreamBreaker em 2 a 2 (§11) |

O mecanismo de "Em breve" (`available: false`) continua no domínio, mas hoje todo
formato é escolhível. As divisões das equipes usam a soma do DUPR (`dupr_sum`),
com o modelo da MiLP pronto em `MILP_DIVISIONS` (botão "Divisões da MiLP" no passo 4).

Os ids de formato, de status, de regra de divisão e de gênero são **gravados**:
nunca renomeie.

## 4. Dados

Tudo debaixo de `leagues/{liga}` — **uma regra de leitura** (`allow read: if
isAuthed()`) e **nenhuma escrita** pelo cliente.

| Documento | Campos principais |
|---|---|
| `leagues/{id}` | `name`, `description`, `city`, `state`, `location`, `format`, `entry_type`, `organizer {type,id,name}`, `status` (`draft`→`open`→`running`→`finished`, ou `cancelled`), `season`, `standings`, `visibility` (`public`/`unlisted`), `self_registration`, `admins[]`, `member_uids[]`, `ever_uids[]`, `entries_count` |
| `…/divisions/{id}` | `name`, `order`, `gender`, `rule {kind, bracket, label, min, max, allow_unrated, cap, individual_cap, unrated_value}`, `max_entries` |
| `…/entries/{id}` | `division_id`, `name`, `auto_name`, `players[{uid?, name, dupr?, gender?}]`, `player_uids[]`, `status` (`active`/`withdrawn`), `override`, `added_by` |
| `…/matches/{id}` | `division_id`, `phase: 'season'`, `round`, `side_a`, `side_b` (ids de inscrição), `games[{a,b}]`, `wo_winner`, `played_date`, `recorded_by`; nas equipes `games` tem um item por jogo do confronto, na ordem de `lines`, e `dreambreaker {a,b}` (opcional) decide o empate |
| `…/matches/{id}` na liga flexível | também `status: 'reported'` (lançado, a confirmar) ou `'disputed'` (contestado), `report {games, dreambreaker, side, by, played_date, at, at_ms, confirm_uids[]}`, `dispute {by, side, reason, at}` e, confirmado, `confirmed_by` (nulo com `auto_confirmed: true` quando valeu pelo prazo) (o `recorded_by` é quem lançou); `report`/`dispute` voltam a `null` quando o placar vale (§13) |
| `…/matches/{id}` no playoff | `phase: 'playoff'`, `round` (1 = primeira fase), `slot` (posição na fase), `third` (a disputa do 3º lugar), `seed_a`/`seed_b` (as cabeças, só na 1ª fase); o resto como na temporada (§12) |
| `…/matches/{id}` na escada | `phase: 'ladder'`, `session` (nº da sessão), `group` (quadra, a partir de 0), `round` (a volta DENTRO da quadra), `team_a[]`/`team_b[]` (ids de inscrição; na escada individual, a dupla da vez), `side_a`/`side_b` nulos; `scheduled_date` nulo (a data sai do calendário da sessão) |

- **Classificação e datas das rodadas são DERIVADAS**, nunca gravadas:
  `computeLeagueStandings(entries, matches, standings)` e `roundCalendar(season, n)`.
  Mudar a pontuação recalcula a tabela na hora; mudar o calendário muda as datas,
  não os jogos.
- `season`: `cadence` (`weekly`/`biweekly`/`monthly`/`custom`), `start_date`,
  `dates[]` (custom), `time`, `round_window_days`, `legs` (1 ou 2), `skip_dates[]`.
- `standings`: `mode` (`points` / `win_pct`, como na MiLP), `win`, `loss`, `wo_loss`
  (padrão 3/1/0) e `tiebreak_order` (lista de critérios; vazia ou ausente = o padrão
  da liga, `LEAGUE_DEFAULT_TIEBREAK_ORDER`: vitórias → confronto direto → saldo de
  games → saldo de pontos → pontos feitos). Ver §9.2.
- `rule.kind` da divisão: `open`, `bracket` (faixa da lista oficial, §9.1),
  `dupr_range` (a faixa digitada da primeira versão — continua valendo e editável
  na divisão que já a usa, mas não é mais oferecida) e `dupr_sum` (equipes).
- **Nenhum contato** na inscrição: conta, nome público, DUPR e a categoria do perfil.
- **Zero índice composto**: as consultas são de uma igualdade (`status in`,
  `member_uids array-contains`, `division_id ==`).

## 5. A função `leagues`

Callable da região SP (`exports.leagues` em `functions/index.js`), despacho pela
chave própria. Ações:

| Ação | Quem | O que confere |
|---|---|---|
| `create` | quem responde pelo organizador | flag do grupo, formato disponível, 1–12 divisões, nome ≥ 3 letras; nasce `draft` |
| `update` | quem gere | campos da lista fechada (`camposDaLiga`) |
| `status` | quem gere | a transição (`LEAGUE_STATUS_NEXT`); `open → draft` só sem inscritos |
| `division_save` / `division_remove` | quem gere | remover só divisão sem inscritos |
| `register` | o atleta | liga aberta, `self_registration`, divisão não lotada, faixa de DUPR e categoria pelo PERFIL (`divisionEligibility`), ninguém duas vezes na divisão; a dupla recebe um aviso. Equipe: `teammateUids` (os outros `players − 1`) e a montagem do formato (`teamCompositionError`: 2+2 na MiLP, mesma categoria na v4) |
| `withdraw` | o próprio atleta ou quem gere | sem jogo gerado ⇒ apaga; com jogo ⇒ `withdrawn` (os placares seguem valendo para os adversários) |
| `entry_add` | quem gere | pode inscrever sem conta (só o nome) e **fora da regra da divisão**: como no torneio, a organização vê o motivo como aviso e inscreve assim mesmo — o servidor marca `override: true` sozinho quando não cabe (§9.3) |
| `session` | quem gere | só escada: gera a próxima sessão com quem veio (`present`, ids de inscrição ativos; ausente = todos), na ordem da escada; número que não fecha é recusado; sessão sem nenhum placar é REFEITA, com algum placar só depois de fechada; avisa cada atleta da quadra; com a liga aberta, começa a temporada |
| `schedule` | quem gere | gera os jogos da divisão em pontos corridos (recusado na escada) (`roundRobin`, método do círculo; folga quando é ímpar); refazer só sem placar lançado; com a liga aberta, começa a temporada |
| `result` | quem gere | `validateResult`: até 5 games, 0–99, sem empate, ou W.O.; nas equipes (`resultRules`) exatamente um game por jogo do confronto e, no empate, o `dreambreaker`; `clear` apaga. No playoff, mudar ou apagar o placar APAGA a fase seguinte ainda sem placar (ela sai de novo) e é recusado se ela já tiver placar |
| `report` | quem joga | só na liga flexível (`self_report`), liga em andamento, jogo da temporada sem placar: um lado lança (`validateResult` do formato, nunca W.O.); quem lançou corrige enquanto o outro não responde; avisa o outro lado |
| `confirm` | quem joga | o OUTRO lado: `accept: true` vale o placar (como se a organização lançasse); senão `reason` (3–300 letras) contesta e avisa a organização e quem lançou. O `result` da organização sempre vence |
| `playoff` | quem gere | liga em andamento, fora da escada, `season.playoff.enabled`: sem chave, monta a 1ª fase com `seeds` (inscrições ATIVAS da divisão na ordem da tabela que a tela mostra); com a fase fechada, gera a próxima (e a disputa do 3º lugar junto da final); `reseed` refaz a chave enquanto nenhum jogo dela tem placar; avisa os atletas da fase (§12) |
| `staff` | quem gere | até 10 organizadores; o criador não sai |

**Quem gere** (`podeGerir`, espelhado no cliente por `canManageLeague`): a lista
`admins`, o admin da plataforma e — pelo organizador — o admin do clube, o gestor
da arena ou a equipe `competitions` da federação. Para atleta e professor só a
lista `admins`.

Grava `audit_logs` na criação, na troca de status, ao gerar rodadas, ao lançar
ou apagar placar e ao mudar a organização (`league_created`, `league_status`,
`league_schedule`, `league_session`, `league_playoff` (com as cabeças na 1ª fase), `league_result_reported`, `league_result_confirmed`, `league_result_disputed`, `league_result`, `league_result_cleared`, `league_staff`).

## 6. Telas

| Rota | Tela |
|---|---|
| `/ligas` | `V2Leagues` — "Abertas a todos" e "Minhas ligas"; "Criar liga" e "Criar torneio" |
| `/ligas/criar` | `V2CreateLeague` — 5 passos: organizador, formato, temporada e pontuação (com a ordem do desempate), divisões ("Uma divisão por faixa de DUPR" monta as cinco faixas numéricas da lista oficial), dados |
| `/ligas/:id/:tab?` | `V2League` — `visao`, `classificacao`, `rodadas`, `playoff` (só com o playoff ligado, `LeaguePlayoff`), `inscritos` e, para quem gere, `gerir` (`?secao=situacao|dados|temporada|divisoes|inscricoes|rodadas|equipe`). Na escada as abas se chamam **Escada** (`LeagueLadder`) e **Sessões** (`LeagueSessions`), e Gerir → Sessões é a chamada (`LeagueSessionPanel`) — os valores de aba são os mesmos |

Componentes em `src/v2/components/leagues/`. Sem nenhuma flag ligada, as rotas
redirecionam para `/torneios` (`LeaguesGate`). Os valores de aba e de `?secao=`
são contrato de link.

## 7. LGPD

- **Exportação** (Configurações → Exportar): bloco `leagues` com cada liga por onde
  a pessoa passou e as inscrições dela (`collectLeagueExport`).
- **Exclusão de conta** (`coletarLigas` em `functions/accountDeletion.js`): a liga e
  os jogos ficam (são o histórico dos adversários); a pessoa sai de `member_uids`,
  `admins` e `ever_uids` e, nas inscrições, vira "Atleta removido", sem a categoria.

## 8. Ainda não (decisões e próximos PRs)

- **Ranking e DUPR**: os jogos de liga **não** contam no ranking da plataforma nem
  vão ao DUPR — decisão do dono pendente. A tela diz isso.
- Corrida de vagas: duas inscrições simultâneas na última vaga podem passar (a
  contagem não é transacional) — anotado no código.

## 9. Padrões compartilhados com o torneio (2026-11-12)

Pedido do dono: aproveitar na liga os padrões, campos e itens que já existem,
sem misturar os dois módulos.

### 9.1 Faixa de nível: a lista OFICIAL

A lista de faixas da Carreira virou a lista oficial da plataforma, em
`src/core/domain/levelBrackets.js` (`LEVEL_BRACKETS`, `LEVEL_BRACKET_LABEL`,
`bracketRange`, `levelBracketOptions`, `levelBracketText`, `levelVsBracket`). A
Carreira reexporta dela (os valores gravados em `career_events.level_bracket` são
os mesmos). As faixas numéricas (`2.000-2.999` … `4.500+`) têm faixa de DUPR;
as descritivas (iniciante, intermediário, avançado, pro, aberta, outra) são nome e
não barram ninguém.

Onde ela vale hoje:

| Onde | Campo | Como |
|---|---|---|
| Carreira | `career_events.level_bracket` | a mesma de sempre |
| Divisão da liga | `rule: { kind: 'bracket', bracket }` | a faixa numérica confere o DUPR do perfil (média da dupla); a descritiva é o nome |
| Modalidade do torneio | `tournament_modalities.skill_level` | o seletor oferece a lista oficial; os valores antigos (`beginner` … `pro`, `intermediate_plus`, `elite`) seguem gravados e aparecem com o nome de sempre. O aviso de nível da inscrição compara o DUPR do perfil com a faixa — só avisa, nunca barra |
| Convite de jogo (`open_games.level`) | `level` | o convite novo grava a faixa oficial; o antigo (código do nivelamento) continua aparecendo |

Onde ela **não** entra, de propósito: o **nível declarado** da pessoa no cadastro
(`leveling`, é o nível dela, não uma faixa de evento); o **mínimo e o máximo** do
jogo aberto da arena e dos grupos do Play (são pontos na régua 2.0–8.0 em degraus
de 0,5, conferidos pela régua única — uma faixa como 3.000–3.499 não cabe nesses
degraus sem mudar o que está gravado); dificuldade de treino e níveis de árbitro
(outros conceitos). Nada foi migrado.

### 9.2 Desempate configurável

A regra de desempate do torneio (`tiebreak.js`, USA Pickleball 15.B.4, mini-tabela
recalculada a cada nível) mudou para `src/core/domain/tiebreak.js`; o caminho
antigo em `modules/tournament/domain/` só reexporta. A liga usa a MESMA função
(`rankByOfficialCriteria`) dentro de cada bloco de mesmos pontos (ou mesmo
aproveitamento), e a ordem é configurável com o MESMO editor do torneio
(`TiebreakOrderEditor`: ordens prontas, subir, descer, tirar, acrescentar,
"Voltar ao padrão"). A tabela diz embaixo a ordem que está valendo. O servidor
filtra a ordem gravada pelos nove critérios conhecidos (`tiebreakOrder` em
`functions/leaguePolicy.js`, com paridade).

### 9.3 Inscrição pela organização como exceção

Como na inscrição de torneio: a organização vê, antes de inscrever, se a dupla
ou o atleta não cabe na divisão (faixa de DUPR, categoria, soma do time), com o
motivo — e pode inscrever assim mesmo. Não há mais o interruptor "por exceção":
o servidor confere e marca `override: true` quando não cabe. Quem não tem conta
entra sem DUPR e sem categoria, e a tela pede para conferir.

## 10. Escada (King of the Court e escada de duplas)

Pedido do dono: o King of the Court usa o padrão do **Americano** que já existe no
torneio e no dia de jogo. A divisão em grupos e o rodízio de parceiros foram para
o núcleo (`core/domain/americanoGroups.js`: `americanoFecha`,
`americanoGroupSizes`, `americanoCourtMatches`) e o Americano em etapas do torneio
importa de lá (`etapaGroupSizes`) — a liga não importa nada do torneio.

- **A escada é DERIVADA, nunca gravada** (`computeLadder`, `leagues/domain/leagueLadder.js`,
  cópia em `functions/leagueLadder.js` com paridade em `leagueLadder.parity.test.js`).
  Ordem inicial: média do DUPR das inscrições (sem DUPR, no fim), depois a hora da
  inscrição. Quem se inscreve depois de uma sessão começar entra **embaixo**, antes
  daquela sessão.
- **Sessão**: os presentes, na ordem da escada, são cortados em quadras
  (`buildSessionGroups`): na individual, quadras de 4 ou 5 (o menor desvio de 4,
  as maiores em cima) jogando um Americano — com 4, três jogos; com 5, cinco jogos
  e cada um descansa um; na de duplas, grupos de 3 a 5 duplas em todos contra
  todos. Número de presentes que não fecha (6 ou 7 na individual) é recusado, e a
  tela diz com quantos fecha (`ladderNearestFits`).
- **Sobe e desce**: com TODOS os placares da sessão lançados, em cada fronteira de
  quadras o último da de cima troca com o 1º da de baixo. **Quem falta fica no
  lugar**: os presentes são recolocados só nas posições que já ocupavam.
- **Quem fica à frente na quadra**: vitórias → saldo de pontos → pontos feitos por
  padrão, configurável em Temporada (`standings.tiebreak_order`, o MESMO editor do
  torneio com `allowedKeys`); confronto direto não entra (na quadra o parceiro
  muda a cada jogo); empate em tudo fica com quem estava acima.
- **Refazer**: sessão sem nenhum placar pode ser gerada de novo com outra chamada;
  com algum placar, a próxima só sai quando a atual fecha. Corrigir um placar de
  sessão antiga refaz a escada daí em diante (é derivada), mas não refaz as quadras
  das sessões já geradas.
- Na escada não há pontos por vitória nem turnos: a Temporada mostra só o
  calendário de sessões e o desempate da quadra.

## 11. Equipes (MiLP 4×4 mista, v3 e v4)

Os três formatos de equipe jogam como os de duplas por divisão — pontos corridos
na divisão (ação `schedule`), rodadas no calendário —, mas quem se enfrenta são
EQUIPES, e o jogo da rodada é um CONFRONTO de vários jogos de duplas.

- **Inscrição**: quem inscreve escolhe os companheiros (`PersonPicker`, a lista da
  plataforma) e dá o nome da equipe. A montagem é conferida pela categoria do
  PERFIL (`teamCompositionError`, cópia no servidor com paridade): na MiLP 2
  homens e 2 mulheres; na v4 todos da mesma categoria; na v3 livre. Categoria
  desconhecida não vira palpite (`gender_unknown`). A organização inscreve fora
  da montagem como no torneio — aviso na tela e `eligibility.override`.
- **Divisão**: soma do DUPR da equipe (`dupr_sum`, teto da soma, teto individual e o
  valor de quem não tem DUPR), com as divisões da MiLP prontas (`milpDivisions`).
  A faixa oficial (`bracket`) também vale, pela média da equipe.
- **Confronto**: `lines` de `LEAGUE_FORMAT_META` — MiLP: duplas femininas,
  duplas masculinas, mista 1 e mista 2; v3: A+B, B+C, A+C; v4: 1+2, 3+4, 1+3,
  2+4. Um game por jogo (a MiLP joga até 21). Vence quem ganhar mais jogos; em 2 a
  2 (MiLP e v4) decide o **DreamBreaker** — simples em rodízio, todos da equipe
  jogam, troca a cada 4 pontos, até 21. O placar do DreamBreaker é gravado em
  `dreambreaker` e só vale no empate (fora dele o servidor grava `null`).
- **Tabela**: por aproveitamento por padrão (como a MiLP; a organização troca no
  passo 3). Vitória e derrota contam o CONFRONTO; "games" são os jogos ganhos do
  confronto e os pontos somam os jogos — o DreamBreaker decide quem venceu, mas
  não entra no saldo.
- Quem jogou cada linha (a escalação) **não** é gravado: a tabela não depende
  dela, e ela passa a importar quando os jogos de liga forem ao DUPR (§8).

## 12. Playoff (o mata-mata do fim da temporada)

Ligado em **Temporada** (`season.playoff`: `enabled`, `size` 2 | 4 | 8,
`third_place`), em qualquer formato menos a escada. A aba **Playoff** aparece
com ele ligado.

- **A chave** sai da classificação da temporada (`computeLeagueStandings`, sem
  quem desistiu): os N primeiros, cortados ao que a divisão permite
  (`playoffSize`: 6 inscritos num playoff de 8 viram 4). Cruzamento clássico
  (`playoffFirstRound`): 1 × último, e a 1ª e a 2ª cabeça só se cruzam na final.
  A tela mostra a tabela e manda a ordem; o servidor confere que são inscrições
  ATIVAS da divisão, e quem organiza responde por ela (vai para a auditoria).
  Jogo da temporada sem placar não segura a chave — a tela avisa quantos faltam.
- **Fase a fase**: a próxima fase nasce dos vencedores quando a atual fecha
  (`playoffState`: `none` → `playing` → `ready` → `done`), com a disputa do
  3º lugar junto da final (chave de 4 ou 8). Campeão, vice e 3º são DERIVADOS
  dos placares — nada é gravado além dos jogos. A conta tem cópia no servidor
  (`functions/leaguePlayoff.js`, paridade `leaguePlayoff.parity.test.js`).
- **Corrigir um placar** de uma fase já seguida: com a fase seguinte sem placar,
  ela é apagada e sai de novo com os vencedores certos; com placar, a correção é
  recusada (apague antes o placar da fase seguinte). "Refazer a chave pela
  tabela" só enquanto nenhum jogo do playoff tem placar.
- Nas **equipes** o jogo do playoff é o confronto de sempre (as linhas e o
  DreamBreaker do formato). A classificação da temporada não conta o playoff.

## 13. Liga flexível: quem joga lança, o outro lado confirma

Na `flex_pairs` (`self_report: true` no formato, cópia no servidor com paridade)
as duplas combinam dia e local, e o placar é delas:

1. Um lado lança (`report`): o jogo fica **A confirmar** e o outro lado é avisado.
   Quem lançou pode corrigir enquanto o outro não responde. W.O. não — esse é da
   organização.
2. O outro lado **confirma** (o placar vale e entra na tabela) ou **contesta**
   dizendo o que está errado (o jogo fica **Contestado**, a organização e quem
   lançou são avisados). Contestado, qualquer lado lança de novo.
3. A organização sempre pode lançar ou corrigir pelo `result`, que vence e limpa
   o lançado e a contestação.

Só quem está numa das inscrições do jogo lança ou confirma (o servidor confere
pelas inscrições, nunca pela tela). Placar a confirmar não conta na tabela. No
playoff o placar é sempre da organização.

4. **Sem resposta no prazo, o placar vale.** A varredura
   `leagueAutoConfirmWorker` (a cada hora) confirma o placar lançado há
   `AUTO_CONFIRM_HOURS` (72 h, cópia no servidor com paridade) sem resposta,
   como se o outro lado confirmasse (`confirmed_by: null`, `auto_confirmed: true`),
   e avisa os dois lados. O prazo é dito no aviso e na tela.
5. **Minha área.** A liga guarda `pending_confirm { uid: n }` — quantos placares
   cada conta tem a confirmar —, refeito pelo servidor a cada lançamento,
   confirmação, contestação, correção da organização e confirmação pelo prazo
   (a partir de `report.confirm_uids`, os uids do outro lado no momento do
   lançamento). A faixa "Precisa de você" soma as ligas em andamento
   (`myLeaguePending`) e leva à aba Rodadas (ou a `/ligas` com várias). Só
   uids: nenhum dado pessoal no documento público.
6. **Início.** O card "Ligas" (`ligas`, escolhido pela pessoa em Personalizar,
   `HomeLeaguesCard`) mostra até 3 das minhas ligas em andamento ou com
   inscrição aberta (`homeLeagueRows`), com "{n} placares para confirmar" em
   destaque. A ajuda é o artigo `ligas` da Central de Ajuda (com as pistas
   `/ligas`, `/ligas/*` e `/ligas/*/*`).
