# 16 — Dia de jogo (Play): rodízio equilibrado

> Flag `play_smart_rotation` — **padrão DESLIGADA**. Desligada, nada muda.
> Código: `src/modules/games/domain/playRotation.js` (puro, 31 testes).

## 1. O problema

No Play, `buildPlayNextMatch` pega **sempre os 4 primeiros da fila**. Como as
partidas terminam mais ou menos na ordem em que começaram — o caso normal —, a
fila se reforma em blocos de 4 e **os mesmos quartetos voltam a jogar juntos**,
rodada após rodada. E como `assignPlayTeams` é quase determinístico (o sorteio
só desempata com peso 0,001), dentro do quarteto as **duplas também se
repetem**.

Medido por simulação (`playRotation.test.js`), em ~41 partidas:

| Cenário | Quartetos distintos | Repetição máxima do mesmo quarteto |
|---|---|---|
| 12 jogadores / 2 quadras | **3** | **14×** |
| 16 jogadores / 3 quadras | 4 | 11× |
| 20 jogadores / 3 quadras | 5 | 9× |
| 8 jogadores / 1 quadra | **2** | **20×** |

Não é impressão de quem joga: é a mecânica da fila.

## 2. A solução — duas alavancas

### 2.1 Janela de escolha (quem entra)
Em vez de pegar rigidamente os 4 primeiros, olha uma **janela curta** — as 4
vagas mais os 4 seguintes — e escolhe, dentro dela, a combinação de 4 que menos
repete encontros já ocorridos. Descer na fila **custa**, então ficar perto do
topo é sempre preferido quando o resto empata.

Custo = `ordem × 1 + encontro × 2 + parceria × 3 + jogou-junto-na-anterior × 4`

### 2.2 Variação de duplas (quem joga com quem)
Ao dividir os 4 em dois lados, penaliza quem já foi parceiro de quem
(`W_PARTNER_REPEAT = 6`). Fica **abaixo** de `W_MIXED = 100`: a dupla mista
continua tendo prioridade. Fica **acima** de `W_LEVEL = 1`: repetir parceria
pesa mais que uma diferença pequena de nível.

## 3. Resultado medido

| Cenário | Quartetos: hoje → novo | Repetição máx.: hoje → novo | Duplas: hoje → novo |
|---|---|---|---|
| 12 jog / 2 quadras | 3 → **40** | 14× → **2×** | 6 → **61** |
| 16 jog / 3 quadras | 4 → **42** | 11× → **1×** | 8 → **78** |
| 20 jog / 3 quadras | 5 → **42** | 9× → **1×** | 10 → **84** |
| 8 jog / 1 quadra | 2 → **32** | 20× → **2×** | 4 → **28** |

Em 42 partidas com 20 jogadores, **42 quartetos distintos**: nenhum se repete.

## 4. Garantias de justiça (todas testadas)

- **O primeiro elegível da fila entra SEMPRE.** Ninguém é ultrapassado
  indefinidamente — quem esperou mais joga.
- **Ninguém é chamado de fora da janela**: o índice máximo na fila de quem é
  escolhido é 7 (4 vagas + 4 extras). Nunca pula meia fila.
- **A maior espera entre duas partidas de um jogador cresce no máximo 1 jogo.**
  É o preço da variedade, e é baixo.
- **A vazão de partidas não cai**: em 5 configurações testadas, o número de
  jogos criados é exatamente o mesmo de hoje.
- **Duplas fixas** (`partner_id` mútuo) continuam entrando juntas.
- **Quem declarou parceiro indisponível** continua aguardando, como hoje.
- **Sem combinação válida, cai de volta** em `buildPlayNextMatch`: nunca deixa
  de criar uma partida que hoje seria criada.

## 5. Impacto: nenhum no banco

O histórico de encontros é **derivado das partidas já carregadas em memória**
(`buildPlayHistory(games)`). Nenhuma coleção, campo, índice, regra ou escrita
nova. `git diff` em `firestore.rules`, `storage.rules`,
`firestore.indexes.json` e `firebase.json`: **vazio**.

## 6. Flag desligada = comportamento idêntico

Provado por **teste de propriedade**: em 300 cenários aleatórios (4 a 17
disponíveis, com e sem duplas fixas, com parceiro inexistente),
`buildPlayNextMatchBalanced(fila, { history: null })` devolve exatamente o
mesmo que `buildPlayNextMatch(fila)`. E `assignPlayTeams` sem
`partnerRepeatCount` é idêntico ao de antes, em 200 cenários.

## 7. Onde está ligado

| Ponto | Arquivo |
|---|---|
| Criação da partida (único caminho de escrita) | `games/services/gameDayService.js` → `createNextPlayGame` |
| Previsão do painel do organizador | `v2/components/games/AthletePlayOrganizer.jsx` |
| Previsão do telão | `v2/pages/V2GameDayTelao.jsx` |

⚠️ **As três precisam andar juntas.** Se a previsão usasse regra diferente da
criação, a tela anunciaria um grupo e entraria outro. Por isso a flag é lida
nos três lugares e todos convergem para `playRotation.js`.

O serviço lê a flag via `getPlatformSettings()` (best-effort: qualquer falha
devolve os padrões e a criação segue como hoje). As telas leem via
`useFeatureFlag`.

## 8. Como ligar

`/admin/painel` → **Funcionalidades** → grupo **Dia de jogo** →
"Dia de jogo (Play) — rodízio equilibrado".

Vale a pena ligar **antes** do dia de jogo começar: o histórico é lido das
partidas do próprio dia, então quanto mais cedo, mais material para variar.
Ligar no meio também funciona — ele passa a considerar o que já aconteceu.

Para desligar, basta desmarcar: a próxima partida já volta ao comportamento
antigo. Não há migração nem estado a limpar.

## 9. Ajuste fino

`ROTATION_WEIGHTS` e `ROTATION_WINDOW_EXTRA` em `playRotation.js`:

- `windowExtra` maior → mais variedade, espera um pouco maior.
- `together`/`partner` maiores → evita repetição com mais agressividade.
- `consecutive` maior → evita sobretudo repetir com quem acabou de jogar.

Ao mexer, **rode a simulação**: ela mede variedade e justiça de uma vez.
