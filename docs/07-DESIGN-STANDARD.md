# DESIGN_STANDARD — padrão visual da plataforma ("Athleisure Premium")

Documento normativo para páginas, abas e diálogos da PickleRush. Existe para
eliminar deriva visual: toda tela nova deve parecer parte do mesmo produto.
O visual atual é o **Athleisure Premium** do V2 (tinta escura + verde-ácido +
papel claro); o antigo padrão "emerald/arena-panel" (`PlatformSurfaceCard` etc.,
`src/components/ui/platform-page.jsx`) é **legado** — não use em tela nova.

Fontes de verdade (se este texto divergir, o código vence e este texto está
errado — corrija): `tailwind.config.js`, `src/core/theme/palette.js`,
`src/v2/ui/primitives.jsx`, `src/v2/ui/pageFrame.js`, `src/index.css`.

## 1. Escopo

Obrigatório em páginas novas, abas que funcionam como páginas, diálogos com
mais de um bloco e qualquer refino de tela existente. Exceção só deliberada e
escrita (ex.: telão, totem, impressão têm layout próprio e ficam sempre claros).

## 2. Tokens

### 2.1 Cores da marca (`tailwind.config.js` ← `palette.js` `BRAND`)

| Token | Valores | Uso |
|---|---|---|
| `acid` | `DEFAULT #D4F82E`, `light #E5FA7A`, `dark #A6C61A` | ação primária, destaque, selo |
| `ink` | `DEFAULT #0B0F19`, `light #1A2235`, `lighter #2D3A54` | texto principal, superfície escura, botão secundário |
| `paper` | `DEFAULT #F7F9FC`, `pure #FFFFFF`, `dark #E2E8F0` | fundo da aplicação (`paper`), cartão (`paper-pure`/`white`) |

Texto secundário é `text-gray-500` (nunca `gray-400` em fundo claro: 2,5:1,
reprova no AA). Estado usa só as famílias `green`, `amber`, `red`, `blue`
(`V2Badge` também admite `cyan` e `purple`). Os tokens shadcn (`background`,
`primary`, `border`…) existem por compatibilidade com Radix; em tela V2 prefira
os da marca.

### 2.2 Tipografia

- **Inter** (corpo, via `index.css`) e **Outfit** (`font-display`, títulos),
  carregadas do Google Fonts em `index.html`. Classes: `font-display`, `font-inter`.
- Título da página (h1): `PAGE_TITLE` (fundo claro) ou `HERO_TITLE` (herói escuro)
  — `font-display text-3xl sm:text-4xl font-bold tracking-tight`, **um tamanho só**
  (`TITLE_TYPE`). Nunca escreva h1 à mão.
- Título de seção: `V2SectionHeader` (`font-display text-2xl sm:text-3xl font-bold`).
- Eyebrow/legenda: `text-2xs font-bold uppercase tracking-widest text-gray-500`.
- **Piso tipográfico: 11 px** (`text-2xs`, só selo e legenda). `text-[10px]` e
  menores são dívida e o guarda reprova aumento.

### 2.3 Raios, sombras e espaçamento

- Raios: `--radius` 1.25rem (1rem no mobile); `rounded-2.5xl` (1.25rem),
  `rounded-3xl` (1.75rem), `rounded-4xl` (2.25rem) — os "squircles" do V2.
- Sombras: `shadow-organic` e `shadow-organic-sm` (difusas; mais fundas no
  escuro, vêm de variáveis da paleta) e `shadow-glow` (brilho ácido, só em ação
  primária).
- Cartões: `V2Surface` com `variant` `padrao` (seção, `rounded-4xl`, `p-6/8`),
  `compacto` (cartão interno, `rounded-3xl`, `p-4`) ou `plano` (apoio, sem sombra).
  Cartão ou campo "escrito à mão" fora de `src/v2/ui` é dívida (guarda).
- Espaçamento vertical entre blocos: `space-y-*` no container da página; o
  recuo lateral/superior é do `<main>` do layout.

## 3. Primitivos

### 3.1 `src/v2/ui/primitives.jsx` (exportações reais)

`SURFACE_VARIANTS`, `V2Surface`, `V2CollapsibleSection`, `PAGE_FRAME`,
`TITLE_TYPE`, `PAGE_TITLE`, `HERO_TITLE`, `V2Page`, `V2PageIntro`, `V2BackLink`,
`V2PageHeader`, `V2SectionHeader`, `V2Button`, `V2Badge`, `V2StatCard`,
`V2Avatar`, `V2AvatarStack`, `V2EmptyState`, `V2ErrorState`, `V2Skeleton`,
`V2FilterChip`, `V2SearchInput`, `V2Field`, `V2Input`, `V2Textarea`, `V2Select`,
`V2Toggle`, `V2ContentHero`, `V2ContentSection`, `V2BulletList`.

