# Onda 5b — Torneios internos

> **Módulos**: `leagues` · `leagues_internal` · `leagues_ladder` ·
> `leagues_open_play` · `leagues_prizing`
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção nova, zero índice novo, zero regra nova.
>
> **Atualização 2026-09-24 (Onda BG)**: os torneios passaram a ser PARTE da
> arena — seção **Torneios** na Central (da casa + da plataforma), "Torneios da
> casa" na página, inscrições em "Meus torneios". **A inscrição nunca tinha
> funcionado** (a regra só deixava a arena atualizar o torneio) e **"Encerrar"
> não tinha botão** — corrigidos. Ver `09-INTEGRACAO-NA-ARENA.md` §6.
>
> ## ⚠️ Atualização 2026-09-25 (Onda CB): o torneio interno SAIU
>
> *"Você deve transformar os torneios da plataforma em torneios da plataforma
> na casa, excluindo o que foi criado como 'torneio da casa'."*
>
> O torneio interno era uma segunda porta para a mesma sala: começar o torneio
> **criava um dia de jogo da arena** (§2 abaixo), e desde a Onda CA **todo jogo
> aberto já é um dia de jogo**. Sobrou uma competição paralela, com inscrição,
> formato e ladder próprios, fazendo pior o que o jogo aberto faz melhor. Então:
>
> | Antes | Agora |
> |---|---|
> | "Torneio da casa" = `arena_internal_tournaments`, com regras próprias | **Torneio da casa = torneio da PLATAFORMA sediado na arena** (`tournaments.arena_id`), com as regras da plataforma (chaves, desempate, ranking nacional) |
> | Ladder somado à mão ao "Encerrar e pontuar" | **Ranking da casa DERIVADO** (`domain/houseRanking.js`): jogos abertos/dias de jogo com placar + torneios da casa encerrados, por temporada, somado a cada leitura — ninguém clica em nada |
> | Central → Torneios → *Da casa* · *Da plataforma* | Central → Torneios → **Torneios da casa** · **Ranking da casa** |
> | Página da arena → "Torneios da casa" (os internos) | Página da arena → **Torneios da casa** (os da plataforma) + chamada **Ranking da casa** |
> | `/arenas/:id/torneios` = torneios internos | `/arenas/:id/torneios` = ranking da casa + torneios da casa |
> | "Meus torneios" mostrava os internos | Só os torneios da plataforma (os da casa já estão lá) |
>
> **Nada foi apagado do banco.** `arena_internal_tournaments` e
> `arena_ladders` seguem como estão, e a regra também. O que mudou foi a tela:
>
> - **Encerrados** → os pontos que já foram para o ladder (`{arena}_geral`)
>   **continuam** no ranking da casa, como "Torneios internos (formato
>   antigo)". O dia de jogo de um torneio encerrado é **excluído** da soma pelo
>   placar (`legacyLadderGameDayIds`) — senão contaria duas vezes.
> - **Abertos** (`scheduled`) → a Central mostra um aviso
>   (`LegacyInternalTournamentsNotice`) com **"Cancelar e avisar os
>   inscritos"** (o `cancelInternalTournament` de sempre): sumir com eles
>   calado deixaria gente inscrita num torneio que ninguém vê.
> - **Em andamento** (`running`) → já viraram dia de jogo; o aviso leva a ele,
>   e o placar conta sozinho no ranking da casa.
> - O **bloqueio de quadra** dos torneios internos segue derivado
>   (`tournamentBlocks`): um torneio antigo marcado para o futuro continua
>   ocupando a quadra até ser cancelado.
>
> O catálogo mudou de sentido sem mudar de id (o id é contrato de banco):
> `leagues` passou a ser **"Ranking da casa"**; `leagues_internal`,
> `leagues_ladder` e `leagues_prizing` ganharam o status novo **`retired`**
> (não liberável — somem da tela da arena; o admin os vê como "Aposentado").
>
> O restante deste documento descreve o módulo como ele era, e fica como
> histórico. A referência atual é `09-INTEGRACAO-NA-ARENA.md` §15.

