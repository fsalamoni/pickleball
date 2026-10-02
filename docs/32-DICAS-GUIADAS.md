# 32 — Dicas guiadas: a dica aparece quando a pessoa quer, e aponta o botão de verdade (Onda CJ)

> **Pedido**: *"o tutorial não está bem da forma como está. O ideal é que o
> usuário ligue ou desligue 'dicas'. E quando as dicas estiverem ligadas, elas
> possam ensinar várias coisas, com setas e avisos reais na tela, indicando que
> clicar ali vai levar para tal coisa. E as dicas sirvam para tudo. Elas não
> devem surgir depois de o usuário ter feito algo, elas devem surgir se ele
> quiser e guiar ele para fazer o que ele procura, guiar configurações etc.…
> não afete o banco de dados"*.
>
> Uma flag nova, **default OFF**: `guided_tips` (grupo novo **Ajuda e dicas**,
> ao lado de `help_center`). Desligada, **nada muda**: nem o botão aparece, e
> os tutoriais seguem abrindo sozinhos na primeira vez, como sempre.

---

## 1. O que muda para a pessoa

| Antes (tutoriais, Onda X) | Com as dicas guiadas |
|---|---|
| Um **modal** de leitura abria sozinho na primeira vez que a pessoa entrava na ferramenta — no meio do que ela tinha ido fazer | **Nada abre sozinho.** A dica aparece quando a pessoa pede |
| Só quatro ferramentas tinham ajuda (torneio e três formatos de dia de jogo) | **44 guias** para tudo o que se faz na plataforma — reservar, criar dia de jogo, torneio, clube, a Central da arena, a agenda do professor, as configurações **e a gamificação** (17 guias: do atleta, de quem oferece e do admin) — e **60 pontos de dica** em 29 telas |
| O texto dizia "vá em Dia de jogo → Criar" e a pessoa procurava o botão sozinha | O guia **leva à tela**, **destaca o botão de verdade** com uma seta, e **avança sozinho** quando a pessoa faz o que ele pediu |
| — | Um interruptor por pessoa: **Dicas na tela ligadas / desligadas** |

## 2. As peças

### 2.1 O botão "Dicas" do topo

Presente em toda tela com a flag ligada (`BotaoDicas`, no cabeçalho do
`V2Layout`). É a única peça que existe com as dicas desligadas — sem ele não
haveria como ligar. Ligadas, ganha o fundo ácido: dá para saber de relance. No
celular, só o ícone (com nome acessível).

### 2.2 O painel

Abre no botão "Dicas" (e em Configurações → Dicas → **Ver os guias**). Três
blocos, na ordem em que a pessoa pensa:

1. **O interruptor** — "Dicas na tela ligadas/desligadas", com o que isso muda
   e quantos pontos a tela atual tem.
2. **Nesta tela** — os guias do lugar onde a pessoa está, o da ferramenta
   primeiro. Num dia de jogo, o guia do formato **daquele** dia (mesmo com a
   flag do formato desligada: flag tira a opção de escolher daqui para frente,
   nunca a de conduzir o que está gravado).
3. **O que você quer fazer?** — a busca (ignora acento, vários termos
   estreitam, título pesa mais) e todos os guias, por área: Primeiros passos ·
   Jogar · Competir · Comunidade · Arenas · A sua arena · Aulas · Conta.

**Os guias funcionam com o interruptor desligado.** Pedir um guia já é querer a
dica; o interruptor decide só o que aparece **sozinho** na tela (os pontos).

### 2.3 Os pontos de dica (com as dicas ligadas)

Uma bolinha pulsando no canto de cada botão que tem dica — no máximo **6 por
tela**, só sobre botões **à vista**. Tocar abre o destaque sobre o botão, com
"o que ele faz" e, quando existe, **"Me mostre como"** (o guia da tarefa).
**"Entendi"** marca como visto: o ponto para de pulsar e fica discreto (quem
esqueceu pode tocar de novo). Com um diálogo aberto, os pontos se recolhem — o
diálogo é o assunto.

### 2.4 O guia

Um guia é uma tarefa em passos. Cada passo diz **onde** (a tela), **o quê** (o
botão, pelo `data-dica`) e **quando avançar**:

| O passo espera… | Como avança |
|---|---|
| nada | "Próximo" |
| `advanceOn: 'click'` | a pessoa toca no botão destacado |
| `advanceOn: { route }` | a tela muda para aquela rota (abriu a arena, o dia de jogo foi criado) |
| `advanceOn: { appears }` | algo aparece (o formulário abriu, os horários apareceram) |

