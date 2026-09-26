# Rankings e rating — quando e como são atualizados

> **Regra central**: todo resultado publicado atualiza **na hora** os três
> rankings que dependem de partida. Não há espera, não há botão obrigatório,
> não há tarefa noturna.

---

## 1. Quais são os rankings

| Ranking | Onde vive | Página |
|---|---|---|
| **ELO / nacional** | `player_ratings` + `rating_history` | `/ranking` (aba Nacional) |
| **Rating estilo DUPR** (2.0–8.0) | `player_skill_ratings` + `skill_rating_history` | `/ranking?tab=dupr` |
| **Duplas** | `doubles_rankings` | `/ranking/duplas` |

Os três saem **dos mesmos jogos**: `tournament_matches` (torneios públicos e
encerrados) + `club_event_games` (dias de jogo e eventos de clube publicados).

**Simples × duplas (Onda CF).** O que decide para onde vai um jogo é o número
de atletas de cada lado, nos três motores, sem campo nenhum a conferir:

| Jogo | ELO / nacional | Rating 2.0–8.0 | Ranking de duplas |
|---|---|---|---|
| 1 × 1 (simples) | entra | bloco **simples** | **não** entra |
| 2 × 2 (duplas) | entra | bloco **duplas** | entra |

Desde a Onda CF o dia de jogo cria jogo simples no Play, no Americano e no
Americano aprimorado; publicado, o espelho grava `kind: 'singles'` com um uid
por lado. Nenhuma linha mudou no servidor — os motores já separavam, e
`functions/singlesRankings.test.js` prova o caminho inteiro.

O ranking **interno de clube** é outra coisa, com o seu próprio conjunto de
gatilhos (`functions/clubRanking.js`), e não mudou.

## 2. A classificação do ranking de duplas

Uma linha por **parceria** (os dois atletas que jogaram juntos do mesmo lado).
A ordem é:

1. **aproveitamento** (vitórias ÷ jogos);
2. maior número de **vitórias**;
3. menor número de **derrotas**;
4. maior **saldo de pontos**.

> **Consequência a conhecer**: o aproveitamento vem primeiro, então uma dupla
> com 1 jogo e 1 vitória (100%) fica à frente de uma com 50 jogos e 45 vitórias
> (90%). É a regra pedida — e é por isso que a página oferece a **amostra
> mínima** (§6.1), para cada pessoa escolher a partir de quantos jogos uma dupla
> entra na SUA visualização.

Um quinto critério existe só para a ordenação ser **estável** (a chave da
parceria). Sem ele, duas duplas idênticas em tudo trocariam de posição entre um
recálculo e outro, e a tela mostraria mudanças que não aconteceram.

A regra mora em **um lugar só**: `compareDoublesRows`, em
`src/modules/rating/domain/doublesRanking.js`.

## 3. Quando cada coisa é recalculada

Tudo passa por **gatilhos do Firestore** (`functions/index.js`):

| Gatilho | Dispara quando | Recalcula |
|---|---|---|
| `recomputeRankingOnClubEventGame` | escreve em `club_event_games/{id}` | os três |
| `recomputeRankingOnTournamentMatch` | escreve em `tournament_matches/{id}` | os três |
| `recomputeRankingOnTournamentRegistration` | muda o uid por trás de uma inscrição | os três |
| `recomputeRankingOnTournamentChange` | `tournaments/{id}` muda de elegibilidade | os três |
| `catchUpPlatformRankings` (agendada, 30 min) | entrou resultado **sem** passada correspondente | os três |

### A recuperação agendada: o gatilho que não disparou

Gatilho **não tem fila**: se a função não existe no momento da escrita, o
evento se perde. 🐞 Foi o que aconteceu em 2026-09-22: o deploy de outro
aplicativo do mesmo projeto Firebase apagou as funções daqui, e o dia de jogo
publicado naquela noite (12 partidas) ficou fora do ranking 2.0–8.0. Quando as
funções voltaram, nada recalculou — nada novo tinha sido escrito.

