# 10 — Transversais e engajamento

Contexto: notificações só in-app (`src/core/services/notificationService.js` + sino no layout); **uma** Cloud Function no backend (`recomputeRankingOnTournamentChange`); nenhum gateway de pagamento; PWA completo porém desligado (`src/core/pwa/registerPwa.js`, env `VITE_PWA_ENABLED`); analytics de funil atrás de flag; 28+ feature flags todas default-off.

---

### TRV-01 — Push notifications (FCM) (P0 · A)
**Problema:** sem push/email, todo re-engajamento depende do usuário abrir o app — o sino in-app não traz ninguém de volta.
**Proposta:** Firebase Cloud Messaging: opt-in contextual (pedir permissão após uma ação de valor, nunca no primeiro load), tokens em `users/{uid}/fcm_tokens`, Cloud Function que espelha as notificações in-app relevantes (respeitando preferências ONB-06). Casos iniciais: convite de dupla, jogo em breve, resultado lançado, vaga na lista de espera, reserva confirmada/lembrete, aviso do organizador. Requer SW ativo (TRV-03).
**Flag:** `PUSH_NOTIFICATIONS`.

### TRV-02 — E-mail transacional (P1 · M)
**Proposta:** extensão Trigger Email (Firestore→SMTP/SendGrid) para: confirmação de inscrição (com dados de pagamento ATL-08), confirmação de reserva, resumo pós-torneio. Template HTML simples com a marca; sempre com fallback in-app.

### TRV-03 — Ativar o PWA (P0 · B)
**Problema:** manifest + service worker v4 prontos e testados, mas `VITE_PWA_ENABLED` desligado — sem instalação nem shell offline, e push (TRV-01) fica impossível.
**Proposta:** ligar em produção; banner de instalação contextual (componente `InstallAppButton` já existe e é testado) após 2ª visita ou pós-inscrição; medir instalações via analytics.

### TRV-04 — Offline básico de dados (P2 · M)
**Proposta:** habilitar persistência offline do Firestore (`persistentLocalCache`) — páginas já visitadas funcionam sem rede (ginásio com sinal ruim); indicador "sem conexão" no layout; par com DIA-13 para escrita.

### TRV-05 — Pagamentos em 3 fases (P0 · A)
**Problema:** nenhum dinheiro se move na plataforma; tudo é marcação manual (inscrição `PENDING_PAYMENT`, toggle de reserva).
**Proposta:** Fase 1 — instruções PIX estáticas + "já paguei" + conciliação manual assistida (ATL-08; vale também para reservas e mensalidades). Fase 2 — gateway (Mercado Pago é o caminho natural para PIX no Brasil): checkout de inscrição, webhook confirma automaticamente (Cloud Function), reembolso em cancelamento. Fase 3 — split payment (taxa da plataforma) e repasse a organizador/arena/professor — a fundação do modelo de negócio.
**Flags:** `PAYMENT_INSTRUCTIONS` (F1), `PAYMENT_GATEWAY` (F2).

### TRV-06 — Backend de lembretes agendados (P1 · M)
**Problema:** só existe 1 função (ranking); nenhum job agendado.
**Proposta:** função scheduled (a cada 15 min): jogos que começam em ~1h → notifica; reservas de amanhã → lembra (ARE-10); pagamentos pendentes há N dias → cobra; aulas do dia → lembra. Idempotente (marca `reminded_at`).

### TRV-07 — Padronizar envelope de notificação (P2 · B)
**Proposta:** todo tipo novo de notificação com `type`, `entity_ref`, `link`, `icon` padronizados (catálogo em `notificationService.js`), agrupamento por entidade ("3 novas inscrições no Torneio X" em vez de 3 itens) e deduplicação.

### TRV-08 — Analytics de produto ativado por padrão (P2 · B)
**Proposta:** promover `FUNNEL_ANALYTICS` a ligado; instrumentar funis-chave: criação de torneio (iniciou→publicou), inscrição (abriu dialog→confirmou), reserva (abriu→pediu), onboarding (login→perfil completo). Sem medir, o roadmap é opinião.