---

## 1. O que existia e o que não funcionava

| # | Defeito | Sintoma para quem usa |
|---|---|---|
| 1 | **O torneio não gerava partida nenhuma** | Guardava `format: 'single_elimination'` e nada no projeto sorteava nada. O atleta se inscrevia e acabava ali. Um torneio que não vira jogo é uma lista de nomes. |
| 2 | **O ladder era lido e nunca escrito** | `getLadder` consultava `arena_ladders` e **nada no projeto gravava naquela coleção**. A classificação da arena estava vazia desde sempre, para todo mundo. |
| 3 | **O torneio não ocupava a quadra** | Marcar um torneio das 14h às 18h no sábado não impedia a arena de vender aquelas quadras no mesmo horário. |
| 4 | **Não dava para sair** | Só entrar. Um torneio de que ninguém consegue sair enche de gente que não vai aparecer, e o sorteio nasce errado. |
| 5 | **Não dava para editar, cancelar nem apagar** | Só criar. |

---

## 2. A decisão que evitou reescrever a plataforma

A arena já tem uma máquina completa de dia de jogo: sorteio equilibrado pela
régua 2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking do dia,
telão e tutoriais.

**Um torneio interno é exatamente isso, com inscrição antecipada e prêmio.**

```
arena cria o torneio        (nome, data, quadras, horário, formato, vagas, taxa)
        │
        ▼
atletas se inscrevem / saem     ← roster com nome e foto, não só uids
        │
        ▼
arena clica "Começar o torneio"
        │
        ├── cria um DIA DE JOGO da arena com os inscritos, no formato escolhido
        ├── grava `game_day_id` no torneio
        └── status → running
        │
        ▼
tudo o que a plataforma já sabe fazer passa a valer, sem código novo:
sorteio, placar, ranking do dia, telão, tutoriais
        │
        ▼
"Encerrar" soma o resultado ao LADDER da arena
```

O corolário é o mesmo da Onda AA: **o ambiente do atleta não precisou de nada
novo.**

Três detalhes de ordem que valem a pena:

- **O dia de jogo é criado ANTES de o torneio virar "em andamento".** Se a
  criação falhar (uma quadra ficou ocupada no meio do caminho), o torneio
  continua com as inscrições abertas e a arena tenta de novo — em vez de ficar
  "em andamento" sem jogo nenhum.
- **Os inscritos entram em série**, não em paralelo: são poucas dezenas, e o
  paralelo só aumentaria a chance de bater no limite de escrita.
- **Um inscrito que falhe não derruba o torneio** — o `catch` registra e segue.
  Melhor 15 dos 16 na quadra do que ninguém.

### O formato passou a significar alguma coisa

`single_elimination` era guardado e não existia executor. Agora o formato é um
dos que **o dia de jogo sabe conduzir** — Americano, Americano aprimorado,
Mexicano, Rei da Quadra, Open Play — e valor desconhecido cai no Americano,
que é o mais comum numa arena.

---

## 3. O torneio ocupa a quadra

`court_ids` + `start_time` + `end_time`, todos opcionais, e o bloqueio é
**derivado** (`tournamentBlocks` / `mergeTournamentBlocks`) — como o dia de
jogo e a aula, porque `arena_internal_tournaments` é legível por qualquer
conta autenticada.

Três recortes:

- **Sem quadra escolhida não bloqueia nada.** A arena pode anunciar a data
  antes de decidir onde; fechar quadra por um torneio que ainda não tem lugar
  seria inventar ocupação.
- **Escolher quadra sem dizer o horário é ERRO**, não bloqueio do dia inteiro.
- **Torneio que virou dia de jogo para de derivar por aqui.** O dia de jogo já
  bloqueia; contar duas vezes mostraria dois bloqueios para o mesmo horário na
  tela de gestão.

Criar ou editar um torneio **confere as quadras antes**.

---

## 4. O ladder passou a existir