Cada passada grava uma **impressão** do que leu em
`platform_settings/ranking_worker.last_result.fingerprint`: quantas partidas de
torneio decididas, quantos jogos de dia de jogo publicados e o hash da
assinatura dos torneios elegíveis. A cada 30 min `catchUpPlatformRankings`
(`functions/rankingCatchUp.js`) lê a impressão ATUAL — duas contagens, uma
leitura por mil documentos, mais a lista de torneios — e só recalcula quando
ela difere. Em dia, **não grava nada**. A passada e a recuperação medem pela
mesma função (`impressaoDosResultados`). Na primeira execução depois do deploy
não há impressão gravada: ela recalcula uma vez e fica em dia.

Limite honesto: editar o placar de um jogo já publicado não muda contagem nem
assinatura; se isso acontecer justamente com as funções fora do ar, entra na
próxima passada.

E o histórico de ELO só ganha ponto quando o rating **muda**
(`proximoHistoricoElo`): antes, toda passada somava um ponto para todo mundo, e
passadas sem jogo novo empurrariam a evolução real para fora dos 50 pontos
guardados.

Publicar um dia de jogo grava o espelho em `club_event_games` → o gatilho
dispara → os três rankings são reescritos. Corrigir um placar, excluir uma
partida ou despublicar seguem o mesmo caminho.

**Criação, edição e exclusão contam igual**: `mudouResultado` devolve `true`
quando o documento nasce ou some, e compara campo a campo no meio. Mexer em
quadra, horário ou observação **não** dispara nada.

### FACULTATIVO × NÃO FACULTATIVO: o que é o gatilho de cada origem

É a única diferença real entre as origens, e ela não é um detalhe técnico:

| Origem | O que faz o resultado contar | Por quê |
|---|---|---|
| **Torneio** | o **lançamento** do placar | não é facultativo: o resultado é lançado porque a partida aconteceu |
| **Dia de jogo / evento de clube** | a **publicação** no ranking | é uma DECISÃO de quem organiza — nem todo dia de jogo é para valer |

> 🐞 **O atraso que isto corrigiu.** A elegibilidade do torneio exigia
> `status === 'finished'`. Num torneio de três dias, nada do que acontecia em
> quadra aparecia no rating até alguém clicar em "encerrar" — às vezes dias
> depois, às vezes nunca. E o organizador não tinha como saber que faltava um
> passo, porque lançar o resultado já parecia o passo final. Agora conta a
> partir do momento em que entra na plataforma.

> **Dia de jogo do CLUBE (Onda AS).** A partir dela, uma data NOVA de evento
> de clube é um `game_days`, então ela publica pelo mesmo caminho do dia de
> jogo do atleta e da arena (`publishGameDayToRanking` → `club_event_games` →
> gatilho). Uma diferença deliberada no espelho: num dia de jogo de clube o
> `club_id` gravado é o clube **DONO**, não o clube inferido pelos atletas.
> São duas razões — é o clube certo (a partida aconteceu no evento dele) e é o
> campo que `isClubAdmin(club_id)` confere na regra de `club_event_games`, sem
> o qual só quem agendou a data conseguiria publicar. As datas LEGADAS seguem
> publicando pelo caminho de sempre (`rankingPublishingService`), intocadas.

Continua de fora o que não é resultado de verdade: torneio em **rascunho**
(ambiente de teste), **cancelado** (não aconteceu), **privado** (não alimenta
ranking público) e **arquivado**. Como o recálculo é sempre integral, cancelar
ou arquivar **tira** do ranking o que já tinha contado — sem passo nenhum a
mais. A regra vive em `isTournamentRankingEligible`
(`tournament/domain/rankingEligibility.js`) e no espelho `isEligible`
(`functions/ranking.js`), com teste de paridade entre as duas.

### A inscrição também move o ranking

A partida guarda ids de **inscrição**, não uids: o ranking só descobre de quem
é o resultado resolvendo a inscrição. Então preencher ou trocar o uid de uma
inscrição — o que a migração de inscrições provisórias faz — muda a quem o jogo
pertence **sem tocar em partida nenhuma**. Era o único caminho que ainda
dependia de um admin apertar "Recalcular ranking agora"; hoje tem gatilho
próprio (`CAMPOS_INSCRICAO`).

### Por que no servidor, e não no navegador

