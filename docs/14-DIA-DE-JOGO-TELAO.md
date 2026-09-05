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

### 2.2 O que mostra

Em ordem de importância para quem está na quadra:

1. **Em quadra agora** — um card grande por quadra, nomes em tipografia
   grande, legível de longe;
2. **Quem vem a seguir** — próximos jogos (formatos de grade) ou **ordem de
   participação** (Play), com as quatro primeiras posições destacadas como
   "entra a seguir";
3. **Ranking do dia** — as 10 primeiras posições, quando já há resultado;
4. **Últimos resultados** — uma linha por dupla, cada uma com o seu placar.

Somente leitura: nenhum botão do telão altera o dia de jogo.

### 2.3 Detalhes de layout que vieram de conferência visual

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
- **Em tela estreita, a ordem de participação vem antes do ranking.** Quem está
  na fila quer saber a sua posição, não a classificação. No desktop a grade
  recoloca cada bloco no seu lugar.
- **"Entra a seguir" só aparece quando há 4 ou mais na fila** — com 3, ninguém
  entra.

### 2.4 Atualização automática

A página tem consultas próprias (`useQuery` + `refetchInterval` de 15 s) em vez
de usar os hooks compartilhados de dia de jogo. É de propósito: ligar
`refetchInterval` nos hooks gerais poria a plataforma inteira a consultar em
laço.

Há também um botão de **tela cheia** do navegador, escondido quando a API não
existe (iOS Safari, por exemplo).

### 2.5 Impacto no banco de dados

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
src/v2/pages/V2GameDayTelao.runtime.test.jsx  # 9 testes de runtime
```
