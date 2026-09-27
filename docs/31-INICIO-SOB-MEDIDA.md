# 31 — Início sob medida: cada pessoa escolhe os cards do seu início (Onda CI)

> **Pedido**: *"nas configurações do perfil de cada usuário eles possam escolher
> quais funcionalidades e cards eles querem na sua página de início, pois a
> página está muito povoada. Em regra, deve vir habilitados os cards de dia de
> jogo, horários de arena e ranking, os quais podem ser desabilitados se o
> usuário quiserem, os demais também podem ser habilitados… não afete o banco
> de dados"*.
>
> Uma flag nova, **default OFF**: `home_cards` (grupo **Engajamento**, ao lado
> de `personalized_home`). Ela só vale **sobre** o início personalizado: com
> `personalized_home` desligada, `/` segue a tela clássica e nada disto existe.
> Com `home_cards` desligada, o início personalizado segue decidindo sozinho,
> exatamente como na Onda CG.

---

## 1. O que muda para a pessoa

| Antes (Onda CG) | Com o início sob medida |
|---|---|
| A tela decidia as seções: papel real → atividade → interesses → padrão. Quem gere arena, dá aula e organiza torneio via **tudo** empilhado | A pessoa decide: **Dias de jogo, Horários da arena e Ranking** de começo; qualquer um sai, qualquer outro entra |
| Atalhos, destaques e evolução sempre na tela (fora das seções) | São **cards como os outros**, na posição que a pessoa quiser |
| "Personalizar" mudava os **interesses** do perfil (escrita no banco) | "Personalizar" abre o **seletor dos cards** (nenhuma escrita no banco) |
| — | O que a pessoa FAZ na plataforma vira **sugestão** no seletor ("Porque você faz isso na plataforma"), não enche a tela |

O que **não** muda:

- **O que tem prazo aparece sempre**, fora dos cards: a chamada da fila de um
  jogo aberto (vence em 1 hora). Escolha nenhuma esconde isso.
- O topo (saudação, a frase do dia e os contadores Hoje / Próx. 7 dias / Pedem
  ação) segue lá. É o "resumo do dia" — e é tudo o que sobra quando a pessoa
  desliga todos os cards.
- As regras da Onda CG: nada vencido, falha não é vazio, seção isolada.

## 2. Onde se escolhe

Dois lugares, **o mesmo seletor** (`HomeCardsPicker`):

