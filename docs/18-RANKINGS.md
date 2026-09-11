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
| `recomputeRankingOnTournamentChange` | `tournaments/{id}` muda de elegibilidade | os três |

Publicar um dia de jogo grava o espelho em `club_event_games` → o gatilho
dispara → os três rankings são reescritos. Corrigir um placar, excluir uma
partida ou despublicar seguem o mesmo caminho.

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

- **Regra**: leitura pública (a página é aberta, como `/ranking`), escrita só do
  admin — na prática, a Cloud Function. Provado por 9 asserções no emulador.
- **Índice**: nenhum novo. A página ordena por `position`, um campo só.
- **Migração**: nenhuma. A coleção nasce no primeiro recálculo.
- As demais coleções (`player_ratings`, `player_skill_ratings`, os dois
  históricos) **não mudaram de formato**.

## 8. Os botões manuais do admin continuam

No painel admin seguem existindo "recalcular ranking" (ELO + duplas) e
"recalcular rating 2.0–8.0". Não são mais necessários no dia a dia — o gatilho
faz isso sozinho —, mas continuam sendo a saída para reprocessar tudo depois de
uma correção em massa. O caminho do admin no cliente passou a materializar
`doubles_rankings` também, para não deixar metade do ranking atualizada.

## 9. Ao mexer nesta área, cuidado com

1. **Não recalcule ranking no cliente para o usuário comum.** A regra recusa, e
   o erro é silencioso. Se precisar de um recálculo novo, é gatilho ou `onCall`.
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
