# Central de ajuda

> **Flag**: `help_center` (default **OFF**) · **Rota**: `/ajuda` ·
> **Banco de dados**: nenhum (a única memória é a parte preferida, no
> `localStorage` por usuário).

---

## 1. O que é

O manual da plataforma, dentro da própria plataforma, dividido por **tipo de
usuário**. A divisão não é cosmética: quem administra uma arena e quem só joga
têm perguntas completamente diferentes, e um texto corrido faria cada um
garimpar o que não interessa.

| Parte | Público | Artigos |
|---|---|---|
| **Começar aqui** | todos | 6 |
| **Atleta** | quem joga | 10 |
| **Arena** | quem tem quadra | 7 |
| **Professor** | quem dá aula | 5 |
| **Conta e privacidade** | todos | 5 |

33 artigos no total.

## 2. O momento em que esta tela é usada

Ninguém abre a ajuda por lazer. Abre-se **travado**, no meio de outra coisa, já
irritado. Cada passo entre "cliquei em ajuda" e "achei a resposta" é cobrado em
paciência que a pessoa não tem mais.

A primeira versão desta tela custava quatro passos no pior momento: achar o
link, adivinhar que o assunto era "Atleta", varrer dez artigos, abrir. Tudo
abaixo existe para derrubar esse número.

### 2.1 De onde a pessoa veio (`?de=<rota>`)

O link de ajuda de **qualquer** tela manda a rota atual junto
(`helpLinkFor(location.pathname)`), e a central abre com **"Ajuda para esta
tela"** no topo — os dois ou três artigos daquele assunto, já identificados.
Zero adivinhação no caso mais comum.

- o mapa rota → artigos é `HELP_ROUTE_HINTS`, lido por `helpForRoute(pathname)`;
- o molde aceita `*` como **um segmento**, então `/torneios/(*)/gerenciar`
  cobre qualquer id; vence o primeiro molde que casar, e por isso **o
  específico vem antes do genérico** (há teste travando a ordem);
- rota sem pista ⇒ **bloco nenhum**. Sugestão errada é pior que nenhuma:
  ensina a pessoa a ignorar o bloco;
- dá para **dispensar** o bloco (ele some da URL).

### 2.2 Perguntas antes de índice

A tela inicial abre com **"Dúvidas mais comuns"** (`HELP_FAQ`), escritas como
pergunta. Buscar pressupõe saber o **nome** da coisa; quem está perdido não
sabe o nome, mas reconhece a própria pergunta assim que a lê.

### 2.3 Quem é você

Abaixo das perguntas, três cartões em linguagem de pessoa — **"Eu jogo"**,
**"Tenho uma arena"**, **"Dou aulas"** — em vez de só abas abstratas. A escolha
fica **lembrada por usuário** (`v2:view:<uid>:ajuda:secao`): quem cuida de uma
arena não deveria reencontrar a tela no estado inicial toda vez.

Precedência: **URL (`?s=`) → memória → "Começar aqui"**. Link direto manda mais
que memória — senão um link de suporte abriria na parte errada. Escolher
"Começar aqui" **apaga** a memória (é o padrão, não é escolha).

### 2.4 A busca se explica

- **destaque** do termo no título, no resumo e no trecho (`highlightParts`, que
  casa sem acento mas recorta o texto **com** acento);
- **trecho do corpo** onde o termo apareceu (`searchSnippet`) — sem ele o
  resultado parece arbitrário: a pessoa abre, não acha a palavra no começo, e
  desconfia da busca;
- `searchHelp` procura em título, resumo, palavras-chave **e no corpo**, ignora
  acento e caixa, e vários termos **estreitam** o resultado (E, não OU);
- **`/`** foca o campo, **`Esc`** limpa, e há um **X** para limpar no celular
  (onde não existe Esc) e um `kbd` com a dica do atalho quando está vazio;
- **nada encontrado não é parede**: vira as perguntas comuns + a entrada de
  cada parte. Quem não achou com a própria palavra não tem outra — foi por isso
  que buscou.