1. **No próprio início** → botão **Personalizar** no topo (e "Escolher o que
   aparece aqui" no pé). Abre um diálogo; a tela atrás muda **na hora** — por
   isso o botão é "Pronto", não "Salvar".
2. **Configurações → Página inicial** (`/configuracoes#pagina-inicial`), com um
   resumo ("Hoje: 3 cards: Dias de jogo, Horários da arena e Ranking") e "Ver o
   início".

O seletor tem três blocos, na ordem em que a pessoa pensa:

1. **No seu início, nesta ordem** — os cards ligados, numerados, com subir /
   descer e o interruptor para tirar. Fora do padrão aparece **Restaurar o
   padrão**.
2. **Sugeridos para você** — os cards das frentes em que a pessoa está por
   papel, atividade ou interesse (`suggestedHomeCards`), com o motivo e
   **Adicionar**. É sugestão: a tela não volta a se encher sozinha.
3. **Para acrescentar** — o resto, por assunto (Para jogar · Para competir ·
   O seu dia a dia · Se você trabalha com pickleball).

Acessibilidade: o interruptor é `role="switch"` com o título do card como nome;
subir/descer têm nome ("Subir “Ranking”") e, nas pontas, ficam **focáveis com
`aria-disabled`** (não somem sob o dedo); cada mudança é anunciada numa região
`aria-live` ("Sua agenda entrou no início, em 4º."). No celular as setas ficam
uma sobre a outra — lado a lado, com o interruptor, espremiam a descrição em
duas palavras por linha.

## 3. O catálogo

Fonte única: `src/modules/home/domain/homeCards.js` (`HOME_CARD_META`). As
seções da Onda CG viraram cards com os mesmos ids (`HOME_SECTION`), e três
cards novos cobrem o que ficava fora delas:

| Card | id | Observação |
|---|---|---|
| Dias de jogo | `jogar` | ⭐ padrão |
| Horários da arena | `reservar` | ⭐ padrão |
| Ranking | `ranking` | ⭐ padrão |
| Sua agenda | `agenda` | largo |
| Atalhos | `atalhos` | largo |
| Promoções e destaques | `destaques` | largo · só com uma fonte de promoção ligada (`arena_modules`, `platform_marketing` ou `coach_marketing`) |
| Sua evolução | `evolucao` | largo · só com `action_home` |
| Torneios | `torneios` | |
| Seu último torneio | `resultado` | escolhido e sem resultado, diz que ainda não há (não some) |
| Torneios que você organiza | `organizar` | |
| Aulas e professores | `aulas` | |
| Seus clubes | `clubes` | |
| Comunidade | `comunidade` | |
| Sua arena | `arena` | |
| Suas aulas (professor) | `professor` | |

**Card de funcionalidade desligada** (`homeCardAvailable`): não é oferecido e
não aparece, mas **continua guardado** na escolha — volta sozinho no dia em
que a funcionalidade for ligada.

## 4. A grade não deixa buraco

A grade tem duas colunas a partir de `xl`. Os cards **largos** (agenda,
atalhos, destaques, evolução) ocupam a linha inteira; e, entre dois largos ou
no fim, o card que ficaria **sozinho** numa linha também se estica
(`wideHomeCards`). É o caso do próprio padrão: três cards — dois numa linha e
o Ranking na linha de baixo inteira, em vez de sozinho com um buraco ao lado.
O card que se estica é o **último** da sequência: a ordem da pessoa não muda.

A regra supõe que todo card renderiza algo — por isso "Seu último torneio",
quando escolhido, mostra um "ainda não há" em vez de sumir. (Os largos podem
sumir sem problema: largo que some não abre buraco.) As seções recebem a
decisão por contexto (`HomeWideCards`, em `homeWideCards.js`), sem cada uma
precisar de uma prop nova.

## 5. Card escondido não consulta nada

Card desligado **não é montado**. Como cada seção faz as próprias consultas,
escondê-lo tira as consultas junto — em especial a faixa **Sua evolução**, que
lê o ranking nacional inteiro. O início enxuto é também um início mais leve.
Há teste de tela provando que, sem o Ranking, a consulta do ranking não roda.

## 6. Banco: zero

A escolha mora no **navegador, por usuário** (`viewPreference`):

```
localStorage  v2:view:<uid>:inicio:cards  =  {"v":1,"cards":["jogar","reservar","ranking"]}
```

- **Sem a chave** ⇒ a pessoa nunca escolheu ⇒ vale o padrão (e o padrão pode
  evoluir para todo mundo que nunca escolheu).
- **`cards: []`** ⇒ escolha de verdade ("só o resumo do dia") — não volta ao
  padrão sozinha. A tela diz "Seu início está enxuto" e oferece os dois
  caminhos.
- **Restaurar o padrão** apaga a chave.
- Texto ilegível, de outra versão (`v`) ou com card desconhecido não quebra:
  vira "nunca escolheu" / o desconhecido é descartado.
- Com o uid na chave, num tablet compartilhado cada pessoa vê o **próprio**
  início. Em outro aparelho, escolhe de novo — é o preço de não tocar o banco,
  e o texto da tela e da ajuda diz isso.

Várias partes da tela leem a mesma escolha (o início atrás do diálogo, o
seletor, o resumo em Configurações). É um armazenamento com assinantes
(`homeCardsPreference.js`) lido por `useSyncExternalStore` (`useHomeCards`):
mudar num lugar atualiza os outros na hora, e mudar em **outra aba** também
(evento `storage`). O retrato é o **mesmo objeto** enquanto nada muda — sem
isso o `useSyncExternalStore` renderiza em laço.

Nenhuma coleção, campo, índice, regra ou função. O "Personalizar" da Onda CG
gravava `users.interests`; com o início sob medida ele **não grava nada** (os
interesses seguem editáveis no perfil e continuam alimentando as sugestões).

## 7. Código

```
src/modules/home/
├── domain/homeCards.js              # catálogo, padrão, ligar/ordenar, disponibilidade, sugestões, grade
├── services/homeCardsPreference.js  # localStorage por uid + assinantes (e o evento storage)
└── hooks/useHomeCards.js            # useHomeCards / useHomeCardsOn / useHomeCardsContext

src/v2/components/home/cards/
├── HomeCardsPicker.jsx        # o seletor (o mesmo nos dois lugares)
├── HomeCardsDialog.jsx        # "Personalizar" no início — carregado sob demanda (lazy)
├── HomeCardsSettingsCard.jsx  # Configurações → Página inicial (some sem a flag)
└── HomeCardsEmpty.jsx         # "Seu início está enxuto"
```

`V2PersonalHome` tem **dois caminhos**: com `useHomeCardsOn()` ele monta os
cards escolhidos, na ordem, numa grade só; sem, é o código da Onda CG, intacto.
`HomeHero` aceita `cards` + `onPersonalizar` (a lista mostrada no topo e o
seletor); sem eles, segue mostrando as frentes e abrindo os interesses.

## 8. Ajuda

"A sua tela inicial" ganhou um irmão: **"A sua tela inicial: você escolhe os
cards"** (`inicio-sob-medida`). Os dois ensinam coisas diferentes para o MESMO
botão "Personalizar", então nunca aparecem juntos. Para isso a ajuda ganhou
duas formas de condição (`helpArticleVisible`):

- `flagsTodas` — vale só com TODAS ligadas (o sob medida só existe sobre o
  personalizado);
- `semFlags` — some quando QUALQUER uma está ligada (o artigo do jeito antigo
  sai no dia em que o novo entra).

A pista de `/configuracoes` aponta para o artigo novo. 48 artigos no total.

## 9. Guardas e testes

- `src/core/guards/inicioSobMedida.test.js` (lê o código-fonte):
  1. **todo card do catálogo tem desenho** na tela inicial — card acrescentado
     ao catálogo e esquecido no `switch` não dá erro: a pessoa liga o
     interruptor e nada aparece;
  2. **zero banco** — nenhum arquivo do recurso fala com o Firestore nem grava
     o perfil;
  3. o seletor é carregado **sob demanda** na tela inicial.
- Domínio (`homeCards.test.js`), armazenamento (`homeCardsPreference.test.js`),
  hook (`useHomeCards.test.jsx`), seletor e Configurações
  (`HomeCardsPicker.runtime.test.jsx`) e a tela
  (`V2PersonalHome.runtime.test.jsx`, bloco "início sob medida").

## 10. De quebra: a âncora que era desfeita (e deslocava o app)

Verificando `/configuracoes#pagina-inicial` no navegador, a página **não
rolava** até o cartão e o aplicativo inteiro **subia 131 px** (a barra lateral
cortada em cima, uma faixa vazia embaixo, sem volta). Duas causas, as duas
fora desta onda:

1. O layout volta o conteúdo ao topo a cada troca de página, num efeito que
   roda **depois** dos efeitos da página (o React roda o do pai depois do dos
   filhos). Com a seção já na tela no primeiro desenho, a rolagem de
   `useHashScroll` era desfeita na hora. (Quando a seção chega depois, com uma
   consulta — o perfil do professor —, o defeito não aparecia.) Agora a
   primeira tentativa espera **um quadro**.
2. `scrollIntoView` rola **todos** os ancestrais que podem rolar, inclusive o
   `.v2-root`, que é `overflow: hidden`. Agora `rolarAte`
   (`src/v2/ui/rolarAte.js`) rola **só o contêiner que rola de verdade** (o
   `<main>`), respeitando o `scroll-margin-top`; sem nenhum, cai no
   `scrollIntoView`. Vale também para o índice "Nesta página" da arena.

## 11. Lições

1. **Quem escolhe precisa ver o efeito na hora.** O seletor muda a tela atrás
   do diálogo — é o que dispensa o "Salvar" e o "será que salvou?".
2. **Desligar tudo é uma escolha**, não um estado inválido. Voltar ao padrão
   sozinho seria desobedecer a pessoa; a tela diz o que está acontecendo e
   oferece o caminho de volta.
3. **Card que a pessoa ligou não pode sumir calado.** "Seu último torneio"
   escondia-se sem resultado — certo quando a TELA decidia mostrá-lo, errado
   quando foi a PESSOA que o ligou.
4. **Uma regra de layout depende do que renderiza.** Esticar o card que sobra
   só funciona se todo card desenha algo; por isso a exceção do item 3 e o
   comentário no domínio.