Quando o passo espera uma ação, o cartão mostra o que fazer ("Toque em «Novo
dia de jogo»") e troca "Próximo" por **"Pular"**. O guia **leva à tela** do
primeiro passo sozinho (uma vez por passo), **rola** até o botão e o **centra**,
e no fim "Concluir" o marca como feito (o painel mostra ✓).

**Quando o ponto não está onde se espera**, o guia mostra o caminho em vez de
só dizer "não achei":

- **Noutra aba da mesma tela** (a Central da arena no Calendário quando o passo
  é em Quadras) → **"Levar-me até lá"** abre a aba certa
  (`destinoDeRecuo`). Nunca tira a pessoa de dentro de um dia de jogo para a
  LISTA: o recuo só vale para a mesma tela.
- **O formulário foi fechado** no meio do guia → **"Abrir de novo"** volta ao
  passo que o abre (`passoQueAbre`), se o botão que abre estiver à vista.
- De resto, o aviso honesto (pode depender de permissão, de algo que ainda não
  existe, de um cartão fechado) — e dá para seguir.

**Esc** e o **X** saem do guia (o Esc de um diálogo aberto é do diálogo). O
guia em andamento sobrevive a recarregar a página (sessão do navegador).

### 2.5 Os tutoriais viraram guias

Os quatro tutoriais (Onda X) **são** guias agora — `tutorial:<id>`, **o mesmo
texto** (fonte única em `tutorials.js`), com uma âncora para cada passo. Com as
dicas ligadas, o botão **"Como funciona"** das ferramentas começa o guia na tela
e **não abre nada sozinho**. Duas exceções de propósito:

- `explicar` — o diálogo de **criação** do dia de jogo segue com o modal de
  leitura: a tela do guia (o dia de jogo) ainda não existe, e o botão serve
  para escolher o formato;
- `guia` — em `/torneios/criar`, o botão começa o guia **do formulário**
  ("Criar um torneio"), não o da gestão, que é noutra tela.

### 2.6 "Mostre na tela" na Central de ajuda

Cada artigo da `/ajuda` pode dizer os seus guias (`guias: [...]` no artigo). Com
as dicas ligadas, o fim do artigo ganha **"Quer fazer agora?" → Mostre na
tela**: ler e, em seguida, fazer. Só aparecem os guias que valem para a pessoa
(flags e papel) — "Cadastrar quadras" não é oferecido a quem não gere arena.

### 2.7 Configurações → Dicas

O mesmo interruptor, "Ver os guias", "Mostrar de novo os pontos já vistos" e
quantos guias a pessoa já concluiu (`DicasSettingsCard`, âncora `#dicas`).

## 3. O desenho

- **Destaque**: o resto da tela escurece (o foco é um recorte, não um bloqueio —
  o botão destacado **continua clicável**, é para clicar nele), o botão ganha o
  anel ácido e uma **seta** aponta para ele, balançando de leve.
- **O cartão** se posiciona sozinho (`posicionarDestaque`, geometria pura e
  testada): abaixo, acima, à direita ou à esquerda do botão, o que couber. **No
  celular**, acopla na borda de baixo ou de cima, a oposta ao botão.
- **Dentro de um diálogo do Radix** (o formulário de criar dia de jogo, a
  confirmação da reserva) o cartão vira uma **faixa presa ao rodapé do próprio
  diálogo**: um cartão por cima, fora dele, não receberia clique (o diálogo
  prende o foco) e clicar nele **fecharia o formulário** que o guia ensina a
  preencher. E o guia rola o diálogo até o campo ficar **acima** da faixa.
- **Modo escuro**: sai da paleta, como toda tela (Onda CH). O ácido é o mesmo.
- **Menos movimento** (`prefers-reduced-motion`): sem pulso, sem seta
  balançando, rolagem sem animação.
- Camadas: pontos `z-[35]` (abaixo do cabeçalho fixo), escurecimento e seta
  `z-[60]`, cartão `z-[61]`.

## 4. Acessibilidade

- O cartão é `role="dialog"` (não modal) com `aria-labelledby` no título; o
  foco vai para o título a cada passo (menos quando a pessoa está digitando
  num campo que o guia acabou de abrir).
- Uma região `aria-live` anuncia "Passo 2 de 8: …".
- "Ir até o ponto destacado" (visível ao receber foco) leva o teclado ao
  botão de verdade.
- Interruptor com `role="switch"`; cada ponto é um botão "Dica: <título>".

## 5. Banco de dados

**Nenhum.** Zero coleção, zero campo, zero regra, zero índice, zero função.
Tudo é preferência de interface, no navegador, **por usuário** (a chave leva o
uid — num tablet de clube, uma pessoa não herda as dicas da outra):

| O quê | Onde |
|---|---|
| dicas ligadas | `localStorage` `v2:view:<uid>:dicas:ligadas` = `'1'`/`'0'` (sem a chave: desligadas) |
| guias concluídos | `localStorage` `v2:view:<uid>:dicas:feitos` (lista de ids) |
| pontos já vistos | `localStorage` `v2:view:<uid>:dicas:vistos` (lista de ids) |
| guia em andamento | `sessionStorage` `picklerush:dicas:guia:<uid>` (`{ id, passo }`) |

Guarda de fonte travando: nenhum arquivo das dicas importa o Firestore nem
grava o perfil (`src/core/guards/dicas.test.js`).

**E o pacote**: o catálogo (guias, pontos) e tudo o que desenha só baixam quando
a pessoa liga as dicas, começa um guia ou abre o painel (`DicasCamada`, com
`lazy()`). A tela que todo mundo abre paga só pelo botão e pelo provedor.

## 6. 🐞 O que a verificação achou (e foi corrigido)

1. **O "Cancelar" do pedido de reserva quebrava** quando o pedido vinha da
   grade do dia: a confirmação é aberta com `onClose`, e o botão chamava
   `onOpenChange(false)` direto — `undefined is not a function`, e o diálogo
   não fechava. Agora usa a mesma função resolvida do resto do diálogo (teste
   de regressão que falha sem a correção).
2. **O painel do professor ignorava `?aba=`** depois de aberto: a aba escolhida
   ficava num estado local que vencia a URL. Um aviso (ou um guia) apontando
   para `/aulas?aba=agenda` com o painel já aberto noutra aba não fazia nada.
   Agora a URL manda quando diz a aba.
3. **Os tutoriais ensinavam botões que não existem mais**: "Dia de jogo →
   Criar" (o botão é **Novo dia de jogo**), "Torneios → Criar" (**Criar
   torneio**) e "o card Organização" (saiu na Onda BC — hoje é **Configurações
   do dia de jogo → Quem organiza as partidas**). Corrigidos.