- `V2Button`: `variant` = `primary | secondary | ghost | subtle | danger`;
  `size` = `sm | md | lg | icon`. `sm`/`md` levam `coarse:min-h-11`; `icon` é 44×44.
- `V2Badge`: `tone` = `neutral | acid | ink | green | blue | amber | red | cyan | purple`.
- `V2Select` aceita `children` **ou** `options`.
- `V2Field` junta rótulo (sempre acima), dica e erro.

### 3.2 Demais peças de `src/v2/ui/`

`V2CollapsibleCard` (seção colapsável que lembra por pessoa; `sectionId`
estável, ações em `actions`), `V2SectionNav` + `V2SubTabs` (barras de seções
que **quebram em linhas, nunca rolam de lado**), `V2Pagination`, `BrandMark`
(logo que troca por tema), `CopyCodeButton` (código = botão de copiar),
`rolarAte`/`useHashScroll`/`useAncoraDoAviso` (rolagem por âncora — nunca
`scrollIntoView` cru), `useDesfazivel` (desfazer).
Confirmação de ação destrutiva usa `ConfirmDialog` (`src/components/`), não `confirm()`.
Componentes Radix/shadcn de `src/components/ui/` são a base de diálogos e menus.

## 4. Moldura única de página

Toda página está dentro de `<V2Page>` (`PAGE_FRAME` = `mx-auto w-full
max-w-[1200px]`), **sem recuo próprio**: o recuo é do `<main>` do `V2Layout`.
`className` do `V2Page` leva `space-y-*`, nunca `p-*`/`px-*`/`pt-*`/`mt-*`.
Estados de carregamento, erro e vazio ficam **dentro** da moldura. A barra de
abas usa a mesma moldura. Isentos (com motivo): telão, totem, login, convite,
modo quadra, apresentação. Guarda: `larguraDePagina.test.js`. Ver
`docs/45-MOLDURA-DAS-PAGINAS.md`.

## 5. Composição por tipo de tela

1. **Página de entrada/lista**: `V2PageHeader` (título, subtítulo, ações) →
   filtros (`V2FilterChip`/`V2SearchInput`) → lista em `V2Surface`.
2. **Página de detalhe**: herói (`V2ContentHero` ou painel `bg-ink` com
   `HERO_TITLE`) com poucas badges → grade curta de `V2StatCard` → seções em
   `V2Surface`/`V2CollapsibleCard` → abas em `V2SectionNav`/`V2SubTabs`.
3. **Diálogo complexo**: blocos com título e descrição curta; não misturar
   identidade, vagas, pontuação e operação; rolagem interna (`DialogContent`
   já traz `max-h-[90dvh] overflow-y-auto`).
4. **Formulário**: rótulo acima, ajuda no mesmo bloco, configuração avançada
   depois da básica, `gap-3`/`gap-4`.

Regras de densidade: no máximo uma camada de destaque forte por viewport
inicial; métrica pequena responde a uma pergunta concreta; texto explicativo
longo vai em bloco contextual, não espalhado em cartões ornamentais.

## 6. Navegação

- **Barra lateral** (desktop): hubs de nível 1, recolhível; cada pessoa escolhe
  o que aparece (padrão por papel: atleta, arena, professor), em Configurações →
  Menu. Lógica pura em `core/domain/sidebarNav.js`; `Início` fica em 1º e
  `Minha área`/`Admin` nunca saem. A busca indexa todos os hubs.
- **Barra inferior do celular**: 5 itens fixos em ordem (`Início · Jogar ·
  Arenas · [contextual] · Minha área`), o quarto muda com a pessoa
  (`core/domain/bottomNav.js`); não é configurável. Gaveta do celular espelha o menu.
- **Cabeçalho**: busca, sino de notificações (uma assinatura compartilhada),
  idioma, menu do usuário, ajuda e dicas.
- **Paleta de comandos**: `Ctrl/⌘+K` (`V2CommandPalette`, lazy): ações por papel,
  telas, atletas, torneios, arenas, clubes e artigos da ajuda; teclado por setas,
  Enter, Esc (combobox/listbox WAI-ARIA).
- **Centrais** (arena, professor, torneio): `V2SectionNav` + `V2SubTabs`; a aba
  ativa vive na URL (`?aba=`/`?secao=`), e os valores são contrato de link.
- Link de "voltar" é `V2BackLink`; link de ajuda por tela, `helpLinkFor`.

## 7. Modo escuro

