# Arena V3 — Plano de Sprints (12 sprints)

> Roadmap de implementação progressiva, segura e testada. Cada sprint é auto-contido, com commits atômicos, feature flag desligada por padrão, e zero impacto no que existe.

## Visão geral

| Sprint | Nome | Flags (qtd) | Esforço | Valor p/ arena |
|---|---|---|---|---|
| 0 | **FUNDAÇÃO** | 1 | 2 dias | ⭐⭐⭐⭐⭐ (pré-requisito) |
| 1 | Matchmaking & Open Match | 3 | 2 dias | ⭐⭐⭐⭐ |
| 2 | Membros & Pacotes | 4 | 3 dias | ⭐⭐⭐⭐⭐ |
| 3 | PDV & Pagamentos | 3 | 3 dias | ⭐⭐⭐⭐ |
| 4 | Aulas & Instrutores | 3 | 3 dias | ⭐⭐⭐⭐ |
| 5 | Torneios internos & Ladder | 4 | 3 dias | ⭐⭐⭐ |
| 6 | Marketing & Fidelidade | 5 | 3 dias | ⭐⭐⭐⭐⭐ |
| 7 | Operações & Equipe | 4 | 2 dias | ⭐⭐⭐ |
| 8 | IoT & Integrações | 4 | 4 dias | ⭐⭐ |
| 9 | Multi-unidade (rede) | 3 | 3 dias | ⭐⭐⭐ |
| 10 | White label & Personalização | 3 | 2 dias | ⭐⭐⭐⭐ |
| 11 | AI & Smart features | 3 | 4 dias | ⭐⭐⭐⭐ |

**Total**: 29 feature flags, ~36 dias-homem. Pode ser feito em paralelo por 3-4 devs em ~3-4 meses.

---

## Sprint 0 — FUNDAÇÃO (atual)

**Objetivo**: Criar a infraestrutura para todos os outros sprints.

**Entregas:**
1. **Flag global `arena_modules`** (pai de todos os outros módulos) — desliga TUDO
2. **Sub-flags** (todas desligadas) para cada módulo:
   - `arena_module_matchmaking`
   - `arena_module_members`
   - `arena_module_pdv`
   - `arena_module_classes`
   - `arena_module_leagues`
   - `arena_module_marketing`
   - `arena_module_operations`
   - `arena_module_iot`
   - `arena_module_multi_unit`
   - `arena_module_white_label`
   - `arena_module_ai`
3. **Coleção `arena_settings/{arenaId}`** — settings por arena
4. **Coleção `arena_module_states/{arenaId_moduleId}`** — quais módulos a arena habilitou
5. **Domínio puro**:
   - `ARENA_MODULE_ID` (enum)
   - `canArenaUseModule(arena, moduleId)` — gate logic
   - `normalizeArenaSettings()`
6. **Hooks**:
   - `useArenaSettings(arenaId)`
   - `useArenaModuleStates(arenaId)`
   - `useCanArenaUseModule(arenaId, moduleId)`
   - `useToggleArenaModule(arenaId, moduleId)`
7. **Service**:
   - `getArenaSettings`, `updateArenaSettings`
   - `getArenaModuleStates`, `setArenaModuleState`
8. **Firestore rules**:
   - Acesso a `arena_settings` só por gestor da arena + platform admin
   - Acesso a `arena_module_states` só por gestor da arena + platform admin
9. **Páginas V2**:
   - `V2ArenaModules` (em `/arenas/:id/gerir/modulos`) — gestor liga/desliga módulos
   - Refatorar `V2ArenaManage` para usar nova arquitetura (mas sem mudar comportamento)
10. **Testes**:
    - `domain/modules.test.js` (5+ testes)
    - `services/settingsService.test.js` (mock Firestore)