4. Durante o desenvolvimento, dois defeitos do próprio guia, que a verificação
   no navegador pegou e os testes travam: o hook que acha o botão devolvia, no
   primeiro desenho de um passo novo, o botão do passo **anterior** (o guia
   rolava até o velho e nunca trazia o novo à vista); e, num diálogo, a faixa
   do guia **cobria o campo** que ela mesma destacava.

## 7. Onde mexer

| Quero… | Vá em |
|---|---|
| escrever/editar um guia | `src/modules/help/domain/guias.js` (`GUIAS_BASE`) |
| mudar o texto de um tutorial | `src/modules/help/domain/tutorials.js` (vale para o modal E para o guia) |
| apontar um passo de tutorial para outro botão | `ANCORAS_DOS_TUTORIAIS` em `guias.js` |
| acrescentar um ponto de dica | `src/modules/help/domain/pontosDeDica.js` |
| marcar um botão como alvo | `data-dica="…"` nele (ou `dica` num `V2CollapsibleCard`, `V2TutorialLauncher`, `V2SectionNav`/`V2SubTabs` e nos itens de navegação) |
| oferecer um guia no fim de um artigo | `guias: [...]` no artigo, em `helpCenter.js` |
| mudar o motor (seta, cartão, avançar) | `src/v2/components/dicas/` (`GuiaEmAndamento`, `Destaque`, `alvoNaTela`) |
| mudar a geometria | `src/modules/help/domain/dicasPosicao.js` (puro, testado) |

## 8. Ao mexer, cuidado com

1. **A âncora é contrato.** Renomear um `data-dica` numa tela não dá erro: o
   guia passa a dizer "não encontrei este ponto" para sempre. O guarda
   (`dicas.test.js`) lê o código de todas as telas e reprova âncora usada que
   não existe.
2. **Toda tela citada existe.** `route`, `goTo` e `advanceOn.route` são
   conferidos contra as rotas do `V2App.jsx` — "Levar-me até lá" para um
   caminho que não existe é uma tela em branco.
3. **O passo que avança por rota espera OUTRA tela**; senão avançaria sozinho
   no instante em que aparece (guarda travando).
4. **Uma âncora pode existir duas vezes** (a barra lateral e a gaveta do
   celular): vale a primeira **à vista**. Por isso um passo pode ter uma LISTA
   de âncoras, da preferida à de reserva — ex.: a aba "Quadras", senão a seção
   "Estrutura e preços", senão a barra de seções.
5. **Cartão que começa fechado não tem o corpo montado.** Aponte para o cartão
   (ou para a ação no cabeçalho dele), não para algo lá dentro.
