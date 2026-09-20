# 28 — Um erro numa tela não derruba o aplicativo

> **Onda AY (2026-09-20).**

---

## 1. O que acontecia

O `ErrorBoundary` global fica **acima do Router**, em `main.jsx`:

```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

E ele **nunca reseta**: uma vez em erro, continua em erro.

Junte as duas coisas e o resultado é este — um defeito em **uma** tela (uma
aba de torneio, o organizador do dia de jogo, um componente que recebeu um
documento inesperado) substitui o **aplicativo inteiro** por um cartão claro:

> *"Algo deu errado. Recarregue a página para tentar novamente."*

Sem barra lateral. Sem navegação. Sem voltar. Quem estava conduzindo um
torneio perde o lugar onde estava porque uma aba quebrou.

### O mecanismo certo já existia — no lugar errado

`GamificationErrorBoundary` faz exatamente o que precisa ser feito: isola a
rota, mostra um recado amigável, oferece "tentar de novo", e o resto da
plataforma segue de pé. Só que ele era usado em **cinco rotas de
gamificação** — que estão atrás da flag `gamification_v2`, **desligada**.

É a mesma família do defeito da Onda AU (a entrada direta montada no ramo onde
nunca renderizava): a ferramenta certa, construída, testada e guardada onde
não fazia falta.

---

## 2. O caso do TELÃO

O telão fica **horas sozinho** numa TV na beira da quadra. Um cartão dizendo
*"recarregue a página"* não serve ali: **não há ninguém para clicar**. Um erro
de renderização congelava o painel pelo resto da noite.

Por isso o boundary aceita `unattended`: sem ninguém por perto, ele tenta de
novo **por conta própria**, com espera crescente (3 s, 6 s, 12 s…) e um
**limite** — tentar para sempre sobre um defeito real é um laço de falha que
ninguém vê, queimando bateria de tablet a noite inteira.

Depois do limite ele para e mostra o caminho manual, para quem chegar na
frente da TV.

---

## 3. Versão velha depois de um deploy

A plataforma publica a cada push em `main`. Quem está com a aba aberta — e num
torneio a aba fica aberta o dia todo — fica com um `index.js` que aponta para
pedaços de código que **já não existem**. A primeira navegação para uma tela
sob demanda falha ao BAIXAR.

Isso não é defeito de programação, e "tentar de novo" não resolve: o arquivo
continua não existindo. `isChunkLoadError` reconhece o caso pelas mensagens dos
quatro navegadores e a tela diz a verdade — *"Uma versão nova foi publicada"* —
com o botão que resolve: **Recarregar**.

---

## 4. Ao mexer nesta área, cuidado com

1. **Não mexa no boundary GLOBAL.** Ele é a última linha: o que escapar de
   tudo cai nele. O que esta onda fez foi impedir que as coisas chegassem lá.
2. **Toda tela nova de dia de jogo ou torneio entra em `<Isolada>`.**
   `src/core/guards/telaIsolada.test.js` lê `V2App.jsx` e reprova quem
   esquecer.
3. **`fatal: false` no relatório.** Marcar tudo como fatal apaga, na
   telemetria, a diferença entre "o aplicativo caiu" e "uma aba falhou e a
   pessoa seguiu usando".
4. **Tentar de novo tem de REMONTAR** (`resetKey`). Sem isso o mesmo estado
   quebrado renderiza de novo e cai no mesmo erro na hora.
5. **Recuperação automática é só para tela desacompanhada**, e sempre com
   limite.

---

## 5. Uma armadilha de teste que custou uma rodada

Um componente que "se cura" na segunda renderização **não serve** para testar
boundary: ao capturar um erro, o **React re-renderiza uma vez** antes de
acionar o fallback, e o defeito desaparece nessa tentativa interna — o
boundary nunca entra, e o teste falha dizendo que o componente está errado
quando o errado é o teste.

O gatilho da falha tem de ser controlado **de fora** (um objeto mutável que o
teste vira quando quiser).