Materializar ranking é escrita em coleção que, pelas regras, **só o admin da
plataforma escreve** — e tem de ser assim: é o placar oficial de todo mundo.

Antes, o cliente tentava recalcular na publicação
(`maybeAutoRecomputeRatings(force)`). Só que **quem publica um dia de jogo quase
nunca é o admin**: a escrita era recusada pela regra e o erro caía num `catch`
com log. Na prática o ranking só se atualizava quando o admin clicava no botão
do painel. Agora a conta roda no servidor, com privilégio de servidor, e vale
para qualquer pessoa que publique.

### Coalescência: por que a rajada não recalcula N vezes

Publicar um dia de jogo grava dezenas de partidas de uma vez, e cada escrita
acorda um gatilho. Recalcular a plataforma inteira por partida seria absurdo.

O controle é um **lease** em `platform_settings/ranking_worker`:

```
   1ª escrita  → toma o lease → recalcula
   2ª..N       → lease ocupado → marca `pending: true` e sai na hora
   fim da 1ª   → vê `pending` → limpa e faz UMA passada final
```

A rajada inteira custa **duas passadas**, e a última enxerga todos os
resultados. Há teto de passadas (`MAX_PASSADAS_EXTRAS`) para não existir
ping-pong, e o lease é sempre solto ao final — inclusive no caminho de erro e
no de teto atingido, senão a próxima publicação ficaria travada até o TTL.

## 4. O bug que isto corrigiu

O recálculo de servidor que já existia (`functions/ranking.js`) lia **apenas**
`tournament_matches`. Ignorava `club_event_games` — que é onde vivem TODOS os
resultados de dia de jogo.

Como o cliente lia as duas fontes e o servidor lia uma, os dois escreviam
rankings **diferentes** na mesma coleção, e valia quem tivesse rodado por
último. Na prática: mudar o status de um torneio apagava do ranking nacional
todos os resultados de dia de jogo, sem erro nenhum aparecendo.

`functions/platformRankings.js` usa as duas fontes sempre, como o cliente. Há
teste preso nisso em `functions/platformRankings.test.js`.

## 5. Duas cópias dos motores, sem divergência

O pacote de Cloud Functions é publicado isolado e **não pode importar de
`../src`**. Por isso os motores existem duas vezes:

| Motor | Cliente | Servidor |
|---|---|---|
| ELO | `src/modules/rating/domain/elo.js` | `functions/ranking.js` |
| Rating 2.0–8.0 | `src/modules/rating/domain/duprScale.js` | `functions/engines/dupr.js` |
| Duplas | `src/modules/rating/domain/doublesRanking.js` | `functions/engines/doubles.js` |

Duas cópias de um algoritmo de pontuação é a forma mais fácil de a plataforma
passar a ter duas verdades. A garantia **não é disciplina de quem edita**: é o
teste de paridade em `functions/engines/parity.test.js`, que roda as duas
implementações sobre as mesmas 400 partidas e exige resultado idêntico — casa
decimal por casa decimal, posição por posição. Confere também a tabela de
níveis (a ORDEM importa para a semente do ELO; o texto USAP importa para a
semente do 2.0–8.0).

**Mexeu num lado, mexa no outro.** O teste acusa.

## 6. A página de duplas

- Lê **uma** coleção já classificada (`doubles_rankings`), com nome e foto
  embutidos. Antes lia `tournament_matches`, `club_event_games`,
  `tournament_registrations` e `athlete_profiles` **inteiras** a cada abertura e
  refazia a conta no navegador.
- A numeração vem do campo `position` gravado pelo servidor — a tela não
  reordena nada. O que o usuário lê é o que o servidor calculou.
- **Paginação**: 20, 50 ou 100 por página, com navegação por número. O estado
  (busca, tamanho, página) vive na **URL** (`?q=&tam=&pag=`), então o link é
  compartilhável e o botão "voltar" funciona.
- Enquanto a coleção não existir (antes do primeiro recálculo), a página recorre
  ao cálculo antigo no cliente. Ninguém vê tela vazia por causa da migração.

A paginação em si é domínio puro e compartilhado:
`src/core/domain/pagination.js` (e a tabela de exportação DUPR passou a usá-la
em vez da cópia que tinha).