11. **Docs**:
    - `02-FOUNDATION.md` (atualizado com implementação)
    - `10-MODULES-CATALOG.md`
    - `11-DATA-MODEL.md`
    - `12-FEATURE-FLAGS.md`
    - `13-ROUTING-UX.md`
    - `14-FIRESTORE-RULES.md`
    - `15-BUSINESS-LOGIC.md`

**Critério de done**:
- [x] Flag global `arena_modules` no Firestore (off)
- [x] 11 sub-flags no Firestore (off)
- [x] Coleções criadas
- [x] Domínio puro + testes (5+ passing)
- [x] Hooks + service + testes (3+ passing)
- [x] Rules atualizadas (sem quebrar nada)
- [x] Página V2ArenaModules funcional
- [x] V2ArenaManage continua funcionando igual
- [x] Lint verde
- [x] Build verde
- [x] Todos os testes existentes continuam passing

---

## Sprint 1 — MATCHMAKING & OPEN MATCH

**Flags**: `arena_module_matchmaking_open_match`, `arena_module_matchmaking_partner_finder`, `arena_module_matchmaking_waitlist`

**Novas coleções**:
- `arena_open_slots/{slotId}` — vagas abertas por horário
- `arena_waitlist/{waitlistId}` — lista de espera

**Funcionalidades**:
- Open Match (arena publica horário com vagas)
- Matchmaking por nível (atleta procura parceiro)
- Waitlist automática (vaga liberada notifica próximo)
- Open Play (sem reserva de jogador específico)

---

## Sprint 2 — MEMBROS & PACOTES

**Flags**: `arena_module_members_tiers`, `arena_module_members_packages`, `arena_module_members_subscription`, `arena_module_members_wallet`

**Novas coleções**:
- `arena_members/{arenaId_uid}` — relação arena-atleta
- `arena_packages/{pkgId}` — pacotes pré-pagos
- `arena_wallets/{arenaId_uid}` — wallet do atleta na arena
- `arena_subscriptions/{subId}` — mensalidades

**Funcionalidades**:
- Membros com tiers (Bronze/Prata/Ouro/Platina)
- Pacotes pré-pagos (10h por R$ X)
- Mensalidades recorrentes
- Wallet com saldo
- Cashback progressivo

---

## Sprint 3 — PDV & PAGAMENTOS

**Flags**: `arena_module_pdv_catalog`, `arena_module_pdv_pix_native`, `arena_module_pdv_split`

**Novas coleções**:
- `arena_products/{prodId}` — produtos da loja
- `arena_sales/{saleId}` — vendas
- `arena_payments/{paymentId}` — pagamentos

**Funcionalidades**:
- PDV (água, raquete, grip, bola, vestuário)
- Pix nativo (QR gerado no app)
- Split payment (cliente paga parte)
- Comanda digital
- Recibos e NF
- Integração com gateways (Stripe, MercadoPago, Asaas)

---

## Sprint 4 — AULAS & INSTRUTORES

**Flags**: `arena_module_classes_catalog`, `arena_module_classes_packages`, `arena_module_classes_marketplace`

**Novas coleções**:
- `arena_coaches/{coachId}` — instrutores da arena
- `arena_classes/{classId}` — aulas agendadas
- `arena_class_bookings/{bookingId}` — reservas de aula
- `arena_class_packages/{pkgId}` — pacotes de aula

**Funcionalidades**:
- Catálogo de instrutores (perfil, vídeo, bio, valor)
- Aulas avulsas, pacotes, planos
- Marketplace de instrutores autônomos
- Comissão arena/instrutor
- Avaliação do instrutor

---

## Sprint 5 — TORNEIOS INTERNOS & LADDER

**Flags**: `arena_module_leagues_internal`, `arena_module_leagues_ladder`, `arena_module_leagues_open_play`, `arena_module_leagues_prizing`

**Novas coleções**:
- `arena_internal_tournaments/{tid}` — torneios da arena
- `arena_ladders/{ladderId}` — ranking interno
- `arena_open_play_sessions/{sessionId}` — sessões de jogo aberto

