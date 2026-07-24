# 15 — Backlog remanescente (o que falta)

> Consolidação de **todas** as sugestões espalhadas no repositório
> (`docs/ux-analysis/01–14`, `docs/arena-roadmap.md`, `docs/ARENA_V3/*`),
> com uma **limpeza do que já foi implementado**. Este documento é a fonte
> única de "o que ainda falta". Status apurado por: catálogo de flags
> (`src/core/featureFlags.js`, 124 flags), trabalho desta branch e verificação
> no código.

Legenda: ✅ implementado · 🟡 parcial / a verificar · ⏳ pendente.

---

## 0. Nuances professor ↔ arena (unificação da parceria)

O produto de professor e a parceria com arenas estão entregues, mas **nem tudo
que pode se unificar foi unificado**. Pontos pertinentes ainda abertos:

- ✅ Vínculo arena↔professor (admin da arena + aba, público dos dois lados,
  perfil profissional = atleta + página de professor, cross-links).
- ✅ Notificação ao professor quando a arena o adiciona como parceiro.
- ✅ **Reservas compartilhadas** (`shared_bookings`): reserva de quadra com
  vários atletas, convites (aceite/recusa), reserva aberta (com/sem limite),
  co-propriedade e rateio do valor por tempo.
- ✅ **Aula → reserva de quadra**: o professor reserva quadra nas arenas
  parceiras (`booking_type=coach_lesson`), adiciona alunos ou deixa aberta; a
  reserva aparece no calendário da arena marcada como "aula com professor".
  Alunos podem ingressar em reservas abertas.
- ✅ **Clubes vinculados** (`linked_clubs`): professor/arena criam ou vinculam
  clubes próprios; seção aparece no público só quando há clubes.
- ⏳ **Aceite mútuo da parceria**: a arena ainda vincula unilateralmente (o
  professor só pode *sair*). Ideal: convite + aceite (espelhar `partner_invites`).
- ⏳ **Pedido de aluno para horário fechado**: hoje o aluno entra em reserva
  **aberta** do professor; para reserva fechada faltaria um "pedir para entrar"
  (o professor aprova).
- ⏳ **Disponibilidade por arena parceira**: a janela de disponibilidade usa
  `location` em texto livre; poderia ser um seletor das arenas parceiras.
- ⏳ **"Agendar com este professor nesta arena"** direto da página da arena.
- ⏳ **Ponte com o Sistema C (aulas da arena)**: `arena_classes` (aulas operadas
  pela arena) e `coach_lessons` seguem separados.
- ⏳ **Split de receita / comissão** para aulas realizadas na arena parceira.
- ⏳ **Checkout/gateway** (o rateio é calculado, mas o pagamento é combinado
  direto). Gateway é transversal (ver §9).

---

## 1. Design system (doc 01) — grande dívida em aberto

- ✅ Correções pontuais: tons de `V2Badge`, `emerald→green` em arenas/coach,
  `V2Skeleton lines`, paleta em telas tocadas.
- ⏳ **DS-01/02/03**: unificar os 4 sistemas concorrentes (`V2*` vs shadcn
  esmeralda vs `arena-*` vs `Platform*`); remover fontes Manrope/Sora (manter
  Outfit/Inter); mapear tokens shadcn `--primary` esmeralda → ink/acid.
- ⏳ **DS-06** dark mode: decidir (ativar tokens `.dark` existentes ou remover
  código morto).
- ⏳ **DS-08** auditoria de contraste do acid `#D4F82E` (falha WCAG em texto).
- ⏳ **DS-12** motion: catálogo de micro-interações (transições de página,
  shimmer, confete no pódio).
- ⏳ **DS-14** ilustrações de empty state com tom da marca.
- ⏳ **DS-16** lint rules/codemods proibindo import de primitivos legados em
  `src/v2` (e QW-13: migrar `V2GameDayOrganizer`, `V2EventDatesPanel`,
  `V2MatchesBlock`).
- ⏳ **DS-18** reescrever `DESIGN_STANDARD.md` (hoje manda `Platform*`/slate).

## 2. Navegação / arquitetura de informação (doc 02)

- ✅ Bottom nav mobile, menu do usuário (desktop), `page_titles`, link quebrado
  removido, nav por persona (arena/professor).
- ⏳ **NAV-03** busca global federada (hoje só `/atletas?q=`): atletas +
  torneios + arenas + clubes.
- ⏳ **NAV-04** command palette (Ctrl/Cmd+K).
- ⏳ **NAV-05** breadcrumbs em hierarquias profundas.
- ⏳ **NAV-09 / QW-20** página 404 interna útil (hoje catch-all → `/`).
- ⏳ a11y: skip-link, ordem de foco, navegação por teclado nas tabelas de jogo.

