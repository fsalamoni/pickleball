# Design do Banco de Dados — Bolão Copa 2026

## 1. Estratégia de Isolamento

### 1.1 Firestore Multi-Database (Isolamento entre Plataformas)

O projeto Firebase `hocapp-44760` hospeda **múltiplas plataformas**. Para garantir que os dados de uma plataforma não afetem outra, utilizamos **Firestore Multi-Database**:

```
hocapp-44760 (projeto Firebase)
├── (default)               ← outras plataformas
├── bolao2026               ← banco DEDICADO desta plataforma
└── ... (outras plataformas)
```

**Configuração:**
```javascript
// src/core/config/firebase.js
export const db = getFirestore(app, 'bolao2026');
```

```typescript
// functions/src/core/firestore.ts
export const db = getFirestore('bolao2026');
```

Isso garante que coleções desta plataforma NUNCA colidam com outras.

### 1.2 Isolamento por Bolão (Pool Isolation)

Cada bolão tem seu próprio "namespace" lógico através de:
- **pool_id** como chave estrangeira em TODAS as coleções de dados do bolão
- Regras de segurança que só permitem acesso a membros do bolão
- IDs determinísticos que previnem duplicatas

**Coleções do bolão (todas usam pool_id como filtro):**
- `pool_memberships` — membros e pontuações
- `bets` — palpites dos membros
- `special_bets` — palpites especiais
- `processed_scores` — cache de pontuação processada
- `pool_stage_aggregates` — agregados por fase

### 1.3 Isolamento por Usuário (User Isolation)

Cada usuário tem dados próprios:
- `users` — perfil, configurações, roles
- `notifications` — notificações pessoais
- Seus palpites são identificados por `user_id` em todas as coleções

---

## 2. Estrutura de Coleções

### 2.1 Coleções Globais da Plataforma (database: `bolao2026`)

```
platform_config/          ← Configurações globais da plataforma
  └── {docId}
      ├── maintenance_mode: boolean
      ├── max_pools_per_user: number
      └── ...

users/                    ← Perfis de usuários
  └── {userId}
      ├── email: string
      ├── display_name: string
      ├── platform_name: string
      ├── photo_url: string
      ├── role: 'user' | 'platform_admin'
      ├── can_create_pools: boolean
      ├── accepted_terms_at: timestamp
      ├── created_at: timestamp
      └── updated_at: timestamp

pool_creator_requests/    ← Solicitações para criar bolões
  └── {userId}
      ├── user_id: string
      ├── status: 'pending' | 'approved' | 'rejected'
      ├── reason: string
      ├── reviewed_by: string | null
      ├── reviewed_at: timestamp | null
      └── created_at: timestamp

platform_metrics/         ← Métricas agregadas (cache)
  └── {metricId}
      ├── total_users: number
      ├── total_pools: number
      ├── total_bets: number
      └── computed_at: timestamp

audit_logs/               ← Logs de auditoria
  └── {logId}
      ├── action: string
      ├── user_id: string
      ├── target: string
      ├── details: map
      └── timestamp: timestamp

notifications/            ← Notificações de usuários
  └── {notifId}
      ├── user_id: string
      ├── title: string
      ├── message: string
      ├── type: string
      ├── read: boolean
      ├── read_at: timestamp | null
      └── created_at: timestamp
```

### 2.2 Coleções do Torneio (Dados Estáticos, Read-Only para clientes)

```
tournaments/
  └── {tournamentId}
      ├── name: 'Copa do Mundo FIFA 2026'
      ├── champion_team_id: string | null (preenchido ao final)
      ├── top_scorer_player_name: string | null (preenchido ao final)
      ├── status: 'scheduled' | 'live' | 'finished'
      └── ...

stages/
  └── {stageId}
      ├── name: string
      ├── stage_code: 'group' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
      ├── sequence: number
      └── ...

teams/
  └── {teamId}
      ├── code: string (ex: 'BRA')
      ├── name: string (ex: 'Brasil')
      ├── flag_url: string
      └── ...

matches/
  └── {matchId}
      ├── tournament_id: string
      ├── stage_id: string
      ├── stage_code: string
      ├── group_id: string | null
      ├── sequence_in_stage: number
      ├── home_team_id: string
      ├── away_team_id: string
      ├── kickoff_at: timestamp
      ├── bet_lock_at: timestamp
      ├── zebra_team_id: string | null
      ├── zebra_multiplier: 2 | 3 | 4 | null
      ├── official_home_score: number | null
      ├── official_away_score: number | null
      ├── penalty_winner_team_id: string | null
      └── status: 'scheduled' | 'live' | 'finished'

scoring_tiers/
  └── {tierId}
      ├── stage_code: string
      ├── exact_score: number
      ├── winner_plus_diff: number
      ├── winner_plus_team_goals: number
      ├── winner_only: number
      ├── team_goals_only: number
      └── penalty_winner: number
```