Sempre disponível (`dark_mode`, incorporada em 2026-10-10); Claro, Escuro ou Automático por pessoa (`docs/30-MODO-ESCURO.md`).
**A tela não precisa de nada**: a paleta compila cada cor de `bg-*`/`text-*`/
`border-*` como `rgb(calc(CLARO + (ESCURO − CLARO) × var(--k)))`; `--k` vale 0
no claro (idêntico ao de sempre, provado token a token) e 1 no escuro
(`.dark`, só na tela — impresso é claro). Texto e linha usam um segundo
interruptor `--kf`, que "superfícies de cor" (`bg-ink`, `bg-acid`) zeram para o
design original continuar valendo lá dentro.

1. Use os tokens de sempre (`bg-white` cartão, `bg-paper` recuo, `text-ink`/
   `text-gray-500`, `bg-ink` destaque). Cor arbitrária (`bg-[#…]`, `style`)
   **não** troca.
2. **Nunca** use `dark:` para cor — só para trocar arquivo (logo, via `BrandMark`).
3. O que precisa ficar claro: `tema-claro` no trecho (arte exportada, moldura
   de QR) ou `<AparenciaClara>` na rota (telão, totem, impressão).
4. `palette.js`/`tailwindTheme.js` são de build: importá-los numa tela põe
   `tailwindcss/colors` no pacote (guarda `modoEscuro.test.js`).
5. Confira a tela no escuro antes de concluir.

## 8. Acessibilidade

- **Alvo de toque 44 px** em ponteiro grosso: variante `coarse:` (= `@media
  (pointer: coarse)`, em `tailwind.config.js`); `V2Button` e `V2BackLink` já
  cumprem.
- **Piso de 11 px** de fonte e contraste AA (texto secundário `gray-500`; o
  escuro tem contraste conferido por teste).
- Botão só com ícone leva nome acessível (`aria-label`); `<button>` sempre com
  `type` (dentro de `<form>`, sem `type` envia o formulário). Guardas:
  `botaoSoIcone.test.js`, `dividaDeDesign.test.js`.
- Navegação com `aria-label`, listas/combobox com os papéis ARIA corretos;
  nada crítico depende de hover; respeitar "menos movimento" (carrosséis).
- Rotas públicas passam pelo **axe** (`tests/e2e/acessibilidade.spec.js`:
  violações `serious`/`critical` em WCAG 2 A/AA barram).

## 9. Estados de interface

- **Carregando**: `V2Skeleton` com a geometria real da página; telas inteiras
  em `Suspense` caem no spinner do `V2App`.
- **Erro**: `<V2ErrorState onRetry={refetch} />` (`tipo` `rede`/`servidor`,
  `inline` para uma seção que falhou numa tela que carregou). Nunca um bloco de
  erro escrito à mão, nunca "não encontrado" para uma falha de rede.
- **Vazio**: `V2EmptyState`, e **só** quando `podeAfirmarVazio(consulta)`
  (`core/lib/queryState.js`: terminou e não falhou). Sem a lista na mão, não
  renderize "Criar"/"Salvar" que dependam dela. Guarda: `falhaNaoEVazio.test.js`.
- Aviso operacional: bloco contextual no mesmo lugar do que ele explica
  (na impressão, o aviso de falha **deve** sair no papel).

## 10. Responsividade

Phone-first; sem rolagem horizontal da página (`overflow-x: clip` no corpo, para
não quebrar `sticky`). Herói e painel lateral viram uma coluna no celular;
métricas refluem 1–2 colunas antes de 4; barras de abas quebram linha. Gutter
lateral vem do `<main>`.

## 11. Texto e idioma

Todo texto visível passa por `t('…')`/`tk('…')` com `en` e `es` nos catálogos
(`docs/44-IDIOMAS.md`); datas e números por `fmtData`/`fmtNumero`/`fmtMoeda`.
Nunca `'pt-BR'` fixo em tela nova.

## 12. Checklist de revisão visual

1. Está em `<V2Page>` e usa `PAGE_TITLE`/`HERO_TITLE`?
2. Usa primitivos V2 (sem cartão/campo/botão/erro escrito à mão)?
3. Carregando, erro e vazio tratados (e o vazio só quando é verdade)?
4. Mobile legível, alvos de 44 px, nada abaixo de 11 px, contraste AA?
5. Conferida no escuro; nenhuma cor arbitrária nem `dark:` para cor?
6. Texto em `t()` com catálogos; ajuda/dicas atualizadas se houver guia (`data-dica`)?
7. Há mais de uma camada de destaque forte no primeiro viewport? Se sim, reduza.

## 13. Regra final

Se uma implementação precisar inventar um padrão fora destes primitivos e
regras, trate como exceção deliberada, escreva o motivo no código e atualize
este documento — não como liberdade default.