### 6.1 Amostra mínima (preferência de cada usuário)

Um seletor — **Todas / 3+ / 5+ / 10+ / 20+ jogos** — define a partir de quantos
jogos uma parceria entra na visualização. Serve à consequência do §2: com
aproveitamento como primeiro critério, quem jogou uma vez e venceu lidera.

**O recorte RENUMERA.** A amostra mínima não é uma busca: ela redefine QUEM
disputa o ranking. Quem pede "só duplas com 10+ jogos" quer saber quem é a
primeira entre elas — ver "#37" no topo da própria tela pareceria defeito. A
ordem relativa não muda em nada; só a numeração acompanha o recorte, e a
posição no ranking geral continua visível ao lado de cada linha
(`overall_position`).

É a diferença entre este filtro e a **busca por nome**, que preserva a posição
geral: buscar é "encontre esta dupla no ranking", e ali a posição geral é
justamente a resposta.

**A escolha fica salva, por usuário, no navegador** —
`v2:view:<uid>:ranking:duplas:min-jogos`, via `core/lib/viewPreference.js`,
irmã de `collapsePreference.js`. Volta sozinha na próxima visita e sobrevive à
navegação por páginas e à busca. **Nada disso toca o banco**: é conveniência de
interface, não dado do produto, e não vale uma leitura por abertura de tela nem
uma escrita por clique.

Precedências, nesta ordem:

1. `?min=` na URL, quando traz um dos valores oferecidos — é o que faz um link
   compartilhado mostrar a mesma coisa para quem abre;
2. a preferência salva desta pessoa;
3. o padrão (todas as duplas).

Abrir o link de outra pessoa **não** reescreve a sua escolha: só mexer no
seletor grava. E voltar para "Todas" **apaga** a preferência em vez de gravar
`1`, para quem nunca escolheu e quem voltou ao padrão ficarem no mesmo estado.

Dois detalhes que custaram teste para acertar:

- a escolha vive em estado de React semeado da preferência, **não** numa
  leitura memoizada do storage: lendo o storage, "voltar para Todas" só faria
  efeito ao recarregar a página;
- ao espionar o `localStorage` em teste, espione `Storage.prototype`. No jsdom
  ele é um Proxy, e `vi.spyOn(window.localStorage, 'setItem')` não troca o
  método — grava uma chave chamada `"setItem"`, e o teste passa sem exercitar
  nada.

## 7. Banco de dados

**Uma coleção nova**, `doubles_rankings/{pair_key}`:

```js
{
  pair_key: 'uidA__uidB',        // ids ordenados: a chave é estável
  player_ids: ['uidA', 'uidB'],
  players: [{ uid, name, photo }, ...],  // desnormalizado: a página não busca perfil
  games, wins, losses, win_rate,
  points_for, points_against, points_balance,
  position,                       // a classificação, calculada no servidor
  updated_at
}
```

- **Regra**: leitura pública (a página é aberta, como `/ranking`), escrita
  **recusada para todo mundo, inclusive o admin** — só a Cloud Function (Admin
  SDK) escreve. Vale para as cinco coleções de ranking desde 2026-09-24 (ver
  §8). Provado no emulador (`tests/rules/misc.rules.test.js`).
- **Índice**: nenhum novo. A página ordena por `position`, um campo só.
- **Migração**: nenhuma. A coleção nasce no primeiro recálculo.
- As demais coleções (`player_ratings`, `player_skill_ratings`, os dois
  históricos) **não mudaram de formato**.

## 8. Não há mais botão de recalcular

Havia quatro, espalhados: "Recalcular ratings" (console e métricas do admin),
"Recalcular" no ranking 2.0–8.0, "Recalcular ranking agora" depois da migração
de inscrições e "Materializar ranking agora" no ranking interno do clube.
**Saíram todos.**

Não foi arrumação de tela. Botão de recalcular tem três problemas:

1. **Mente sobre de quem é a responsabilidade.** Materializar ranking é escrita
   que só o admin da plataforma pode fazer — então quem publicava um resultado
   dependia de OUTRA pessoa apertar um botão para o seu jogo aparecer. Na
   prática o ranking ficava atrasado até alguém lembrar.
