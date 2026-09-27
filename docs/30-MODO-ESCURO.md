# 30 — Modo escuro (Onda CH)

> *"Agora vamos fazer o modo escuro da plataforma, com opção de cada usuário
> alterar para a forma que melhor se enquadra ao seu gosto. Desenvolva o design
> condizente, seguindo os padrões e cores da plataforma… não afete o banco de
> dados."*

Cada pessoa escolhe a aparência: **Claro** (o visual de sempre), **Escuro** ou
**Automático** (acompanha o aparelho). Flag `dark_mode`, **default OFF** —
desligada, todo mundo vê o claro de sempre, pixel a pixel.

**Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração. A
escolha fica no navegador, por usuário.

---

## 1. A ideia — as telas não mudaram

Nenhuma das ~500 telas e componentes foi reescrita. Elas continuam escrevendo
`bg-white`, `text-gray-500`, `border-gray-100`, `bg-ink`… e a **paleta** decide
a cor nos dois modos. Isso é o que torna o modo escuro barato de manter: tela
nova já nasce com ele.

Cada cor que muda no escuro é compilada como

```
rgb(calc(CLARO + (ESCURO − CLARO) × var(--k)) …)
```

e `--k` é um interruptor: **0 no claro, 1 no escuro**. Com `--k: 0` a conta dá
**exatamente** a cor de antes — há teste conferindo token a token contra a
paleta original, e a comparação do CSS gerado (2 521 declarações) só achou
diferenças de FORMA (a sombra passou a vir de uma variável com o mesmo valor).

### Por que por PROPRIEDADE

A mesma palavra significa coisas diferentes: `bg-white` é o **cartão** (no
escuro, a superfície escura), mas `text-white` é o texto sobre um botão escuro
(no escuro, continua branco). Por isso o tema tem três grupos:

| Grupo | Propriedades | Interruptor |
|---|---|---|
| `bg` | fundo, degradês, recuo do anel | `--k` |
| `fg` | texto, placeholder, ícones, cursor | `--kf` |
| `line` | borda, divisória, contorno, anel de foco | `--kf` |

### Por que dois interruptores

Texto e linha dependem da **superfície** em que estão. Um painel `bg-ink` ou um
selo `bg-acid` foram desenhados com o texto certo para eles, e esse texto
continua certo no escuro. Então o plugin ensina cada `bg-*` a dizer que
superfície é:

- **de cor** (`bg-ink`, `bg-acid`, `bg-green-600`, cinzas ≥ 500…) zera `--kf`:
  o design original volta a valer lá dentro;
- **neutra** (`bg-white`, `bg-paper`, `bg-gray-100`, tintas `-50/-100/-200`…)
  restabelece `--kf: var(--k)`.

Como é um `matchUtilities` com o mesmo prefixo `bg`, **todas as variantes vêm
de graça**: `hover:`, `group-hover:`, `data-[state=active]:`, `sm:`, `/80`.

### Véus

- `bg-white/10` (véu claro num painel escuro) continua branco;
- `bg-ink/5` (hover sutil sobre o cartão) vira um clarão do texto no escuro;
- `bg-ink/20` em diante (fundo de modal, sombra sobre foto) continua o ink
  profundo — véu tem de escurecer o que está atrás;
- `border-white/10` continua branca.

## 2. A paleta escura

Derivada da própria marca — a família `ink` em camadas, com o verde-ácido
intacto (sobre o escuro ele fica ainda mais vivo, e é ele que marca a ação).

| Camada | Cor | Onde |
|---|---|---|
| página | `#070B13` | `bg-paper` (o recuo) |
| cartão | `#0F1624` | `bg-white`, `bg-paper-pure` |
| realces | `#141C2C` · `#1A2336` · `#232E45` | `bg-gray-50/100/200` |
| destaque | `#26324B` (hover `#303D5A`) | `bg-ink` — aba ativa, botão secundário |
| texto | `#E7ECF3` | `text-ink` |

Contraste **WCAG AA conferido por teste** (`palette.test.js`): texto principal
≥ 12 em qualquer superfície; cinza secundário e de metadado ≥ 4,5; texto
colorido sobre a tinta da MESMA cor (o selo "verde") ≥ 4,5; branco e ácido
sobre o destaque ≥ 7. As camadas sobem em ordem, e as bordas se distinguem do
cartão.

O shadcn (diálogos, menus, avisos) é retunado para a mesma paleta, e os avisos
do `sonner` recebem `theme` — sem isso, o verde-claro de sucesso acenderia no
meio do escuro.

## 3. Onde fica a escolha

| Camada | Chave | O quê |
|---|---|---|
| Por usuário | `v2:view:<uid>:aparencia:tema` | a ESCOLHA (`claro`/`escuro`/`automatico`), via `viewPreference` |
| Espelho do aparelho | `picklerush:tema` | cópia da escolha em vigor, para o script de `index.html` |

- **Por usuário**: num tablet de clube duas pessoas usam o mesmo navegador, e
  uma não herda o escuro da outra.
- **Padrão = Claro**: ninguém acorda com a plataforma diferente sem ter pedido.
  O "claro" escolhido é gravado — se um dia o padrão mudar, quem escolheu fica.
- **Só para quem está logado, com a flag ligada.** Landing, login e visitante
  de página pública veem o claro.
