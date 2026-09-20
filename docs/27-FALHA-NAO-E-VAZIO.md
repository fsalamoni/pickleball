# 27 — Falha não é lista vazia

> **Onda AV (2026-09-20).** Uma classe de defeito que atravessa a plataforma
> inteira, corrigida na arena em 2026-09-13 (Onda AE) e que nunca tinha chegado
> ao dia de jogo nem ao torneio.

---

## 1. O defeito, em duas linhas

O padrão do projeto é:

```js
const { data: gameDays = [] } = useMyGameDays();
```

Quando a consulta **falha**, `data` vem indefinido, cai no `[]`, e a tela
conclui que **não existe nada**. E aí ela **afirma** isso.

Lista vazia quase nunca é neutra: ela tem um significado próprio na tela, e
esse significado é uma frase que a plataforma diz ao usuário com toda a
confiança do mundo.

---

## 2. O que a plataforma estava dizendo

| Tela | O que dizia numa queda de rede | O que o usuário conclui |
|---|---|---|
| Meus dias de jogo | *"Nenhum dia de jogo ainda"* + botão **Criar** | "sumiu tudo" → cria um duplicado |
| Um dia de jogo | *"Dia de jogo não encontrado. Ele pode ter sido removido ou você não tem acesso."* | "me tiraram do grupo", na beira da quadra |
| Dia de jogo da arena | *"Ele pode ter sido arquivado, ou pertence a outra arena."* | procura um problema que não existe |
| Torneio | *"Torneio não encontrado. Verifique o link."* | confere um link que está certo |
| Modalidade | *"Modalidade não encontrada"* | "tiraram a minha categoria" |

Medido na auditoria: **28 das 30 telas** de dia de jogo e torneio não
distinguiam falha de vazio.

Quem lê uma afirmação dessas **não tenta de novo**. Acredita.

---

## 3. 🐞 O caso grave: o sorteio apagando o que não viu

Este não é cosmético.

`persistMatches` **apaga todos os jogos da fase** antes de gravar os novos — é
o que faz "re-sortear" funcionar, e a tela avisa disso. Só que o aviso era
decidido por `matches.length`:

```js
{matches.length > 0
  ? 'Os jogos atuais desta fase serão apagados e novos serão gerados.'
  : 'Serão gerados os jogos desta fase a partir das inscrições confirmadas.'}
```

Então, com `useMatches` **falhando**:

1. `matches = []`;
2. o botão vira **"Sortear"** em vez de "Re-sortear tudo";
3. o cabeçalho diz **"Nenhum jogo gerado ainda"**;
4. o diálogo diz que vai **gerar** — e **não menciona que apaga nada**;
5. o organizador confirma;
6. `persistMatches` **apaga os jogos já disputados** e grava outros.

Um resultado de torneio destruído por uma queda de rede, sem ninguém ter como
perceber.

### Como ficou

**Na tela** — comando sobre estado desconhecido **não é renderizado**. É a
mesma regra do dia de jogo (`docs/15`): comando sem atribuição não aparece,
nunca só desabilitado. No lugar das ações, o aviso da falha com botão.

**No serviço** — segunda tranca, `domain/drawSafety.js`:

```js
canDiscardStageMatches(matches, { acknowledged })
```

Só é **reconhecimento** quando a tela realmente **viu** os jogos
(`replacesKnownMatches: matches.length > 0`). Sem isso, o sorteio é **recusado**
se a fase tiver jogo **com resultado**, com o número na mensagem.

⚠️ **Só o jogo com RESULTADO é protegido.** Re-sortear uma fase que ainda não
começou não perde nada, e exigir confirmação ali treinaria a pessoa a clicar em
"sim" sem ler — o que faria a confirmação que IMPORTA passar despercebida.

> **Achado não alterado**: `advanceToNextPhase` regrava a fase seguinte, e
> avançar duas vezes já descartava o que estivesse lançado nela. Esse
> comportamento é anterior a esta onda e foi **preservado bit a bit**
> (`replacesKnownMatches: true` na chamada interna). Mudá-lo é decisão à parte.

---

## 4. A peça: `V2ErrorState`

