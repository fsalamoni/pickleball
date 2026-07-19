# 01 — Fundação e Design System

Contexto: convivem hoje **quatro camadas visuais**: (a) tokens "Athleisure Premium" `acid/ink/paper` + Outfit/Inter (`tailwind.config.js:33-47`); (b) tokens HSL shadcn com `--primary` esmeralda e fontes Manrope/Sora no body (`src/index.css:67-96,166-179`); (c) classes `arena-*` (`src/index.css:206-241`) mandatadas por `docs/DESIGN_STANDARD.md`; (d) primitivos `V2*` (`src/v2/ui/primitives.jsx`) usados pelas páginas ativas. Resultado: 4 fontes carregadas, 3 botões, 3 empty states, 2 skeletons, 3 avatares, 2 spinners de cores diferentes.

---

### DS-01 — Eleger o sistema V2 como único e oficial (P0 · M)
**Problema:** `docs/DESIGN_STANDARD.md` manda usar componentes `Platform*` e classes `arena-*`, mas as ~60 páginas ativas usam primitivos `V2*` — o padrão normativo não descreve o código que roda; qualquer tela nova começa com uma decisão ambígua.
**Proposta:** declarar `src/v2/ui/primitives.jsx` como sistema oficial; reescrever `DESIGN_STANDARD.md` descrevendo os primitivos V2 reais (com exemplos de uso e do's/don'ts); marcar `platform-page.jsx` e classes `arena-*` como deprecadas no próprio arquivo (comentário de cabeçalho) com plano de remoção.
**Reuso:** conteúdo do guia `Design System/PickleHub - Guia de Implementação Design System.txt`.

### DS-02 — Remover as fontes Manrope e Sora (P1 · B)
**Problema:** `src/index.css:1` importa Manrope+Sora para o `<body>` global enquanto `index.html:22` carrega Inter+Outfit para o app ativo (`.v2-root` sobrescreve). Quatro famílias tipográficas pagam custo de rede/render e criam inconsistência nas páginas fora de `.v2-root` (login antigo, print, public).
**Proposta:** padronizar Outfit (display) + Inter (texto) em todo o app, inclusive `PublicTournament`, `PrintTournament` e landing; remover o `@import` e as regras Manrope/Sora; medir peso da página antes/depois.

### DS-03 — Reconciliar tokens shadcn com a paleta Athleisure (P1 · M)
**Problema:** `--primary: 161 78% 28%` (esmeralda) em `src/index.css` colore componentes shadcn ainda em uso (dialogs, inputs, focus rings) com um verde que não existe na marca; o fundo do body é um gradiente esmeralda/dourado (`index.css:167-171`).
**Proposta:** mapear os tokens HSL para a paleta real (`--primary` → ink; `--ring` → acid com alpha; `--background` → paper), eliminando a "segunda marca" esmeralda sem tocar na API dos componentes shadcn.

### DS-04 — Unificar Button (P1 · M)
**Problema:** três botões (`components/ui/button.jsx` CVA, `V2Button`, estilos ad-hoc). Ex.: `V2MatchesBlock.jsx:12` importa o shadcn Button dentro de página V2.
**Proposta:** `V2Button` é o único; adicionar a ele os variants que faltarem (outline/link) e um codemod de migração; regra de lint proibindo `@/components/ui/button` sob `src/v2/`.

### DS-05 — Unificar EmptyState e Skeleton (P1 · B)
**Problema:** `V2GameDayOrganizer.jsx:9-10` e `V2EventDatesPanel.jsx:9-10` importam `Skeleton`/`EmptyState` legados (cinza muted, cantos md) dentro do V2 — telas de clube destoam visivelmente do resto.
**Proposta:** migrar para `V2Skeleton`/`V2EmptyState`; deprecar os legados.

### DS-06 — Unificar Avatar (P2 · B)
**Problema:** `avatar.jsx`, `user-avatar.jsx` e `V2Avatar` coexistem com tamanhos e fallbacks diferentes.
**Proposta:** `V2Avatar` único; `UserAvatar` vira alias fino ou é migrado.

### DS-07 — Spinner único (P2 · B)
**Problema:** `App.jsx:58` gira `border-primary` (esmeralda) e `V2App.jsx:58` gira `border-ink` — o usuário vê dois spinners de cores diferentes na mesma sessão dependendo do momento do carregamento.
**Proposta:** componente `V2Spinner` exportado de `primitives.jsx`, usado nos dois pontos; cor `border-ink`.