- **O espelho** existe só para o script de `index.html` pintar a PRIMEIRA tela
  certa, antes de o React, o login e as flags carregarem — sem ele, quem
  escolheu o escuro veria um clarão branco a cada abertura. Ele guarda a
  ESCOLHA (o automático é reavaliado a cada abertura) e é **apagado** sempre
  que o escuro não pode valer (flag desligada, visitante).

## 4. Onde a pessoa escolhe

- **Menu do avatar** (computador): um controle de três, e o menu **não fecha**
  ao escolher — a página troca por trás dele e a pessoa compara;
- **Gaveta do celular** (onde o avatar não existe);
- **Configurações → Aparência**: três cartões com uma **miniatura da
  plataforma** em cada modo, desenhada com as MESMAS classes das telas (dentro
  de `.dark` / `.tema-claro`) — qualquer ajuste de paleta aparece nela sozinho.

Os três são grupos de rádio de verdade (setas movem e escolhem; só o escolhido
entra no Tab) e **somem** com a flag desligada.

A troca pedida pela pessoa **esmaece** a página inteira (View Transitions,
onde o navegador tem; nunca com "menos movimento"). Qualquer troca desliga as
transições por dois quadros (`.tema-trocando`) — com elas ligadas, cada botão
mudaria de cor num ritmo e a página "derreteria" em ondas.

## 5. O que fica CLARO de propósito

| O quê | Como | Por quê |
|---|---|---|
| Telão do dia de jogo e do torneio, totem da arena | `<AparenciaClara>` na rota (`App.jsx`) | já são escuros de propósito, desenhados sobre os tokens claros; no escuro o `bg-ink` deles viraria ardósia |
| Impressão do torneio | `<AparenciaClara>` + o `.dark` só vale em `@media screen` | a tela mostra o que sai no papel |
| Cards para compartilhar, certificado | `tema-claro` no elemento capturado pelo `toPng` | a imagem baixada é da marca, não da tela |
| QR codes | fundo branco do próprio QR | leitura |
| Botão das chaves (switch) | `bg-[#fff]`, fora da paleta | `bg-white` é o cartão, e o botão sumiria no trilho |

`<AparenciaClara>` põe o **documento inteiro** no claro enquanto está montada
(corpo, diálogos em portal, avisos) e o script de `index.html` pula as mesmas
rotas (`ROTA_SEMPRE_CLARA`), para a abertura direta não sair escura. O símbolo
da marca troca para a versão clara no escuro (`BrandMark`): a metade ink do
logo some num fundo escuro.

## 6. Arquivos

```
src/core/theme/palette.js            # ⭐ os tokens (claro = Tailwind + marca; escuro)
src/core/theme/tailwindTheme.js      # cores por propriedade + plugin (base, superfícies, véus)
src/core/theme/themePreference.js    # a escolha: opções, padrão, efetivo, espelho, rotas claras
src/core/theme/themeDom.js           # aplicar no documento (idempotente, sem cascata, esmaecer)
src/core/lib/ThemeContext.jsx        # ThemeProvider, useTheme, AparenciaClara
src/v2/components/theme/ThemeSwitcher.jsx  # menu, gaveta e cartão de Configurações
src/v2/ui/BrandMark.jsx              # o símbolo da marca nos dois modos
index.html                           # o script que pinta a primeira tela
src/core/guards/modoEscuro.test.js   # guarda de fonte
```

⚠️ `palette.js` e `tailwindTheme.js` são de **build** (só o
`tailwind.config.js` os importa): importá-los de uma tela poria o
`tailwindcss/colors` inteiro no pacote de todo mundo. Há guarda travando.

## 7. Três armadilhas que custaram horas (e têm teste)

1. **🐞 O `:root` de `index.css` vencia o `.dark`.** Os dois têm a mesma
   especificidade e o `:root` vem depois: com `.dark` sozinho, diálogos e menus
   saíam CLAROS no modo escuro (texto claro sobre fundo claro). O escuro usa
   `:root.dark, .dark`.
2. **🐞 Classe de utilitário numa regra de base vira candidato do Tailwind.**
   A regra "texto padrão sobre superfície ácida" usava `.bg-acid-light`; com
   `hover:bg-acid-light` no código, o Tailwind gerava uma CÓPIA da regra com a
   variante, **depois** dos utilitários — e ela passava a vencer o `text-*` do
   próprio botão. A regra é por atributo (`[class~="bg-acid"]`).
3. **O Playwright muda `prefers-color-scheme` mas não dispara o evento
   `change`.** O automático ao vivo é provado no teste de unidade (ouvinte
   simulado); no navegador, prova-se recarregando.

## 8. Como estender

- **Cor nova da marca**: acrescente em `palette.js` (`BRAND`/`DARK`) e rode
  `palette.test.js` — ele confere a identidade do claro e o contraste do escuro.
- **Uma superfície nova que é "de cor"** (pede o texto do design original):
  confira `surfaceKind`; tons ≥ 300 de uma cor já são.
- **Uma tela que precisa ficar clara**: rota em `App.jsx` casando com
  `ROTA_SEMPRE_CLARA` + `<AparenciaClara>`; trecho, `tema-claro`.
- **Um elemento que vira imagem**: `tema-claro` no elemento capturado (o guarda
  confere todo `toPng`).
- **Nunca** use a variante `dark:` para cor — a paleta já troca. Ela existe
  para trocar ARQUIVO (o logo). E ela só vale na tela, fora de `.tema-claro`.
