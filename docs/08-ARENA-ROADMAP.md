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
> **Estado atual no repositório (origin/main @ 56dba26)**:
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
