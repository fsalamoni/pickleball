# 02 — Navegação e Arquitetura de Informação

Contexto: shell autenticado em `src/v2/components/V2Layout.jsx` — sidebar 280px (desktop), drawer full-screen (mobile), topbar glass com busca, sino e CTA "Procuro jogo". Sem bottom nav, sem breadcrumbs, sem menu de usuário no desktop.

---

### NAV-01 — Bottom navigation no mobile (P0 · M)
**Problema:** no mobile toda navegação exige abrir o drawer (2 toques para qualquer lugar). O `main` já reserva `pb-24` (`V2Layout.jsx:303`) mas nada ocupa o espaço.
**Proposta:** barra fixa inferior (`lg:hidden`) com 5 itens: Início, Torneios, Atletas, Chat, Perfil. Item ativo em ink com ícone acid (mesma linguagem do sidebar); badge de não lidas no Chat; respeitar `safe-area-inset-bottom` (util `safe-px` já existe). Drawer permanece para o menu completo.
**Flag:** `MOBILE_BOTTOM_NAV`.

### NAV-02 — Menu do usuário no topbar desktop (P0 · B)
**Problema:** no desktop **não existe logout** — o botão "Sair" só existe dentro do drawer mobile (`V2Layout.jsx:353`); o card de perfil do sidebar navega para `/perfil`.
**Proposta:** avatar no topbar → dropdown: Meu perfil, Editar perfil, (futuro: Configurações, Tema), Sair. Reusa `DropdownMenu` e `V2Avatar` já importados no layout.
**Flag:** `NAV_USER_MENU`.

### NAV-03 — Busca global federada (P1 · A)
**Problema:** o placeholder promete "Buscar atletas, cidades, clubes..." mas `handleSearch` (`V2Layout.jsx:214-219`) sempre navega para `/atletas?q=` — cidades e clubes não são buscáveis.
**Proposta:** busca federada com dropdown de resultados agrupados (Atletas / Torneios / Clubes / Arenas), teclado ↑↓/Enter, "ver todos" por grupo. Fase 1: consultas Firestore por prefixo em paralelo (users, tournaments públicos, clubs, arenas). Fase 2: índice dedicado (ex.: coleção `search_index` alimentada por Cloud Function).
**Flag:** `GLOBAL_SEARCH`. Quick win imediato: QW-06 (corrigir placeholder).

### NAV-04 — Command palette Ctrl/Cmd+K (P2 · M)
**Proposta:** paleta de comandos para power users (organizadores/admins): navegação, ações rápidas ("Criar torneio", "Abrir inscrições de …"), busca. Base: mesmo índice do NAV-03; UI com `Dialog` existente.

### NAV-05 — Remover link morto "App anterior" (P0 · B)
**Problema:** `V2Layout.jsx:286-292` linka `/v1/inicio`; `V1Routes.jsx` não existe e o catch-all de `V2App` redireciona silenciosamente para `/` — botão visível no header que não faz nada de útil.
**Proposta:** remover o link (e a copy relacionada no V2Profile — QW-03).

### NAV-06 — Sidebar por papéis contextuais (P1 · M)
**Problema:** dono de arena e organizador não têm entrada de gestão no menu — a gestão da arena só é alcançável via `/arenas/:id/gerir` (deep-link) e os torneios administrados se misturam à lista geral. Os dados para saber os papéis já existem (`tournament_admins`, `arena_managers`, `club_members.role`, `is_coach`).
**Proposta:** seções condicionais no `useV2Nav`: "Organizo" (aparece se o usuário administra ≥1 torneio → lista de torneios sob gestão), "Minha arena" (se gerencia ≥1 arena → atalho direto para gestão), "Ensino" (se `is_coach`). Hooks agregadores leves com React Query.
**Flag:** `ROLE_AWARE_NAV`.

