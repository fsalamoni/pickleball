# help/ — tutoriais e ajuda em tela

Módulo pequeno e de propósito único: guardar o **conteúdo dos tutoriais** que a
plataforma mostra dentro das próprias ferramentas.

## O que tem aqui

```
help/
└── domain/
    ├── tutorials.js       # o conteúdo (puro, sem I/O, sem React)
    └── tutorials.test.js  # rede de proteção do conteúdo
```

A interface vive em `src/v2/components/tutorial/V2TutorialLauncher.jsx`.

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