6. **O guia descreve a tela como ela é HOJE** — a mesma regra dos tutoriais.
   Mexeu numa tela com guia, passe por ele.
7. **Guia de papel**: `audience: 'arena'`, `'professor'` ou `'admin'` some para
   quem não é (`ctx.ehAdmin` vem de `isPlatformAdmin`, em `useContextoDasDicas`);
   `flags`/`flagsTodas`/`semFlags` seguem a mesma regra dos artigos da ajuda.
8. **Só a camada e as telas preguiçosas importam o catálogo** (guarda
   travando) — importá-lo de uma tela comum põe os 44 guias no pacote de todo
   mundo.

### 8.1 A gamificação nas dicas (flag `gamification_v2`)

Uma área própria no painel — **Gamificação** (ícone `Sparkles`), depois de
Comunidade — com 17 guias, todos atrás da flag `gamification_v2`:

| Para quem | Guias |
|---|---|
| Atleta | `gamificacao-entender` (XP, nível e tier + o guia completo), `-missoes` (primeiros passos e missões), `-sequencia` (semanas seguidas, folga e férias), `-revisao`, `-competir` (temporada, duelo, desafios), `-social` (avaliações, cartas, reputação), `-vinculos`, `-recompensas`, `-hall`, `-conquistas`, `-privacidade` |
| Quem tem arena (`audience: 'arena'`) | `gamificacao-oferecer-arena` (saúde, metas, criar desafio), `gamificacao-recompensa-arena` |
| Professor (`audience: 'professor'`) | `gamificacao-oferecer-professor` |
| Admin da plataforma (`audience: 'admin'`) | `gamificacao-admin-configurar`, `-integridade`, `-metricas` |

Os pontos de dica (20) ficam no hub, em Conquistas, Hall da Fama, Vínculos,
Revisão, Preferências, no guia, na aba de engajamento da arena e do professor,
na aba **Atividade** do clube (só quem administra a vê) e na seção Gamificação do
console do admin.

Regras que travam:

- **Os números das férias vêm da regra** (`STREAK_VACATION_MAX_DAYS`,
  `STREAK_VACATION_COOLDOWN_DAYS`, de `weekStreak.js`), não escritos à mão — há
  teste. Os demais textos evitam número de propósito: quem quer o número lê o
  guia da gamificação (`/gamification/como-funciona`), que o tira das constantes.
- **Âncora é contrato**: `hub-tabs` (`aba-jornada`, `aba-missoes`…), `sequencia`,
  `sequencia-ferias`, `oferta-desafio-novo`/`-form`/`-salvar` (e as de
  recompensa), `prefs-*`, `hall-*`, `vinculos-*`, `revisao-*`, `admin-gam-*`.
  Renomear não dá erro — o guia passa a dizer "Não encontrei este ponto"; o
  guarda `dicas.test.js` reprova. O guarda lê `dica: '…'` e `data-dica="…"`
  **literais**: âncora montada com template (`` `x-${k}` ``) ou ternário não é
  vista — ponha o valor no objeto (`dica: 'vinculos-aba-crews'`).
- **A aba some quando o módulo está desligado** (`hubTabs`): guia que manda
  tocar numa aba desligada cai no "Não encontrei" com o botão "Levar-me até lá".
  É o comportamento certo — a alternativa seria mostrar o guia de uma porta que
  o admin fechou.

## 9. Testes

- Domínio (`guias.test.js` — que cobre também os pontos —, `dicasRota.test.js`,
  `dicasPosicao.test.js`, `dicasPreference.test.js`): forma do catálogo,
  tutoriais convertidos com o mesmo texto, quem vê o quê, "Nesta tela", busca,
  destinos, recuo, "abrir de novo", artigos apontando para guias que existem.
- Guarda de fonte (`src/core/guards/dicas.test.js`): âncoras existem, rotas
  existem, zero banco, catálogo fora do pacote comum.
- Renderização (`src/v2/components/dicas/dicas.runtime.test.jsx`): flag
  desligada não muda nada; desligadas não aparece nada sozinho; ligar por
  usuário; buscar → começar → ser levado → avançar por ação; Voltar/Próximo/
  Concluir; Esc e X; "Como funciona" vira guia (e `guia`/`explicar`); pontos e
  "Entendi"; Configurações; "Mostre na tela" respeitando o papel; "Levar-me até
  lá" e "Abrir de novo".
- Verificação no navegador (Playwright + emuladores, claro/escuro,
  computador/celular): criar um dia de jogo **seguindo o guia até o fim**, com o
  guia avançando sozinho para a tela do dia criado; o tutorial do Play achando
  o ponto de todos os passos; nenhum passo de diálogo coberto pela faixa.
