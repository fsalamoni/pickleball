# help/ — tutoriais e ajuda em tela

Módulo pequeno e de propósito único: guardar o **conteúdo dos tutoriais** que a
plataforma mostra dentro das próprias ferramentas.

Duas coisas, complementares:

| | Tutoriais em tela | Central de ajuda |
|---|---|---|
| Onde | dentro da ferramenta | página própria, `/ajuda` |
| Quando | na primeira vez, sozinho | quando a pessoa procura |
| Escopo | uma ferramenta, passo a passo | a plataforma inteira, por persona |

## O que tem aqui

```
help/
└── domain/
    ├── tutorials.js          # tutoriais em tela (torneio, dia de jogo)
    ├── tutorials.test.js
    ├── helpCenter.js         # a central de ajuda: 33 artigos em 5 partes
    └── helpCenter.test.js
```

As interfaces vivem em `src/v2/components/tutorial/V2TutorialLauncher.jsx`
(tutoriais) e `src/v2/pages/V2Help.jsx` (central, flag `help_center`).

## Tutoriais existentes

| id | Ferramenta | Onde aparece |
|---|---|---|
| `torneio` | Criar e gerenciar torneio | `/torneios/criar` e o console de gestão |
| `dia-de-jogo-play` | Dia de jogo — Play | dia de jogo no formato Play + diálogo de criação |
| `dia-de-jogo-americano` | Dia de jogo — Americano | Americano, Mexicano e Rei da Quadra (a tela é a mesma) |
| `dia-de-jogo-americano-aprimorado` | Dia de jogo — Americano aprimorado | dia de jogo `americano_live` |

## Como usar numa tela

Uma linha. O componente cuida do resto — abrir na primeira vez, dispensar,
lembrar por usuário e deixar o botão para rever:

```jsx
import V2TutorialLauncher from '@/v2/components/tutorial/V2TutorialLauncher';
import { TUTORIAL_ID } from '@/modules/help/domain/tutorials';

<V2TutorialLauncher tutorialId={TUTORIAL_ID.TOURNAMENT} />
```

Num dia de jogo, o tutorial acompanha o formato gravado:

```jsx
import { tutorialIdForGameDayFormat } from '@/modules/help/domain/tutorials';

<V2TutorialLauncher tutorialId={tutorialIdForGameDayFormat(gameDay.format)} />
```

`tutorialId` nulo ou desconhecido **não renderiza nada** — a tela nunca quebra
por causa de um tutorial que não existe.

Parâmetros úteis: `label` (texto do botão) e `autoOpen={false}` (só oferece,
não interrompe — use onde a pessoa veio fazer outra coisa).

## Memória: quem já viu o quê

`localStorage`, por usuário: `v2:view:<uid>:tutorial:<id>`, via
`core/lib/viewPreference.js`. **Nada toca o Firestore** — "já vi este tutorial"
é preferência de interface, não dado do produto, e não vale uma leitura de
banco por abertura de tela.

Fechar de qualquer jeito (X, "Dispensar", "Entendi", clicar fora) marca como
visto: a intenção é sempre a mesma — "não me mostre isso sozinho de novo".
Rever continua a um clique, sempre.

## Ao mexer aqui, cuidado com

1. **Os ids são CONTRATO.** Renomear um id faz o tutorial reaparecer para toda
   a base, como se fosse novo.
2. **O tutorial precisa descrever a ferramenta como ela é HOJE.** Um tutorial
   que ensina um botão que não existe mais é pior que nenhum: quem segue passo
   a passo conclui que está fazendo algo errado. Mexeu na tela, passe aqui.
3. **Formato novo de dia de jogo precisa de tutorial.** Há teste que percorre
   `GAME_DAY_FORMAT` inteiro e exige um tutorial para cada — sem isso o botão
   "Como funciona" some justamente para quem abriu o formato novo.
4. **Regra de negócio não mora aqui.** Estes textos explicam o que a tela faz;
   quem decide o que ela faz é o domínio de cada módulo.

## Central de ajuda (`helpCenter.js`)

Cinco partes — **Começar aqui**, **Atleta**, **Arena**, **Professor**, **Conta e
privacidade** —, 33 artigos, cada um feito de blocos tipados (`p`, `steps`,
`list`, `tip`, `warn`, `link`). Conteúdo é dado, não JSX: dá para testar,
buscar e endereçar sem depender da tela.

`searchHelp(termo)` procura no corpo dos artigos, ignora acento e caixa, e
vários termos ESTREITAM o resultado (E, não OU).

Os ids são **endereço**: `/ajuda?s=arena&a=gerir-reservas` abre direto no
artigo. Renomear um id quebra links que já circulam.

### A ajuda sabe de onde a pessoa veio

O link de ajuda de qualquer tela leva a rota atual junto —
`helpLinkFor(location.pathname)` monta `/ajuda?de=<rota>` — e a central abre
com os artigos daquele assunto no topo. O mapa é `HELP_ROUTE_HINTS`, lido por
`helpForRoute(pathname)`; `*` vale por UM segmento, e **vence o primeiro molde
que casar**, então o específico tem de vir antes do genérico (há teste).

Rota sem pista devolve `null` e a tela não mostra bloco nenhum: **sugestão
errada é pior que nenhuma** — ensina a pessoa a ignorar o bloco.

**Criou ou removeu uma tela? Passe por `HELP_ROUTE_HINTS`.** O teste pega a
pista órfã; a pista que FALTA ninguém vê.

⚠️ **Importe `helpLinkFor` de `helpLink.js`, nunca de `helpCenter.js`.** Quem
monta esse link está numa tela comum, e `helpCenter.js` carrega 33 artigos de
texto: importar de lá joga o manual inteiro no chunk que todo mundo baixa
(216 kB contra 184 kB, medido). Há teste conferindo.

### O resto do que o domínio oferece à tela

| Função | Para quê |
|---|---|
| `HELP_FAQ` / `faqArticles()` | as dúvidas comuns, escritas como pergunta |
| `highlightParts(texto, termo)` | destaque do termo, sem perder acento |
| `searchSnippet(artigo, termo)` | o trecho do corpo onde o termo apareceu |
| `nextHelpArticle(s, a)` | o próximo artigo, atravessando seções |

Testes que guardam o que mais importa:

1. **todo link interno aponta para uma rota que existe** — o teste lê
   `V2App.jsx` e confere;
2. **a ajuda não documenta o que está atrás de flag desligada** (hoje, a
   gamificação). Ao ligar a flag, escreva os artigos **e remova o teste**;
3. **toda rota de origem existe**, **toda pista e toda pergunta apontam para
   artigo que existe**, e **o específico vem antes do genérico**;
4. **`highlightParts` nunca perde nem inventa caractere** — remontar os pedaços
   devolve o texto original.

Detalhes: `docs/21-CENTRAL-DE-AJUDA.md`.
