# 14 — Dia de jogo: seções colapsáveis + telão

> Dois ajustes de uso, não de regra de negócio: **as seções do dia de jogo
> recolhem e lembram** o que cada pessoa deixou, e existe uma **página de
> visualização em tela cheia** para a segunda tela.

---

## 1. Seções colapsáveis com preferência por usuário

### 1.1 O que mudou

Toda seção do dia de jogo virou um card colapsável. O cabeçalho continua
mostrando ícone, título e contagem; o corpo recolhe ao clique. Quando recolhido,
o cabeçalho passa a exibir um **resumo curto** — um card fechado que não diz
nada é inútil.

| Superfície | Seções | Arquivo |
|---|---|---|
| Dia de jogo do atleta (Americano, Mexicano, Rei da Quadra) | Participantes, Jogos, Ranking do dia, Resultados no ranking | `v2/components/games/AthleteGameDayOrganizer.jsx` |
| Dia de jogo do atleta — Play (organizador) | Participantes, Quadras e jogos, Ordem de participação | `v2/components/games/AthletePlayOrganizer.jsx` |
| Dia de jogo do atleta — Play (participante) | Minha participação (+ as duas seções compartilhadas acima) | `v2/components/games/AthletePlayParticipant.jsx` |
| Dia de jogo do clube (data de evento) | Participantes, Jogos, Ranking do dia | `modules/clubs/components/GameDayOrganizer.jsx` |

### 1.2 Como a preferência é guardada

`src/core/lib/collapsePreference.js` (puro, testado).

Chave: **`v2:collapse:<uid>:<secao>`**.

- **Por usuário.** O `localStorage` é por navegador, não por conta. Num tablet
  de clube ou num notebook compartilhado, sem o uid na chave uma pessoa
  herdaria a preferência da outra. Quem não está autenticado usa o escopo
  `anon`.
- **Por TIPO de seção, não por dia de jogo.** O `sectionId` (de
  `v2/components/games/gameDaySections.js`) não carrega o id do dia: quem
  recolhe "Participantes" quer encontrá-lo recolhido no próximo dia de jogo
  também. **Mudar um valor daquele arquivo apaga a preferência salva de todo
  mundo para aquela seção.**
- **Não vai para o Firestore.** É conveniência de interface: não vale uma
  leitura de banco a cada abertura de tela nem uma escrita a cada clique.
- **Nunca lança.** Aba anônima, storage bloqueado por política ou cota
  estourada fazem o `localStorage` lançar — inclusive na leitura da própria
  propriedade. Toda função engole a exceção e devolve o neutro: a seção abre no
  padrão e a tela segue funcionando.

### 1.3 O componente

`src/v2/ui/V2CollapsibleCard.jsx`. Três cuidados que o código explica:

1. **As ações ficam FORA do botão que alterna.** `<button>` dentro de
   `<button>` é HTML inválido, e um clique em "Sortear" recolheria a seção
   junto. O cabeçalho é uma linha com dois filhos irmãos.
2. **O corpo é desmontado quando recolhido**, não apenas escondido — não faz
   sentido manter tabelas e inputs de placar no DOM sem necessidade.
3. **`aria-expanded` + `aria-controls`**, para leitor de tela.

> `V2Surface collapsible` (em `v2/ui/primitives.jsx`) tem persistência própria,
> mais antiga e **sem escopo de usuário**. Ela não foi migrada de propósito:
> trocar o formato da chave apagaria de uma vez a preferência já salva de todo
> mundo nas telas de torneio.

---

## 2. Telão do dia de jogo

**Rota:** `/dia-de-jogo/:gameDayId/telao` · **Página:** `v2/pages/V2GameDayTelao.jsx`

Botão **"Abrir telão"** no cabeçalho do dia de jogo, visível para todos que
enxergam o dia (não só o dono). Abre em outra aba de propósito: o uso é numa
segunda tela, com a aba original seguindo aberta para o organizador continuar
lançando resultados.

### 2.1 Onde a rota vive, e por quê

Em `src/App.jsx`, **fora do `V2Layout`** — sem menu e sem cabeçalho da
plataforma, a tela inteira é conteúdo. Fica sob `ProtectedRoute` porque as
regras do Firestore só liberam a leitura de um dia de jogo para o dono, os
participantes ou um dia público; sem login não há o que mostrar.

### 2.2 O que mostra — e por que muda com o formato

| Bloco | Americano · Mexicano · Rei da Quadra | Play |
|---|---|---|
| **Em quadra agora** | sim, um card grande por quadra | sim |
| **Próximos jogos** | as rodadas seguintes já sorteadas | a previsão de quem entra, pela fila |
| **Ordem de participação** | — | sim, com as 4 primeiras marcadas "entra a seguir" |
| **Ranking do dia** | as 10 primeiras posições | — |
| **Últimos resultados** | uma linha por dupla, com o seu placar | — |

> **O Play não tem placar.** `finishPlayGame` apenas marca o jogo como
> concluído e devolve os quatro à fila — nenhum resultado é gravado em lugar
> nenhum. Logo, no Play não existem "últimos resultados" nem ranking do dia:
> mostrá-los seria exibir traços numa tela que a sala inteira está olhando.
> O card de quadra recebe `comPlacar={false}` no Play, uma trava explícita em
> vez de confiar em `score_a` vir nulo.

