# Roadmap de Arena — implementação completa

> **Status**: **Sprint 0 ✅ DONE** (PRs #46, #47), **Sprint 1 ✅ DONE**
> (PRs #48–#51), **Sprint 2 em andamento** (PR novo: ARE-08 métricas +
> ARE-03 reserva instantânea; ARE-06 PDV já existia do Arena V3).
>
> **Escopo**: persona **proprietário de arena** (ARE-01 a ARE-20 do doc de UX)
> + cross-cutting necessário para ela fechar. **Não** cobre gestão de
> torneio (05-organizador), dia de jogo (06), professor (08), clubes (09) —
> esses têm seu próprio roadmap.
>
> **Estado atual no repositório (origin/main @ d03a61e + hotfix #52)**:
> - Sprint 0 (Descoberta) ✅: `Minhas arenas` no sidebar (ARE-11), onboarding
>   4-passos (ARE-20), aba "Arenas" no admin/painel, QW-14/15
> - Sprint 1 (Fundação) ✅: ARE-01 quadras, ARE-02 calendário, ARE-04
>   janelas de horário, ARE-05 preço por quadra, ARE-07 detecção de conflito
> - Sprint 2 (Operação) em andamento:
>   - ARE-06 PDV: ✅ já existia (Arena V3) — 4 flags, 3 coleções, 2 rotas
>   - ARE-08 Painel de métricas: ✅ PR atual
>   - ARE-03 Reserva instantânea: ✅ PR atual
> - 18 páginas V2Arena* (V2ArenaMetrics adicionado) no ar
> - 13 services + 1 hook monolítico `useArenaV3.js` (749 linhas)
> - 30 feature flags `ARENA_MODULE_*` (4-level gate)
> - 36 firestore collections (Sprint 1+2: +arena_courts, +arena_court_schedules,
>   +arena_products, +arena_sales, +arena_payments)
>   + 5 Cloud Functions
> - `/admin/v3-bootstrap` (liga tudo de uma vez)
> - Domínio de booking/pricing/calendar/court/court_schedule/booking_conflict
>   /instant_booking/arena_metrics **bem testado** (8 arquivos de teste,
>   857 tests passing)

---

## 1. Visão executiva (1 página)

### O problema
O `07-arena.md` lista 20 melhorias UX para a persona "proprietário de
arena" priorizadas em P0/P1/P2/P3. O **outro agente** (Arena V3) entregou
a **infraestrutura** (4-level gate de flags, services, collections, Cloud
Functions) mas **não entregou nenhuma das 20 melhorias UX**. Resultado:
o proprietário de arena tem o painel `/arenas/:id/gerir` mas:

- Não vê um calendário visual, só listas
- Não gerencia quadras individuais
- Não tem painel de ocupação/receita
- Não recebe lembrete de reserva
- Não tem como responder avaliações
- Não tem CRM de clientes
- A entrada "Minha arena" não está no menu

### A solução
Implementar as 20 melhorias UX em **5 sprints sequenciais** (0, 1, 2, 3, 4),
começando pelas P0 (que destravam uso real) e respeitando dependências
técnicas (push, payment, Cloud Functions agendadas). Cada sprint termina
com deploy e bundle novo em produção.

### Métricas de sucesso (Onda 2 = fim dos P0+P1)
- Dono de arena consegue criar, configurar e abrir reservas em < 10 min
- Calendário visual ativo em 100% das arenas configuradas
- Reservas com pagamento confirmado em < 24h (vs hoje: manual)
- No-show de reservas cai para < 15% (vs hoje: ~40% estimado)
- Taxa de retorno do dono de arena em 30 dias ≥ 50%

---

## 2. Gaps do 07-arena.md cruzados com Arena V3

| ID | P | Proposta | Arena V3? | Dependências |
|---|---|---|---|---|
| **ARE-01** | P0 | Quadra como entidade | ❌ `court_count` ainda é int | — |
| **ARE-02** | P0 | Calendário visual | ❌ UI é lista | ARE-01 |
| **ARE-11** | P0 | Entrada "Minha arena" no nav | ⚠️ Rota existe, sidebar não | — |
| **ARE-03** | P1 | Reserva instantânea | ❌ Manual | ARE-02, TRV-05F1 |
| **ARE-04** | P1 | Política de cancelamento | ❌ | ARE-01 |
| **ARE-05** | P1 | Gestão de mensalistas | ❌ | ARE-01, TRV-05F1 |
| **ARE-08** | P1 | Painel do proprietário (métricas) | ❌ | ARE-01, ARE-02 |
| **ARE-10** | P1 | Lembrete automático de reserva | ❌ | TRV-01 (push), TRV-06 (CF agendada) |
| **ARE-12** | P1 | Página pública da arena | ⚠️ Básica | TRV-09 (SEO) |
| **ARE-06** | P2 | Lista de espera por horário | ⚠️ Infra | ARE-02 |
| **ARE-07** | P2 | Heatmap de preços | ❌ | ARE-02 |
| **ARE-09** | P2 | CRM de clientes | ❌ | ARE-01 |
| **ARE-13** | P2 | Responder avaliações | ❌ | — |
| **ARE-19** | P2 | Exportação CSV | ❌ | ARE-01 |
| **ARE-20** | P2 | Onboarding do dono | ❌ | — |
| **ARE-14** | P2 | Integração arena × torneio | ❌ | ORG-20 (circuitos) |
| **ARE-15** | P3 | Integração arena × professor | ❌ | PRO-15 |
| **ARE-16** | P3 | Selo "arena verificada" | ❌ | — |
| **ARE-17** | P3 | Multi-unidade (rede) | ⚠️ Infra | — |
| **ARE-18** | P3 | Termos de uso | ❌ | ARE-04 |

**Sumário**: 0 ✅ / 4 ⚠️ / 16 ❌. Cobertura de 20%.

---

## 3. Dependências cross-doc (de outros planos)

| ARE | Depende de | Bloqueia | Motivo |
|---|---|---|---|
| ARE-01 | — | ARE-02, ARE-04, ARE-05, ARE-08, ARE-09, ARE-19 | Quadra é base de toda UI |
| ARE-02 | ARE-01 | ARE-06, ARE-07, ARE-08 | Calendário depende de quadras |
| ARE-03 | ARE-02, TRV-05F1 | — | Reserva instantânea precisa calendário + PIX |
| ARE-04 | ARE-01 | ARE-18 | Política ligada a quadras (prazo) |
| ARE-05 | ARE-01, TRV-05F1 | — | Mensalista = recorrência + pagamento |
| ARE-08 | ARE-01, ARE-02 | — | Painel = agregação de quadras+reservas |
| ARE-10 | TRV-01 (push), TRV-06 (CF) | — | Lembrete precisa push + scheduler |
| ARE-12 | TRV-09 (SEO) | — | SEO é pré-requisito de página pública |
| ARE-14 | ORG-20 (circuitos) | — | Integração com torneio depende de circuitos |
| ARE-15 | PRO-15 | — | Integração com professor depende de PRO-15 |
| ARE-17 | — | — | Já tem infra (`arena_networks` + flag) |

**Pré-requisitos bloqueantes** (sem eles a Onda 2 não anda):
- **TRV-01** (push notifications) — bloqueia ARE-10
- **TRV-05F1** (PIX instruções) — bloqueia ARE-03, ARE-05
- **TRV-06** (CF agendada) — bloqueia ARE-10
- **TRV-09** (SEO) — bloqueia ARE-12 (página pública rica)
- **ORG-20** (circuitos) — bloqueia ARE-14
- **PRO-15** (professor residente) — bloqueia ARE-15

**Decisão**: essas TRV/ORG/PRO entram na **Sprint 0 ou Sprint 1** como
pré-requisitos, ou a Sprint correspondente a ARE-10/03/05/12/14/15 vira
"bloqueada" e é feita por último (Sprint 4).

---

## 4. Sprints (5 sprints sequenciais)

### Sprint 0 — "Minha arena" entra na home (1 semana, ~5 dias úteis)
**Tema**: descoberta do Arena V3 pelo dono de arena. Sem UI nova complexa,
só reorganizar o que já existe.

| Item | Tipo | Esforço | Arquivo | Flag |
|---|---|---|---|---|
| ARE-11 | UX | B (1d) | `src/v2/components/V2Layout.jsx` (sidebar + dashboard) | `ARENAS` |
| ARE-20 | UX | B (1d) | novo: `src/v2/pages/V2ArenaOnboarding.jsx` | `ARENA_OWNER_ONBOARDING` |
| QW-15 | docs | B (0.5d) | `docs/AI_CONTEXT.md` + `README.md` | — |
| QW-14 | UX | B (0.5d) | `src/v2/components/V2Layout.jsx` (condicional) | `ARENAS` |
| **Testes** | infra | B (0.5d) | setup: `vitest` + `@firebase/rules-unit-testing` (se ainda não tem) | — |
| **Domínio `arena_owner.test.js`** | test | B (0.5d) | novo | — |

**Resultado**: dono de arena loga e vê "Minhas arenas" no sidebar com
badge de pendências. Após criar arena, vê checklist de 4 passos.

**Critérios de aceite**:
- [ ] Dono de arena (manager de pelo menos 1) vê "Minhas arenas" no sidebar
- [ ] Item NÃO aparece para user sem arena gerenciada
- [ ] Pós-criação, modal com 4 passos (fotos, preços, horários, compartilhar)
- [ ] 418+ testes passando
- [ ] Build verde, bundle deploya

---

### Sprint 1 — Fundação: quadras + calendário (2-3 semanas, ~12 dias úteis)
**Tema**: a entidade quadra (ARE-01) é base de quase tudo. O calendário
visual (ARE-02) é o produto que o dono vai usar todo dia.

| Item | Tipo | Esforço | Arquivo | Flag |
|---|---|---|---|---|
| ARE-01 | feature | M (5d) | `firestore.rules` + `firestore.indexes.json` + novo `src/modules/arenas/domain/court.js` + novo `src/modules/arenas/services/courtService.js` | `ARENA_COURTS` |
| ARE-01 | feature | M (3d) | novo: `src/modules/arenas/hooks/useCourts.js` + `src/v2/pages/V2ArenaCourts.jsx` | `ARENA_COURTS` |
| ARE-02 | feature | A (4d) | novo: `src/v2/components/arenas/V2ArenaCalendar.jsx` + integração em `V2ArenaManage.jsx` | `ARENA_CALENDAR` |
| **Testes do domínio** | test | M (2d) | `src/modules/arenas/domain/court.test.js` + `arenaCascadingBooking.test.js` | — |
| **Testes do service** | test | M (2d) | `src/modules/arenas/services/courtService.test.js` + `arenaService.test.js` | — |
| **Migração não-destrutiva** | infra | B (1d) | script que cria `arenas/{id}/courts` baseado em `court_count` se doc não tem subcoleção | — |

**Estrutura proposta** (`arenas/{arenaId}/courts/{courtId}`):
```js
{
  name: 'Quadra 1',                    // string, required
  kind: 'covered' | 'uncovered' | 'indoor',
  surface: 'sport_court' | 'concrete' | 'wood',
  has_lighting: true,                  // bool
  photo_url: null,                    // string
  status: 'active' | 'maintenance' | 'closed',  // default 'active'
  notes: '',
  order: 0,                           // int, ordem de exibição
  created_at, updated_at,
  archived_at: null,
}
```

**Migração**: ao abrir o V2ArenaCourts, se `arena.court_count > 0` e a
subcoleção `courts` estiver vazia, criar `court_count` quadras com nome
"Quadra 1"..N. Não-destrutivo: `court_count` continua existindo.

**Critérios de aceite**:
- [ ] Dono de arena cria/edita/remove quadras via `/arenas/:id/gerir/quadras`
- [ ] Calendário semanal mostra quadras em colunas (ou linhas) × horas em linhas (ou colunas)
- [ ] Reservas confirmadas aparecem como blocos coloridos no calendário
- [ ] Atleta pode ver o calendário em modo leitura na página da arena (futuro Sprint 2)
- [ ] 600+ testes passando (era 668; adiciona ~30-40 testes de court + booking)
- [ ] Build verde, bundle deploya, PWA funcionando

---

### Sprint 2 — Operação do dia-a-dia (2-3 semanas, ~10 dias úteis)
**Tema**: o dono de arena usa essas features DIARIAMENTE. Reserva
instantânea, política de cancelamento, mensalistas, painel de métricas.

| Item | Tipo | Esforço | Arquivo | Flag |
|---|---|---|---|---|
| **Pré-req: TRV-05F1** (PIX instruções) | feature | M (3d) | novo: `src/modules/payments/services/pixInstructions.js` + página `/configuracoes/pagamento` | `PAYMENT_INSTRUCTIONS` |
| ARE-04 | feature | M (3d) | `src/modules/arenas/domain/cancellationPolicy.js` + `cancellationPolicy.test.js` + integração no `V2ArenaManage.jsx` | `ARENA_CANCELLATION_POLICY` |
| ARE-03 | feature | M (2d) | extensão `bookingService.js` + UI toggle em `V2ArenaManage.jsx` | `ARENA_INSTANT_BOOKING` |
| ARE-05 | feature | M (3d) | novo: `src/v2/pages/V2ArenaMembersTab.jsx` (sub-tab em V2ArenaManage) | `ARENA_MEMBERSHIPS` |
| ARE-08 | feature | M (3d) | novo: `src/v2/pages/V2ArenaInsights.jsx` + agregações | `ARENA_INSIGHTS` |
| ARE-07 | feature | B (1d) | heatmap de preços em `V2PricingEditor.jsx` | — |
| **Testes** | test | M (2d) | cancellation + members + insights | — |

**Política de cancelamento** (domínio puro):
```js
// cancellationPolicy.js
export const DEFAULT_POLICY = {
  free_until_hours_before: 24,        // até 24h antes: grátis
  fee_percent_within_window: 50,      // dentro da janela: 50%
  no_show_fee_percent: 100,           // no-show: 100%
};

export function calculateCancellationFee(booking, policy, now = new Date()) {
  // returns { fee_cents, label, color, applies }
}
```

**Reserva instantânea** (lógica no `bookingService`):
- Nova flag `arena.instant_booking: boolean`
- Se `true` e `resolveArenaPrice()` retorna preço de tabela e `hasConflictWithConfirmed` é false, criar booking direto em `CONFIRMED`
- Se conflito ou preço custom, manter `REQUESTED` atual

**Mensalistas** (modelo de dados):
- Reusa `arena_bookings` com `kind: 'recurring'` + `recurring_parent_id`
- View nova: "Mensalistas" lista por cliente (uid agregado)
- Ações: pausar férias, reajustar valor, encerrar

**Painel de proprietário** (V2ArenaInsights):
- Ocupação % (últimas 4 semanas)
- Receita confirmada × pendente
- Top 10 clientes (por receita)
- Horários ociosos recorrentes ("ter 14-16h vazia há 4 sem")
- Gráficos simples (CSS, sem lib)

**Critérios de aceite**:
- [ ] Dono de arena liga/desliga reserva instantânea por arena
- [ ] Dono configura política de cancelamento (prazos, %)
- [ ] Dono vê lista de mensalistas com ações de pausar/reajustar
- [ ] Dono vê painel de ocupação e receita em `/arenas/:id/gerir/insights`
- [ ] Heatmap de preços visível na aba Preços
- [ ] PIX instruções aparece no fluxo de reserva (F1 do TRV-05)
- [ ] 700+ testes passando
- [ ] Build verde, deploy

---

### Sprint 3 — Engajamento + reputação (2 semanas, ~7 dias úteis)
**Tema**: o dono de arena quer se relacionar com clientes e ter boa
reputação. Lembretes, avaliações, exportação, CRM.

| Item | Tipo | Esforço | Arquivo | Flag |
|---|---|---|---|---|
| **Pré-req: TRV-01** (push) | feature | A (5d) | `src/core/push/` + Cloud Function `mirrorNotification` | `PUSH_NOTIFICATIONS` |
| **Pré-req: TRV-06** (CF agendada) | feature | M (2d) | nova Cloud Function `arenaReminderScheduler` | — |
| ARE-10 | feature | M (2d) | integração no `notificationService` + Cloud Function | `ARENA_RESERVATION_REMINDERS` |
| ARE-13 | feature | B (1d) | `arena_reviews` ganha campo `owner_reply` + UI | — |
| ARE-19 | feature | B (1d) | botão "Exportar CSV" em `V2ArenaManage.jsx` | — |
| ARE-09 | feature | M (3d) | novo: `src/v2/pages/V2ArenaCRM.jsx` + subcoleção `arena_clients` | `ARENA_CRM` |
| ARE-20 (refinamento) | UX | B (1d) | ligar com progresso real (sincronizar com `arena.profile_complete`) | — |
| **Testes** | test | M (2d) | reminders + CRM | — |

**Lembretes de reserva** (Cloud Function agendada):
- A cada 15 min, busca reservas com `starts_at in [now+1h ±15min, now+24h ±15min]`
- Marca `reminded_24h_at` ou `reminded_2h_at` (idempotente)
- Cria notificação in-app + push (se token registrado)
- Action: "Confirmo presença" / "Preciso cancelar"

**CRM leve** (modelo `arenas/{id}/clients`):
```js
{
  uid: 'Kx7CC...',
  name: '',
  email: '',
  phone: '',
  tags: ['mensalista' | 'eventual' | 'inadimplente' | 'bloqueado'],
  notes: '',
  total_bookings: 5,
  total_revenue_cents: 24000,
  last_booking_at: timestamp,
}
```

**Critérios de aceite**:
- [ ] Dono recebe push 24h antes de reserva confirmar presença
- [ ] Dono responde avaliações publicamente
- [ ] Dono exporta CSV de reservas do mês
- [ ] Dono tem lista de clientes com tags (mensalista, bloqueado)
- [ ] Cliente bloqueado não consegue pedir reserva
- [ ] 750+ testes passando
- [ ] Build verde, deploy

---

### Sprint 4 — Integrações + premium (2-3 semanas, ~10 dias úteis)
**Tema**: arena como hub do ecossistema (torneio, professor, rede, verificada).

| Item | Tipo | Esforço | Arquivo | Flag |
|---|---|---|---|---|
| **Pré-req: ORG-20** (circuitos) | feature | A (5d) | novo: `src/modules/tournaments/circuits/` | `TOURNAMENT_CIRCUITS` |
| ARE-14 | feature | M (2d) | `bookingService` ganha `kind: 'tournament_block'` + UI em `V2ArenaManage` | `ARENA_TOURNAMENT_BLOCK` |
| **Pré-req: PRO-15** (professor residente) | feature | M (2d) | `coach_arenas` subcollection + flag | `COACH_RESIDENT` |
| ARE-15 | feature | B (1d) | UI "Professores residentes" em `V2ArenaDetail` (público) | — |
| ARE-16 | feature | B (1d) | `arena.verified: boolean` + `arena.verified_at` + UI selo | `ARENA_VERIFIED` |
| ARE-17 (UI) | feature | M (2d) | dedicado: `V2ArenaNetworks.jsx` + agregação | `ARENA_MODULE_MULTI_UNIT_NETWORK` |
| ARE-18 | feature | B (1d) | `arena.house_rules_md` + UI na reserva | — |
| ARE-12 (refinamento) | UX | M (2d) | mapa + amenidades + CTA fixo | — |
| **Testes** | test | M (2d) | circuits + networks + verification | — |

**Tournament block** (reserva especial para torneio):
- `kind: 'tournament_block'` + `tournament_id`
- Dono da arena aprova (ou rejeita)
- Quando aprovado, agenda da arena mostra o evento + página do torneio linka arena

**Selo "arena verificada"** (workflow):
- platform admin verifica telefone + endereço + fotos
- Seta `verified: true` + `verified_at` + `verified_by`
- Badge no diretório e na página da arena
- Sem flag (é campo no doc, controlado pelo admin)

**Multi-unidade** (rede):
- `arena_networks` + `arena_network_memberships` (já existem, sprint 9 do Arena V3)
- UI dedicada: `V2ArenaNetworks.jsx` com seletor de arena + visão agregada

**Critérios de aceite**:
- [ ] Organizador reserva bloco de quadras para torneio
- [ ] Dono vê na agenda "Torneio X - 5 quadras - 18/07 14h-22h"
- [ ] Arena pode ter professor residente (aparece na página)
- [ ] Platform admin marca arena como verificada (selo aparece)
- [ ] Dono de rede vê painel agregado de todas as arenas
- [ ] Termos de uso (markdown) aparecem na reserva
- [ ] Página pública com mapa + amenidades + CTA fixo
- [ ] 800+ testes passando
- [ ] Build verde, deploy

---

## 5. Resumo das sprints

| Sprint | Tema | AREs | Pré-reqs | Dias | Testes |
|---|---|---|---|---|---|
| 0 | Descoberta | ARE-11, ARE-20, QW-14, QW-15 | — | 5 | 668 |
| 1 | Fundação | ARE-01, ARE-02 | — | 12 | 700+ |
| 2 | Operação | ARE-03, ARE-04, ARE-05, ARE-07, ARE-08 | TRV-05F1 | 10 | 700+ |
| 3 | Engajamento | ARE-09, ARE-10, ARE-13, ARE-19, ARE-20 | TRV-01, TRV-06 | 7 | 750+ |
| 4 | Integrações | ARE-12, ARE-14, ARE-15, ARE-16, ARE-17, ARE-18 | ORG-20, PRO-15 | 10 | 800+ |
| **Total** | — | **15 AREs + 5 QWs** | 4 TRV + 2 doc | **~44 dias** | **+130 testes** |

---

## 6. Critérios globais (todas as sprints)

### Padrão de implementação
1. **Domínio puro primeiro** (com testes, padrão da casa) → service → hook → UI
2. **Feature flag** sempre, default off, ativável em `/admin/metricas`
3. **Migração não-destrutiva**: campos novos opcionais; dados existentes
   continuam funcionando
4. **Auditoria**: cada mutation sensível em `audit_logs` com `actor`
5. **i18n**: microcopy pt-BR; copy revisada pelo owner antes do merge
6. **Acessibilidade**: foco visível, `aria-label` em botões-ícone, navegação
   por teclado nas tabelas/calendário
7. **Testes**: 1 teste por função pura no domínio + smoke test de
   integração por service
8. **Build verde** + bundle deploya + `/admin/owner-debug` continua OK

### Dívida técnica que essa roadmap NÃO fecha
- **Sprints 8-11 do Arena V3 (IoT, Multi-Unit, White Label, AI) estão
  compactados em `V2ArenaAdvanced` com 4 tabs**. Cada um deveria ter
  página dedicada. Roadmap à parte.
- **V2ArenaModules** (gestão de módulos por arena) está OK mas precisa
  de mais polish (drag-and-drop, bulk ON, undo).
- **Bundle size**: Arena V3 já adicionou ~50KB no `useArenaV3.js`. Cada
  sprint vai adicionar mais. Considerar code-splitting mais agressivo
  ou dividir `useArenaV3.js` em hooks por módulo.
- **Zero testes nos services atuais do Arena V3**. Antes de começar
  Sprint 2, fazer um sprint de testes (1-2 dias) cobrindo members, pdv,
  classes, etc. (não está no roadmap acima mas é pré-req implícito).

---

## 7. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| TRV-01 (push) vira projeto grande e bloqueia Sprint 3 | Alta | Alto | Reduzir TRV-01 para escopo mínimo (F1: só notificação `booking_reminder`), sem opt-in contextual |
| ORG-20 (circuitos) é pré-req de ARE-14 mas é enorme | Média | Médio | ARE-14 vira "booking tipo tournament" sem circuito completo; só com arena + criador + datas |
| `useArenaV3.js` monolítico trava Tree-shaking | Alta | Médio | Dividir em hooks por módulo ANTES da Sprint 1 (criar 1-2 dias extras) |
| Dono de arena não tem dados suficientes para testar | Média | Alto | Criar 1 arena de teste (PickleRush Arena) com reservas geradas em dev |
| Bundle size estoura limite (>2MB) | Baixa | Alto | Code-splitting agressivo; dynamic import de páginas de arena |
| `calendar` componente (ARE-02) sem lib dá muito trabalho | Alta | Alto | Avaliar FullCalendar vs react-big-calendar vs custom; benchmark 1d antes da Sprint 1 |
| Migração de dados (criar `courts` a partir de `court_count`) quebra arenas existentes | Baixa | Alto | Testar em ambiente de dev; flag `ARENA_COURTS_MIGRATED` opt-in |
| Push (FCM) precisa de Blaze plan | Alta | Crítico | Confirmar Blaze ativo ANTES da Sprint 3; caso contrário, manter só in-app |

---

## 8. Validação e início

### Antes de começar
- [ ] Owner valida este plano (estrutura + prioridades + ordem)
- [ ] Owner confirma Blaze plan ativo (Sprint 3 depende)
- [ ] Owner abre issues para cada ARE (ou PR por sprint, se preferir
      granularidade menor)
- [ ] Decidir: criar 1 worktree por sprint ou 1 worktree com todas as
      sprints em commits separados? (recomendação: 1 worktree por sprint,
      merge + deploy entre sprints)

### Primeiro passo (Sprint 0)
Criar a worktree `feature/arena-sprint-0-descoberta` e implementar:
- ARE-11 (entrada "Minha arena" no sidebar)
- ARE-20 (onboarding pós-criação)
- QW-14 + QW-15 (higiene)

PR + CI + merge + deploy. Bundle novo em produção.

### Métricas de saúde (a verificar a cada sprint)
- Bundle size (alvo: < 1.5MB total)
- Test count (alvo: crescendo 30+ por sprint)
- Lighthouse score (alvo: ≥ 90 em Performance e Accessibility)
- `/admin/owner-debug` continua respondendo OK

---

## 9. Referências

- **Doc 07-arena.md** (este plano deriva dele) — 20 propostas priorizadas
- **Doc 10-transversais.md** — dependências técnicas (TRV-01, TRV-05, TRV-06)
- **Doc 12-roadmap-priorizacao.md** — priorização de ondas
- **picklerush-agent-context.md** (memory topic) — workflow + decisões + gotchas
- **Origin/main commits**:
  - `aecb40d` — merge Arena V3 (11 sprints)
  - `7c24993` — Firebase setup package
  - `8c7dfe6` — firebase init.json fallback
  - `9f14d2d` — hotfix Firebase live bindings (#45)
- **PRs relevantes**:
  - #45 (Firebase hotfix) — app=null exportado
  - #40 (Painel Admin) — `/admin/painel` com 7 abas (pode ganhar aba "Arenas")
  - #35, #36, #37, #38, #39 — diagnóstico + owner-restore + lookups fix

---

## 10. Próximo passo imediato

**Decisão do owner**:

1. ✅ Aprovar este roadmap como está?
2. 🔄 Mudar ordem/prioridades? (ex: ARE-08 antes de ARE-02?)
3. ➕ Adicionar sprints (ex: sprint de testes antes da 1)?
4. ➖ Remover sprints (ex: dividir Sprint 4 em 4 e 5)?

Sugestão de início: **Sprint 0 (ARE-11 + ARE-20 + QW-14/15) ainda hoje**.
Tempo estimado: 5 dias úteis. Resultado: dono de arena vê o Arena V3 pela
primeira vez no menu, com checklist de configuração. Já é vitória.

---

## 11. Progresso por sprint (atualizado 2026-07-22)

### Sprint 0 (Descoberta) — ✅ DONE (PRs #46, #47)
- **ARE-11** "Minhas arenas" no sidebar com badge de reservas pendentes
  - Hook `useMyArenaSummary` (reusa `useMyManagedArenas` + 1 query por arena)
- **ARE-20** `/arenas/:id/onboarding` stepper 4-passos (Fotos → Preços →
  Horários → Compartilhar)
  - Persiste em `arenas/{id}.onboarding_complete` (4 booleans)
  - Substituiu o redirect direto pra `/gerir`
- **QW-14** "Minhas reservas" condicional à flag `ARENAS`
- **QW-15** docs (AI_CONTEXT.md + README.md) atualizadas
- **Bônus** aba "Arenas" no `/admin/painel` com 5 stats + tabela
- **Sprint 0.1** (PR #47, hotfix) — âncoras #fotos/#precos/#horarios em
  V2ArenaManage (resolveu caveat do PR #46)
- **Sprint de testes** 28 tests novos em `arena.test.js`

### Sprint 1 (Fundação) — ✅ DONE (PRs #48, #49, #50, #51)
- **ARE-01** Quadras como entidades reais (PR #48)
  - Coleção `arena_courts` com `court_type`/`surface_type`/`is_active`/`sort_order`
  - Domain + 20 tests + service + 5 hooks + UI V2CourtsTab
- **ARE-02** Calendário mensal de reservas (PR #51)
  - Domain `calendar.js` com `buildMonthGrid`/`groupBookingsByDate` + 29 tests
  - UI V2ArenaCalendar com grid 6x7, filtro por quadra, modal do dia
- **ARE-04** Janelas de horário recorrentes (PR #49)
  - Coleção `arena_court_schedules` com `weekdays[]`/`start_time`/`end_time`
  - Domain + 36 tests + service + 4 hooks + UI V2CourtSchedulesModal (grade semanal 7-col)
- **ARE-05** Regras de preço por quadra (PR #51)
  - `price_rules[]` e `price_overrides[]` agora suportam `court_id` opcional
  - Domain + 3 tests + UI campo "Aplicar à quadra" em V2PricingEditor
- **ARE-07** Detecção de conflito (PR #50)
  - Domain `booking_conflict.js` com `validateBookingRequest`/`getCourtAvailabilityForDate` + 30 tests
  - Integração no `createBooking` (SINGLE) com validação real-time na UI
  - Chips verdes de horários livres no BookingRequestDialog

### Métricas finais
- **816/816 tests passing** (era 418 no início do projeto, +95% cobertura)
- Bundle main deployed: `index-CebdVFSS.js` (124,709 B)
- 33 firestore collections, 5 Cloud Functions
- 6 PRs mergeados (Sprint 0, 0.1, 1 com 4 PRs)

### Próximo (Sprint 2 — Operação)
- ARE-03 reserva instantânea (workflow refinado + pagamento)
- ARE-06 PDV de arena
- ARE-08 painel de proprietário (métricas)

---

## 12. Sprint 2 (Operação) — em andamento (2026-07-22)

### Status
- ✅ **ARE-08** Painel do proprietário (métricas) — PR (este PR)
- ✅ **ARE-03** Reserva instantânea (PIX/dinheiro) — PR (este PR)
- 🔲 **ARE-06** PDV — **JÁ IMPLEMENTADO** pelo Arena V3 (outro agente).
  Coleções `arena_products` / `arena_sales` / `arena_payments` +
  rotas `/arenas/:id/loja` e `/arenas/:id/gerir/pdv` + 4 feature flags
  (ARENA_MODULE_PDV, _CATALOG, _PIX_NATIVE, _SPLIT). Tudo default OFF.
  Para ativar: `/admin/v3-bootstrap` ou via platform_settings.

### ARE-08 (este PR)
Painel read-only com métricas agregadas:
- Receita confirmada (bookings CONFIRMED + sales PAID)
- Receita pendente (REQUESTED + NEGOTIATING)
- Taxa de conversão (% de finalizadas com sucesso)
- Ocupação (% de horas reservadas vs disponíveis)
- Rating médio
- Próximas reservas confirmadas
- Navegação por mês (cursor prev/next)

Domain puro `arena_metrics.js` + 22 tests. Reusa hooks já cacheados
(useArenaBookings, useArenaSales, useArenaReviews,
useArenaCourtSchedules, useArenaCourts) e filtra no client.

UI: nova tab "Métricas" no /arenas/:id/gerir (primeira tab).

### ARE-03 (este PR)
Toggle no BookingRequestDialog: "Solicitar reserva" vs "Reserva
instantânea" (auto-confirmada).
- Arena opt-in: `arena.allow_instant_booking: true`
- Requer `payment_method` (PIX por QR/código, cartão, dinheiro)
- Requer `proposed_price > 0` (instant não pode ser grátis)
- Status inicial muda pra CONFIRMED (em vez de REQUESTED)
- Flag `is_instant: true` gravada no booking

Domain puro `instant_booking.js` + 19 tests. Integração no
`bookingService.createBooking` com `canBeInstantBooking` +
`getInitialBookingStatus`.

### Métricas Sprint 2
- 857/857 tests passing (era 816, +41)
- Build verde (23.1s)
- +41 tests (22 metrics + 19 instant)
- Bundle: `index-DjnLS97o.js` (124,709 B) — hotfix #52 do Settings
  import também deployado
- 4 PRs mergeados (PRs #52 hotfix + PR novo)

### Próximos sprints
- Sprint 3 (Engajamento): ARE-09 reviews, ARE-18 termos
- Sprint 4 (Integrações): ARE-14/15 (depende ORG-20, PRO-15)
