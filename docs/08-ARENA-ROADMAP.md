# Roadmap de Arena — implementação completa

> **Status**: Sprints 0+1+2+3+4 ✅ DONE, **Sprint 5 (Refinamento) ✅ DONE**
> (PRs #58 hotfix, #59 calendar, #60 PIX, #61 regras, #62 mercado).
> Roadmap Arena COMPLETAMENTE CONCLUÍDO.
>
> **Escopo**: persona **proprietário de arena** (ARE-01 a ARE-20 do doc de UX)
> + cross-cutting necessário para ela fechar. **Não** cobre gestão de
> torneio (05-organizador), dia de jogo (06), professor (08), clubes (09) —
> esses têm seu próprio roadmap.
>
> **Estado atual no repositório (origin/main @ eacc48f)**:
- Sprint 0 (Descoberta) ✅: `Minhas arenas` no sidebar (ARE-11), onboarding
  4-passos (ARE-20), aba "Arenas" no admin/painel, QW-14/15
- Sprint 1 (Fundação) ✅: ARE-01 quadras, ARE-02 calendário, ARE-04
  janelas de horário, ARE-05 preço por quadra, ARE-07 detecção de conflito
- Sprint 2 (Operação) ✅: ARE-06 PDV, ARE-08 painel de métricas,
  ARE-03 reserva instantânea
- Sprint 3 (Engajamento) ✅: ARE-09 resposta de reviews, ARE-18
  regras da casa (house rules)
- Sprint 4 (Integrações) ✅: ORG-20 circuitos, PRO-15 professores residentes,
  ARE-14 arena × torneio, ARE-15 arena × professor
- Sprint 5 (Refinamento) ✅: HOTFIX ConfirmDialog, calendar interativo
  público+admin com auto-preço, pagamento PIX (QR+chave), regras
  estruturadas (lista por categoria), mercado/estoque (entrada+saída+margem)
- **Sprint 6 (Bugs críticos)** ✅: PR #64 FeatureFlagGuard (substitui
  redirect silencioso), PR #65 Calendar/Check/Copy lucide imports
- **Sprint 7 (Quadras + calendário)** ✅: PR #66 V2CourtsTab cn + V2Select
  options + **calendário MENSAL** com clique no dia (V2DaySlotsDialog),
  PR #67 V2DaySlotsDialog com info de reservas + badges numéricos