```js
applyTournamentToLadder(ladderAtual, classificacaoFinal) → novoLadder
```

| Posição | Pontos |
|---|---|
| 1º | 100 |
| 2º | 70 |
| 3º | 50 |
| 4º | 35 |
| **participou** | **10** |

**Por que quem não pontuou leva 10.** Um ladder em que só os quatro primeiros
somam faz todo mundo desistir na segunda semana. A classificação da casa é
sobre aparecer.

A acumulação é pura e testada — é a parte que ninguém confere de olho. O nome
mais recente vence (quem trocou de nome na plataforma não fica com o antigo
para sempre), e o ladder para em 100 linhas: além disso vira relatório, não
motivação.

O documento tem **id determinístico** (`arenaId_periodo`), então `setDoc` com
`merge` cria na primeira vez e atualiza depois — sem consulta, sem índice, e
sem o risco de dois documentos para o mesmo período. A leitura passou a ser um
`getDoc` no lugar de uma consulta com dois filtros.

---

## 5. O que mais foi entregue

| O quê | Antes | Agora |
|---|---|---|
| Sair do torneio | não existia | devolve a vaga; recusado depois que o torneio começa |
| Editar | não existia | com trava: não dá para reduzir vagas abaixo dos inscritos, nem editar torneio que já começou |
| Cancelar | não existia | **avisa os inscritos** e devolve as quadras |
| Apagar | não existia | só torneio encerrado ou cancelado |
| Roster | só uids | nome, foto e nível — sem isso o dia de jogo nasceria com uma lista de identificadores |
| Quem já está | invisível | mostrado na tela: "tem gente que eu conheço" vale mais que qualquer texto |

Sobre o `roster`: sair usa **reescrita da lista filtrada**, não `arrayRemove`.
`arrayRemove` num objeto exige igualdade exata de todos os campos, e o formato
pode mudar entre versões — filtrar funciona sempre.

---

## 6. O que foi tocado

**Domínio** (`domain/leagues.js`, +27 asserções): `tournamentBlocks`,
`mergeTournamentBlocks`, `isTournamentOpen`, `tournamentSeatsLeft`,
`applyTournamentToLadder`, `ladderPointsFor`, `LADDER_POINTS`, `LADDER_MAX`,
`INTERNAL_TOURNAMENT_FORMAT(+_META)`, `INTERNAL_TOURNAMENT_STATUS_META`,
`PRIZE_TYPE_META`; `normalizeInternalTournamentInput` com quadras, horário e
formato executável.

**Serviço** (`services/leaguesService.js`): `leaveTournament`,
`updateInternalTournament`, `cancelInternalTournament`,
`deleteInternalTournament`, **`startInternalTournament`**,
**`finishInternalTournament`**, o `roster` na inscrição, a conferência de
quadra ocupada e `getLadder` por id.

**Composição** (`domain/arenaBlocks.js`): o torneio virou a **quinta fonte** de
ocupação — e entrou numa linha, que era o ponto do refactor da Onda 5a.

**Tela** (`V2ArenaLeagues.jsx`, reescrita, +19 asserções de runtime).

**Banco**: nada. Campos opcionais em `arena_internal_tournaments`
(`court_ids`, `start_time`, `end_time`, `game_day_id`, `roster`,
`cancel_reason`, `started_at`, `finished_at`, `final_standings`).

---

## 7. O que NÃO pode regredir

1. **Começar o torneio cria o dia de jogo**, e o dia de jogo é criado antes de
   o status mudar.
2. **Torneio com `game_day_id` não deriva bloqueio** — quem bloqueia é o dia
   de jogo.
3. **Escolher quadra sem horário é erro.**
4. **Cancelar avisa os inscritos** e devolve as quadras.
5. **O ladder acumula**, e quem participou pontua.
6. **O ladder é lido e escrito pelo mesmo id determinístico.**
7. **O `roster` guarda nome** — sem ele o sorteio mostra identificadores.
8. **Dá para sair** enquanto as inscrições estão abertas.
