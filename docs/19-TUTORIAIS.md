# Tutoriais em tela

> Ajuda onde a pessoa está, na hora em que ela precisa — não num manual à
> parte que ninguém abre.

---

## 1. O que existe

Quatro tutoriais, cobrindo as duas ferramentas mais densas da plataforma:

| Tutorial | Cobre |
|---|---|
| **Torneio** | o caminho inteiro: criar → modalidades → inscrições → sorteio → resultados → encerramento e ranking → página pública e telão |
| **Dia de jogo — Play** | jogo aberto por ordem de chegada: criar, participantes, criar partidas, a fila, substituir/pausar/dupla fixa, previsão e telão |
| **Dia de jogo — Americano** | grade sorteada de uma vez: criar, sortear (aditivo), lançar resultados, ranking do dia, publicar no ranking da plataforma, telão |
| **Dia de jogo — Americano aprimorado** | partida a partida com placar: a fila, o fluxo de DOIS passos, como o sorteio escolhe, partidas concluídas, ranking e telão |

Mexicano e Rei da Quadra usam o tutorial do Americano de propósito: a tela é a
mesma, o que muda entre eles é o critério do sorteio, não a forma de operar.

## 2. Onde cada um aparece

| Tela | Tutorial | Abre sozinho? |
|---|---|---|
| Console de gestão do torneio | Torneio | **Sim**, na primeira vez |
| `/torneios/criar` | Torneio | Não — só o botão |
| Dia de jogo (detalhe) | o do formato do dia | **Sim**, na primeira vez — **só para quem organiza** |
| Diálogo de criação de dia de jogo | o do formato selecionado | Não — só o botão |

A abertura automática é reservada às telas de OPERAÇÃO, onde a pessoa vai de
fato conduzir a coisa. Nas telas de criação o tutorial só se oferece: quem
chegou ali veio fazer, não ler — mas a porta fica visível.

No diálogo de criação do dia de jogo, o botão acompanha o formato selecionado.
Sem isso, os tutoriais só existiriam DEPOIS de o dia estar criado — tarde
demais para ajudar a escolher o formato.

No dia de jogo, a abertura automática é limitada a quem PODE ORGANIZAR. O
conteúdo é sobre conduzir o dia (criar partidas, substituir, lançar resultado);
para quem entrou só para ver quando joga, seria um modal no caminho. O botão
continua visível para todo mundo — quem quiser ler, lê.

## 3. Dispensar e rever

- **Abre sozinho** na primeira vez que a pessoa entra naquela ferramenta.
- **Fechar de qualquer jeito** — X, "Dispensar", "Entendi", clicar fora — marca
  como visto. A intenção de quem fecha é sempre a mesma: "não precisa me
  mostrar isso de novo sozinho".
- **O botão "Como funciona" fica sempre visível**, inclusive para quem já
  dispensou. Rever é um clique, e reabrir volta ao primeiro passo.
- Dentro do tutorial: Anterior / Próximo, e as bolinhas levam direto a um passo.

### A armadilha do modal que reaparece

A plataforma já teve esse bug com o onboarding: voltava toda sessão porque a
trava era só de sessão. Aqui há duas proteções:

1. a marca de "já viu" é gravada **por usuário** (não por sessão, nem por
   navegador inteiro);
2. a abertura automática é **latcheada por um ref** — dentro de uma mesma
   montagem ela acontece no máximo uma vez, então um re-render não ressuscita
   o modal.

## 4. Banco de dados

**Nenhum.** "Esta pessoa já viu este tutorial" é preferência de interface, não
dado do produto: vai para o `localStorage` por usuário
(`v2:view:<uid>:tutorial:<id>`), pelo mesmo caminho das outras preferências de
tela (`core/lib/viewPreference.js`).

Zero coleção, zero regra, zero índice, zero migração. Num navegador
compartilhado (o tablet do clube), cada conta tem a sua marca — a chave leva o
uid, e quem não está autenticado usa o escopo `anon`.

## 5. Onde mexer

| Quero… | Vá em |
|---|---|
| corrigir um texto | `src/modules/help/domain/tutorials.js` |
| mudar o comportamento (abrir, fechar, navegar) | `src/v2/components/tutorial/V2TutorialLauncher.jsx` |
| colocar um tutorial numa tela nova | uma linha: `<V2TutorialLauncher tutorialId={...} />` |
| criar um tutorial novo | id em `TUTORIAL_ID` + objeto em `TUTORIALS` |

## 6. Ao mexer, cuidado com

1. **Os ids são CONTRATO.** É por eles que se guarda quem já viu o quê.
   Renomear um id faz o tutorial reaparecer para toda a base, como se fosse
   novo.
2. **O tutorial descreve a ferramenta como ela é HOJE.** Um tutorial que ensina
   um botão que não existe mais é pior do que nenhum: quem segue passo a passo
   conclui que está fazendo algo errado. Mexeu numa dessas telas, passe pelo
   conteúdo.
3. **Formato novo de dia de jogo precisa de tutorial.** Há teste percorrendo
   `GAME_DAY_FORMAT` inteiro e exigindo um para cada — senão o botão "Como
   funciona" some justamente para quem abriu o formato novo.
4. **`tutorialId` nulo não pode quebrar a tela.** O componente devolve `null`
   nesse caso, de propósito: é o que acontece num dia de jogo antigo sem
   formato gravado.
5. **Não ponha regra de negócio no conteúdo.** Estes textos explicam o que a
   tela faz; quem decide o que ela faz é o domínio de cada módulo.