### DS-08 — Decisão sobre dark mode (P2 · M/A)
**Problema:** `tailwind.config.js` define `darkMode: ['class']` e `index.css:98-126` tem o set completo de tokens `.dark`, mas há **zero** utilitários `dark:` no código e nenhum toggle — dark mode é 100% código morto.
**Proposta (recomendada):** ativar de verdade em 3 passos — (1) ThemeProvider com `class` no root + persistência em `localStorage` + `prefers-color-scheme`; (2) toggle no menu do usuário; (3) varredura das superfícies V2 (paper→ink invertido; acid mantém). Alternativa mínima: remover os tokens mortos e documentar "light-only".
**Flag:** `DARK_MODE`.

### DS-09 — Regras de uso do verde acid (acessibilidade) (P1 · B)
**Problema:** `#D4F82E` sobre branco tem contraste ~1.3:1 — ilegível como texto; hoje aparece como texto/ícone pequeno em alguns lugares.
**Proposta:** documentar regra dura: acid apenas como (a) fundo com texto ink, (b) ícone ≥20px sobre ink, (c) detalhe decorativo; nunca texto sobre claro. Auditar ocorrências (`text-acid`) e corrigir as ilegíveis.

### DS-10 — Tokens semânticos de status (P1 · B)
**Problema:** os 6 status de torneio, 5 de inscrição e 6 de reserva têm cores decididas caso a caso em cada badge/página.
**Proposta:** mapa único `STATUS_TONE` (domain → tone do `V2Badge`) exportado por módulo, ex.: DRAFT=neutral, REGISTRATIONS_OPEN=green, IN_PROGRESS=blue, FINISHED=ink, CANCELLED=red, PENDING_PAYMENT=amber. Toda badge de status consome o mapa.

### DS-11 — Escala tipográfica documentada (P2 · B)
**Proposta:** documentar 6 níveis (display/h1/h2/h3/body/caption) com classes canônicas (`font-display text-3xl font-bold` etc.) e aplicar via primitivos (`V2PageIntro`, `V2SectionHeader`) — hoje páginas repetem as classes à mão com pequenas variações.

### DS-12 — Modo denso para tabelas operacionais (P2 · M)
**Problema:** o respiro generoso do design (p-6/p-8, rounded-4xl) é ótimo em cards mas desperdiça espaço em tabelas de operação (inscrições com 100+ linhas, jogos).
**Proposta:** variante `density="compact"` nos contêineres de tabela (py-2, text-sm), aplicada nas abas de inscrições/jogos/admin.

### DS-13 — Catálogo de micro-interações (P2 · M)
**Proposta:** além do `.btn-press` existente, padronizar: transição de página (fade/slide 150ms respeitando `prefers-reduced-motion` já tratado em `index.css:189-202`), shimmer no skeleton, "pulse" no badge de notificação ao chegar item, confete no pódio (DIA-10), animação de contagem nos `V2StatCard`.

### DS-14 — Ilustrações de empty state (P3 · M)
**Problema:** `V2EmptyState` usa apenas ícone lucide num círculo — funcional, mas genérico.
**Proposta:** set de 6–8 ilustrações SVG leves da marca (raquete, quadra, troféu, rede) para os vazios mais vistos (sem torneios, sem jogos, sem notificações, sem reservas).

### DS-15 — Padrão de feedback: quando toast, inline ou dialog (P2 · B)
**Proposta:** guia curto no design standard: toast (sonner) para confirmação assíncrona; erro inline no campo para validação; dialog para decisão destrutiva; nunca toast para erro de validação de formulário. Auditar usos atuais.

### DS-16 — Focus states consistentes (P2 · B)
**Problema:** `V2Button` tem `focus-visible:ring-acid/30`, inputs usam `ring-gray-100`, shadcn usa `--ring` esmeralda — três estilos de foco.
**Proposta:** anel único (acid/40, offset 2) via token; corrigir nos primitivos.

### DS-17 — Guard rails automatizados (P1 · B)
**Proposta:** regra ESLint `no-restricted-imports` sob `src/v2/**` bloqueando `@/components/ui/{button,skeleton,empty-state,avatar}`; teste unitário que falha se `index.css` reintroduzir fontes extras. Impede regressão da unificação.

### DS-18 — OG/preview visual das páginas públicas (P2 · M)
**Problema:** `/p/:id` compartilhado no WhatsApp mostra preview genérico.
**Proposta:** gerar OG image por torneio (reuso do motor `html-to-image` dos share cards) e meta tags dinâmicas (ver TRV-16).

### DS-19 — Modo impressão como parte do sistema (P3 · B)
**Proposta:** documentar tokens de impressão usados por `PrintTournament.jsx` (preto/branco, sem sombras) e criar utilitário `print-surface` para futuros relatórios (súmulas DIA-14, financeiro ORG-16).

### DS-20 — Inventário vivo de componentes (P3 · M)
**Proposta:** página interna `/admin/design` (flag `ADMIN_CONSOLE` on) renderizando todos os primitivos V2 com seus variants — vitrine para QA visual e onboarding de novos devs.