### TRV-09 — SEO das páginas públicas (P1 · M)
**Problema:** SPA client-only: `/p/:id`, arenas e clubes não têm meta tags específicas — compartilhamento e busca orgânica desperdiçados.
**Proposta:** fase 1: meta tags dinâmicas client-side + OG image gerada (DS-18). Fase 2: pré-render das rotas públicas (function de SSR leve ou prerender no build para landing/regras/história) + sitemap.xml das entidades públicas.

### TRV-10 — Auditoria de acessibilidade WCAG AA (P1 · M)
**Proposta:** passada completa: contraste (acid — DS-09; gray-400/500 sobre paper), foco visível (DS-16), navegação por teclado (drawer, dialogs, tabelas), labels de ícone-botão, `aria-live` para placares ao vivo; testes automatizados (vitest-axe nos primitivos + Playwright a11y nas 10 páginas principais).

### TRV-11 — Performance de listas em escala (P1 · M)
**Problema:** ranking nacional, diretório de atletas e inscrições (até 500/modalidade) renderizam tudo e filtram em memória.
**Proposta:** paginação por cursor no Firestore + virtualização (lista simples própria; sem lib pesada); debounce na busca; contadores agregados pré-computados por function.

### TRV-12 — Imagens otimizadas (P2 · M)
**Proposta:** extensão Resize Images no Storage (thumbs 200/800px); `srcset` no `V2Avatar`/galerias; lazy-loading nativo. Fotos de galeria hoje servem o original.

### TRV-13 — Estratégia de flags com dependências e bundles (P1 · B)
**Problema:** 28+ flags default-off com dependências implícitas (matchmaking exige rating; certificados exigem share cards) — fácil criar estados semi-habilitados; rollout exige ligar 6 flags na ordem certa.
**Proposta:** declarar `requires: []` nos metadados das flags (`featureFlags.js`), validação visual no painel admin (aviso "requer X desligada"), e "bundles" de um clique ("Experiência do atleta completa" liga o conjunto na ordem certa).

### TRV-14 — Auditoria LGPD (P1 · M)
**Proposta:** consentimento explícito no cadastro (política versionada, aceite gravado), banner de cookies/analytics com opt-out, revisão dos campos públicos por padrão (telefone público etc.), exportação/exclusão (ONB-08), DPO/contato na política.

### TRV-15 — Rate limiting e antiabuso (P2 · M)
**Proposta:** regras Firestore com limites de criação (torneios/clubes/pedidos por dia por usuário), validação de tamanho de payload, bloqueio de usuário (campo `banned` + checagem central). Hoje criação é ilimitada para qualquer conta.

### TRV-16 — Compartilhamento consistente em toda entidade (P2 · B)
**Proposta:** todo detalhe público (torneio, arena, clube CLU-07, perfil, professor) com o mesmo conjunto: copiar link, wa.me pré-preenchido, QR, share card — hoje só torneio/arena têm o pacote completo (`shareLinks.js` reusável).

### TRV-17 — Monitoramento de erros com contexto (P2 · B)
**Proposta:** `recordClientError` já existe; adicionar breadcrumb de rota + release version; alerta (e-mail ao admin) quando taxa de `exception` subir; página de saúde no admin console.

### TRV-18 — E2E dos fluxos críticos (P1 · M)
**Problema:** Playwright cobre só 3 smoke tests públicos; nenhum fluxo autenticado.
**Proposta:** com emulador Firebase: criar torneio → modalidade → inscrever → sortear → lançar placar → encerrar; inscrição de atleta; pedido de reserva. É o seguro das refatorações de UX propostas neste catálogo.

### TRV-19 — Modo de manutenção e comunicação de incidentes (P3 · B)
**Proposta:** doc `platform_settings/global.maintenance` (mensagem + severidade) exibido como banner no layout; controlado pelo admin console — hoje não há como avisar usuários de um problema.

### TRV-20 — Custom claims para papéis (P2 · M)
**Problema:** `role` vem do doc `users` e as regras fazem `get()` extra por request; owner hardcoded por e-mail em `src/core/config/owners.js`.
**Proposta:** espelhar `platform_admin` em custom claim via function (menos leituras, regras mais simples), mantendo o doc como fonte de exibição; base para papéis futuros (ORG-21).