### 2.5 Sem becos no fim do artigo

Todo artigo aberto termina com **Próximo: <título>** (atravessa para a próxima
seção quando acaba a atual), **Copiar link** (o link direto, que é como o
suporte manda alguém ao ponto) e **Topo**.

### 2.6 O resto

- **Sem busca** — uma seção por vez, escolhida nas abas ou nos cartões.
- **Com busca** — as abas somem e aparecem resultados de **todas** as seções,
  cada um dizendo de onde veio. Quem busca não sabe (nem tem de saber) em que
  parte a resposta mora; manter a aba marcada sugeriria um filtro que não
  existe.
- Artigos abrem e fecham em acordeão, com `aria-expanded`/`aria-controls`.

### Estado na URL

`?s=<seção>&a=<artigo>&q=<busca>&de=<rota de origem>` — o endereço reproduz a
tela.

Isso é o que permite mandar alguém **direto ao artigo certo**
(`/ajuda?s=arena&a=gerir-reservas`), e faz o botão "voltar" funcionar. Ao abrir
por link direto, a página rola até o artigo: sem isso o link abriria no topo e
a pessoa teria de procurar.

## 3. Acesso — três pontos, em toda tela

| Onde | Por quê |
|---|---|
| **Barra lateral**, no rodapé, acima de "Termos e Documentos" | visível em qualquer tela do app |
| **Menu do usuário** (avatar) | é onde se procura quando não se sabe nem por onde começar |
| **Gaveta do celular** | o equivalente da barra lateral no mobile |

Os três passam a **rota atual** adiante (`helpLinkFor(location.pathname)`), que
é o que liga o §2.1. Um quarto ponto de acesso não era o que faltava — o que
faltava era o link já saber do que a pessoa está falando.

A ajuda fica **fora dos hubs** de propósito: ela não é um tema da plataforma
(como Competir ou Jogar), é o que se procura quando se está perdido em qualquer
um deles.

## 4. Arquitetura

```
src/modules/help/domain/helpCenter.js       # conteúdo + pistas + busca (puro)
src/modules/help/domain/helpCenter.test.js  # 121 asserções
src/v2/pages/V2Help.jsx                     # a página
src/v2/pages/V2Help.runtime.test.jsx        # 44 testes de runtime
```

O que o domínio exporta, além do conteúdo:

| Função | Para quê |
|---|---|
| `helpLinkFor(pathname)` | o endereço da central **a partir de** uma tela |
| `helpForRoute(pathname)` | os artigos de quem veio dali (`null` se não há pista) |
| `HELP_ROUTE_HINTS` | o mapa rota → artigos (ordem importa) |
| `HELP_FAQ` / `faqArticles()` | as perguntas comuns, já resolvidas em artigos |
| `highlightParts(texto, termo)` | pedaços `{ text, match }` para o destaque |
| `searchSnippet(artigo, termo)` | o trecho do corpo onde o termo apareceu |
| `nextHelpArticle(s, a)` | o artigo seguinte, atravessando seções |

O conteúdo é **dado**, não JSX. Cada artigo é uma lista de **blocos tipados**:

```js
{ type: 'p',     text }          // parágrafo
{ type: 'steps', items: [...] }  // passo a passo numerado
{ type: 'list',  items: [...] }  // lista
{ type: 'tip',   text }          // dica
{ type: 'warn',  text }          // atenção: o que costuma dar errado
{ type: 'link',  to, label }     // atalho para a tela de que se fala
```

Assim a tela desenha cada tipo do seu jeito e o conteúdo nunca carrega
marcação — nada de `<b>` perdido num texto que um dia vira outra coisa. E dá
para testar, buscar e endereçar sem depender da interface.

## 5. A rede de proteção

Três testes que valem mais que os outros:

1. **⭐ Todo link interno aponta para uma rota que existe.** O teste lê
   `V2App.jsx`, extrai as rotas declaradas e confere cada link da ajuda contra
   elas. Um manual que manda a pessoa para uma página 404 é pior que manual
   nenhum.
2. **⭐ A ajuda não documenta o que está atrás de flag desligada.** Gamificação
   (`/conquistas`, `/hall-da-fama`, `/vinculos`) vive dentro de `<Gamified>` e
   a flag `gamification_v2` está OFF: essas telas **não existem** para o
   usuário. Quando a flag for ligada, escreva os artigos **e remova o teste**.
3. **⭐ Toda rota de origem existe de verdade em `V2App.jsx`**, e **toda pista
   e toda pergunta apontam para artigo que existe.** Pista para tela que não
   existe é código morto que sobrevive à remoção da tela.
4. **⭐ O específico vem antes do genérico** em `HELP_ROUTE_HINTS`: `/torneios`
   casa com `/torneios/x/gerenciar`, então, se viesse primeiro, a pista
   específica nunca seria alcançada. O teste confere todos os pares.
5. **⭐ `helpLinkFor` e `helpForRoute` fecham o contrato**: o que um escreve o
   outro lê. Se um dos dois mudar de forma, quebra na hora.
6. **⭐ `highlightParts` nunca perde nem inventa caractere** — remontar os
   pedaços devolve o texto original, com acento e caixa.
7. **Estrutura**: todo artigo tem título, resumo, corpo e palavras-chave; ids
   não se repetem; blocos são bem formados.

## 6. Banco de dados

**Nenhum.** A página é só leitura: nenhuma consulta, nenhuma escrita, nenhuma
coleção, nenhum índice, nenhuma regra. O conteúdo é estático e vem do domínio,
carregado sob demanda (a rota é lazy).

A única memória é a **parte preferida**, no `localStorage` **por usuário**
(`v2:view:<uid>:ajuda:secao`, via `src/core/lib/viewPreference.js`). O uid está
na chave porque `localStorage` é por NAVEGADOR: num tablet de clube, sem ele,
uma pessoa herdaria a preferência da outra. **Nada disso toca o Firestore.**

## 7. Relação com os tutoriais em tela

São complementares, e a divisão de trabalho é clara:

| | Central de ajuda | Tutoriais (`docs/19-TUTORIAIS.md`) |
|---|---|---|
| Onde | página própria, `/ajuda` | dentro da ferramenta |
| Quando | quando a pessoa procura | na primeira vez, sozinho |
| Escopo | a plataforma inteira, por persona | uma ferramenta, passo a passo |
| Profundidade | panorama + o essencial de cada área | o detalhe fino da operação |

O rodapé da central aponta para os tutoriais; os tutoriais cobrem o passo a
passo de torneio e dia de jogo, que a central resume e referencia.

## 8. Ao mexer, cuidado com

1. **Os ids são endereço.** `/ajuda?s=atleta&a=inscrever-torneio` circula em
   link de suporte. Renomear um id quebra o que já foi compartilhado.
2. **Mexeu numa tela, passe pela ajuda.** Como todo manual, ele só vale
   enquanto for verdade.
3. **Não documente o que está atrás de flag desligada** (veja §5.2).
4. **Não ponha regra de negócio no conteúdo.** Este texto descreve o que a
   plataforma faz; quem decide o que ela faz é o domínio de cada módulo.
5. **O console do admin da plataforma fica de fora** — de propósito. A central
   é visível a qualquer pessoa logada, e documentar a superfície
   administrativa ali não ajudaria ninguém que possa usá-la.
6. **Criou ou removeu uma tela? Passe por `HELP_ROUTE_HINTS`.** O teste pega a
   pista órfã, mas só depois que a rota some — a pista que FALTA ninguém vê.
7. **Ordem das pistas é contrato.** Inserir uma genérica no meio da lista
   silencia todas as específicas abaixo dela; o teste de "engole" existe por
   isso, mas leia a lista antes de inserir.