### 2.3 Coleções dos Bolões

```
pools/
  └── {poolId}
      ├── name: string
      ├── description: string
      ├── invite_code: string (único, 6 caracteres)
      ├── owner_user_id: string
      ├── entry_fee: number (0 = gratuito)
      ├── template_code: string (ex: 'worldCup2026')
      ├── tournament_id: string | null
      ├── settings: {
      │   deadline_overrides: { [stageCode]: timestamp },
      │   ...
      │ }
      ├── stats: {
      │   members_count: number,
      │   total_bets: number,
      │   ...
      │ }
      ├── created_at: timestamp
      └── updated_at: timestamp

pool_memberships/
  └── {userId}_{poolId}  ← ID determinístico
      ├── user_id: string
      ├── pool_id: string
      ├── user_email_snapshot: string
      ├── user_name_snapshot: string
      ├── user_photo_snapshot: string
      ├── role: 'owner' | 'admin' | 'participant'
      ├── points: number
      ├── buchas: number
      ├── super_buchas: number
      ├── group_stage_position: number | null
      ├── joined_at: timestamp
      └── invite_code_used: string | null
```

### 2.4 Coleções de Palpites

```
bets/
  └── {userId}_{poolId}_{matchId}  ← ID determinístico
      ├── user_id: string
      ├── pool_id: string
      ├── match_id: string
      ├── predicted_home: number
      ├── predicted_away: number
      ├── penalty_winner_team_id: string | null
      ├── revealed: boolean
      └── updated_at: timestamp

special_bets/
  └── {userId}_{poolId}_{type}  ← ID determinístico
      ├── user_id: string
      ├── pool_id: string
      ├── type: 'champion' | 'top_scorer'
      ├── team_id: string | null
      ├── player_name: string | null
      ├── revealed: boolean
      └── updated_at: timestamp
```

### 2.5 Coleções de Cache e Agregação

```
processed_scores/
  └── {userId}_{poolId}_{matchId}
      ├── user_id: string
      ├── pool_id: string
      ├── match_id: string
      ├── base_points: number
      ├── penalty_points: number
      ├── multiplier: number
      ├── total_points: number
      ├── is_bucha: boolean
      ├── is_super_bucha: boolean
      ├── zebra_applied: boolean
      ├── hit_type: string
      └── computed_at: timestamp

pool_stage_aggregates/
  └── {userId}_{poolId}_{stageId}
      ├── user_id: string
      ├── pool_id: string
      ├── stage_code: string
      ├── total_points: number
      ├── buchas: number
      ├── super_buchas: number
      └── computed_at: timestamp
```

---

## 3. Estratégia de Indexação e Caching

### 3.0 Status em Produção — 05/05/2026

- O arquivo canônico de índices é [firestore.indexes.json](../firestore.indexes.json).
- O cache client-side canônico é configurado em `src/App.jsx` via TanStack React Query: `staleTime: 30_000` e `refetchOnWindowFocus: false`.
- Leituras críticas de experiência em tempo real continuam usando listeners Firestore (`onSnapshot`) nos hooks/services dos módulos.
- Tabelas largas no frontend devem usar wrappers com rolagem horizontal, como `.arena-table-wrap`, para não criar overflow de página em mobile.
- Build frontend usa code splitting por rota (`React.lazy`/`Suspense`) e chunks nomeados no Vite: `vendor` e `vendor-firebase-*` separados por domínio. Arquivos recebem hash em `dist/assets`, então podem ser cacheados agressivamente pelo Hosting sem prender HTML antigo.
- Smoke E2E público (`npm run e2e:public`) valida em produção os chunks lazy e ausência de overflow em desktop/mobile; smoke autenticado (`npm run e2e:auth`) usa `tests/.auth` local e não versionado, gerável por login manual ou `npm run e2e:auth:admin` com Firebase Admin custom token.
- Observabilidade frontend é opt-in: Analytics/Performance só inicializam com envs `VITE_ENABLE_FIREBASE_ANALYTICS=true` ou `VITE_ENABLE_FIREBASE_PERFORMANCE=true`; rotas de bolão são sanitizadas antes de page view.
- Healthcheck operacional (`npm run health:production`) valida rewrites públicas e a política de cache: `index.html` sem cache e assets hashados com `max-age=31536000, immutable`; o workflow `Production Healthcheck` roda a cada 30 minutos no GitHub Actions.
- Antes de adicionar uma query com `where + orderBy` ou múltiplos filtros por coleção, atualizar este documento e [firestore.indexes.json](../firestore.indexes.json) no mesmo commit.