O bloco de falha estava escrito **à mão em sete lugares** e não havia
primitivo. Agora há um, em `src/v2/ui/primitives.jsx`, com três regras:

1. **Nunca diz que o dado não existe.** Diz que não conseguiu carregar.
2. **Sempre oferece o caminho de volta** (`onRetry`) — a segunda tentativa
   quase sempre funciona.
3. **Não despeja o erro técnico** — `detail` é opcional e sai pequeno.

`inline` serve para uma **seção** que falhou dentro de uma tela que carregou:
ali um bloco de tela inteira roubaria a página de quem só perdeu um pedaço.

E `src/core/lib/queryState.js` responde à pergunta que as telas realmente
fazem — **posso afirmar que está vazio?** —, que só é verdade quando a consulta
terminou **e** não falhou.

---

## 5. Ao mexer nesta área, cuidado com

1. **Não escreva `const { data = [] } = useX()` e conclua algo do vazio.** Se a
   tela vai AFIRMAR ("nenhum", "não encontrado", "ninguém inscrito"), ela
   precisa de `isError`.
2. **Não ofereça comando sobre estado desconhecido.** Principalmente comando
   que apaga.
3. **Não afirme ocupação/estado enquanto carrega.** Mês sem reserva carregada
   parece mês inteiro livre (lição da Onda AE).
4. **Não escreva o bloco de falha à mão.** Use `V2ErrorState`.
5. **Não tire o botão de tentar de novo.** Aviso sem saída é pior que aviso
   nenhum: a pessoa fecha o aplicativo.

`src/core/guards/falhaNaoEVazio.test.js` lê o código-fonte e reprova quem
regredir — o defeito é invisível a teste de comportamento, porque com a
consulta funcionando **cada tela está correta**.

---

## 6. De quebra: o dia de jogo diz o que ele é

O cabeçalho do dia de jogo mostrava título, origem, data e observações. **Nem o
formato** — e é o formato que decide se há placar, se há ranking do dia, se o
resultado pode ir para o ranking da plataforma e se dá para vincular uma dupla.

Pior: a **lista** de dias de jogo da arena já mostrava o formato num selo, e a
tela do **dia** não. A lista dizia mais que o detalhe.

`describeGameDayRules` (`modules/games/domain/gameDayRules.js`) traduz o dia nas
linhas que a tela mostra, e `GameDayRulesCard` fica dentro do **`GameDayModule`**
— assim as três origens (atleta, arena, clube) recebem o resumo **por
construção**, sem ninguém precisar lembrar de montá-lo em cada tela. Que é
exatamente como o clube ficou meses sem Play e sem telão.

Fechado, é uma linha. Aberto, cada linha explica o porquê — quem já conhece o
formato não precisa ler nada, e quem não conhece precisa de mais que um rótulo.

Ganhou também um predicado que só existia implícito no motor de sorteio:
`formatHonorsFixedPairs(format)` — **Mexicano e Rei da Quadra não honram dupla
vinculada**, e isso não é omissão: neles as duplas saem da classificação da
rodada, que é o que define os dois formatos.

---

## 7. Código morto removido

Nove componentes V1 de clube, **sem nenhum caminho a partir de `main.jsx`** e
fora do bundle: `ClubAdminTab`, `ClubFeedTab`, `ClubForumsTab`,
`ClubMembersTab`, `EventChat`, `EventDatesPanel`, `EventParticipantsPanel`,
`ForumPoll`, `ForumThreadView`.

Entre eles, `EventDatesPanel.jsx` — **gêmeo obsoleto** do `V2EventDatesPanel`
que a Onda AS modificou, e que **não conhece `game_day_id`**. Cópia morta de
tela viva é armadilha de divergência: é o caso do `V2GameDayOrganizer` (Onda
AS) e do `TournamentDrawTab` (Onda AU).

> Sobram três órfãos conhecidos, deixados de propósito:
> `tournament/services/courtService.js` e `clubs/hooks/useClubRankingAdmin.js`
> (descritos/ligados à arquitetura documentada) e `clubs/domain/clubRanking.js`
> (tem teste próprio e espelha `functions/clubRanking.js`).
