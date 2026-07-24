# Sprint 1 — MATCHMAKING & OPEN MATCH

**Status**: 🚧 Em andamento

**Pré-requisito**: Sprint 0 completo.

## Flags

- `arena_module_matchmaking` (pai)
- `arena_module_matchmaking_open_match` (filho)
- `arena_module_matchmaking_partner_finder` (filho)
- `arena_module_matchmaking_waitlist` (filho)

**Todas desligadas por padrão.**

## Funcionalidades

### Open Match
- Arena publica horários com vagas ociosas
- Atleta vê lista de vagas abertas (filtrar por nível, data, cidade)
- Atleta se inscreve em 1-tap
- Arena vê lista de inscritos e gerencia vagas

### Partner Finder
- Atleta procura parceiro por:
  - Nível (DUPR-style, depois integrável)
  - Cidade
  - Disponibilidade (data, horário)
  - Objetivo (social, competitivo, treino)
- Lista ordenada por compatibilidade
- CTA para abrir chat

### Waitlist
- Quando horário lota, atleta entra na fila
- Notificação push quando vaga libera
- Aceitar/recusar vaga em 5min
- Auto-promove o próximo se não aceitar

## Novas coleções

### `arena_open_slots/{slotId}`

```js
{
  id: 'slot_xxx',
  arena_id: 'arena_123',
  court: 'Quadra 1',
  date: '2026-07-25',  // YYYY-MM-DD
  start: '19:00',
  end: '21:00',
  total_spots: 4,
  filled_spots: 1,
  min_level: 2.0,  // opcional
  max_level: 4.0,  // opcional
  price: 50,  // opcional (se null, usa o da arena)
  format: 'duplas',  // 'simples' | 'duplas' | 'mistas' | 'open'
  notes: 'Vagas para o jogo das 19h. Trazer raquete própria.',
  status: 'open',  // 'open' | 'full' | 'cancelled' | 'completed'
  created_by: 'uid_xxx',
  created_at: Timestamp,
  updated_at: Timestamp,
  participants: ['uid_1', 'uid_2'],  // array de uids inscritos
}
```

### `arena_waitlist/{waitlistId}`

```js
{
  id: 'wl_xxx',
  arena_id: 'arena_123',
  slot_id: 'slot_xxx',  // ou booking_id se for reserva
  slot_kind: 'open_match',  // 'open_match' | 'booking'
  athlete_id: 'uid_xxx',
  athlete_name: 'Flavio',
  position: 2,  // ordem na fila
  status: 'waiting',  // 'waiting' | 'notified' | 'accepted' | 'declined' | 'expired'
  notified_at: null,
  notification_expires_at: null,
  joined_at: Timestamp,
}
```

## Domínio puro

- `domain/openMatch.js`:
  - `canJoinOpenSlot(slot, user, userProfile)` — verifica se pode se inscrever
  - `isSlotOpen(slot, now)` — verifica se slot está aberto para inscrição
  - `getSlotAvailableSpots(slot)` — quantas vagas faltam
  - `getSlotFillPct(slot)` — % de ocupação

- `domain/matchmaking.js`:
  - `matchScore(user, candidate, criteria)` — score 0-100 de compatibilidade
  - `sortByMatchScore(users, criteria)` — ordena
  - `matchesCriteria(user, criteria)` — filtro

- `domain/waitlist.js`:
  - `getNextInLine(waitlist)` — próximo da fila
  - `isExpired(notification, nowMs)` — expirou em 5 min
  - `promoteNext(waitlist, slotId)` — promove (puro, retorna ações)

## Services

- `services/openMatchService.js`:
  - `createOpenSlot`, `updateOpenSlot`, `cancelOpenSlot`
  - `listOpenSlots(arenaId, filters)`
  - `joinOpenSlot(slotId, user)` — valida + adiciona
  - `leaveOpenSlot(slotId, userId)`

- `services/matchmakingService.js`:
  - `findPartners(arenaId, criteria)` — busca por compatibilidade
  - `getMatchSuggestions(userId, arenaId)`

- `services/waitlistService.js`:
  - `joinWaitlist(slotId, user)`
  - `leaveWaitlist(slotId, userId)`
  - `notifyNextInLine(slotId)` — promove o próximo
  - `acceptWaitlistPromotion(waitlistId)`
  - `declineWaitlistPromotion(waitlistId)`
  - `expireStaleNotifications()` — Cloud Function cron

## Hooks (useArenaV3.js — extensão)

- `useArenaOpenSlots(arenaId, filters)` — lista de slots
- `useOpenSlot(slotId)` — detalhe
- `useJoinOpenSlot()` — mutation
- `useLeaveOpenSlot()` — mutation
- `useCreateOpenSlot()` — mutation
- `useArenaWaitlist(slotId)` — fila do slot
- `useJoinWaitlist()` — mutation
- `useWaitlistForUser(userId)` — fila do user

## Páginas V2

### Públicas (atleta)
- `/arenas/:arenaId/open-match` — lista de vagas abertas
- `/arenas/:arenaId/open-match/:slotId` — detalhe + inscrição
- `/arenas/:arenaId/matchmaking` — busca de parceiro
- `/arenas/:arenaId/minha-fila` — minha waitlist

### Admin
- `/arenas/:arenaId/gerir/open-match` — gestor cria/edita slots
- `/arenas/:arenaId/gerir/open-match/:slotId` — inscritos + ações

## Tarefas

1. [ ] Documentar sprint 1 (este doc)
2. [ ] Domínio puro: openMatch.js + matchmaking.js + waitlist.js
3. [ ] Testes do domínio (15+ testes)
4. [ ] Service: openMatchService.js
5. [ ] Service: matchmakingService.js
6. [ ] Service: waitlistService.js
7. [ ] Hooks (estender useArenaV3)
8. [ ] Página pública V2ArenaOpenMatch (lista)
9. [ ] Página pública V2ArenaOpenMatchDetail (detalhe + inscrição)
10. [ ] Página pública V2ArenaMatchmaking (busca)
11. [ ] Página admin V2ArenaAdminOpenMatch (gerir)
12. [ ] Adicionar rotas em V2App
13. [ ] Adicionar links no V2ArenaPublic (header + sidebar)
14. [ ] Notificações (join/leave/promote)
15. [ ] Testes de integração (5+)
16. [ ] Validação: lint + build + todos os testes
17. [ ] Commits atômicos

## Critério de done

- [ ] Lint verde
- [ ] Build verde
- [ ] 487+ testes existentes passando
- [ ] 15+ novos testes passando
- [ ] Nenhuma rota/comportamento existente alterado
- [ ] Flag master + sub-flags visíveis no admin console
- [ ] Página de módulos mostra os novos