### NAV-07 — Breadcrumbs em hierarquias profundas (P2 · B)
**Problema:** em `/torneios/:id/modalidades/:modalityId` não há trilha de volta além do botão do navegador.
**Proposta:** componente `V2Breadcrumbs` (Torneios → Nome do torneio → Modalidade) nos níveis ≥3; no mobile, colapsar para "← Nome do torneio".

### NAV-08 — Título do documento por rota (P1 · B)
**Problema:** `document.title` é fixo — todas as abas do navegador chamam-se igual; histórico e favoritos ficam inúteis.
**Proposta:** hook `usePageTitle` no layout com mapa rota→título ("Torneios · PickleRush", "Ranking · PickleRush"); páginas de detalhe setam título com o nome da entidade.

### NAV-09 — 404 interna útil (P2 · B)
**Problema:** o catch-all de `V2App.jsx` redireciona silenciosamente para `/` — URL errada "funciona" sem explicação, mascarando links quebrados.
**Proposta:** página 404 interna (V2EmptyState com busca e links populares) em vez do redirect mudo; registrar evento analytics para detectar links quebrados.

### NAV-10 — Estado "recurso desativado" explicado (P2 · B)
**Problema:** quando uma flag está off, rotas/menus somem sem explicação; quem recebeu um link para `/ranking` com a flag desligada cai no redirect mudo.
**Proposta:** para rotas flag-gated, renderizar tela "Este recurso ainda não está disponível" (V2EmptyState) em vez de redirect, com CTA de voltar. Ajuda também no rollout gradual.

### NAV-11 — Atalho "Criar" contextual no topbar (P2 · B)
**Proposta:** o CTA fixo "Procuro jogo" pressupõe intenção única. Substituir por botão "+ Criar" com menu (Procuro jogo / Torneio / Clube / Arena — itens conforme flags), mantendo 1 clique para a ação mais comum por contexto.

### NAV-12 — Persistir aba ativa em URLs (P2 · B)
**Problema:** partes da UI com abas internas (painel admin do torneio usa `/torneios/:id/:tab`, ok; mas sub-abas do admin panel e da gestão de arena vivem em estado local) perdem posição no refresh/compartilhamento.
**Proposta:** sub-aba na URL (query `?tab=` ou segmento), padrão em todo componente com Tabs.

### NAV-13 — Scroll restoration por rota (P3 · B)
**Problema:** `V2Layout.jsx:208-210` força scroll-top a cada pathname — voltar de um detalhe para uma lista longa perde a posição.
**Proposta:** manter mapa pathname→scrollTop e restaurar no `popstate` (voltar), mantendo top em navegação nova.

### NAV-14 — Skip link e ordem de foco (P2 · B)
**Proposta:** link "Pular para o conteúdo" antes do sidebar; garantir que o drawer mobile prenda o foco (focus trap) e devolva ao hamburger ao fechar.

### NAV-15 — Indicador de seção no título mobile (P3 · B)
**Proposta:** no mobile o topbar não diz onde o usuário está; exibir o título da rota atual centralizado (ex.: "Torneios") quando a busca não estiver expandida.

### NAV-16 — Favoritos/fixados do usuário (P3 · M)
**Proposta:** permitir fixar torneios/arenas/clubes (estrela) e exibir seção "Fixados" no topo do sidebar; campo `pinned` em subcoleção do usuário.

### NAV-17 — Histórico "Continuar de onde parou" (P3 · M)
**Proposta:** no dashboard, cards "Visto recentemente" (últimos 3 torneios/arenas abertos, salvos em localStorage) — retorno rápido ao contexto de trabalho.

### NAV-18 — Padronizar rótulos do menu com as rotas (P3 · B)
**Problema:** menu diz "Explorar Quadras" para `/arenas` e "Minhas reservas" aparece mesmo com `ARENAS` off (item sempre visível em `V2Layout.jsx:87`), levando a uma página de reservas sem contexto quando a flag está desligada.
**Proposta:** rótulo "Arenas"; condicionar "Minhas reservas" à flag `ARENAS`; revisar consistência rótulo↔rota em todo o `useV2Nav`.