2. **Compete com o servidor.** Os gatilhos já recalculam a cada resultado; o
   botão só refazia, em duplicado, o que já tinha sido feito.
3. **Esconde o defeito.** Quando algo não entrava no ranking, o botão
   "resolvia" e ninguém investigava a causa.

No lugar deles, o painel admin mostra `RankingAutomatico`, que **explica** o que
dispara o quê — porque um botão que some sem explicação vira chamado de
suporte. O `src/core/guards/diaDeJogoUniforme.test.js` reprova quem trouxer
qualquer um deles de volta.

E o cliente **parou de tentar** materializar ranking ao publicar: além de ser
recusado pela regra para quem não é admin, custava a leitura da coleção INTEIRA
de torneios a cada publicação.

### 8.1 🐞 O escritor que sobrou: o navegador do admin (2026-09-24)

Os botões saíram, mas ficou um recálculo AUTOMÁTICO no navegador do admin:
`useAutoRecomputeRatings` no `V2Layout` (a cada visita) e um recálculo forçado
no painel do torneio ao encerrá-lo. Ele gravava **só o ELO e as duplas** —
nunca o 2.0–8.0 — por cima do que o servidor tinha gravado.

Com o servidor funcionando, os dois chegavam ao mesmo número e ninguém via.
Com as funções apagadas (22/09), o navegador do admin atualizou dois rankings e
o terceiro ficou parado em 18/09. Medido na produção, pela leitura pública:

| Coleção | Última gravação | Quem gravou |
|---|---|---|
| `player_ratings`, `rating_history`, `doubles_rankings` | 22/09 14:54 | navegador do admin |
| `player_skill_ratings`, `skill_rating_history` | 18/09 16:53 | botão (antes de sair) |
| `platform_settings/ranking_worker.last_run_at` | 18/09 00:26 | servidor |

Três rankings discordando entre si, sem nada na tela avisar. O conserto:

- **O cliente não recalcula mais nada.** Hooks e serviços de escrita saíram
  (`ratingService` e `duprRatingService` agora só leem); o guarda de fonte varre
  `src/` inteiro e reprova quem trouxer qualquer um de volta.
- **A regra recusa escrita de ranking para TODO MUNDO**, inclusive o admin. Sem
  isso, uma aba aberta numa versão antiga do aplicativo continuaria gravando.
- **A recuperação agendada** (§3) cobre o que o navegador do admin cobria sem
  querer — e cobre os três rankings, não dois.
- **O painel mostra a última passada do servidor** (`RankingAutomatico`, via
  `describeRankingWorker`), com o motivo e o erro recente, se houver. Um
  servidor parado passa a ser visível.

## 9. Ao mexer nesta área, cuidado com

1. **Não recalcule ranking no cliente, para ninguém.** A regra recusa para
   todo mundo, inclusive o admin (§8.1): dois escritores da mesma coleção
   discordam em silêncio. Recálculo novo é GATILHO ou recuperação agendada no
   servidor — e nunca um botão: botão é alguém para lembrar.
1b. **Não confunda facultativo com não facultativo.** Em torneio o gatilho é o
   LANÇAMENTO; no dia de jogo é a PUBLICAÇÃO. Inverter qualquer um dos dois é
   ou publicar o que ninguém quis publicar, ou atrasar o que já aconteceu.
2. **Não mexa num motor só.** O teste de paridade quebra — e ele está certo.
3. **Não largue o lease.** Toda saída de `requestRankingRecompute` tem de soltar
   ou renovar; esquecer trava os recálculos até o TTL (9 min).
4. **Não acrescente gatilho de ranking sem filtro de campo.** `mudouResultado`
   existe para que mexer em quadra ou horário não recalcule a plataforma.
5. **Não reordene no navegador.** A `position` é a do servidor; reordenar na
   tela faria a numeração discordar da classificação oficial. Recortar por
   amostra mínima e renumerar DENTRO do recorte é outra coisa — não muda a
   ordem relativa, e guarda a posição geral em `overall_position`.
6. **Não mude o id da preferência** (`ranking:duplas:min-jogos`). Ele é
   contrato: mudar apaga, de uma vez, a escolha salva de todo mundo.