## 3. Onboarding, perfil e conta (doc 03)

- ✅ `profile_onboarding` (completude), `onboarding_wizard` (3 passos + persona).
- ⏳ **ONB-05** página `/configuracoes` unificada (privacidade, notificações,
  tema, conta, dados).
- ⏳ **ONB-06** preferências de notificação por canal e tipo.
- ⏳ **ONB-10** LGPD: exportar dados e excluir conta; consentimento versionado.
- ⏳ **ONB-08** múltiplos logins (e-mail/senha, Apple) — hoje só Google.
- ⏳ **ONB-11 / QW-19** máscara/normalização de telefone; verificação por WhatsApp.
- ⏳ edição de perfil com dirty-state/autosave.

## 4. Atleta (doc 04)

- ✅ Dupla com convite (`partner_invites`), self check-in, PIX na inscrição
  (F1), página de perfil, histórico de rating, H2H, seguir atletas, filtros de
  ranking, share cards (flag).
- ⏳ **ATL-01** agenda unificada "Meus jogos" (lista + histórico com filtros).
- ⏳ **ATL-02 / QW-23** exportar para calendário (ICS + Google Calendar).
- ⏳ **ATL-09** carteirinha digital (QR de check-in, nível, foto).
- ⏳ **ATL-11** descoberta de torneios com filtros geográficos + mapa + "perto
  de mim".
- ⏳ **ATL-14** ranking com paginação/virtualização (hoje renderiza tudo).
- ⏳ **ATL-16** ranking de duplas.
- ⏳ **ATL-15** metas/evolução (módulo `progression` existe, falta UI de metas).
- ⏳ **ATL-17** avaliação pós-torneio (NPS do evento).
- ⏳ **ATL-18** fair-play/reporte.

## 5. Organizador — criação e gestão (doc 05)

- ✅ Multi-fase, cancelar torneio, check-in, dashboard operacional, avisos em
  massa, duplicação, lista de espera, galeria, certificados, placeholder draw.
- ⏳ **ORG-04** wizard de criação em etapas com rascunho persistente (hoje
  formulário único que só valida nome; editor de modalidades perde tudo ao
  fechar).
- ⏳ **ORG-05** templates de torneio.
- ⏳ **ORG-07 / QW-24** exportar inscrições em CSV; filtros/busca/ações em massa.
- ⏳ **ORG-15** gestão financeira do torneio (receita esperada × recebida,
  inadimplentes).
- ⏳ **ORG-16** patrocinadores (logos na página pública/telão/share cards).
- ⏳ **ORG-12/13** seeds/cabeças-de-chave com drag; preview do sorteio antes de
  publicar; undo do re-sorteio.
- ⏳ **ORG-14** terceiro lugar e consolação configuráveis.
- ⏳ **ORG-18** página do organizador (histórico, credibilidade, seguidores).
- ⏳ **ORG-19** permissões granulares de staff (mesário/check-in/financeiro).

## 6. Organizador — dia de jogo (doc 06) — quase tudo pendente

- ⏳ **DIA-01** console "Dia de Jogo" (fila por quadra, chamada, ocupação).
- ⏳ **DIA-02** placar courtside otimizado (botões gigantes, desfazer, WO
  explícito — QW-18, offline com fila).
- ⏳ **DIA-03** delegação de placar a mesários (link/QR por quadra).
- ⏳ **DIA-04** modo Telão/TV (`/torneios/:id/telao`).
- ⏳ **DIA-05** árvore visual de chaves (bracket tree com zoom/pan).
- ⏳ **DIA-06** quadro de quadras com drag para retribuir quadra/horário.
- ⏳ **DIA-11** tela de pódio/premiação (confete, foto oficial).
- ⏳ **DIA-12** página pública ao vivo por `onSnapshot` (hoje polling 20–60s).

## 7. Arena (doc 07 / arena-roadmap / ARENA_V3)

- ✅ Grande parte via Arena V3: quadras (ARE-01), calendário, reserva
  instantânea (ARE-03), preços estruturados (ARE-07), membros/pacotes, PDV/PIX,
  mercado, marketing, operações, ligas, multi-unidade, reserva manual, refino de
  navegação (2 níveis) e design.
- ✅ **Reservas — cancelar e alterar** (atleta/professor nas próprias, arena em
  qualquer) no painel de reservas e no calendário admin; **transferir
  responsável** (atleta da plataforma ou cliente avulso) — antes "em construção".
- ✅ **Auditoria Arena V3 + Open Match** (nesta sessão): as páginas de módulos
  (Modules, Advanced, Matchmaking, Members/PDV/Classes/Leagues/Marketing/
  Operations, Open Match público+admin) são implementações reais (200–400 linhas
  cada) com domínio testado — não são stubs. O único "em construção" encontrado
  (transferir reserva) foi concluído.