### 3.1 Índices Compostos (firestore.indexes.json)

| Coleção | Campos | Propósito |
|---------|--------|-----------|
| pool_memberships | user_id ASC, joined_at DESC | Meus bolões ordenados |
| pool_memberships | pool_id ASC, points DESC | Leaderboard do bolão |
| pool_memberships | pool_id ASC, joined_at DESC | Membros por data |
| matches | tournament_id ASC, kickoff_at ASC | Jogos do torneio ordenados |
| matches | tournament_id ASC, stage_code ASC, sequence_in_stage ASC | Jogos por fase do torneio ordenados |
| matches | stage_id ASC, sequence_in_stage ASC | Jogos por fase |
| stages | tournament_id ASC, sort_order ASC | Fases do torneio ordenadas |
| special_bets | user_id ASC, pool_id ASC | Palpites especiais por usuário e bolão |
| bets | user_id ASC, pool_id ASC, updated_at DESC | Meus palpites recentes |
| bets | pool_id ASC, match_id ASC, revealed ASC | Palpites revelados do bolão |
| processed_scores | user_id ASC, pool_id ASC, computed_at DESC | Scores processados |
| notifications | user_id ASC, created_at DESC | Notificações do usuário |

### 3.2 Estratégia de Caching no Frontend

**TanStack React Query** gerencia cache local com:
- `staleTime: 30_000` (30 segundos) — dados são considerados frescos por 30s
- `refetchOnWindowFocus: false` — evita recargas desnecessárias
- Dados em tempo real via `onSnapshot` (Firestore listeners) para coleções críticas:
  - Pools e memberships
  - Leaderboard
  - Bets do usuário

**Dados com cache/listeners por contexto:**
- Pools, memberships, leaderboard, notificações e bets do usuário usam listeners em tempo real quando a UX depende de atualização imediata.
- Dados estáticos do torneio (`tournaments`, `stages`, `teams`, `scoring_tiers`) podem ser reaproveitados entre telas via hooks e cache do React Query.
- Listas de jogos (`matches`) são lidas por torneio/fase e devem respeitar os índices de `tournament_id + stage_code + sequence_in_stage` ou `tournament_id + kickoff_at`.
- Métricas administrativas agregadas usam contadores do Firestore e não devem expor palpites individuais antes do reveal.

**Cache de agregação (servidor):**
- `pool_stage_aggregates/` — atualizado pela Cloud Function após cada cálculo de pontuação
- `platform_metrics/` — atualizado periodicamente (scheduled function)

---

## 4. Regras de Acesso por Role

| Coleção | user | participant | pool_admin | pool_owner | platform_admin |
|---------|------|-------------|------------|------------|----------------|
| users (próprio) | RW | RW | RW | RW | RW |
| users (outros) | R | R | R | R | RW |
| pools | - | R (seu) | RW (seu) | RW (seu) | RW (todos) |
| pool_memberships | - | R (seu) | RW (seu) | RW (seu) | RW (todos) |
| bets (próprio) | - | RW | RW | RW | R |
| bets (outros, revealed) | - | R | R | R | R |
| matches | - | R | R | R | RW |
| special_bets | - | RW | RW | RW | R |
| notifications (próprio) | RW | RW | RW | RW | - |
| audit_logs | - | - | - | - | R |

**Legenda:** R = Read, W = Write, RW = Read+Write, - = Sem acesso

---

## 5. Migração para Multi-Database

### Passos para migrar do `(default)` para `bolao2026`:

1. **Criar database `bolao2026`** via Firebase Console ou gcloud:
   ```bash
   gcloud firestore databases create --database=bolao2026 --location= southamerica-east1
   ```

2. **Atualizar inicialização do Firestore** no frontend e functions:
   ```javascript
   // Antes: getFirestore(app)
   // Depois: getFirestore(app, 'bolao2026')
   ```

3. **Migrar dados existentes** (se houver) via script de export/import

4. **Atualizar firestore.rules** para contemplar o novo database

5. **Atualizar firebase.json emulators** para incluir database name

---

> **Última atualização:** 05/05/2026
> **Versão:** 1.1.0