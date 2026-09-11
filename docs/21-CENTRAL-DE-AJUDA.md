# Central de ajuda

> **Flag**: `help_center` (default **OFF**) · **Rota**: `/ajuda` ·
> **Banco de dados**: nenhum.

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

## 2. Como a tela se comporta

- **Sem busca** — uma seção por vez, escolhida nas abas. É leitura guiada: a
  pessoa se reconhece num papel e lê o que é dela.
- **Com busca** — as abas somem e aparecem resultados de **todas** as seções,
  cada um dizendo de onde veio. Quem busca não sabe (nem tem de saber) em que
  parte a resposta mora; manter a aba marcada sugeriria um filtro que não
  existe.
- Artigos abrem e fecham em acordeão, com `aria-expanded`/`aria-controls`.

### Estado na URL

`?s=<seção>&a=<artigo>&q=<busca>` — o endereço reproduz a tela.

Isso é o que permite mandar alguém **direto ao artigo certo**
(`/ajuda?s=arena&a=gerir-reservas`), e faz o botão "voltar" funcionar. Ao abrir
por link direto, a página rola até o artigo: sem isso o link abriria no topo e
a pessoa teria de procurar.

### Busca

`searchHelp` procura em título, resumo, palavras-chave **e no corpo** dos
artigos. Normaliza acento e caixa — ninguém digita acento numa busca. Vários
termos **estreitam** o resultado (E, não OU): quem digita duas palavras está
sendo mais específico.

## 3. Acesso — três pontos, em toda tela

| Onde | Por quê |
|---|---|
| **Barra lateral**, no rodapé, acima de "Termos e Documentos" | visível em qualquer tela do app |
| **Menu do usuário** (avatar) | é onde se procura quando não se sabe nem por onde começar |
| **Gaveta do celular** | o equivalente da barra lateral no mobile |

A ajuda fica **fora dos hubs** de propósito: ela não é um tema da plataforma
(como Competir ou Jogar), é o que se procura quando se está perdido em qualquer
um deles.

## 4. Arquitetura

```
src/modules/help/domain/helpCenter.js       # o conteúdo (puro, testado)
src/modules/help/domain/helpCenter.test.js  # 88 asserções
src/v2/pages/V2Help.jsx                     # a página
src/v2/pages/V2Help.runtime.test.jsx        # 19 testes de runtime
```

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
3. **Estrutura**: todo artigo tem título, resumo, corpo e palavras-chave; ids
   não se repetem; blocos são bem formados.

## 6. Banco de dados

**Nenhum.** A página é só leitura: nenhuma consulta, nenhuma escrita, nenhuma
coleção, nenhum índice, nenhuma regra. O conteúdo é estático e vem do domínio,
carregado sob demanda (a rota é lazy).

Diferente dos tutoriais em tela, a central **não guarda nada** — nem no
`localStorage`. Não há o que lembrar: não existe "já vi esta página".

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