- 🟡 Famílias **aspiracionais** que dependem de hardware/serviços externos e não
  se "desenvolvem integralmente" só no app: **IoT** (sensores, iluminação, QR
  kiosk, video replay) exige dispositivos; **AI** (pricing/forecast) exige
  modelo/serviço; **white-label** (domínio/app) exige infra de hosting/CI. Ficam
  como scaffolding atrás de flag até haver o backend/integração correspondente.
- ⏳ **ARE-07 / QW-25** heatmap de preços sobre a grade.
- ⏳ política de cancelamento automática (prazo/taxa); lista de espera por
  horário; no-show tracking; CRM leve de clientes.
- ⏳ integração arena↔torneio (reservar bloco de quadras p/ evento); selo
  "arena verificada".

## 8. Professor (docs 08/14) — núcleo entregue

- ✅ Disponibilidade, agenda, aulas (avulsa/recorrente), alunos (ficha/tags/
  notas), pacotes/créditos/financeiro/CSV, biblioteca de conteúdo, fotos, loja
  (visibilidade pública), parceiros, painel em 2 níveis, perfil público
  espelhado, contato (WhatsApp/e-mail).
- ⏳ **PRO-16** clínicas/workshops como eventos inscritíveis (reusa eventos de
  clube).
- ⏳ **PRO-17** nivelamento validado por professor (integra `leveling` + selo no
  ranking).
- ⏳ nuances de unificação com arena — ver §0.

## 9. Clubes e comunidade (doc 09)

- ✅ Base sólida (feed, fóruns, eventos com RSVP, chat, Game Day americano).
- ⏳ **CLU-01** eventos recorrentes (hoje cada data manual).
- ⏳ **CLU-02** King of the Court e Mexicano no Game Day (mexicano já existe no
  domínio de torneios — reusar).
- ⏳ **CLU-03** ranking interno do clube (game days pontuados).
- ⏳ **CLU-05** mensalidade/financeiro do clube.
- ⏳ **CLU-07** página pública do clube (hoje exige login).
- ⏳ convites por link/QR; papéis além de admin; integração clube↔arena;
  descoberta por mapa; moderação de feed/fórum.

## 10. Transversais e engajamento (doc 10) — maior alavanca

- ⏳ **TRV-01** notificações **push (FCM)** — hoje só sino in-app; re-engajamento
  zero fora do app. Destrava convites de dupla, jogo em 30 min, resultado,
  vaga na lista de espera, lembrete de aula.
- ⏳ **TRV-02** e-mail transacional (comprovantes, resumo de inscrição).
- ⏳ **TRV-03 / QW-17** ativar PWA (`VITE_PWA_ENABLED` off, SW pronto) + banner
  de instalação.
- ⏳ **TRV-05** pagamentos F2/F3: gateway (Mercado Pago/PIX automático com
  webhook) → confirma inscrição/reserva/aula sozinho; split da plataforma.
- ⏳ **TRV-06** Cloud Functions agendadas (lembretes: jogo amanhã, aula hoje,
  pagamento pendente) — hoje só 1 function (ranking).
- ⏳ **TRV-07** gamificação: expandir `achievements` (streaks, badges), temporadas
  de ranking com reset/histórico.
- ⏳ **TRV-09** SEO das páginas públicas (`/p/:id`, arena, clube, professor): meta
  tags dinâmicas, OG image gerada, sitemap.
- ⏳ **TRV-08** ativar/instrumentar funil (`funnel_analytics` existe como flag).
- ⏳ **TRV-10/11** LGPD (consentimento, política versionada, exportar/excluir).
- ⏳ **TRV-13** acessibilidade: auditoria WCAG, foco visível, teclado,
  `prefers-reduced-motion`.
- ⏳ **TRV-14** performance: paginação/virtualização de listas grandes; imagens
  responsivas com thumbs.
- ⏳ **TRV-13 (flags)** matriz de dependência entre as 124 flags; bundles por
  persona.

---

## Top prioridades recomendadas (maior impacto)

1. **Push (FCM) + Cloud Functions de lembrete** (TRV-01/06) — re-engajamento é a
   maior lacuna; destrava valor já construído (aulas, reservas, duplas).
2. **Gateway de pagamento** (TRV-05 F2) — confirma inscrição/reserva/aula sem
   trabalho manual; destrava GMV.
3. **Unificação professor↔arena** (§0): aceite mútuo + aula que segura quadra.
4. **Design system unificado** (DS-01/02/03) — dívida que encarece toda tela nova.
5. **Console de dia de jogo + placar courtside** (DIA-01/02) — dor real do
   organizador no evento.
6. **PWA on + SEO das páginas públicas** (TRV-03/09) — aquisição e retenção.