**Próximos jogos no Play** vêm de `forecastPlayMatches`: são as próximas levas
de quatro, pela ordem da fila. A tela diz com todas as letras que **as duplas
são formadas só na hora de criar o jogo** — prometer uma dupla que ainda vai
mudar seria pior do que não mostrar nada. Uma leva incompleta não é anunciada
como "próxima partida": vira "aguardando jogadores", com quantos faltam.

Somente leitura: nenhum botão do telão altera o dia de jogo.

### 2.3 Retrato e paisagem

O layout segue a **orientação** da tela, não só a largura:

- **Paisagem** com espaço (TV, notebook): duas colunas. A coluna larga leva as
  quadras em cima e, embaixo, o bloco da vez — próximos jogos no Play, ranking
  do dia na grade. A coluna estreita leva a fila (Play) ou próximos jogos +
  últimos resultados (grade).
- **Retrato** (tablet de pé, TV girada, celular): tudo empilha na ordem do HTML,
  que é a ordem de urgência — o que está em quadra, quem entra depois, e só
  então classificação e histórico.

Usar `landscape:` em vez de só um breakpoint importa: **um iPad Pro de pé tem
1024px de largura** e cairia na regra de duas colunas por engano, espremendo
tudo numa tela alta.

Os dois formatos têm a **mesma estrutura de duas linhas** na coluna larga. Foi
uma correção: sem um segundo bloco, o Play deixava metade da tela em branco.
Quando nem esse segundo bloco existe (grade recém-sorteada, ainda sem
resultado), os cards de quadra crescem para preencher a altura — com teto de
`24rem`, senão duas quadras numa TV de 1080px virariam caixas de 800px com
quatro nomes perdidos no meio.

### 2.4 Detalhes de layout que vieram de conferência visual

- **Nas listas compactas, a dupla vai numa linha só**, unida por "·". Quatro
  nomes empilhados sem separação viram uma lista indistinguível e quem olha de
  longe não descobre quem joga contra quem.
- **O resultado tem uma linha por lado, com o placar daquele lado à direita.**
  Assim não é preciso decifrar de que lado do "11 × 7" está cada dupla.
- **A grade de quadras usa `auto-fit`**, não um número fixo de colunas: com 3
  quadras — o caso mais comum — uma grade de 2 deixaria a terceira sozinha
  numa linha, com metade da tela vazia.
- **No Play, quem está em quadra e quem está pausado aparecem resumidos numa
  linha**, não como itens da lista: os nomes de quem joga já estão em letra
  grande nos cards ao lado.
- **Em tela estreita, a fila vem antes do ranking.** Quem está esperando quer
  saber a sua posição, não a classificação. Em paisagem a grade recoloca cada
  bloco no seu lugar.
- **"Entra a seguir" só aparece quando há 4 ou mais na fila** — com 3, ninguém
  entra.

### 2.5 Atualização automática

A página tem consultas próprias (`useQuery` + `refetchInterval` de 15 s) em vez
de usar os hooks compartilhados de dia de jogo. É de propósito: ligar
`refetchInterval` nos hooks gerais poria a plataforma inteira a consultar em
laço.

Há também um botão de **tela cheia** do navegador, escondido quando a API não
existe (iOS Safari, por exemplo).

### 2.6 Impacto no banco de dados

**Nenhum.** Nenhuma coleção, campo, índice ou regra novos; nenhuma escrita. O
telão lê exatamente o que o organizador já lê, com as mesmas regras.

---

## 3. Domínio

`src/modules/games/domain/gameDayBoard.js` (puro, 25 testes) separa os jogos em
`live` / `upcoming` / `recent`.

Dois modelos de dia de jogo, um painel só:

- os formatos de **grade** sorteiam rodadas inteiras — o que separa "agora" de
  "depois" é a **rodada corrente**, a primeira que ainda tem jogo sem placar
  (com tudo decidido, é a última rodada: o dia acabou, mas não some da tela);
- o **Play** cria um jogo por vez — o que separa é o **status**
  (`open`/`finished`), e não existem jogos futuros gravados: quem entra sai da
  ordem de participação.

As funções não recebem o formato: elas olham os dados. Um jogo com `status` é
Play; sem `status`, é grade. Por isso o mesmo painel serve ao dia de jogo do
atleta e ao do clube, que gravam jogos no mesmo formato.

---

## 4. Arquivos

```
src/core/lib/collapsePreference.js            # preferência por usuário (puro)
src/core/lib/collapsePreference.test.js       # 12 testes
src/v2/ui/V2CollapsibleCard.jsx               # o card colapsável
src/v2/ui/V2CollapsibleCard.runtime.test.jsx  # 10 testes de runtime
src/v2/components/games/gameDaySections.js    # ids ESTÁVEIS das seções

src/modules/games/domain/gameDayBoard.js      # live / upcoming / recent (puro)
src/modules/games/domain/gameDayBoard.test.js # 25 testes
src/v2/pages/V2GameDayTelao.jsx               # a página do telão
src/v2/pages/V2GameDayTelao.runtime.test.jsx  # 13 testes de runtime
```