- **Sprint 8 (Professores + reservas compartilhadas + refino UX/UI)** ✅
  (PR #68): shared-bookings (booking_type='coach_lesson', 'shared'),
  linked-clubs, produto do professor (Fases A-D), coach-arena partner
- **Sprint 8a (Admin + cancelar/alterar/transferir)** ✅ (PR #69): painel
  admin 2 níveis, cancelar/alterar reservas, transferir responsável,
  Arena V3 Boot embutido
- **Sprint 9 (Reservas por quadra + rateio)** ✅ (PR #70): CourtDayGrid
  (linhas=horários, colunas=quadras), toda reserva com court_id via
  pickAvailableCourt, rateio inclui avulsos
- **Sprint 10 (Backlog ~30 features)** ✅ (PR #71 + #72): 10 ondas com
  sub-flags (ver §13 abaixo)
- **23+ páginas V2Arena* no ar** (Sprint 7: +V2DaySlotsDialog, Sprint 8:
  +V2ArenaCRM, +V2ArenaWaitlist, +V2ArenaCancellationPolicy)
- 23 services + 1 hook monolítico `useArenaV3.js` (749 linhas)
- **51 feature flags `ARENA_MODULE_*` + 73 flags normais = 124 totais**
- **92 firestore collections** (Sprint 6-10: +53 — coach_*, shared,
  waitlist, crm, cancellation, e todo o Arena V3 skeleton)
- `/admin/v3-bootstrap` + `/admin/console` (liga tudo de uma vez)
- Domínio de booking/pricing/calendar/court/court_schedule/booking_conflict
  /instant_booking/arena_metrics/review_response/cancellation_policy/
  arena_crm/booking_waitlist/court_assignment/shared_booking **bem testado**
  (24+ arquivos de teste, **1334+ tests passing** — Sprint 6-10: +314)

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
| QW-15 | docs | B (0.5d) | `docs/01-AI-CONTEXT.md` + `README.md` | — |
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
- **QW-15** docs (01-AI-CONTEXT.md + README.md) atualizadas
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

---

## 13. Sprints 6–10 (continuação, 2026-07-23 → 2026-07-24)

> Atualizado em **2026-07-24** (origin/main @ `56dba26`). 9 PRs grandes
> mergeados em outros ambientes paralelos (PRs #64-#72). Esta seção
> documenta o que foi entregue e o que foi aprendido.

### Sprint 6 — Bugs críticos (PRs #64, #65)

**Tema**: tirar `ReferenceError`s e `redirect silencioso`.

- **PR #64 / sw-v73.3** — `FeatureFlagGuard`
  - **Problema**: páginas V2 (Arenas, ArenaDetail, ArenaManage, ArenaOnboarding,
    CreateArena) faziam `if (!enabled) return <Navigate to="/" replace />`
    quando flag `ARENAS` OFF (default). Resultado: user reportou "arenas
    fora do ar" — era redirect silencioso para landing.
  - **Solução**: novo `<FeatureFlagGuard flag= label= description=>` —
    flag OFF mostra empty state com Flag icon + título + descrição +
    botão "Ativar {label}" 1-click para platform_admin.
  - **Aplicado em 5 pages V2 + V2Layout link "Explorar Quadras" sempre
    visível para admin com tag "Off"**.
  - Bônus: `getArena()` ganhou fallback case-insensitive.
  - Bundle: `index-B0jHnHak.js` + `FeatureFlagGuard-DVrqH8Bm.js` (915B).
- **PR #65 / sw-v73.4** — `lucide imports` em V2ArenaDetail
  - **Problema**: PR #63 introduziu `<Calendar className="h-4 w-4" />`
    mas esqueceu de adicionar `Calendar` no import. `ReferenceError:
    Calendar is not defined` em runtime. Também faltavam `Check` e `Copy`
    (não causavam erro imediato porque section faz early-return).
  - **Solução**: 1 linha no import.
  - Bundle: `index-DKzkhUW2.js`.

### Sprint 7 — Quadras + calendário mensal (PRs #66, #67)

**Tema**: UX de quadras e reservas de arena.

- **PR #66 / sw-v73.5** — `V2CourtsTab + V2Select + calendar MENSAL`
  - **Bug 1**: `cn is not defined` em V2CourtsTab (linha 255).
  - **Bug 2**: V2Select ignorava prop `options`, só renderizava `children`
    (vazio) → campos "Tipo" e "Superfície" vazios.
  - **Redesign**: V2BookingCalendar reescrito de **DIÁRIO para MENSAL**
    com clique no dia → `V2DaySlotsDialog` (NOVO) com slots do dia +
    multi-seleção. `BookingRequestDialog` recebe `preselectedSlots` com
    `date+start+end+court_id`.
  - **Domain**: `aggregateDayStatus` extraído para
    `src/modules/arenas/domain/calendar_aggregate.js` (puro, testável).
  - **21 testes novos** (calendar_aggregate.test.js).
  - 6 files, 832 insertions, 190 deletions. Tests: 1020 → 1041.
  - V2Select agora aceita `children` OU `options` (children > options).
- **PR #67 / sw-v73.6** — `V2DaySlotsDialog com info de reservas + badges`
  - Dialog reescrito com 3 seções: resumo do dia (badges com contagens),
    lista de reservas existentes (nome, horário, quadra, status, preço),
    indisponibilidades admin (com motivo).
  - Calendar mensal: badges numéricos amber (PENDING) + vermelho
    (CONFIRMED) em cada dia.
  - Tooltip rico: "18:00 · Solicitação: Fulano de Tal".
  - 2 files, 379 insertions, 99 deletions.

### Sprint 8 — Professores + reservas compartilhadas + refino UX/UI (PR #68)

**Tema**: produto do professor + ponte arenas↔professores.

- **Shared bookings**: `arena_bookings.booking_type` ganhou `'coach_lesson'`
  e `'shared'` (multi-responsáveis com rateio). Reusa coleção canônica.
- **Linked clubs**: clubes vinculados a professores (`coach.linked_club_ids`)
  e arenas. Seção "Clubes" no público dos dois lados.
- **Coach — produto completo (Fases A-D)**:
  - **Fase A**: agenda (coach_availability) + aulas (coach_lessons) +
    loja (coach_products)
  - **Fase B**: roster (coach_students) + agenda de aulas por aluno
  - **Fase C**: pacotes (coach_packages) + vendas (coach_package_sales) +
    financeiro
  - **Fase D**: biblioteca (coach_content) — drills, vídeos, planos
- **Coach-arena partner**: espaço admin + público para professores
  parceiros. `coach_arenas.partnership_status` (mútuo na Onda 7).
- **Painel do professor 2 níveis** + fotos + loja
- **Refino UX/UI geral**: `emerald-*` → `green-*` em arenas, V2Badge
  tones padronizados, V2Layout nav 2 linhas no admin da arena, skeletons
  visíveis, ConfirmDialog em vez de `confirm()` nativo, emoji → `lucide`.

### Sprint 8a — Admin + cancelar/alterar/transferir (PR #69)

- **Painel admin 2 níveis**: sticky top-2 + sub-tab-bar. Flags agrupadas
  por assunto (`core`/`nav`/`athlete`/`tournaments`/`arenas`/`coaches`/
  `community`/`arena_v3`/`other`).
- **Cancelar/alterar reservas**: atleta, professor e arena podem fazer
  no painel e no calendário.
- **Transferir responsável** → **Responsáveis** (multi-responsáveis
  com rateio). Substituiu o antigo "transferir" (1:1) por N-ário.
- **Arena V3 Boot embutido** no console — sub-seção de bootstrap.

### Sprint 9 — Reservas por quadra + rateio (PR #70)

- **CourtDayGrid**: linhas=horários, colunas=quadras. Visão clássica
  de "planilha" de reservas.
- **TODA reserva tem `court_id`** (não opcional). Auto-atribuição via
  `pickAvailableCourt` em `domain/court_assignment.js` quando user não
  escolhe.
- **Rateio inclui avulsos** (sem conta) — campo `responsibles[]` com
  `{user_id?, name, percent, share_type}`.

### Sprint 10 — Backlog ~30 funcionalidades (PRs #71, #72)

> Cada sub-feature tem **sua própria flag** (opt-in individual). 10 ondas.

| Onda | Flag(s) | Descrição |
|---|---|---|
| 1 | `calendar_export`, `registrations_csv`, `not_found_page` | Exporta `.ics` de aulas/torneios; CSV de inscrições; página 404 interna |
| 2 | `gameday_formats` | Mexicano + Rei da Quadra em game-day |
| 3 | `doubles_ranking`, `athlete_agenda` | Ranking de duplas + agenda do atleta |
| 4 | `tournament_tv_mode` | Telão fullscreen para quadras |
| 4b | `courtside_scoring`, `bracket_tree` | Placar courtside + árvore visual de chave |
| 5 | `tournament_templates` | Marcar torneio como modelo pra duplicar |
| 5b | `tournament_wizard` | Criação de torneio em etapas (assistente) |
| 6 | `cancellation_policy`, `no_show_tracking` | Política de cancelamento + tracking de no-show |
| 6b | `arena_crm`, `booking_waitlist` | CRM leve + lista de espera |
| 7 | `partnership_mutual` | Aceite mútuo professor↔arena |
| 7b | `coach_leveling`, `coach_clinics` | Validação de nível por professor + clínicas abertas |
| 8 | `club_internal_ranking` | Ranking interno do clube |
| 8b | `club_invite_link`, `club_recurring_events`, `club_public_page` | Link de convite + eventos recorrentes + página pública |
| 9 | `settings_page` | `/configuracoes` (privacidade, notif, LGPD export) |
| 9b | `notification_prefs`, `public_seo` | Preferências por categoria + meta tags SEO |
| 10 | `global_search` | Busca federada (atletas+torneios+arenas+clubes) |
| 10b | `a11y` | Skip-link + main landmark |

### Métricas finais (2026-07-24)

- **1334+ tests passing** (era 1020 no sw-v73.4, +314 com as sprints 6-10)
- **Lint 0 errors** (era 30 no início do projeto)
- **Bundle V2ArenaDetail**: 33KB → 39KB (calendar mensal + V2DaySlotsDialog)
- **Last bundle deployed**: `index-CJmY5B8O.js` (PR #67, sw-v73.6)
- **9 PRs mergeados** (#64-#72), 27 PRs totais
- **Last SHA**: `56dba26` (52 commits à frente do snapshot anterior)
- **92 firestore collections** (eram 39)
- **124 feature flags** (eram 30)
- **67 V2 pages** (eram 24)
- **19 módulos** (eram 17 — adicionados `coaches/` e `circuits/`)

### Próximo (Sprint 11+ — backlog remanescente)

> Ver `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` para a lista
> consolidada do que ainda falta. Tópicos principais:
>
> - **DS** (Design System): unificar 4 sistemas concorrentes, dark mode,
>   auditoria de contraste acid, motion, ilustrações
> - **NAV**: busca global ✅ (Onda 10), command palette, breadcrumbs
> - **Ponte com Sistema C** (aulas da arena): integração aulas da arena
>   ↔ aulas do professor
> - **Split de receita / comissão** para aulas realizadas na arena parceira
> - **Checkout/gateway** (rateio é calculado, mas pagamento é combinado
>   direto)
> - **Aceite mútuo da parceria** (Onda 7 entregou; refinamento pode vir)

---

## 14. Sprints 11-12 — UX/UI + reservas por quadra (2026-07-24 → 2026-07-27)

> Atualizado em **2026-07-27** (origin/main @ `80f7bb6`, PR #81).
> 9 PRs grandes mergeados em outros ambientes: PRs #73-#81.
> Esta seção documenta o que foi entregue e o que foi aprendido.

### Sprint 11 — UX/UI fixes (PRs #73, #74, #79, #80)

**Tema**: pequenos fixes de UX que incomodavam no dia-a-dia, mais a
grande mudança de navegação em hubs.

- **PR #73** — `fix(ux): onboarding só na 1ª entrada, diálogos roláveis, dedup waitlist`
  - Onboarding wizard só dispara na 1ª entrada (não mais sempre)
  - Diálogos roláveis em modo paisagem
  - **Dedup `arena_waitlist`**: removida duplicação
  - 8 files, 66 insertions, 27 deletions
- **PR #74** — `feat(nav+admin): navegação em hubs (flag) + consolidação de flags`
  - **Nova flag `NAV_HUBS`**: navegação 2 níveis
  - Consolidação de flags (contagem única, agrupamento)
  - **V2AdminBootstrap** consolidada no console (`/admin/console?tab=flags`)
  - V2AdminBootstrap.jsx + ArenaV3FlagsPanel.jsx **deletados**
  - 7 files, 422 insertions, 578 deletions
- **PR #79** — `feat(nav+admin): ver como usuário + Política de uso + Parceiros`
  - **"Ver como usuário"** no header (toggle debug, só admin)
  - **"Política de uso"** no rodapé (link próprio)
  - "Parceiros" vira seção própria
  - **Renames**: "Aprender"→"Pickleball", "Ensino"→"Professores"
  - 2 files, 68 insertions, 9 deletions
- **PR #80** — `fix(nav): drawer mobile mostra só os hubs`
  - 1 file, 54 insertions, 23 deletions

### Sprint 12 — Reservas por quadra + circuitos + professor (PRs #75-#78, #81)

**Tema**: o coração das arenas — vincular toda reserva a uma quadra
específica, suportar multi-quadra, e unificar o "professor".

- **PR #75** — `fix: reservas por quadra, circuitos no painel, unificar 'professor'`
  - **Toda reserva AGORA tem `court_id`** (auto-atribuído via
    `pickAvailableCourt` em `domain/court_assignment.js`)
  - 8 asserts no domain: `activeCourts`, `isCourtFreeForSlot`,
    `pickAvailableCourt`, `courtAvailabilityForSlot`,
    `countAvailableCourts`
  - **Rename "treinador"→"professor"** (label flag `COACH_DIRECTORY`)
  - Calendário admin por quadra (grade tempo × quadra)
  - Circuitos no painel
  - 13 files, 188 insertions, 89 deletions
  - 608 testes de arena verdes
- **PR #76** — `feat(circuits): registrar resultados por etapa`
  - UI de registro de resultados por etapa
  - Pontos pela tabela do circuito
  - 3 erros de lint pré-existentes corrigidos
  - 2 files, 111 insertions, 6 deletions
- **PR #77** — `fix(arenas): reservar todas/específicas quadras (uma por quadra)`
  - **3 modos** no BookingRequestDialog: qualquer / específicas / todas
  - Modo específicas/todas: cada quadra = reserva independente
  - `booking_group_id` aditivo (lote atômico)
  - Domain: `resolveTargetCourts`, `unavailableCourtsForSlots` (+12 tests)
  - 4 files, 323 insertions, 142 deletions
- **PR #78** — `fix(arenas): reservar/cancelar por quadra + convidar participantes`
  - Modo "todas" cria reserva por quadra
  - Filtro do calendário define modo
  - **Cancelar próprias reservas** (individual e em lote)
  - **Convidar participantes** no modal de dia
  - Suporte a múltiplos horários (kind `multi`)
  - +16 testes (1350 total)
  - 7 files, 331 insertions, 69 deletions
- **PR #81** — `feat(coaches): "Sou professor" bidirecional`
  - Sync `users/{uid}` ↔ `coaches/{uid}` (dois sentidos)
  - "Sou professor" do perfil (V2ProfileEdit) salva em `coaches/{uid}` +
    `users/{uid}.is_coach=true`
  - Salvar em `/coaches` reflete no perfil
  - Campo Modalidades no perfil + pré-preenchimento
  - 4 files, 167 insertions, 6 deletions
  - 1350 testes verdes

### Métricas finais (2026-07-27)

- **1350 testes verdes** (era 1334, +16 com PR #78)
- **Lint 0 errors**
- **125 feature flags** (124 + 1: NAV_HUBS)
- **66 V2 pages** (67 - 1: V2AdminBootstrap removida)
- **9 PRs mergeados** (#73-#81), 36 PRs totais
- **Last SHA**: `80f7bb6` (PR #81)

### Decisões de arquitetura importantes (Sprints 11-12)

1. **TODA reserva tem `court_id` obrigatório** (PR #75) — auto-atribuído
   via `pickAvailableCourt`. Service **erra** se nenhuma quadra livre
   (sem fallback silencioso).
2. **`booking_group_id` aditivo** em `arena_bookings` (PR #77) — agrupa
   reservas do mesmo pedido multi-quadra.
3. **3 modos no BookingRequestDialog** (PR #77): qualquer / específicas /
   todas. Cada modo gera padrão diferente de reservas.
4. **NAV_HUBS** (PR #74): nova navegação 2 níveis. OFF por default.
5. **"Ver como usuário"** (PR #79): toggle no header. Faz
   `isPlatformAdmin`/`canCreatePools` retornarem `false`.
6. **V2AdminBootstrap consolidada** (PR #74) — não existe mais, foi
   absorvida pelo console.
7. **Renames** (PR #75, #79): "treinador"→"professor", "Aprender"→
   "Pickleball", "Ensino"→"Professores".
8. **Professor unificado** (PR #81): "Sou professor" do perfil sincroniza
   com `coaches/{uid}` automaticamente.

### Próximo (Sprint 13+ — backlog remanescente)

> Ver `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` para a lista
> consolidada do que ainda falta. Tópicos principais:
>
> - **DS** (Design System): unificar 4 sistemas, dark mode, contraste acid
> - **NAV**: command palette, breadcrumbs
> - **Ponte com Sistema C** (aulas da arena)
> - **Split de receita / comissão** para aulas em arena parceira
> - **Checkout/gateway** (rateio calculado, pagamento combinado)

---

## 15. Sprint 13 — Persistência do admin + UI colapsável (2026-07-27)

> Atualizado em **2026-07-27, 16:10 GMT-3** (origin/main @ `eacc48f`, PR #84).
> 3 PRs mergeados em outros ambientes: PRs #82, #83, #84.
> Esta seção documenta o que foi entregue e o que foi aprendido.

### PR #82 (bf07a80) — fix(coaches): busca lista todos + filtro por cidade; hub "Aulas"
- **`listCoaches` reescrito sem índice composto** — query simples
  (`limit(500)`) + filtros/ordenação em memória
- Resolve bug onde professores não apareciam na busca (índice
  `active+accepting+display_name` faltando)
- Filtro cidade/estado: inicia com cidade do usuário; limpar → todos
- Busca automática (debounced)
- **Hub renomeado**: "Professores" → **"Aulas"**
- Ordem: Professores / Minhas aulas / Painel do professor
- Perfil › Professor: acesso direto ao Painel + texto atualizado
- 4 files, 51 insertions, 20 deletions
- 1350 testes verdes

### PR #83 (0c10d18) — feat(ui): cards de seção colapsáveis
- **`V2Surface` ganha modo `collapsible`** (retrocompatível)
- **`V2CollapsibleSection`** (NOVO) — alias para `<V2Surface collapsible>`
- Aplicado em: Meu perfil, Professores, Circuitos, Clubes, Arena pública
- Estado lembrado por seção via localStorage (`collapseId` ou título)
- Chevron importado de `lucide-react`
- 6 files, 121 insertions, 35 deletions
- 1350 testes verdes

### PR #84 (eacc48f) — fix(arenas): persistência do admin
- **Excluir quadra**: botão renderiza e deleta de fato
- **Catálogo/entradas/saídas do mercado** voltam a aparecer
  (era `where+orderBy` sem índice — agora query simples + filtro/ord em memória)
- **Parcerias professor↔arena** voltam a aparecer
- **Receita do mercado contabilizada no desempenho** da arena
- Mesmo fix em PDV produtos, membros, pacotes
- 6 files, 99 insertions, 64 deletions
- 1350 testes verdes

### Métricas finais (2026-07-27, 16:10 GMT-3)

- **1350 testes verdes** (sem mudança de count)
- **Lint 0 errors**
- **125 feature flags** (sem mudança)
- **66 V2 pages** (sem mudança)
- **92 coleções Firestore** (sem mudança)
- **3 PRs mergeados** (#82-#84), 39 PRs totais
- **Last SHA**: `eacc48f` (PR #84)

### Decisões de arquitetura importantes (Sprint 13)

1. **Padrão "query simples + filtro/ordenação em memória"** — emergente,
   bom até ~500 docs/arena. Trade-off: mais memória + mais lento, mas
   sempre funciona sem depender de índice composto. Documentado em
   `02-STANDARDS.md §5.3.2`.

2. **`V2CollapsibleSection`** é retrocompatível — sem `collapsible` prop,
   mesma API. Sem migração.

3. **localStorage** como persistência do estado colapsado — chave
   `collapseId` ou título. Lembra entre sessões.

4. **Hub "Aulas"** reflete a visão produto (user quer aulas, não
   "professores" como seção).

5. **Padrão "fix de query" se repete**: arenaService (mercado, partners),
   coachService (listCoaches), membersService, pdvService — todos
   seguindo a mesma fórmula.

### Próximo (Sprint 14+ — backlog remanescente)

> Ver `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` para a lista
> consolidada do que ainda falta. Tópicos principais:
>
> - **DS** (Design System): unificar 4 sistemas, dark mode, contraste acid
> - **NAV**: command palette, breadcrumbs
> - **Ponte com Sistema C** (aulas da arena)
> - **Split de receita / comissão** para aulas em arena parceira
> - **Checkout/gateway** (rateio calculado, pagamento combinado)

---

## 16. Sprint 14 — Wave B: página pública do professor + arena pública (2026-07-27, 16:46)

> Atualizado em **2026-07-27, 16:46 GMT-3** (origin/main @ `5b8395d`).
> Branch `wave/b-coach-public-panel` mergeada como squash em main.
> Atende à lista completa de itens do user (1.1-1.4, 2, 3.1-3.3, 4.1-4.2).

### PR (squash-merge) — feat(coaches+arenas): página pública do professor, painel e arena pública
12 files: 4 criados, 8 modificados (726 insertions, 131 deletions).

#### Página pública do professor (V2CoachProfile)
- **3.1** **Calendário público de disponibilidade** (V2CoachAvailabilityCalendar):
  - 14 dias de slots livres via `generateWeekSlots` (domínio puro)
  - CTA "marcar aula" abre `RequestLessonDialog`
  - CTA "propor horário" pro caso sem agenda publicada
  - Lazy-loaded via `useFeatureFlag(COACH_LESSONS)`
- **3.1** **Seleção de arena no "marcar aula"**: `RequestLessonDialog` com
  dropdown de arenas parceiras ativas. `arena_id` enviado ao `requestLesson`.
  Resumo final inclui o nome da arena escolhida.
- **3.2** **Remove botões de gestão**:
  - ❌ Removidos: Adicionar arena, Gerenciar biblioteca,
    Minha agenda de aulas, Editar meu perfil
  - ✅ Mantido: "Ver perfil de atleta" (não é gestão)
  - ❌ `AddResidencyForm` + função "remover residência": removidas
- **3.3** **Curtir (favorite) + Compartilhar (share)**:
  - Nova coleção `coach_favorites/{uid_coachId}`
  - `firestore.rules`: match /coach_favorites/{favId}
  - `V2FavoriteCoachButton` (Heart) + `V2CoachShareButton`
  - `CoachShareDialog`: card com QR Code, WhatsApp, copiar, download PNG

#### Painel do professor (V2CoachAgenda)
- **4.1** Calendário e funções pertinentes: `AvailabilityEditor` + `LessonCard`
  já existiam. Verificado.
- **4.2** **"Vincular arena"** (que foi retirado da pública):
  - `CoachAddArenaForm`: busca arena por nome/cidade
  - Cria vínculo `pending` (via `useAddCoachResidency`)
  - Botão "Adicionar arena" no `CoachPartnersSection`
  - Texto explicativo: "Você pode ser convidado por uma arena ou
    solicitar a parceria"

#### Página pública da arena (V2ArenaDetail)
- **2** **Lista de quadras** (`ArenaCourtsSection`) com tipo + superfície
  + status — usa `useArenaCourts` (já existia)
- **2** **`price_overrides`** agora exibidos em "Datas especiais" (amber)

#### Persistência (item 1.4)
- `pdvService.listArenaSales / listUserSales / listArenaPayments` usam
  query simples + sort por `created_at_ms` em memória (mesmo padrão
  dos PRs #82/#84 — sem depender de índice composto)

### Métricas finais (Sprint 14)

- **1350 testes verdes** (sem mudança de count)
- **Lint 0 errors**
- **125 feature flags** (sem mudança)
- **66 V2 pages** (sem mudança)
- **93 coleções Firestore** (+1: `coach_favorites`)
- **40 PRs totais**
- **Last SHA**: `5b8395d` (Wave B mergeada em main)
- **Deploy**: em curso via GitHub Actions

### Decisões de arquitetura importantes (Sprint 14)

1. **`coach_favorites/{uid_coachId}`** — id determinístico, mesmo padrão
   de `arena_favorites/{uid_arenaId}`. Read/create/delete só pelo próprio uid.
2. **`V2CoachAvailabilityCalendar` reusa `generateWeekSlots`** (puro,
   testado) + `useCoachAvailability`/`useCoachBusySlots` — sem
   dependência de gestão. Compatível com flag `COACH_LESSONS`.
3. **`V2CoachShareDialog` espelha `ArenaShareDialog`** — mesmo padrão
   de card (QR + WhatsApp + copy + PNG). Lazy-loaded para não impactar
   bundle principal.
4. **Página pública SEM botões de gestão** — toda gestão fica no Painel
   (`/aulas`). Mantém só navegação (Ver perfil de atleta) + interação
   social (Like/Share) + CTA (Solicitar aula).
5. **Professor pode SOLICITAR parceria com arena** (item 4.2) — fluxo:
   professor busca arena → cria `coach_arenas/{coachId_arenaId}` com
   `status: 'pending'` → arena recebe notificação → arena aceita/recusa.
6. **`pdvService` em memória** — vendas/pagamentos agora usam query
   simples + sort por `created_at_ms` em memória. Padrão consistente
   com PRs #82 e #84.

### Próximo (Sprint 15+ — backlog remanescente)

> Ver `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` para a lista
> consolidada do que ainda falta. Tópicos principais:
>
> - **DS** (Design System): unificar 4 sistemas, dark mode, contraste acid
> - **NAV**: command palette, breadcrumbs
> - **Ponte com Sistema C** (aulas da arena)
> - **Split de receita / comissão** para aulas em arena parceira
> - **Checkout/gateway** (rateio calculado, pagamento combinado)

---

## 17. Sprint 15 — Wave C: lançar resultados de dias de jogo no ranking (2026-07-27, 20:30)

> Atualizado em **2026-07-27, 20:30 GMT-3** (origin/main @ `d5694a6`).
> Branch `wave/c-ranking-game-days` mergeada como squash em main.
> Atende à solicitação do user: "dentro de clubes, em 'dias de jogo',
> o criador do evento (e admins do clube) podem LIGAR uma chave para
> lançar os resultados no ranking da plataforma e no histórico dos
> atletas. Por padrão desligada. Apenas jogos com resultados lançados
> entram no ranking."

### PR (squash-merge) — feat(clubs+rating): lançar resultados de dias de jogo no ranking nacional
11 files: 4 novos, 7 modificados. 22 testes novos.

#### Modelo de dados
- Nova coleção `club_event_games/{eventId_dateId_gameId}` (id determinístico)
  com schema espelhado de `tournament_matches` + campos extras:
  - `source: 'club_event_game'`, `event_id`, `date_id`, `club_id`,
    `event_title`, `game_id`, `published_by`
  - `side_a_ids`/`side_b_ids` são **uids** (não passam por
    `tournament_registrations`)
  - `status: 'finished'`, `winner_side`, `score_a`/`score_b`, `kind`
- `club_events/{id}/dates/{dateId}.publish_to_ranking: bool` (default
  false) + `published_at`, `published_by`, `published_count`,
  `unpublished_at`, `unpublished_by`, `last_publish_summary`

#### firestore.rules (novo bloco + helper)
- `match /club_event_games/{gameId}`:
  - `allow read: if true` (faz parte do ranking público)
  - `create/update/delete`: só criador do evento + admin do clube +
    platform admin; validação de schema (singles 1×1 / doubles 2×2)
  - `event_id`/`date_id`/`club_id` imutáveis
- `function isClubEventCreator(eventId)` — checa `created_by` no
  documento `club_events/{id}`

#### Domínio puro (19 testes)
- `src/modules/clubs/domain/rankingPublishing.js`:
  - `isGameDecided` (rejeita null/undefined/empate)
  - `winnerSideOf` ('a' ou 'b')
  - `inferKind` (singles vs doubles)
  - `resolveSideUids` (filtra guests sem user_id)
  - `buildPublishableMatch` (monta payload respeitando schema)
  - `buildPublishableMatches` (idempotente: toWrite + toRemove +
    contadores `published`/`skipped`/`already_published`/`removed`)
  - `summarizeResult` (rótulos legíveis)
- 19 testes unitários cobrindo decidido/empate/null/guest/tamanhos
  diferentes/singles/doubles/idempotência

#### Service
- `src/modules/clubs/services/rankingPublishingService.js`:
  - `publishEventDateToRanking(event, dateId, clubId, actor)`:
    1. Lê evento + data + participants + games
    2. Resolve `publishedIds` atuais (idempotência)
    3. Calcula `toWrite`/`toRemove` via domínio puro
    4. Aplica batch no Firestore
    5. Marca o dia com `publish_to_ranking: true` + auditoria
    6. Aciona `maybeAutoRecomputeRatings({ force: true })` best-effort
    7. Audit log `club_event_date_published_to_ranking`
  - `unpublishEventDateFromRanking` (operação simétrica)
  - `getEventDateRankingMeta`, `listPublishedGamesForDate`,
    `clearPublishedGamesForDate`

#### Hooks (React Query)
- `useEventDateRankingMeta(eventId, dateId)` — meta + `publishedIds`
- `usePublishedGamesForDate(eventId, dateId)`
- `usePublishEventDateToRanking(event, clubId)` — invalida caches
  relevantes (event-dates, club-game-results, national-ranking, etc.)
- `useUnpublishEventDateFromRanking(event, clubId)` — simétrico

#### Motor de rating
- `recomputeAllRatings` em `src/modules/rating/services/ratingService.js`:
  - Agora lê AMBAS as coleções em paralelo:
    - `tournament_matches` (filtro de torneio público+encerrado,
      mantido)
    - `club_event_games` (Wave C — sem filtro, sempre conta)
  - Matches de `club_event_game` processados em **4b** com
    `side_a_ids`/`side_b_ids` já como uids (não passam por
    `tournament_registrations`)
  - Audit log inclui `club_event_matches_total`
- 3 testes do motor ELO cobrindo match de club_event_game
  (sem tournament_id) + mistura com torneio + match sem winner

#### UI
- `src/modules/clubs/components/PublishToRankingToggle.jsx` (NOVO):
  - Switch "Lançar resultados no ranking" — renderizado **dentro do
    `GameDayOrganizer`**, na mesma seção da organização de jogos
    (logo após a lista de jogos do dia, com o resumo de
    decididos/eligíveis/com-guest).
  - Visível SÓ para criador do evento + admin do clube
    (computado dentro do `GameDayOrganizer` via `useAuth` +
    `useMyMembership` + `event.created_by`).
  - Tooltip + texto: "apenas jogos com resultados lançados entram
    no ranking".
  - Botão "Republicar" (idempotente) + ConfirmDialog para despublicar.
  - Badge "resultados deste dia estão no ranking nacional" para
    visualizadores (não-managers) quando ativo.
- `GameDayOrganizer.jsx`: agora computa `canManage` internamente
  (criador + admin) e renderiza o `PublishToRankingToggle` na
  mesma seção da organização de jogos.
- `EventDatesPanel.jsx`: aba "Jogos" do DateCard agora renderiza só
  o `GameDayOrganizer` (o toggle vive dentro dele, mesma seção).

#### Limpeza
- `clearGameDayData` em `clubService.js` agora também chama
  `clearPublishedGamesForDate` — quando o dia de jogo é excluído, os
  espelhamentos no ranking também são removidos (consistência
  garantida)

### Métricas finais (Sprint 15)

- **1372 testes verdes** (+22 do Wave C)
- **Lint 0 errors**
- **94 coleções Firestore** (+1: `club_event_games`)
- **41 PRs totais**
- **Last SHA**: `d5694a6` (Wave C mergeada em main)
- **Deploy**: em curso via GitHub Actions

### Decisões de arquitetura importantes (Sprint 15)

1. **D-CRIADOR+ADMIN-DEVEM-LIGAR-CHAVE (Wave C)**: a chave
   `publish_to_ranking` é **OFF por padrão**. Só o criador do evento
   OU admins do clube podem LIGAR/DESLIGAR. O platform admin tem
   poder de override.
2. **D-OPT-IN-POR-DIA-DE-JOGO (Wave C)**: cada `date_id` (dia de
   jogo) tem sua própria chave. Um evento pode ter vários dias;
   cada dia é publicado/despublicado independentemente.
3. **D-ID-DETERMINISTICO-IDEMPOTENTE (Wave C)**: id
   `${eventId}_${dateId}_${gameId}` garante idempotência. Re-rodar a
   publicação não duplica; jogos removidos do dia também saem do
   ranking.
4. **D-SOMENTE-JOGOS-DECIDIDOS (Wave C)**: placar definido, lados 1×1
   ou 2×2, todos os jogadores com `user_id` válido. Outros casos são
   pulados (não bloqueiam a publicação; são apenas ignorados).
5. **D-RECALCULO-AUTOMATICO-AFTER-PUBLISH (Wave C)**:
   `maybeAutoRecomputeRatings(actor, { force: true })` é chamado
   após publish/unpublish (best-effort; falhas são logadas).
6. **D-LIMPEZA-TRANSACIONAL (Wave C)**: `clearGameDayData` (chamado
   ao excluir um dia de jogo) também remove os espelhamentos no
   ranking, evitando "fantasmas" no histórico dos atletas.

### Próximo (Sprint 16+ — backlog remanescente)

> Ver `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` para a lista
> consolidada do que ainda falta. Tópicos principais:
>
> - **DS** (Design System): unificar 4 sistemas, dark mode, contraste acid
> - **NAV**: command palette, breadcrumbs
> - **Wave D**: Sistema C (aulas da arena) — integração com Sistema A
> - **Wave E**: Split de receita / comissão para aulas em arena parceira
> - **Wave F**: Checkout/gateway (rateio calculado, pagamento combinado)

### Wave C.1 (2026-07-27, 23:55) — reposicionamento do switch

> Ajuste de UX solicitado pelo user. Branch `wave/c-ranking-toggle-position`
> mergeada em main como `c939e17`.

**O que mudou:**
- O switch "Lançar resultados no ranking" foi movido para **dentro
  do `GameDayOrganizer`** (mesma seção da organização de jogos),
  abaixo da lista de jogos do dia. Antes ficava em uma seção
  separada dentro da aba "Jogos" do DateCard.
- `GameDayOrganizer.jsx` agora computa `canManage` internamente
  (`useAuth` + `useMyMembership` + `event.created_by`) — sem
  precisar receber via prop.
- `EventDatesPanel.jsx`: removidos imports/variáveis órfãs
  (`canManage`, `dateParticipants`, `isCreator`, `isAdmin`,
  `useMyMembership`, `useEventParticipants`,
  `PublishToRankingToggle`).

**Arquivos:** 2 (`GameDayOrganizer.jsx`, `EventDatesPanel.jsx`).
**Testes:** 1372 (sem mudança de count).
**Build:** OK.

---

## 18. Sprint 16 — Wave C.2: ranking interno do clube em duplas (2026-07-28, 14:25)

> Atualizado em **2026-07-28, 14:25 GMT-3** (origin/main @ `9001509`).
> Branch `wave/c-club-doubles-ranking` mergeada como squash em main.
> Atende à solicitação: "dentro de clubes, além do ranking individual
> baseado em dias de jogos, ter também o ranking em dupla. Na parte de
> ranking do clube deve ter duas sub-abas (individual | duplas). Ter um
> botão que faça incorporar ao ranking interno as informações de
> resultados de atletas e duplas do clube em torneios e outros dias de
> jogos criados fora do clube."

### PR (squash-merge) — feat(clubs+rating): ranking interno em DUPLAS no clube + agregação de fontes externas
5 files: 4 novos, 1 modificado. 13 testes novos.

#### Domínio (puro, 13 testes)
- `src/modules/clubs/domain/clubRankingSources.js`:
  - `flattenSideToUids` (extrai `user_id` de objetos ou mantém strings)
  - `normalizeMatch` (aceita `side_a_ids`/`side_b_ids` OU
    `side_a`/`side_b` como objetos; infere `winner` pelo placar se
    ausente)
  - `normalizeAllSources` (combina `clubGames` + `clubEventGames` +
    `tournamentMatches`)
  - `filterMatchesForClub` (mantém só matches com pelo menos um uid
    do clube; flags `includeClub`/`includeExternal`; descarta sem
    vencedor decidido; dedup por id)
  - `summarizeSources` (contadores `club`, `external`, `doubles`,
    `singles`)

#### Service (com I/O)
- `src/modules/clubs/services/clubInternalRankingService.js`:
  - `listClubAthleteUids(clubId)` — união de membros + atletas que
    declaram o clube em `athlete_profiles.club_ids`
  - `fetchClubGames` — subcoleção `games` de cada evento do clube
  - `fetchClubEventGamesForClub` — `club_event_games` do clube
  - `fetchExternalClubEventGames` — `club_event_games` de outros
    clubes (chunked 30, `array-contains-any` em `side_a_ids`/`side_b_ids`)
  - `fetchExternalTournamentMatches` — `tournament_matches` finalizados
    com uids do clube (chunked 30)
  - `fetchClubInternalRankingSources(clubId, { includeExternal })`
    — orquestra tudo em paralelo

#### Hook (React Query)
- `useClubInternalRanking(clubId, { includeExternal })`:
  - Retorna `{ sources, clubUids, matches, individual, doubles }`
  - Individual via `computeClubRanking` (do `clubRanking.js`)
  - Doubles via `computeDoublesRanking` (reusado do ranking nacional)
  - Cache 60s; depende de `includeExternal` e `user.uid`

#### Feature flag
- `CLUB_INTERNAL_DOUBLES_RANKING` (padrão ON; depende de
  `CLUB_INTERNAL_RANKING`). Descrita em `src/core/featureFlags.js`.

#### UI (`V2ClubDetail.jsx`, `ClubRankingTab`)
- **Sub-abas** `Individual` | `Duplas` (User/Users2 icons).
- **Toggle "Incluir resultados externos"** (SÓ admins do clube):
  - Default OFF (escopo só do clube).
  - Quando ON, considera também `tournament_matches` +
    `club_event_games` de outros clubes.
- **Badges** no header da tab:
  - `N atletas do clube` (cinza)
  - `N jogo(s) do clube` (verde)
  - `N externo(s)` (amber, só quando o toggle está ON)
- **Tabela de duplas** mostra os 2 atletas da parceria (com
  `V2Avatar`).
- Subcomponentes extraídos: `IndividualRankingTable`,
  `DoublesRankingTable`, `ExternalToggle`, `PairMembers`,
  `useAllAthletesSafe`.

### Métricas finais (Sprint 16)

- **1385 testes verdes** (+13 do Wave C.2)
- **Lint 0 errors**
- **94 coleções** (sem mudança)
- **126 feature flags** (+1: `CLUB_INTERNAL_DOUBLES_RANKING`)
- **42 PRs totais** (Sprints 0-16)
- **Last SHA**: `9001509`
- **Deploy**: em curso via GitHub Actions

### Decisões de arquitetura (Sprint 16)

1. **D-RANKING-DUPLAS-REUSA-MOTOR-NACIONAL (Wave C.2)**: o ranking
   de duplas do clube reusa o `computeDoublesRanking` (do
   `doublesRanking.js`, mesmo motor do ranking nacional) — uma única
   implementação para "parceria com mais vitórias".
2. **D-TOGGLE-EXTERNOS-SÓ-ADMIN (Wave C.2)**: o toggle
   "Incluir resultados externos" é SÓ visível para admins do clube.
   Default OFF. Não é exposto na home.
3. **D-CHUNKED-30-PARA-FONTES-EXTERNAS (Wave C.2)**:
   `array-contains-any` aceita no máximo 30 uids por query. O
   service particiona em chunks. Para clubes com mais de 30 atletas
   faz N queries em paralelo. Defensivo contra coleções grandes.
4. **D-UPSERT-DOUBLE-RANKING-DEDUP (Wave C.2)**: `filterMatchesForClub`
   dedup por `id` defensivo (mesmo jogo chegando por 2 fontes).
5. **D-NORMALIZACAO-DUAL-FORMAT (Wave C.2)**: `normalizeMatch` aceita
   o formato do `tournament_matches`/`club_event_games` (lados como
   `side_a_ids`/`side_b_ids`) E o formato do `gameDayOrganizer`
   (lados como objetos `{id, name, user_id}`). Infere `winner` pelo
   placar se `winner_side` ausente (formato do organizador).

---

## 19. Sprint 17 — Wave C.3: ranking interno do clube materializado (2026-07-28, 15:30)

> Atualizado em **2026-07-28, 15:30 GMT-3** (origin/main @ `b4f4d5a`).
> Branch `wave/c-club-ranking-materialized` mergeada como squash em main.
> Atende à solicitação: "todos esses cálculos sempre devem ser
> automáticos, assim que um resultado é lançado na plataforma, o cálculo
> deve ser realizado dentro do banco de dados. O frontende deve apenas
> mostrar o cálculo que já existe no banco de dados. Pense na estrutura
> técnica mais adequada para a plataforma, de modo que não haja
> latência e que a utilização por múltiplos usuários seja facilitada
> ao máximo."

### PR (squash-merge) — feat(clubs+rating): ranking interno materializado no Firestore
9 files: 4 novos, 4 modificados, 1 substituído. **5 Cloud Functions + 2 callable**.

### Arquitetura — materialização server-side

**4 coleções top-level** materializadas pelo Cloud Function:

| Coleção | Escopo | Conteúdo |
|---|---|---|
| `club_internal_ratings/{clubId_userId}` | Só clube | Individual |
| `club_internal_ratings_ext/{clubId_userId}` | Com externos | Individual |
| `club_internal_doubles_ratings/{clubId_pairKey}` | Só clube | Duplas |
| `club_internal_doubles_ratings_ext/{clubId_pairKey}` | Com externos | Duplas |

Cada documento tem: `display_name`, `photo_url`, `games`, `wins`,
`losses`, `points_for`, `points_against`, `points_balance`,
`win_rate`, `scope`, `updated_at`.

**Toggle "Incluir resultados externos" no frontend = trocar a
coleção lida**. Zero cálculo client-side.

### Cloud Functions (`functions/clubRanking.js`)

**`recomputeClubInternalRankings(db, clubId)`** — pipeline completo:
1. Carrega `club_members` + `athlete_profiles` + `club_events` (com subcoleção `games`).
2. Carrega `club_event_games` (próprio + de outros clubes) + `tournament_matches` (chunked 30).
3. Resolve registrations → uids.
4. Normaliza matches (4 normalizadores puros).
5. Aplica `applyToIndividual` + `applyToDoubles` para 2 escopos (internal, ext).
6 Enriquece com `display_name`/`photo_url` via profiles.
7. Ordena (`sortIndividual`/`sortDoubles`).
8. Escreve materializado em batch (substitui o conjunto anterior).

**Pure helpers** (testáveis manualmente): `pairKey`, `normalizeClubGame`,
`normalizeClubEventGame`, `normalizeTournamentMatch`, `sideToUids`,
`applyToIndividual`, `applyToDoubles`, `filterMatchesForClub`,
`sortIndividual`, `sortDoubles`, `enrichWithProfiles`.

### Handlers (`functions/index.js`)

**5 gatilhos (onDocumentWritten):**
1. `recomputeClubRankingOnClubGame`: `club_events/{id}/games/{id}`
2. `recomputeClubRankingOnClubEventGame`: `club_event_games/{id}` (afeta dono + clubes externos)
3. `recomputeClubRankingOnTournamentMatch`: `tournament_matches/{id}` (resolve registration → uids → clubes)
4. `recomputeClubRankingOnMemberChange`: `club_members/{id}`
5. `recomputeClubRankingOnAthleteProfileChange`: `athlete_profiles/{id}` (quando `club_ids` muda)

**2 callable (admin):**
1. `recomputeAllClubInternalRankings({})` — só `platform_admin` (backfill total)
2. `recomputeOneClubInternalRanking({ clubId })` — admin do clube ou `platform_admin`

### Firestore Rules

```js
match /club_internal_ratings/{docId} {
  allow read: if true;
  allow write: if isAuthed() && (
    isPlatformAdmin()
    || (resource != null && isClubAdmin(resource.data.club_id))
    || (request.resource != null && isClubAdmin(request.resource.data.club_id))
  );
}
// (mesma estrutura para _ext, _doubles_, _doubles_ext)
```

### Frontend

**`useClubInternalRanking`** (reescrito) — **só LÊ**:
- `getDocs(query(collection(db, 'club_internal_ratings'), where('club_id', '==', clubId), orderBy('wins', 'desc')))`
- Toggle = troca para `_ext`.
- Resolve profiles defensivos para nomes/fotos faltantes.
- Cache 30s (mais agressivo que Wave C.2 — ranking pode ter sido atualizado).

**`useClubRankingAdmin`** (NOVO):
- `useRecomputeAllClubRankings` (platform admin)
- `useRecomputeOneClubRanking` (admin clube ou platform admin)

**`V2ClubDetail.jsx`**:
- `ClubRankingTab` lê `r.name` e `r.members` do materializado.
- `PairMembers` usa `members` (já vem com nome/foto do server).
- Removidos imports/useAllAthletesSafe orfãos + `PairMembers` que dependia de cache local.

### Bug fix (nome)

Wave C.2: ranking individual mostrava `uid` em vez do nome (porque o
cálculo client-side construía objetos com `name: uid` literal).
Wave C.3: `display_name` e `photo_url` desnormalizados no documento
materializado, no servidor. **Bug resolvido na arquitetura**.

### Limpeza

Removidos (Wave C.2, substituídos):
- `src/modules/clubs/services/clubInternalRankingService.js`
- `src/modules/clubs/domain/clubRankingSources.js`
- `src/modules/clubs/domain/clubRankingSources.test.js`

### Métricas finais (Sprint 17)

- **1372 testes verdes** (mantidos; os 13 do Wave C.2 foram removidos com o service orfão)
- **Lint 0 errors**
- **98 coleções Firestore** (+4)
- **126 feature flags** (sem mudança)
- **7 Cloud Functions** (5 gatilhos + 2 callable)
- **43 PRs totais** (Sprints 0-17)
- **Last SHA**: `b4f4d5a`
- **Deploy**: em curso via GitHub Actions

### Decisões de arquitetura (Sprint 17)

1. **D-RANKING-CLUBE-MATERIALIZADO-SERVER-SIDE (Wave C.3)**: o
   cálculo de ranking é feito exclusivamente no Cloud Function.
   Frontend **só lê**. Sem latência, sem inconsistência, sem
   custo de CPU cliente.
2. **D-4-COLECOES-POR-ESCOPO (Wave C.3)**: cada clube tem 4
   coleções materializadas (individual/doubles × internal/ext).
   O toggle muda APENAS qual coleção ler.
3. **D-5-GATILHOS-1-POR-ORIGEM (Wave C.3)**: cada origem de
   resultado (game do clube, Wave C, torneio, member, profile)
   tem seu próprio onDocumentWritten, recalculando apenas o(s)
   clube(s) afetado(s).
4. **D-CHUNKED-30-PARA-RESOLUCAO-EXTERNA (Wave C.3)**:
   `array-contains-any` aceita no máximo 30 uids por query.
   O Cloud Function particiona em chunks.
5. **D-SERVICE-ACCOUNT-IGNORA-REGRAS (Wave C.3)**: o Cloud
   Function escreve com service account (admin SDK), que
   ignora as regras do Firestore. As regras (`isPlatformAdmin()`
   OU `isClubAdmin()`) cobrem o caso de **escrita manual** via
   app.
6. **D-CALLABLE-PARA-BACKFILL (Wave C.3)**:
   `recomputeAllClubInternalRankings` para o admin master
   disparar o recálculo de todos os clubes (cold start, correção,
   etc.). `recomputeOneClubInternalRanking` para admin do clube
   (correção local).

---

## 20. Sprint 18 — Wave C.4: filtro de clube + backfill do materializado (2026-07-28, 19:15)

> Atualizado em **2026-07-28, 19:15 GMT-3** (origin/main @ `0a501e9`).
> Branch `wave/c-club-ranking-backfill` mergeada como squash em main.
> Atende à reclamação: o filtro de clube do ranking nacional não
> listava nenhum clube; o ranking interno do clube mostrava "0
> atletas do clube" mesmo com 16 membros; e não havia CTA para
> materializar o ranking legado.

### PR (squash-merge) — fix(clubs+rating): filtro + backfill + UX
6 files: 5 modificados + 1 workflow. 0 testes novos (mudança cirúrgica).

### Problema 1 — Filtro de clube no ranking nacional

**Sintoma:** dropdown "Todos os clubes" não listava nenhum clube.

**Causa:** `clubOptions` era derivado **apenas** de `player_ratings`
(que tem `clubs` denormalizado por atleta). Atletas que nunca
sincronizaram o `clubs` no perfil apareciam sem clube no filtro.

**Fix:** `useClubs()` carrega o diretório oficial de clubes (sempre
completo) e mescla com os denormalizados para nomes. Ordenado por
nome.

### Problema 2 — "0 atletas do clube" no ranking interno

**Sintoma:** o badge "0 atletas do clube" aparecia mesmo para um
clube com 16 membros.

**Causa:** o hook `useClubInternalRanking` derivava `clubUids` da
lista de documentos materializados — que estavam VAZIOS para todos
os clubes criados antes da Wave C.3 (o materializado nunca tinha
sido populado para dados legados).

**Fix:** `loadClubUids(clubId)` lê **diretamente** `club_members` +
`athlete_profiles` (com `club_ids array-contains`), e retorna a
contagem REAL de atletas do clube. O badge agora reflete a realidade
do clube, não o estado do materializado.

### Problema 3 — "Sem ranking ainda" sem CTA

**Sintoma:** o ranking interno ficava vazio sem nenhuma ação
disponível para popular.

**Causa:** a Wave C.3 trocou o cálculo client-side por leitura
materializada. Para dados LEGADOS (pré-Wave C.3), o materializado
nunca foi populado. Sem Cloud Function deployada, sem backfill, sem
UI para disparar.

**Fix (defesa em profundidade, 4 caminhos):**

1. **Cloud Function mensal** `recomputeAllClubsMonthly`
   (`0 4 1 * *`, 1º dia de cada mês às 4h) — recalcula **TODOS os
   clubes** automaticamente, sem depender de ninguém.
2. **Botão "Recalcular rankings de todos os clubes"** no
   `AdminMetrics` (platform admin) — backfill manual.
3. **Botão "Materializar ranking agora"** no `ClubRankingTab`
   (admin do clube) + CTA no empty state — backfill local.
4. **Workflow de deploy** `.github/workflows/deploy-firebase.yml`
   adiciona passo "Backfill club internal rankings" (informativo:
   documenta o caminho).

### Mudanças por arquivo

| Arquivo | Mudança |
|---|---|
| `src/modules/rating/pages/NationalRanking.jsx` | `useClubs()` + merge com denormalizados |
| `src/modules/clubs/hooks/useClubInternalRanking.js` | `loadClubUids(clubId)` + `totalClubMembers` |
| `src/v2/pages/V2ClubDetail.jsx` | Botão "Materializar ranking agora" no header + empty state |
| `src/modules/admin/pages/AdminMetrics.jsx` | Panel "Ranking interno dos clubes" com botão de backfill |
| `functions/index.js` | `recomputeAllClubsMonthly` (schedule mensal) |
| `.github/workflows/deploy-firebase.yml` | Passo "Backfill club internal rankings" |

### Métricas finais (Sprint 18)

- **1372 testes verdes** (sem mudança)
- **Lint 0 errors**
- **98 coleções** (sem mudança)
- **126 feature flags** (sem mudança)
- **8 Cloud Functions** (5 ranking clube + 2 callable admin + 1 schedule mensal)
- **44 PRs totais** (Sprints 0-18)
- **Last SHA**: `0a501e9`
- **Deploy**: em curso via GitHub Actions

### Decisões de arquitetura (Sprint 18)

1. **D-CLUBE-UIDS-DO-DIRETORIO (Wave C.4)**: o badge "N atletas do
   clube" reflete o estado real do clube (membros + perfis com
   `club_ids`), não o materializado. Mostra a verdade do banco.
2. **D-FILTRO-CLUBES-DO-DIRETORIO (Wave C.4)**: o filtro de clube
   no ranking nacional usa `useClubs()` (diretório), não o
   denormalizado em `player_ratings`.
3. **D-BACKFILL-DEFESA-EM-PROFUNDIDADE (Wave C.4)**: 4 caminhos
   para garantir que o materializado está populado (schedule
   mensal, callable admin, botão no clube, passo no deploy).
   Nenhum caminho é o único caminho.
4. **D-CLOUD-FUNCTION-MENSAL-PROTECTORA (Wave C.4)**:
   `recomputeAllClubsMonthly` no dia 1 às 4h garante que o sistema
   **se auto-cura** mesmo sem interação humana.

---

## 21. Sprint 19 — Wave C.5: corrigir materialização + Painel Admin V2 (2026-07-28, 19:50)

> Atualizado em **2026-07-28, 19:50 GMT-3** (origin/main @ `25bf67a`).
> Branch `wave/c-club-ranking-fix` mergeada como squash em main.
> 9 files, 470+/97-. 5 testes novos.

### Diagnóstico (a partir de feedback do user)

A Wave C.4 tinha o botão "Recalcular rankings de todos os clubes" em
`AdminMetrics.jsx` (arquivo legado, não roteado), e o "Materializar
ranking agora" dava **erro 500**. Investigação revelou 3 bugs reais
no materializado server-side, não cobertos pelos testes existentes
(que só validavam a lógica client-side).

### Bug #1 (CRÍTICO) — user_id undefined no materializado

**Sintoma:** o painel "0 atletas do clube" mostrava 0 mesmo com
membros. A causa: `applyToIndividual()` no `functions/clubRanking.js`
não setava `user_id` no row criado. Resultado: o doc materializado
era `{clubId}_undefined` com `user_id: undefined`.

**Causa raiz:** a linha 196 (e 204) fazia:
```js
const row = bucket.get(uid) || { games: 0, ... };
```
Sem `user_id`. O doc só era identificável por `__name__` (o docId
incluía `undefined` no final). O `enrichWithProfiles` não encontrava
o uid e o ranking ficava com 0 atletas para o clube.

**Fix:** `user_id: uid` no row default, e re-setado após `bucket.get`
para garantir mesmo se vier de cache.

### Bug #2 — tournament_match nunca era "do clube"

**Sintoma:** torneios privados do clube (Wave B) — onde todos os
atletas são do clube — não contavam para o ranking interno.

**Causa raiz:** o pipeline filtrava `is_club=true` para o escopo
'internal', mas `tournament_match` não tinha `club_id`. O `match`
em si não tem como saber o `club_id` do torneio.

**Fix:** novo `loadTournaments()` (chunks de 30) carrega `tournaments/`
e resolve `tournament.club_id`. Match de torneio 'do clube' →
`is_club=true` → conta no escopo interno. Torneios públicos
continuam sendo 'ext' (só contam se admin ligar "Incluir resultados
externos").

### Bug #3 — callable rejeitava platform_admin sem custom claim

**Sintoma:** "Materializar ranking agora" dava erro 500.

**Causa raiz:** `recomputeOneClubInternalRanking` checava
`req.auth.token.platform_admin`, mas o Fsa tem `role: 'platform_admin'`
no Firestore (`users/{uid}`), **NÃO** no custom claim do Firebase Auth.

**Fix:** nova função `isPlatformAdminUser(req, db)`:
1. Custom claim (rápido) — `req.auth.token.platform_admin`.
2. Fallback no Firestore — `users/{uid}.role === 'platform_admin'`.

### Bug #4 — botão do admin não estava no Painel

**Sintoma:** user não achava o botão. Estava em `AdminMetrics.jsx`
legado, não roteado.

**Fix:** novo componente **`ClubRankingBackfillPanel`** em
`src/modules/admin/components/`, usado em:
- `V2AdminConsole` (aba "Visão geral", depois do QuickActions)
- `V2AdminMetrics` (`/admin/metricas`, entre Ratings e FeatureFlags)

Mostra: 3 cards (clubes / materializados / vazios), botão de
backfill total com confirm, lista granular por clube com
botão "Recalcular" individual. O `ClubRankingPanel` legado foi
removido (evita confusão).

### Bug #5 — handleAdminRecompute engolia erro

**Sintoma:** "Materializar ranking agora" mostrava "Não foi possível
recalcular." sem detalhes.

**Fix:** extrai `err.details` (do `httpsCallable`), `console.error`
para debug, mostra mensagem útil no toast.

### Decisões D- (Wave C.5)

1. **D-USER-ID-FIRST-CLASS-FIELD (Wave C.5)**: `user_id` é um
   campo de primeira classe em cada row, setado no momento da
   criação e re-setado após `bucket.get`. Defensivo.
2. **D-TORNEIO-DO-CLUBE-CLUB-ID (Wave C.5)**: o `tournament.club_id`
   é a fonte de verdade para "torneio do clube". Match herda
   `is_club = (tournament.club_id === this clubId)`.
3. **D-PLATFORM-ADMIN-CUSTOM-CLAIM-OR-DOC (Wave C.5)**: callable
   aceita `platform_admin` por custom claim OU por `users.role`.
   Custom claim é checado primeiro (rápido), Firestore é fallback
   (compatibilidade).
4. **D-PAINEL-ADMIN-V2-EH-A-CASA (Wave C.5)**: ferramentas de admin
   moram em `V2AdminConsole` (hub) **E** `V2AdminMetrics` (página
   dedicada). Arquivos legados (`AdminMetrics.jsx`) sem rota são
   removidos quando migrados, para evitar confusão.
5. **D-BACKFILL-DEFAULT-ON (Wave C.5)**: `CLUB_INTERNAL_BACKFILL`
   nasce **ON** quando `CLUB_INTERNAL_RANKING` está ON. O painel
   é onde o admin master SEMPRE vai quando precisa de backfill.

### Métricas finais (Sprint 19)

- **1377 testes verdes** (+5 novos)
- **0 lint errors**
- **98 coleções** (sem mudança)
- **127 feature flags** (+CLUB_INTERNAL_BACKFILL)
- **8 Cloud Functions** (sem mudança)
- **45 PRs totais** (Sprints 0-19)
- **Last SHA**: `25bf67a`
- **Deploy**: em curso via GitHub Actions

---

## 22. Sprint 20 — Wave C.6: BUG RAIZ do materializado (2026-07-28, 20:10)

> Atualizado em **2026-07-28, 20:10 GMT-3** (origin/main @ `82cecc0`).
> Branch `wave/c6-diagnose` mergeada como squash em main.
> 4 files, 272+/12-. 10 testes novos.

### Diagnóstico (a partir de feedback do user)

> "Antes de eu falar sobre o botão de incluir resultados externos o
> ranking dos clubes funcionava e tinha dados reais. Você conseguiu
> estragar e não está conseguindo arrumar."

Investigação estática do pipeline revelou **BUG RAIZ** latente desde
o `gameDayOrganizer`, que ficou visível com a materialização (Wave C.3).

### O bug

O `GameDayOrganizer` salva `side_a`/`side_b` em
`club_events/{eventId}/games/{gameId}` como objetos `{ id, name }`,
onde `id` é o **doc_id de `event_participants`**, NÃO o `user_id`
do atleta.

A Cloud Function `sideToUids` (em `functions/clubRanking.js`) recebia
esses objetos e retornava `p.id` (doc_id) — nunca o user_id real.

```js
// ANTES (errado)
function sideToUids(side) {
  return side.map((p) => p.user_id || p.id).filter(Boolean);
  //           ^^^^^^^^^^^^^^^^^^^^^^^^
  //           p.id é doc_id de event_participant, não user_id!
}
```

**Resultado**: o materializado (`club_internal_ratings`) ficava
agregado por chaves que **NÃO** correspondiam a:
- `club_members.user_id` (para filtrar por clube)
- `athlete_profiles/{uid}` (para resolver nomes)
- `users/{uid}` (para autenticação)

→ "0 atletas do clube" mesmo com 16 membros.
→ Ranking materializado sempre VAZIO para clubes com game day organizer.

### Por que ficou visível agora

- **Antes da Wave C.3** (cálculo client-side): o cliente também
  usava o mesmo `p.id` — a UI mostrava os nomes do `name` salvo no
  doc, dando a **impressão de funcionar** (mas as estatísticas
  estavam atribuídas a chaves erradas).
- **Depois da Wave C.3** (materializado): o cálculo server-side
  tentou agregar por `user_id` (para depois cruzar com
  `club_members.user_id`), mas o input era `doc_id`. O materializado
  ficou com chaves "doc_id" que **não batem** com `user_id` de ninguém.

### Fix (Wave C.6)

#### Server-side (`functions/clubRanking.js`)

`sideToUids(side, participantById)` agora aceita um mapa
`eventParticipantDocId → event_participant` (que tem `user_id`):

```js
function sideToUids(side, participantById) {
  return side.map((p) => {
    if (typeof p === 'string') return p;
    if (p.user_id) return p.user_id;          // schema novo
    if (p.id && participantById) {             // schema legado
      const ep = participantById.get(p.id);
      if (ep && ep.user_id) return ep.user_id;
    }
    return null; // convidado sem user_id é pulado
  }).filter(Boolean);
}
```

Nova função `loadEventParticipantsMap(db, events)` carrega os
participants de cada evento do clube e constrói o mapa. Pipeline
chama o normalizador com o mapa.

#### Client-side (`GameDayOrganizer` + `sanitizeGameSide`)

Para dados NOVOS, salva `user_id` (além de `id` e `name`):

```js
// GameDayOrganizer.handleDraw
side_a: g.side_a.map((id) => {
  const p = participantById.get(id);
  return { id, name: p?.name, user_id: p?.user_id || null };
})
```

Schema novo funciona no server-side **sem** precisar do mapa.

### Validação contra cenário do Pickleholics

- 16 membros
- 1 evento com 4 participants (1 convidado)
- 1 jogo decidido (Fsa+João 11×5 Maria+Pedro)
- **Antes**: materializado com 0 atletas (doc_ids não correspondem)
- **Depois**: materializado com 4 atletas + stats corretas

### Métricas finais (Sprint 20)

- **1387 testes verdes** (+10 novos)
- **0 lint errors**
- **98 coleções** (sem mudança)
- **127 feature flags** (sem mudança)
- **8 Cloud Functions** (sem mudança)
- **46 PRs totais** (Sprints 0-20)
- **Last SHA**: `82cecc0`
- **Deploy**: em curso via GitHub Actions

### Decisões D- (Wave C.6)

1. **D-USER-ID-NO-SCHEMA (Wave C.6)**: o documento do game DEVE
   ter `user_id` no `side_a`/`side_b`, não só `id` (que é doc_id
   de event_participant). Schema legado é aceito com fallback
   server-side via `participantById`.
2. **D-CONVIDADO-FORA-DO-RANKING (Wave C.6)**: participantes sem
   `user_id` (convidados) são pulados do ranking. Não há uid real
   para agregar, então é justo ignorar.
3. **D-PIPELINE-LEVA-MAPA (Wave C.6)**: o normalizador de
   `club_events/.../games` recebe o mapa de participants como
   parâmetro. Pipeline carrega o mapa uma vez por clube e
   reusa em todos os games.
4. **D-TESTES-DE-REGRESSAO (Wave C.6)**: cada bug do materializado
   agora tem teste de regressão explícito ("sem participantById,
   materializado fica VAZIO"). Impede regressões futuras.

---

## 23. Sprint 21 — Wave C.6.1: índices compostos no Firestore (2026-07-29, 05:25)

> Atualizado em **2026-07-29, 05:25 GMT-3** (origin/main @ `d7a3103`).
> Branch — commit direto em main (fix mínimo, sem nova branch).
> 2 files: 1 JSON + 1 doc (useClubInternalRanking).

### Diagnóstico (a partir de feedback do user)

> "Qual é o problema. Até agora há pouco estava funcionando. Leia as
> mensagens de hoje e veja o que ocorreu."

O user ainda via "0 atletas do clube, sem ranking" no Pickleholics
**DEPOIS** do meu fix da Wave C.6 (`sideToUids` com doc_id → user_id).
Investigação estática revelou **outro bug** que mascarava o
materializado já populado.

### O bug (simples, mas passou por todas as Wave C.3 a C.6)

O hook `useClubInternalRanking` faz esta query no Firestore:

```js
getDocs(query(
  collection(db, 'club_internal_ratings'),
  where('club_id', '==', clubId),
  orderBy('wins', 'desc')
))
```

Esta query precisa de um **índice composto** (`club_id` ASC + `wins`
DESC). **Sem o índice, o Firestore lança `FAILED_PRECONDITION` (código 9)**.

**E o que o hook fazia com o erro?** Nada — só deixava o React Query
tratar. Resultado: `data = undefined` → "0 atletas do clube" no
badge → "Sem ranking ainda" na lista.

E o `loadClubUids(clubId)` (Wave C.4) **também falhava** em paralelo
porque o Promise.all rejeitava.

### Por que passou por todas as Wave C.3 a C.6

A **Wave C.3** introduziu o materializado e as queries no frontend
mas **esqueceu de criar os índices compostos**. As Waves C.4, C.5 e
C.6 mexeram no **backend** (Cloud Function, callable, sideToUids) e
no **schema** (display_name, user_id) mas ninguém olhou se a
**leitura no cliente** tinha índice.

Os testes de backend (`clubRankingServer.test.js`, Wave C.5) cobriam
o pipeline. Os testes de cliente (`clubRanking.test.js`, Wave C.2)
testavam a lógica ANTIGA client-side (que não usava Firestore). Os
**testes do `useClubInternalRanking`** nunca existiram.

### Sintomas visíveis

- "0 atletas do clube" no badge (16 membros, mas `data?.clubUids` era
  undefined)
- "Sem ranking ainda" no empty state (mesmo com materializado populado
  no servidor)
- Toast de "Materializar ranking agora" mostrava "Recalculado: ..."
  mas o frontend continuava vazio após refetch (porque a query
  falhava)

### Fix (Wave C.6.1)

Adicionado em `firestore.indexes.json` (4 índices compostos, ASC
club_id + DESC wins):

```json
{
  "collectionGroup": "club_internal_ratings",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "club_id", "order": "ASCENDING" },
    { "fieldPath": "wins", "order": "DESCENDING" }
  ]
}
```

Um para cada coleção materializada:
- `club_internal_ratings`
- `club_internal_ratings_ext`
- `club_internal_doubles_ratings`
- `club_internal_doubles_ratings_ext`

O workflow `deploy-firebase.yml` já tem passo "Deploy Firestore rules
and indexes" — o índice é deployado automaticamente no push para main.

Comentário no `useClubInternalRanking.js` documenta o requisito do
índice composto (para evitar regressão futura).

### Validação

- **Bundle live**: `index-CAJhIhEv.js` (deploy 20:49:54)
- **Firestore rules + indexes**: deployado no mesmo push
- **Cloud Functions**: deployadas
- **0 lint errors**
- **1387 testes verdes** (sem mudança, fix de infra)

### Métricas finais (Sprint 21)

- **1387 testes verdes**
- **0 lint errors**
- **98 coleções** (sem mudança)
- **102 índices compostos** (+4 novos: 1 por coleção materializada)
- **127 feature flags** (sem mudança)
- **8 Cloud Functions** (sem mudança)
- **47 PRs totais** (Sprints 0-21)
- **Last SHA**: `d7a3103`
- **Deploy**: em curso via GitHub Actions

### Decisões D- (Wave C.6.1)

1. **D-MATERIALIZADO-EXIGE-INDICES (Wave C.6.1)**: toda coleção
   materializada com `where + orderBy` em campos diferentes PRECISA
   de índice composto. A Wave C.3 introduziu o materializado sem
   criar os índices — erro de design que passou despercebido.
2. **D-ERRO-DE-INDICE-DEVE-SER-EXPLICITO (Wave C.6.1)**: hooks que
   fazem `where + orderBy` devem ter `onError` amigável que detecta
   `failed-precondition` e mostra link para criar o índice. Wave
   C.6.2 (futuro) vai implementar.
3. **D-DEPLOY-INDEXES-AUTOMATICO (Wave C.6.1)**: o workflow
   `deploy-firebase.yml` já deploya índices automaticamente. O
   `firestore.indexes.json` é a fonte de verdade.
4. **D-COMENTARIO-NO-HOOK (Wave C.6.1)**: o comentário no
   `useClubInternalRanking.js` documenta o requisito do índice
   composto. Serve como aviso para quem mexer no futuro.

---

## 24. Sprint 22 — PR #85: Dia de jogo do atleta (público/privado) (2026-07-29)

> Atualizado em **2026-07-30, 00:30 GMT-3** (origin/main @ `6079291`).
> Commit: `6079291 feat(games): Dia de jogo do atleta (público/privado) + ranking geral e de clube (#85)`.

### Visão geral

Nova funcionalidade **"Dia de jogo" para atletas**, atrás da flag
`athlete_game_day` (default OFF), com funcionalidade equivalente ao
dia de jogo dos clubes.

### Mudanças

- **Atleta cria seu dia de jogo público** (publica convite em
  "Procura-se jogo") ou **privado** (só convidados).
- Insere/convida qualquer atleta da plataforma.
- Visível apenas ao criador e aos membros (convidados / que
  entraram pelo convite).
- Ao "Participar" em Procura-se jogo, o dia de jogo passa a
  aparecer na aba "Dia de jogo" do atleta.
- Organização dos jogos reaproveita o motor dos clubes
  (Americano / Mexicano / Rei da Quadra) + placar + partidas avulsas.
- Publicação dos resultados decididos:
  - **Ranking GERAL** (espelho na mesma coleção `club_event_games`)
  - **Ranking de um CLUBE** quando todos os atletas de uma partida
    são do mesmo clube (`club_id` resolvido por partida)
- Rating nacional e ranking interno dos clubes consomem sem
  alteração.

### Navegação

- "Meus jogos" passou a ser **sub-aba de "Meu desempenho"**
  (abas: Estatística + Meus jogos).
- No lugar dela, em "Jogar", entra "Dia de jogo".
- `/meus-jogos` redireciona para `/meu-desempenho`.

### Domínio (testado)

- `gameDay.js` (visibilidade/membros) — 7 testes
- `gameDayRanking.js` (`club_event_games` + clube por partida) — 14 testes
- Total: **21 testes novos**

### Serviço/hooks

- `game_days` + subcoleções `participants`/`games`
- Join público
- `publish`/`unpublish` no ranking

### Firestore rules

- `game_days` + subcoleções
- `club_event_games` estendida com o que precisar

### Componentes V2

- `src/v2/components/games/AthleteGameDayOrganizer.jsx` (NOVO)
- `src/v2/components/games/CreateGameDayDialog.jsx` (NOVO)
- `src/v2/pages/V2GameDays.jsx` (NOVO)
- `src/v2/pages/V2MyGames.jsx` (modificado)
- `src/v2/pages/V2OpenGames.jsx` (modificado)
- `src/v2/pages/V2Performance.jsx` (modificado)

### Métricas

- **+21 testes verdes** (domínio games)
- **+1 módulo** (`games`)
- **+1 flag** (`athlete_game_day`)
- **+1 coleção** (`game_days`)
- **+1 V2 page** (`V2GameDays`)
- **+2 V2 components** (`AthleteGameDayOrganizer`, `CreateGameDayDialog`)

---

## 25. Sprint 23 — PR #86: Central de documentos jurídicos (2026-07-29)

> Atualizado em **2026-07-30, 00:30 GMT-3** (origin/main @ `6fd223c`).
> Commit: `6fd223c feat(legal): central de documentos jurídicos + consentimento versionado (#86)`.

### Visão geral

Novo módulo `legal` atrás da flag `legal_center` (default OFF):
documentos jurídicos pensados para todas as personas e
funcionalidades, com registro de aceite versionado e portão de
consentimento.

### Documentos (registro puro e versionado em `legalDocuments.js`)

**Essenciais** (aceite bloqueante para todos):
- Termos de Uso
- Política de Privacidade (LGPD)
- Termo de Ciência de Riscos e Isenção de Responsabilidade

**Complementares** (informativos):
- Política de Cookies
- Diretrizes da Comunidade
- Política de Pagamentos e Reembolsos
- Política de Cancelamento

**Por papel** (aceite no fluxo que assume o papel):
- Termos do Organizador (criar torneio)
- Termos do Proprietário de Arena (criar arena)
- Termos do Professor (ativar "Sou professor")

### Consentimento

- Coleção `legal_consents` (id determinístico `uid_docKey`)
- Lógica pura testada (`domain/consent.js`) — aceite válido quando
  versão aceita >= vigente. Bump de versão reabre o aceite.
- **Portão bloqueante** (`LegalConsentGate`) montado no `V2Layout`
  para os essenciais.
- Caixa de aceite por papel (`useRoleConsent`) integrada a criar
  torneio, criar arena e ativar professor.

### UI

- Central `/legal` + página de documento `/legal/:docRoute`
- Botão "Li e concordo" e estado de aceite
- Links no nav (Pickleball, Perfil, Aprender)
- Página legada `/politica-uso` permanece

### Domínio (testado)

- `consent.js` (lógica de aceite versionado) — 9 testes
- `legalDocuments.js` (registro puro de documentos) — puro (506 linhas)

### Componentes V2

- `src/v2/components/legal/LegalConsentGate.jsx` (NOVO, portão)
- `src/v2/components/legal/LegalDocumentView.jsx` (NOVO, página de doc)
- `src/v2/components/legal/legalIcons.js` (NOVO)
- `src/v2/components/legal/useRoleConsent.jsx` (NOVO)
- `src/v2/pages/V2Legal.jsx` (NOVO, central)
- `src/v2/pages/V2LegalDocument.jsx` (NOVO, doc)

### Integrações

- `V2CreateArena.jsx` — caixa de aceite para "Sou arena"
- `V2CreateTournament.jsx` — caixa de aceite para "Sou organizador"
- `V2ProfileEdit.jsx` — caixa de aceite para "Sou professor"

### Métricas

- **+9 testes verdes** (consent)
- **+1 módulo** (`legal`)
- **+1 flag** (`legal_center`)
- **+1 coleção** (`legal_consents`)
- **+2 V2 pages** (`V2Legal`, `V2LegalDocument`)
- **+4 V2 components** (portão, view, icons, hook)

### Decisões D- (Wave #86)

1. **D-LGPD-CONSENT-VERSIONADO (Wave #86)**: cada documento
   jurídico tem versão. Bump reabre aceite. Aceite válido quando
   versão aceita >= vigente.
2. **D-LGPD-PORTAO-BLOQUEANTE (Wave #86)**: o `LegalConsentGate`
   bloqueia funcionalidades que requerem aceite essencial.
   Não-bloqueante para complementares (apenas informativo).
3. **D-LGPD-DETERMINISTIC-ID (Wave #86)**: `legal_consents/{uid}_{docKey}`.
   Idempotente. Read público, write só do próprio uid.

---

## 26. Sprint 24 — PR #87: Dia de jogo em duplas + "Meu desempenho" (2026-07-29)

> Atualizado em **2026-07-30, 00:30 GMT-3** (origin/main @ `97e314c`).
> Commit: `97e314c fix(games): dia de jogo entra no ranking de duplas e em "Meu desempenho" (#87)`.

### Diagnóstico

Ao publicar os resultados de um dia de jogo no ranking, os jogos
iam para o **ranking individual** mas **NÃO** para o **ranking de
DUPLAS**. E "Meu desempenho" (estatística + meus jogos) só
contava **torneios**.

### Fix

- **Ranking de duplas**: `listFinishedEngineMatches` agora também
  lê `club_event_games` (dias de jogo de clube e de atleta
  publicados), usando `side_a_ids`/`side_b_ids` (já uids). Assim
  ranking individual e de duplas passam a refletir a publicação
  — que é o significado do opt-in.
- **Meu desempenho**: novo agregado `getMyGameDayGames(uid)`
  reúne TODOS os jogos de dia de jogo do atleta (decididos) — do
  **espelho publicado** (`club_event_games` por `array-contains`)
  e da **fonte** `game_days/.../games` (mesmo sem publicação),
  deduplicando pelo id `gd_${gameDayId}_${gameId}`.
  - Alimenta a **Estatística** (fold em `usePlayerStats`)
  - Alimenta a aba **Meus jogos** (mesclado no histórico do
    `MyGamesPanel`)
- **Regra**: o desempenho pessoal mostra **sempre todos os jogos**.
  A publicação afeta **só** os dois rankings.

### Domínio (testado)

- `myGames.js` (normalização espelho/fonte + fold nas estatísticas)
  — 9 testes novos
- Sem índice composto novo (`array-contains` simples)

### Métricas

- **+9 testes verdes** (myGames)
- **2 arquivos** (ratingService + usePlayerStats) para ranking de duplas
- **1 arquivo** (usePlayerStats) para fold em Meu desempenho

### Decisões D- (Wave #87)

1. **D-DUPLAS-CONSOME-CLUB-EVENT-GAMES (Wave #87)**: o motor de
   ranking de duplas (`listFinishedEngineMatches`) lê
   `club_event_games` para considerar dias de jogo publicados.
2. **D-MEU-DESEMPENHO-MOSTRA-TUDO (Wave #87)**: o desempenho
   pessoal **não** respeita o toggle `publish_to_ranking`. Mostra
   todos os jogos (publicados ou não). Publicação afeta só
   rankings.
3. **D-DEDUP-POR-GD-ID (Wave #87)**: `gd_${gameDayId}_${gameId}`
   é o id estável para deduplicar jogo entre fonte original e
   espelho publicado.

---

## 27. Sprint 25 — PR #88: Data nos convites + passados colapsáveis (2026-07-29)

> Atualizado em **2026-07-30, 00:30 GMT-3** (origin/main @ `fe5c191`).
> Commit: `fe5c191 feat(games): data nos convites/dia de jogo + ordenação por data + passados colapsáveis (#88)`.

### Visão geral

"Procura-se jogo" e "Dia de jogo" agora giram em torno da **DATA**.

### Mudanças

- **"Publicar convite"** ganha campo de Data (a descrição livre
  "quando" vira opcional; exige data OU descrição). O convite de
  dia de jogo público carrega a data do próprio dia de jogo.
- **Feed de Procura-se jogo** ordenado por data (mais próximos
  primeiro; sem data ao final). Convites com data já passada
  saem para uma seção **"Convites passados"** colapsável (fechada
  por padrão, abre quando o usuário quiser).
- **Dia de jogo**: a lista segue o mesmo padrão — próximos
  ordenados por data e "Dias de jogo passados" em seção colapsável.

### Domínio (testado)

- `partitionOpenGamesByDate` (pure function)
- `date` em `normalizeOpenGameInput`
- `openGames.test.js` — 6 testes novos

### Métricas

- **+6 testes verdes** (openGames)
- **Sem índice composto novo** (ordenação e partição em memória)

### Decisões D- (Wave #88)

1. **D-DATA-OBRIGATORIA-OU-DESCRICAO (Wave #88)**: convite pode ter
   data **OU** descrição. Não pode ser vazio.
2. **D-PASSADOS-COLAPSAVEIS (Wave #88)**: feed/dia-de-jogo separa
   "próximos" (ordenados por data crescente) de "passados"
   (seção colapsável fechada por padrão).
3. **D-SEM-DATA-AO-FINAL (Wave #88)**: convites sem data aparecem
   depois dos com data.

---

## 28. Sprint 26 — PR #89: Editar dia de jogo (2026-07-30)

> Atualizado em **2026-07-30, 23:50 GMT-3** (origin/main @ `8e47f6d`).
> Commit: `8e47f6d feat(games): editar informações e detalhes do dia de jogo (#89)`.

### Visão geral

O **criador** pode editar o dia de jogo **depois de criado**
(botão "Editar" no detalhe). Reaproveita o diálogo de criação
em **modo edição**: nome, visibilidade, data, horário, local,
cidade/UF, formato e observações.

### Sincronização do convite público

A troca de visibilidade sincroniza o convite público em
`open_games`:

- **privado → público**: publica o convite em "Procura-se jogo"
- **público → privado**: remove o convite
- **público → público**: atualiza data/descrição/local do
  convite existente

### Mudanças técnicas

- `updateGameDay` agora normaliza sobre os valores atuais + patch
  e faz o sync do `open_games`.
- `CreateGameDayDialog` agora aceita prop `editMode` (ou
  `gameDayToEdit`); renderiza o mesmo form pré-preenchido.
- `V2GameDays.jsx` ganhou o botão "Editar" no header do detail
  (visível só para o criador).

### Métricas

- **Sem teste novo** (refactor puro; reuso do `CreateGameDayDialog`)
- **Lint 0**, **1437 testes verdes**, **build OK**

### Decisões D- (PR #89)

1. **D-EDITAR-REAPROVEITA-CRIAR (PR #89)**: o modo edição usa
   exatamente o mesmo `CreateGameDayDialog` (com `editMode=true`).
   Sem componente duplicado, sem divergência de UX.
2. **D-VISIBILIDADE-SINCRONIZA-OPEN-GAMES (PR #89)**: trocar
   visibilidade **sempre** reflete em `open_games` (publish, hide,
   ou update do convite existente).
3. **D-EDIT-SO-CRIADOR (PR #89)**: o botão "Editar" só aparece
   para o criador do dia de jogo. Outros membros não editam
   (consistente com a regra de ownership).

---

## 29. Sprint 27 — PR #90: ID DUPR no perfil (2026-07-30)

> Atualizado em **2026-07-30, 23:50 GMT-3** (origin/main @ `e4ace2a`).
> Commit: `e4ace2a feat(athletes): ID DUPR no perfil, visível em atletas, torneios e afins (#90)`.

### Visão geral

Todo usuário passa a ter um campo **"ID DUPR"** (Dynamic Universal
Pickleball Rating) no perfil. Editável na seção "Identidade" do
editor de perfil. Salvo em `users/{uid}.dupr_id` e espelhado em
`athlete_profiles/{uid}.dupr_id` via `buildAthletePublicProfile`.

### Onde aparece

- **Editor de perfil** (`V2ProfileEdit.jsx`): seção "Identidade",
  campo "ID DUPR".
- **Cards de "Atletas"** (`V2Athletes.jsx`): chip com o DUPR
  quando preenchido. + **busca por DUPR** no diretório.
- **Página pública do atleta** (`V2AthleteProfile.jsx`): chip
  no herói.
- **Inscrições de torneio** (duplas): linha "DUPR: X / Y" por
  dupla, resolvido por uid.
- **Meu perfil** (`V2Profile.jsx`): chip.

### Domínio (testado)

- `athletes/domain/publicProfile.js`: `dupr_id` em
  `buildAthletePublicProfile` (trim, null quando vazio).
- `athletes/domain/publicProfile.test.js`: 5 testes novos (1
  explicitamente do DUPR + 4 outros).

### Métricas

- **+1 teste** (DUPR em `publicProfile.test.js`)
- **6 arquivos modificados**: V2Profile, V2ProfileEdit,
  V2Athletes, V2AthleteProfile, publicProfile, publicProfile.test
- **Sem índice novo** (busca por DUPR é em memória, scan do
  diretório — não escala, mas ok para o tamanho atual)
- **Aditivo / backward-compat**: `dupr_id` é opcional. Users
  sem o campo continuam funcionando.

### Decisões D- (PR #90)

1. **D-DUPR-OPCIONAL-BACKWARD-COMPAT (PR #90)**: o campo `dupr_id`
   é **opcional**. Users sem o campo continuam funcionando.
   Espelhado com `null` quando vazio.
2. **D-DUPR-VISIVEL-EM-TODOS-LUGARES (PR #90)**: o ID DUPR aparece
   em todos os pontos onde o atleta é visível (cards, perfil
   público, inscrições de torneio, meu perfil).
3. **D-DUPR-SEM-MIGRACAO (PR #90)**: sem migração obrigatória.
   Users adicionam o DUPR quando editam o perfil. Admin pode
   popular em massa via script (não é escopo do PR).
4. **D-BUSCA-DUPR-EM-MEMORIA (PR #90)**: a busca por DUPR no
   diretório de atletas é em memória (scan do client-side).
   Não escala para >5000 atletas, mas é ok para o tamanho
   atual (~1000 atletas listados). Se virar gargalo, criar
   índice Firestore + Cloud Function de busca.

---

## 30. Sprint 28 — PR #91: Lado da quadra + Interesses (perfil) (2026-07-30)

> Atualizado em **2026-07-31, 01:00 GMT-3** (origin/main @ `5632a01`).
> Commit: `5632a01 feat(profile): lado da quadra + interesses, cadastro completo obrigatório e painel personalizado (#91)`.

### Visão geral

Perfil de **todos os usuários** ganha:
- **Campo "Lado da quadra"** (qualquer / esquerda / direita). Espelhado
  no diretório público (útil para parcerias).
- **Nova seção "Meus interesses na plataforma"** — multi-seleção
  mapeando as funcionalidades:
  - Participar/organizar torneios
  - Parceria para jogos e treinos
  - Organizar meu treino
  - Encontrar professores
  - Dar aulas
  - Gerir arena
  - Reservar quadras
  - Clubes
  - Comunidade
  - Ranking
- Editável a qualquer momento no editor de perfil.

### Cadastro completo obrigatório

O cadastro não é mais livre — `profile_completeness` é um campo
calculado que valida se o usuário preencheu os campos-chave. O
onboarding e o painel personalizado usam esse score para mostrar
"complete seu perfil" quando aplicável.

### Painel personalizado

A home do usuário mostra conteúdo baseado nos seus **interesses**:
- Atleta focado em torneios → ver próximos torneios
- Professor → ver agenda + pedidos de aula
- Arena → ver PDV + reservas
- Clube → ver feed + eventos

### Domínio (testado)

- `athletes/domain/profileMeta.js` (NOVO) — registro de lados da
  quadra + interesses disponíveis.
- `athletes/domain/profileMeta.test.js` (NOVO) — testes do registro.

### Métricas

- **+16 testes** (perfil + cadastro)
- **+1 componente** (`profileMetaIcons.js`)
- **Sem índice novo** (queries em `users` por uid)

### Decisões D- (PR #91)

1. **D-LADO-DA-QUADRA-UTILS-PARCERIAS (PR #91)**: o lado (esquerda/
   direita) é informação pública (espelhada em `athlete_profiles`)
   — facilita encontrar parceiros compatíveis.
2. **D-INTERESSES-DRIVE-HOME (PR #91)**: o painel personalizado
   usa os interesses declarados pelo usuário. Default: nenhum
   interesse selecionado (home neutra).
3. **D-CADASTRO-COMPLETO-OBRIGATORIO (PR #91)**: `profile_completeness`
   é um score calculado (não um campo armazenado). Valida em tempo
   real.
4. **D-INTERESSES-MULTISELECAO (PR #91)**: o usuário pode marcar
   vários interesses. Não é single-select.

---

## 31. Sprint 29 — PR #92: Onboarding — passo de nível (2026-07-30)

> Atualizado em **2026-07-31, 01:00 GMT-3** (origin/main @ `1fb45ac`).
> Commit: `1fb45ac feat(onboarding): passo de nível — escolher da lista com explicação ou fazer o teste (#92)`.

### Visão geral

No **passo final do assistente de cadastro** (após escolher papel
+ interesses), o usuário tem **3 opções** para o nível:

1. **Fazer o teste de nivelamento** (CBPE/USAP)
2. **Escolher meu nível na lista** — seletor com níveis USAP que
   mostra explicação clara (nome, faixa, resumo, descrição)
3. **Concluir sem informar nível** (nivelamento é opcional)

### Implementação

- Reusa `LEVEL_TABLE`/`LEVEL_OPTIONS` (mesma tabela que alimenta
  o teste e o editor de perfil).
- Padrão de persistência idêntico ao editor de perfil
  (`leveling_level`, `leveling_method='manual'`).
- A opção "Escolher da lista" mostra a **explicação** (não só o
  nome do nível) — combate o problema clássico de "escolho 4.5+
  porque soa bem".

### Decisões D- (PR #92)

1. **D-NIVEL-MANUAL-OU-TESTE-OU-PULAR (PR #92)**: 3 caminhos no
   onboarding. Nivelamento é **opcional** (não bloqueia cadastro).
2. **D-EXPLICACAO-NO-LEVEL-PICKER (PR #92)**: o seletor de nível
   mostra a explicação clara (faixa, resumo, descrição) para
   cada nível. Combate auto-superestimativa.
3. **D-LEVEL-TABLE-REUSO (PR #92)**: a tabela de níveis é a
   mesma em `editor de perfil` e `onboarding`.

---

## 32. Sprint 30 — PR #93: Nav — unificar "Termos e Documentos" + mover "Meu desempenho" (2026-07-30)

> Atualizado em **2026-07-31, 01:00 GMT-3** (origin/main @ `564865f`).
> Commit: `564865f feat(nav): unificar "Termos e Documentos" e mover Meu desempenho para Perfil (#93)`.

### Visão geral

Reorganização da navegação:
- **"Termos e Documentos"** era um link standalone no Perfil.
  Agora é **absorvido pela seção legal** (que já existe desde
  o PR #86 / Wave #86).
- **"Meu desempenho"** era uma rota standalone. Movido para
  **aba dentro de Perfil** (junto com "Estatística" e "Meus jogos"
  da Wave #87).
- `/meus-jogos` redireciona para `/meu-desempenho` (que agora
  aponta para a aba no Perfil).

### Decisões D- (PR #93)

1. **D-NAV-LEGAL-UNIFICADO (PR #93)**: "Termos e Documentos"
   não é um hub separado. Fica na seção legal do Perfil.
2. **D-MEU-DESEMPENHO-ABA-DO-PERFIL (PR #93)**: a rota
   standalone some; vira aba em Perfil (junto com as outras
   seções pessoais).
3. **D-NAV-SEM-DUPLICIDADE (PR #93)**: não há 2 caminhos para
   a mesma coisa. Cada coisa fica em UM lugar.

---

## 33. Sprint 31 — PR #94: Onboarding — destravar 1º acesso + "Política de Uso" (2026-07-30)

> Atualizado em **2026-07-31, 01:00 GMT-3** (origin/main @ `b54d81f`).
> Commit: `b54d81f fix(onboarding): destravar 1º acesso + "Política de Uso" na central de documentos (#94)`.

### Visão geral

- **Destravar 1º acesso**: o cadastro mínimo viável não trava
  o usuário. O onboarding wizard pode ser **interrompido** e
  retomado depois. Nada bloqueia o usuário de começar a usar
  o app.
- **"Política de Uso"** linkada na central de documentos (PR #86)
  — o que o user aceitou no onboarding vira registro em
  `legal_consents/{uid}_privacy_policy` e aparece como
  "aceito em DD/MM/AAAA" no documento.

### Decisões D- (PR #94)

1. **D-ONBOARDING-NAO-BLOQUEIA (PR #94)**: o wizard é opcional.
   O usuário pode usar o app mesmo sem completar. Lembretes
   suaves para completar (não modal persistente).
2. **D-CONSENT-PERSISTIDO-LEGAL (PR #94)**: cada aceite no
   onboarding vira doc em `legal_consents`. Auditável.
3. **D-POLITICA-USO-COM-VERSIONAMENTO (PR #94)**: a Política
   de Privacidade (LGPD) tem versão. Bump reabre aceite.

---

## 34. Sprint 32 — PR #95-#100: Arena Mercado (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3** (origin/main @ `106bd55`).
> 6 PRs (#95-#100) do sistema de **Mercado** da arena:
> catálogo de produtos + vendas + relatórios financeiros.

### Visão geral

Sistema de mercado da arena (PDV V2):
- **Catálogo padrão** de produtos (default: água, isotônico,
  barras, grip, bolas, raquetes; **ampliado** com RS + saudáveis).
- **Adicionar em lote** produtos do catálogo ao mercado da arena.
- **Catálogo sempre disponível** para gestão no painel admin
  da plataforma.
- **Mercado unificado** num só espaço; vendas só do que está
  ou esteve em estoque (não permite vender sem estoque).
- **Entrada ágil** no estoque, **saída só do estoque**
  (baixa ao vender), **relatórios financeiros**.

### Coleções

- `arena_products` — produtos no mercado da arena
- `arena_sales` — vendas registradas
- `arena_marketplace_catalog` (NOVO) — catálogo padrão
  replicado em cada arena via `catalogSeed.js`

### Domínio (testado)

- `arenas/domain/catalogSeed.js` (NOVO) — seed do catálogo
  padrão.
- `arenas/domain/productCatalog.js` (NOVO, testado) — CRUD
  do catálogo.
- `arenas/domain/marketReports.js` (NOVO, testado) — relatórios
  financeiros (receita, lucro, mais vendidos).

### UI

- `v2/components/arenas/V2ArenaMercadoTab.jsx` (NOVO) — aba de
  mercado na arena.
- `v2/components/arenas/V2ArenaCatalogBrowser.jsx` (NOVO) —
  browser de catálogo (admin da plataforma).
- `v2/components/arenas/V2ArenaFinanceTab.jsx` (NOVO) — aba
  de relatórios financeiros.
- `v2/components/arenas/V2ArenaGestaoTab.jsx` (NOVO) — gestão
  do mercado.
- `v2/components/arenas/ProductTypeahead.jsx` (NOVO) — typeahead
  para buscar produto do catálogo.
- `v2/components/admin/AdminCatalogTab.jsx` (NOVO) — aba de
  catálogo no admin da plataforma.

### Decisões D- (PRs #95-#100)

1. **D-MERCADO-SEMPRE-EM-ESTOQUE (PR #100)**: venda só do que
   está/esteve em estoque. Não permite "vender sem estoque".
2. **D-CATALOGO-DEFAULT-POR-ARENA (PR #95)**: seed automática
   do catálogo padrão ao criar arena.
3. **D-MERCADO-UNIFICADO-UM-ESPACO (PR #100)**: um único
   mercado, não múltiplos.
4. **D-RELATORIOS-REAIS-NAO-ESTIMADOS (PR #99)**: relatórios
   baseados em vendas reais, não estimativas.

---

## 35. Sprint 33 — PR #101-#104: Game Day Play (open play) (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> 4 PRs (#101-#104) do formato **Play (open play)** do Game Day.

### Visão geral

Formato **Play** (open play) é o novo "jogar sem compromisso de
torneio" do Game Day. Diferente do dia de jogo tradicional
(que tem sorteio + rodadas + placar), o Play é fila de espera
+ substituição + próximo da fila.

- **Sorteio aditivo** (#101): "Sortear jogos" **adiciona** novos
  jogos sem apagar os já com resultado. Pergunta se deve manter
  ou substituir os sem resultado.
- **Ranking do dia** (#101): nova seção com o ranking acumulado
  da rodada de jogos do dia.
- **Formato Play** (#102): fila de espera + próximo da fila +
  substituir ausente. Padrões de criação.
- **Tabela de quadras** (#103): visualização em tabela com
  previsão de próximos jogos.
- **Visões separadas** (#104): organizador (gestão completa)
  vs participante (só fila + próximos jogos).

### Componentes novos

- `v2/components/games/AthletePlayOrganizer.jsx` (NOVO) — visão
  do organizador do Play.
- `v2/components/games/AthletePlayParticipant.jsx` (NOVO) —
  visão do participante.
- `v2/components/games/CreateGameDayDialog.jsx` — agora com
  opção "Play".

### Decisões D- (PRs #101-#104)

1. **D-SORTEIO-ADITIVO-NAO-DESTRUTIVO (PR #101)**: sortear não
   apaga o que já tem resultado. Pergunta sobre sem resultado.
2. **D-PLAY-FILA-E-SUBSTITUICAO (PR #102)**: Play é fila +
   substituição, não sorteio clássico.
3. **D-VISOES-SEPARADAS-ORG-PARTICIPANTE (PR #104)**: a página
   do dia de jogo tem 2 visões distintas por papel.
4. **D-PLAY-MANTEM-HISTORICO (PR #105)**: sorteio Americano
   ciente do que já aconteceu no dia.

---

## 36. Sprint 34 — PR #105-#109: Game Day Play — polimento (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> 5 PRs (#105-#109) de polimento do Game Day Play e
> Performance.

### PRs

- **#105**: sorteio Americano ciente do histórico do dia
  (não repete confrontos que já aconteceram).
- **#106**: confirmar convite de dupla direto na notificação
  (flag `partner_invite_quick_confirm`).
- **#107**: `normalizeStatsFormat` + `resolveEntryFormat` —
  formato do jogo (não da inscrição). Americano/avulso =
  duplas. Dupla no histórico.
- **#108**: americano (inscrição individual) conta como duplas
  + parceiro na rotação.
- **#109**: `pickSwapReplacement` (domínio puro) — substituído
  não volta à mesma partida em novas trocas.

### Domínio (NOVO)

- `games/domain/gamePlay.js` (NOVO, testado) — lógica de
  substituição no Play.
- `clubs/domain/gameDayDrawMerge.js` (NOVO, testado) — merge
  de sorteios aditivos.
- `clubs/domain/gameDayLeaderboard.js` (NOVO, testado) —
  leaderboard do dia.

### Componente (NOVO)

- `v2/components/tournament/PartnerInviteNotificationAction.jsx`
  (NOVO) — ação "Confirmar/Recusar" no sino.
- `clubs/components/GameDayLeaderboard.jsx` (NOVO).

### Decisões D- (PRs #105-#109)

1. **D-FORMATO-DO-JOGO-NAO-INSCRICAO (PR #107)**: americano/
   avulso = duplas (não singles) por causa da rotação 2×2.
2. **D-PARCEIRO-NA-ROTACAO (PR #108)**: o parceiro muda a cada
   rodada no Americano — registra corretamente no histórico.
3. **D-SWAP-EXCLUI-JA-SUBSTITUIDOS (PR #109)**: substituto
   nunca volta para o mesmo jogo (excluído de `swappedOutIds`).

---

## 37. Sprint 35 — PR #110-#112: Tournament Teams (formato equipes) (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> 3 PRs (#110-#112) do **formato de torneio por equipes**.

### Visão geral

Nova modalidade: **torneio por equipes** (atrás da flag
`team_tournaments`, default OFF).

- **#110 (Sprint 35a)**: formato de torneio por equipes —
  inscrição de equipes + sorteio + resultado.
- **#111 (Sprint 35b)**: elenco por atletas cadastrados (com
  user_id/gênero) + etapas no ranking individual + ranking
  de equipes. Resultados das etapas espelhados em
  `club_event_games` com `kind=singles/doubles` e
  `source='team_confrontation'`.
- **#112 (Sprint 35c)**: "Equipes" vira opção no **seletor
  de formato** (Simples / Duplas / Equipes) unificado. Usa
  internamente a base de duplas (fases de confronto, sem
  americana) + `team_config`. Não altera `MODALITY_FORMAT`.

### Coleções

- `tournament_team_registrations/{id}` (NOVO)
- `tournament_team_lineups/{id}` (NOVO) — elenco por equipe
- `tournament_team_confrontations/{id}` (NOVO) — confrontos
  equipe × equipe

### Decisões D- (PRs #110-#112)

1. **D-EQUIPES-REUSA-BASE-DUPLAS (PR #112)**: sem reinventar
   a base de duplas. Fase de confronto, sem americana.
2. **D-ETAPAS-CONTAM-NO-RANKING-INDIVIDUAL (PR #111)**: cada
   etapa decidida é espelhada no ELO/DUPR como jogo de dupla
   ou simples (conforme formato), com `source='team_confrontation'`.
3. **D-CONFRONTO-IGNORA-RANKING-AGREGADO (PR #111)**: o
   confronto agregado (equipe × equipe) é ignorado pelo
   motor de rating (só etapas individuais contam).
4. **D-EQUIPES-NO-SELETOR-FORMATO (PR #112)**: "Equipes" entra
   no seletor **junto** com Simples/Duplas (unificado), não
   como caixa separada.

---

## 38. Sprint 36 — PR #107 + #110-#112: Tournament Teams — visão e sorteio (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.

### PRs

- **#106 (Sprint 36)**: equipes — sorteio no formato da
  modalidade, tabelas/chave e resultado por etapa. `runDraw`
  e `runPhaseDraw` tratam inscrição-equipe como participante
  (grupo único, grupos ou chave). Americano/Mexicano são
  **recusados com mensagem própria** para equipes.
- **#107 (Sprint 36)**: equipes — **separa visão pública**
  (leitura) da operação do admin. `TeamConfrontationCard`
  mostra confronto por confronto, ampliável para etapa a
  etapa. Nenhum campo editável na visão pública (nem para
  o admin).

### Componentes novos (Tournament Teams)

- `v2/components/tournament/TeamConfrontationCard.jsx` (NOVO)
- `v2/components/tournament/TeamConfrontationCard.runtime.test.jsx`
- `v2/components/tournament/TeamConfrontationDialogs.jsx` (NOVO)
- `v2/components/tournament/TeamConfrontationDialogs.runtime.test.jsx`
- `v2/components/tournament/TeamModalityConfig.jsx` (NOVO)
- `v2/components/tournament/TeamModalityView.jsx` (NOVO)
- `v2/components/tournament/TeamModalityView.runtime.test.jsx`
- `v2/components/tournament/TeamRegistrationDialog.jsx` (NOVO)
- `v2/components/tournament/TeamRegistrationForm.jsx` (NOVO)
- `v2/components/tournament/TeamRegistrationForm.runtime.test.jsx`
- `v2/components/tournament/TeamStandingsTable.jsx` (NOVO)

### Decisões D- (PRs #106-#107)

1. **D-EQUIPES-SEM-AMERICANO (PR #106)**: Americano/Mexicano
   são **recusados** com mensagem própria em torneios por
   equipes.
2. **D-EQUIPES-VISAO-PUBLICA-SOMENTE-LEITURA (PR #107)**: a
   página da modalidade (visão do atleta) **nunca** permite
   editar. Toda a operação é no admin.
3. **D-EQUIPES-CONFRONTO-E-ETAPA (PR #107)**: vocabulário
   explícito — **confronto** (equipe × equipe) se divide em
   **etapas** (as partidas) e cada etapa é disputada em
   **games**.

---

## 39. Sprint 37 — PR #113-#116: Tournament Admin Console (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> 4 PRs (#113-#116) do **console de gestão dedicado** do torneio
> e UX de torneio.

### PRs

- **#113 (Sprint 37a)**: console de gestão em página dedicada
  (`/torneios/:id/gerenciar` → `V2TournamentAdmin`) atrás da
  flag `tournament_admin_console`. Aba "Meus torneios" no
  Perfil (`/perfil/torneios` → `V2MyTournamentsAdmin`).
- **#114 (Sprint 37b)**: seções de Inscrições e Sorteio
  colapsáveis (por modalidade).
- **#115 (Sprint 37c)**: Meus torneios lista apenas torneios
  que gerencio (usa `tournament_admins`, não `useMyTournaments`).
- **#116 (Sprint 37d)**: cards colapsáveis iniciam fechados
  e lembram o último estado por visualizador (localStorage
  via `V2Collapsible.persistId`).

### Componente novo

- `v2/pages/V2TournamentAdmin.jsx` (NOVO) — console dedicado.
- `v2/pages/V2MyTournamentsAdmin.jsx` (NOVO) — aba no Perfil.
- `v2/components/tournament/V2TournamentAdminPanel.jsx` (NOVO)
- `v2/components/tournament/V2TournamentOpsTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentRegistrationsTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentDrawTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentModalitiesTab.jsx` (NOVO)
- `v2/components/tournament/V2TournamentModalitiesTab.runtime.test.jsx`
- `v2/components/tournament/V2MatchesBlock.jsx` (NOVO)
- `v2/components/tournament/V2MatchesBlock.runtime.test.jsx`
- `v2/components/tournament/V2Collapsible.jsx` (NOVO)

### Decisões D- (PRs #113-#116)

1. **D-ADMIN-CONSOLE-PAGINA-DEDICADA (PR #113)**: gestão não
   fica mais na página pública — é página dedicada.
2. **D-MEUS-TORNEIOS-SO-GERENCIO (PR #115)**: aba "Meus
   torneios" usa `tournament_admins` (owner/admin), não
   `useMyTournaments` (que inclui participação como atleta).
3. **D-CARDS-COLAPSAVEIS-PERSISTIDOS (PR #116)**: cards
   iniciam fechados, último estado por visualizador via
   localStorage (`persistId`).

---

## 40. Sprint 38 — PR #117-#125: Tournament UX + rules (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> PRs #117, #118, #119, #120, #121, #123, #125, #127.

### PRs

- **#117 (Sprint 38a)**: fase de grupos forma **múltiplos
  grupos** com tabela própria por grupo.
- **#118 (Sprint 38b)**: grupos aparecem na **visão pública
  do atleta, impressão e telão**.
- **#119 (Sprint 38c)**: inscrição respeita o **gênero** da
  modalidade (lista e envio).
- **#120 (Sprint 38d)**: admin — **moderação de atletas**
  (ocultar contas falsas/teste, flag `athlete_moderation`).
- **#121 (Sprint 38e)**: padroniza largura das colunas das
  tabelas de grupo.
- **#123 (Sprint 38f)**: lançamento de resultado, **desfazer
  início**, check-in, vagas ilimitadas.
- **#125 (Sprint 38g)**: visão pública + impressão dos
  grupos com conjunto completo de colunas.
- **#127 (Sprint 38h)**: rules — sorteio da fase de grupos
  tem leitura pública + escrita null-safe.

### Decisões D- (PRs #117-#127)

1. **D-MULTIPLOS-GRUPOS-TABELA-PROPRIA (PR #117)**: fase de
   grupos suporta múltiplos grupos, cada um com sua tabela.
2. **D-GRUPOS-PUBLICOS-PARA-TODOS (PR #118)**: grupos visíveis
   para quem não é admin (atleta, telão, impressão).
3. **D-INSCRICAO-RESPEITA-GENERO (PR #119)**: se a modalidade
   é masculina, não aceita inscrição feminina (e vice-versa).
4. **D-MODERACAO-NAO-APAGA (PR #120)**: ocultar é `hidden=true`
   em `users/{uid}` e `athlete_profiles/{uid}` (reversível,
   auditado em `audit_logs`).
5. **D-LARGURA-COLUNAS-PADRONIZADA (PR #121)**: tabelas de
   grupo têm largura uniforme (visual consistente).
6. **D-DESFAZER-INICIO (PR #123)**: o organizador pode
   desfazer "início do torneio" (volta estado).
7. **D-VAGAS-ILIMITADAS (PR #123)**: 0 ou null = sem limite.
8. **D-TOURNAMENT-GROUPS-PUBLICA-LEITURA (PR #127)**: regra
   Firestore permite leitura pública (para telão/impressão).

---

## 41. Sprint 39 — PR #128-#133: Rating estilo DUPR (escala 2.0-8.0) (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> 6 PRs (#128-#133) do **motor de rating estilo DUPR**.

### Visão geral

Novo **ranking próprio, INDEPENDENTE do ELO**, na mesma escala
do DUPR (2.000-8.000), exibido em **aba apartada** na página
de Ranking, atrás da flag `skill_rating_dupr` (default OFF).
NÃO usa o algoritmo oficial do DUPR (proprietário) — é uma
**aproximação** na mesma escala.

### Componentes

- `v2/components/rating/V2DuprRankingView.jsx` (NOVO) — aba
  do ranking estilo DUPR.
- `v2/components/rating/V2DuprEvolution.jsx` (NOVO) — gráfico
  de evolução por jogo.
- `v2/components/rating/V2DuprRatingBadge.jsx` (NOVO) — badge
  de rating atual.

### Domínio (NOVO, testado)

- `rating/domain/duprScale.js` (NOVO, +testes) — escala 2.0-8.0,
  simples/duplas separados, K maior na fase provisória, peso
  leve de margem de vitória, semente por rating DUPR do perfil
  e/ou nível USAP (2.5 → 2.500), replay determinístico.
- `rating/domain/elo.js` (testado) — ELO original (intacto).
- `rating/domain/gameLog.js` (NOVO, testado) — normalizador
  compartilhado (espelha fonte de jogos do ELO, sem tocar).
- `rating/domain/coachSeed.js` (NOVO, +testes) — seed por
  nível validado.
- `rating/domain/ratingSignature.js` (NOVO) — assinatura de
  rating (replay).
- `rating/domain/duprMatchExport.js` (NOVO, +testes) — gera
  CSV para DUPR match export.

### Services + Hooks (NOVO)

- `rating/services/duprRatingService.js`
- `rating/services/duprOfficial.js` (stub sem rede — fase 2)
- `rating/services/duprExportService.js`
- `rating/hooks/useDuprRating.js`
- `rating/hooks/useDuprExport.js`

### Coleções (NOVAS)

- `player_skill_ratings/{userId_format}` — `user_id`, `format`,
  `rating`, `games_played`, `reliability`, `provisional`.
- `skill_rating_history/{id}` — mudanças no rating ao longo
  do tempo (espelhado para `rating_history` ELO).
- `audit_logs/{id}` — ações de moderação (PR #120).

### PRs individuais

- **#128 (Sprint 39a)**: ranking estilo DUPR (escala 2.0-8.0)
  em aba própria.
- **#129 (Sprint 39b)**: referencia o Nivel 2.0-8.0 em todos
  os locais de ranking/rating.
- **#130 (Sprint 39c)**: motor baseado no **placar** (não só
  resultado) + **confiabilidade** (0-100%, cresce com jogos).
  K de ~0.30 novato a ~0.05 maduro. Ignora W.O. Derrota
  apertada contra adversário mais forte pode subir o rating.
- **#131 (Sprint 39d)**: evolução do Nivel 2.0-8.0 no perfil
  do atleta (formato "Evolução do rating" — separada Duplas
  e Simples).
- **#132 (Sprint 39e)**: fix — evolução vira **trajetória por
  jogo** (não por agrupamento).
- **#133 (Sprint 39f)**: refactor visual — Nivel 2.0-8.0 sem
  ambiguidade, design consistente, gráficos mais claros.

### Decisões D- (PRs #128-#133)

1. **D-DUPR-NAO-OFICIAL-EXPLICITO (PR #128)**: rotulado
   claramente como NÃO oficial. Não usa o algoritmo
   proprietário do DUPR — aproximação na mesma escala.
2. **D-DUPR-ABA-APARTADA (PR #128)**: ranking DUPR é em aba
   separada do ELO. Não substitui.
3. **D-DUPR-MOTOR-BASEADO-PLACAR (PR #130)**: placar importa
   (margem de vitória leve + vitória-real).
4. **D-DUPR-CONFIABILIDADE-PROGRESSIVA (PR #130)**: K de 0.30
   (novato) a 0.05 (maduro). Ignora W.O.
5. **D-DUPR-SIMPLES-E-DUPLAS-SEPARADOS (PR #128)**: rating
   simples ≠ rating duplas. Coleções separadas.
6. **D-DUPR-SEMENTE-POR-NIVEL-USAP (PR #128)**: 2.5 USAP
   → 2.500 no DUPR. Semente estável.
7. **D-ELO-INTACTO (PR #128)**: nada do ELO existente foi
   tocado. Tudo aditivo.
8. **D-DUPR-OFFICIAL-FASE-2 (PR #128)**: `duprOfficial.js`
   é stub sem rede. Flag `dupr_official_sync` (default OFF)
   reservada para integração oficial futura.

---

## 42. Sprint 40 — PR #134: Engajamento (4 flags) (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.
> 4 PRs de melhorias de engajamento (1 PR com tudo).

### 4 flags default OFF

1. **`action_home`** (#134): **Home orientada a ação**.
   Bloco "O que fazer agora" (próximo jogo, pendências,
   torneios abertos perto da sua cidade) + faixa "Sua
   evolução" (streak, nível/XP, próxima conquista, metas).
   Tudo reusando `progression/`, `achievements/`,
   `performance/` — sem query nova (só dedupe React Query).

2. **`smart_matchmaking`** (#134): **matchmaking inteligente**.
   Score 0-100 cruzando: proximidade de rating,
   complementaridade de lado (duplas), mesma cidade,
   interesses em comum. Em "Encontrar jogadores": selo de %
   + chips de motivo. `useAthletes(enabled)` só busca
   diretório no modo inteligente.

3. **`post_game_flow`** (#134): **fluxo pós-jogo enxuto**.
   Faixa em "Meus jogos" › Histórico: "Jogar de novo"
   (→ encontrar jogadores) + "Ver minha evolução" (→
   ranking). Aderente ao modelo atual (sem uid do
   adversário — sem revanche peer-to-peer).

4. **`push_notifications`** (#134): **notificações push PWA**.
   `pushService.js` (opt-in, opt-out, no-op gracioso sem
   VAPID). SW dedicado `/firebase-cloud-messaging-push-scope`
   (não colide com `sw.js` do PWA). Cloud Function
   `pushOnNotificationCreate` espelha notificações in-app
   → push. Limpa tokens inválidos.

### Domínio (NOVO)

- `matchmaking` (NOVO domínio puro, +9 testes) — score
  de compatibilidade.

### Cloud Function (NOVO)

- `pushOnNotificationCreate` — espelha notificação in-app
  → push dos tokens do usuário. Retorna cedo sem tokens.
  Nunca lança. Limpa tokens inválidos.

### Coleções (NOVAS)

- `push_tokens/{uid}` — token FCM por usuário (cada um
  gerencia os próprios, regra aditiva).

### Componentes (NOVOS)

- `v2/components/home/V2ActionHome.jsx` (NOVO) — Home
  orientada a ação.
- `v2/components/settings/V2PushCard.jsx` (NOVO) — opt-in
  de push nas Configurações.

### Decisões D- (PRs #134)

1. **D-ENGAGEMENT-FLAGS-OFF-POR-DEFAULT (PR #134)**: 4 flags
   novas todas default OFF. Inerte em produção.
2. **D-PUSH-GRACioso-SEM-VAPID (PR #134)**: sem VAPID/
   sem suporte/sem permissão, vira no-op silencioso. Não
   quebra.
3. **D-PUSH-SW-DEDICADO (PR #134)**: FCM SW em escopo
   próprio (`/firebase-cloud-messaging-push-scope`) para
   não colidir com `sw.js` do PWA.
4. **D-PUSH-CF-NUNCA-LANCA (PR #134)**: Cloud Function
   tolera ausência de tokens. Retorna cedo. Limpa
   inválidos.
5. **D-SMART-MATCHMAKING-MOTIVOS-LEGIVEIS (PR #134)**:
   cada candidato mostra os **motivos** do score
   ("rating próximo", "mesma cidade", "lado
   complementar"). Não é caixa-preta.
6. **D-POST-GAME-SEM-REVANCHE-PTP (PR #134)**: peer-to-peer
   revanche exigiria modelo novo. Mantido fora do escopo
   (só atalhos gerais).

---

## 43. Sprint 41 — PR #135: Arena preço dinâmico + arena ops (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.

### PRs

- **#135 (Sprint 41a)**: `arena_dynamic_pricing` — domínio
  puro `dynamic_pricing.js` (7 testes): `applyDynamicPricing`
  (desconto em horário de baixa / sobretaxa em pico; pico
  tem precedência), `normalizeDynamicConfig`,
  `dynamicPricingLabel`. Reusa `timeToMinutes` de `pricing.js`.
- **#136 (Sprint 41b)**: `arena_ops_kpis` — painel
  "Como foi sua semana" (`V2ArenaWeekPanel`). KPIs
  (`weekSummary`): receita, reservas, horas ocupadas,
  no-show + taxa. `bookingsHeatmap` (grade dia×hora).
  `bookingsInRange`. Reusa `arena_metrics`,
  `court_schedule`, `calendar`.

### Decisões D- (PRs #135-#136)

1. **D-PRECO-DINAMICO-PICO-PRECEDE (PR #135)**: pico tem
   precedência sobre baixa (não acumula).
2. **D-PRECO-DINAMICO-NAO-APLICADO-AINDA (PR #135)**: o
   domínio existe, mas a aplicação em `resolveArenaPrice`
   + config no editor de preços fica para a próxima sprint
   (arena opta).
3. **D-ARENA-OPS-WEEK-PANEL-NO-TOPO (PR #136)**: KPIs no
   topo da Central da arena (gated). Avaliação média +
   mapa de calor de horários.

---

## 44. Sprint 42 — PR #137: Coach — alunos + descoberta (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.

### PRs

- **#137 (Sprint 42a)**: `coach_student_progress` — o
  roster do professor mostra **rating/posição do aluno**
  no ranking nacional, ao lado do nível validado e das
  aulas concluídas. Reusa `useNationalRanking` (cache).
- **#138 (Sprint 42b)**: `coach_level_rating_seed` — seed
  de rating por nível validado (`coachSeed.js`, 4 testes):
  `seedFromValidatedLevelId` + `pickRatingSeed`. Nível
  validado tem prioridade.
- **#139 (Sprint 42c)**: `coach_public_discovery` — diretório
  de professores ganha **filtros de preço** (R$/h até),
  "só aceitando alunos" e **ordenação** (relevância /
  menor / maior preço). Client-side sobre a lista já
  buscada. Descoberta é o gargalo nº 1 do professor.

### Decisões D- (PRs #137-#139)

1. **D-COACH-STUDENT-PROGRESS-REUSA-CACHE (PR #137)**:
   reusa `useNationalRanking` — sem query nova.
2. **D-COACH-LEVEL-RATING-SEED-PRIORIDADE-VALIDADO (PR #138)**:
   nível validado (via teste) tem prioridade sobre
   declaração manual.
3. **D-COACH-DISCOVERY-CLIENT-SIDE (PR #139)**: filtros
   client-side sobre o que já foi buscado (sem refetch).

---

## 45. Sprint 43 — PR #120 + Refactor Waves (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.

### PRs

- **#120 (Sprint 43a)**: admin — moderação de atletas
  (já descrito em §40).
- **Onda O — Refactor (lotes 1-2)**: conversão de flags
  em código (lotes 1 e 2) + enxugar catálogo para a
  única flag remanescente. **137 feature flags ativas
  viraram código** (default ON em produção).
  - `12f6243` — lote 1 (hooks + componentes)
  - `033ae39` — lote 2 (páginas/componentes)
  - `bca36d8` — V2Layout + Arena V3 + guards; remove
    `ProfileCompletionModal` V1.
  - `9cb24b6` — enxugar catálogo.
  - `0f824b0` — remover páginas V1 mortas em
    `src/modules/*/pages`.

### Decisões D- (Onda O)

1. **D-FLAGS-EM-CODIGO-POR-DEFAULT (lotes 1-2)**: o que
   estava maduro e estável virou código (sem flag). 137
   flags desnecessárias removidas.
2. **D-V1-LEGACY-REMOVIDO (Onda O)**: `src/modules/*/pages`
   (V1) morto. `ProfileCompletionModal` V1 removido.
3. **D-FEATUREFLAGGUARD-REMOVIDO (Onda O)**: o guard genérico
   não era mais necessário (só 14 flags ativas, todas com
   gates explícitos no código).

---

## 46. Sprint 44 — PRs #110, #108-#110: DUPR export + bulk re-sync (2026-08-31)

> Atualizado em **2026-08-31, 11:05 GMT-3**.

### PRs

- **PRs #108-#110**: sistema de exportação de partidas para
  DUPR (CSV).
  - `dupr_match_export` (flag, default OFF).
  - Resolve `dupr_id` do `users/{uid}` (source of truth), não
    do espelho `athlete_profiles` (PR review).
  - Exclui jogos sem placar (`0×0`) — 2 testes.
  - Bulk re-sync do diretório (source of truth `users`).
  - Per-button busy label (review feedback).

### Decisões D- (PRs #108-#110)

1. **D-DUPR-ID-SOURCE-OF-TRUTH-USERS (PRs #108-#110)**:
   `dupr_id` resolvido de `users/{uid}`, não de
   `athlete_profiles/{uid}` (espelho pode estar
   desatualizado).
2. **D-DUPR-EXPORT-EXCLUI-ZEROS (PRs #108-#110)**: jogos
   `0×0` não entram no CSV.
3. **D-ATHLETES-RESYNC-EM-MASSA (PRs #108-#110)**: bulk
   re-sync (botão no admin) garante consistência
   `users → athlete_profiles` em massa.
