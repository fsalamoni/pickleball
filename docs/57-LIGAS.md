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
| `flex_pairs` — Liga flexível (DUPR Flex) | dupla fixa | idem, mas cada rodada tem prazo e as duplas combinam dia e local |
| `divisional_singles` — Simples por divisão | atleta | pontos corridos em simples |

**Desenhados e marcados "Em breve"** (aparecem no passo 2 da criação, desabilitados):
escada de duplas, escada individual (sobe e desce / King of the Court), equipes
4×4 mista com DreamBreaker (MiLP), equipes 3×3 (MiLP v3) e equipes 4×4 do mesmo
gênero (v4). As divisões por soma do DUPR da equipe (MiLP: 12–22, v3: 9–15) já
estão no domínio (`MILP_DIVISIONS`, regra `dupr_sum`).

Os ids de formato, de status, de regra de divisão e de gênero são **gravados**:
nunca renomeie.

## 4. Dados

Tudo debaixo de `leagues/{liga}` — **uma regra de leitura** (`allow read: if
isAuthed()`) e **nenhuma escrita** pelo cliente.

| Documento | Campos principais |
|---|---|
| `leagues/{id}` | `name`, `description`, `city`, `state`, `location`, `format`, `entry_type`, `organizer {type,id,name}`, `status` (`draft`→`open`→`running`→`finished`, ou `cancelled`), `season`, `standings`, `visibility` (`public`/`unlisted`), `self_registration`, `admins[]`, `member_uids[]`, `ever_uids[]`, `entries_count` |
| `…/divisions/{id}` | `name`, `order`, `gender`, `rule {kind, min, max, allow_unrated, cap, individual_cap, unrated_value}`, `max_entries` |
| `…/entries/{id}` | `division_id`, `name`, `auto_name`, `players[{uid?, name, dupr?, gender?}]`, `player_uids[]`, `status` (`active`/`withdrawn`), `override`, `added_by` |
| `…/matches/{id}` | `division_id`, `phase: 'season'`, `round`, `side_a`, `side_b` (ids de inscrição), `games[{a,b}]`, `wo_winner`, `played_date`, `recorded_by` |

- **Classificação e datas das rodadas são DERIVADAS**, nunca gravadas:
  `computeLeagueStandings(entries, matches, standings)` e `roundCalendar(season, n)`.
  Mudar a pontuação recalcula a tabela na hora; mudar o calendário muda as datas,
  não os jogos.
- `season`: `cadence` (`weekly`/`biweekly`/`monthly`/`custom`), `start_date`,
  `dates[]` (custom), `time`, `round_window_days`, `legs` (1 ou 2), `skip_dates[]`.
- `standings`: `mode` (`points` / `win_pct`, como na MiLP), `win`, `loss`, `wo_loss`
  (padrão 3/1/0). Desempate: vitórias → confronto direto (só entre DOIS empatados)
  → saldo de games → saldo de pontos → pontos feitos.
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
| `register` | o atleta | liga aberta, `self_registration`, divisão não lotada, faixa de DUPR e categoria pelo PERFIL (`divisionEligibility`), ninguém duas vezes na divisão; a dupla recebe um aviso |
| `withdraw` | o próprio atleta ou quem gere | sem jogo gerado ⇒ apaga; com jogo ⇒ `withdrawn` (os placares seguem valendo para os adversários) |
| `entry_add` | quem gere | pode inscrever sem conta (só o nome) e **por exceção** (`override`, fica marcado) |
| `schedule` | quem gere | gera os jogos da divisão em pontos corridos (`roundRobin`, método do círculo; folga quando é ímpar); refazer só sem placar lançado; com a liga aberta, começa a temporada |
| `result` | quem gere | `validateResult`: até 5 games, 0–99, sem empate, ou W.O.; `clear` apaga |
| `staff` | quem gere | até 10 organizadores; o criador não sai |

**Quem gere** (`podeGerir`, espelhado no cliente por `canManageLeague`): a lista
`admins`, o admin da plataforma e — pelo organizador — o admin do clube, o gestor
da arena ou a equipe `competitions` da federação. Para atleta e professor só a
lista `admins`.

Grava `audit_logs` na criação, na troca de status, ao gerar rodadas, ao lançar
ou apagar placar e ao mudar a organização (`league_created`, `league_status`,
`league_schedule`, `league_result`, `league_result_cleared`, `league_staff`).

## 6. Telas

| Rota | Tela |
|---|---|
| `/ligas` | `V2Leagues` — "Abertas a todos" e "Minhas ligas"; "Criar liga" e "Criar torneio" |
| `/ligas/criar` | `V2CreateLeague` — 5 passos: organizador, formato, temporada e pontuação, divisões (conjunto sugerido por DUPR), dados |
| `/ligas/:id/:tab?` | `V2League` — `visao`, `classificacao`, `rodadas`, `inscritos` e, para quem gere, `gerir` (`?secao=situacao|dados|temporada|divisoes|inscricoes|rodadas|equipe`) |

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
- **PR 2**: escadas (duplas e individual), equipes MiLP/v3/v4 com DreamBreaker,
  playoff no fim da temporada.
- **PR 3**: na liga flexível, o próprio atleta lança e o adversário confirma.
- Corrida de vagas: duas inscrições simultâneas na última vaga podem passar (a
  contagem não é transacional) — anotado no código.