**Funcionalidades**:
- Torneios internos (sem ser aberto pro público)
- Ladder semanal (com pódio)
- Open play (categoria + dia)
- Premiação (R$, brinde, crédito)

---

## Sprint 6 — MARKETING & FIDELIDADE

**Flags**: `arena_module_marketing_campaigns`, `arena_module_marketing_loyalty`, `arena_module_marketing_coupons`, `arena_module_marketing_referral`, `arena_module_marketing_nps`

**Novas coleções**:
- `arena_campaigns/{campaignId}` — campanhas de marketing
- `arena_loyalty_programs/{programId}` — programa de fidelidade
- `arena_coupons/{couponId}` — cupons
- `arena_referrals/{referralId}` — indicações
- `arena_nps_responses/{respId}` — respostas NPS

**Funcionalidades**:
- E-mail marketing segmentado
- SMS marketing
- WhatsApp Business API
- Push notifications segmentadas
- Programa de fidelidade (pontos)
- Cupons e promoções
- Programa de indicação
- NPS automatizado

---

## Sprint 7 — OPERAÇÕES & EQUIPE

**Flags**: `arena_module_operations_checklist`, `arena_module_operations_maintenance`, `arena_module_operations_inventory`, `arena_module_operations_staff`

**Novas coleções**:
- `arena_checklists/{checklistId}` — checklists (abertura/fechamento)
- `arena_maintenance_orders/{orderId}` — ordens de manutenção
- `arena_inventory/{itemId}` — estoque
- `arena_staff/{staffId}` — equipe da arena
- `arena_staff_shifts/{shiftId}` — turnos

**Funcionalidades**:
- Checklist diário (abertura/fechamento)
- Manutenção preventiva
- Estoque com alerta
- Equipe (turno, comissão, folha)
- Tarefas operacionais

---

## Sprint 8 — IOT & INTEGRAÇÕES

**Flags**: `arena_module_iot_qr_kiosk`, `arena_module_iot_lighting`, `arena_module_iot_sensors`, `arena_module_iot_video_replay`

**Novas coleções**:
- `arena_devices/{deviceId}` — dispositivos pareados
- `arena_sensor_data/{dataId}` — leituras de sensor
- `arena_video_replays/{replayId}` — replays de jogo

**Funcionalidades**:
- Totem QR de check-in
- Controle de iluminação por app
- HVAC automático
- Sensor de presença
- Câmeras + IA para replay
- Integração com APIs externas (Stripe, WhatsApp, etc.)

---

## Sprint 9 — MULTI-UNIDADE (REDE)

**Flags**: `arena_module_multi_unit_network`, `arena_module_multi_unit_consolidated_bi`, `arena_module_multi_unit_cross_booking`

**Novas coleções**:
- `arena_networks/{networkId}` — rede de arenas
- `arena_network_memberships/{arenaId}` — quais arenas pertencem à rede

**Funcionalidades**:
- Gestão de várias arenas
- BI consolidado
- Pacote rede (membro usa qualquer unidade)
- Comparativo entre unidades

---

## Sprint 10 — WHITE LABEL & PERSONALIZAÇÃO

**Flags**: `arena_module_white_label_branding`, `arena_module_white_label_domain`, `arena_module_white_label_app`

**Funcionalidades**:
- Cores e logo customizados por arena
- Domínio próprio (app.minhaarena.com.br)
- App próprio (white label)
- Tema dark/light por arena
- Email marketing com marca da arena

---

## Sprint 11 — AI & SMART FEATURES

**Flags**: `arena_module_ai_pricing`, `arena_module_ai_matchmaking`, `arena_module_ai_forecast`

**Funcionalidades**:
- Dynamic pricing (tarifa por horário, dia, demanda)
- Smart matchmaking (ML)
- Previsão de demanda
- Previsão de churn
- Chatbot de suporte
- Auto-categorização de clientes
- Recomendações personalizadas
