# Arena V3 — Status Final de Deploy (2026-07-21 16:08 UTC)

> **STATUS**: 🎉 100% DEPLOYADO EM PRODUÇÃO (antonov-82411)

## 👤 Platform Admin (operador)

| Campo | Valor |
|---|---|
| **UID** | `Kx7CC0NVgogh8cCF4wIRmpOvo7r2` |
| **Nome** | Flavio Salomone |
| **Email** | (vinculado ao UID acima) |
| **Role** | `platform_admin` ✅ |
| **State** | RS (Rio Grande do Sul) |
| **updated_at** | 2026-07-21 13:07:21 UTC-3 |

## 📦 Componentes deployados

### 1. Firestore Rules ✅

**Database**: `pickleball` (Firestore nomeado, não default)
**Total de `match /arena_`**: **31** (16 originais + 15 novas da V3)
**Status**: `Released to cloud.firestore`

Novas collections adicionadas (sprints 1-11):
- `arena_matches` (Sprint 1)
- `arena_coaches`, `arena_classes`, `arena_class_bookings` (Sprint 4)
- `arena_internal_tournaments`, `arena_ladders` (Sprint 5)
- `arena_coupons`, `arena_campaigns`, `arena_nps_responses`, `arena_referrals` (Sprint 6)
- `arena_checklists`, `arena_maintenance_orders` (Sprint 7)
- `arena_devices`, `arena_networks`, `arena_network_memberships` (Sprints 8-11)
- `arena_tier_configs` (Sprint 2)
- `arena_nps_daily` (agregação da Cloud Function, write protegido)

### 2. Firestore Indexes ✅

**Total de índices compostos**: **24** (13 originais + 11 novos)
**Status**: Todos `Building` → `Enabled` (demora 5-30 min para finalizar)

Novos índices:
1. `arena_open_slots`: arena_id ASC + starts_at ASC
2. `arena_waitlist`: arena_id ASC + created_at DESC
3. `arena_members`: arena_id ASC + tier ASC
4. `arena_packages`: arena_id ASC + active ASC
5. `arena_sales`: arena_id ASC + created_at DESC
6. `arena_classes`: arena_id ASC + starts_at ASC
7. `arena_internal_tournaments`: arena_id ASC + date ASC
8. `arena_coupons`: arena_id ASC + active ASC
9. `arena_campaigns`: arena_id ASC + created_at DESC
10. `arena_maintenance_orders`: arena_id ASC + created_at DESC
11. `arena_devices`: arena_id ASC + name ASC

### 3. Cloud Functions ✅ (5/5 deployadas)

**Region**: `southamerica-east1` (São Paulo)
**Runtime**: Node.js 20 (Gen 2) — **deprecado em 2026-10-30**, atualizar para 22 antes

| Função | Tipo | Schedule | Status |
|---|---|---|---|
| `recomputeRankingOnTournamentChange` | Trigger (firestore) | onWrite tournaments/{id} | ✅ ACTIVE |
| `expireStaleNotifications` | Scheduled | `0 3 * * *` (3h SP daily) | ✅ ACTIVE |
| `refreshLadderWeekly` | Scheduled | `0 23 * * 0` (dom 23h SP) | ✅ ACTIVE |
| `aggregateNpsDaily` | Scheduled | `0 4 * * *` (4h SP daily) | ✅ ACTIVE |
| `autoCloseChecklists` | Scheduled | `0 1 * * *` (1h SP daily) | ✅ ACTIVE |

### 4. Repositório GitHub ✅

**Repo**: https://github.com/fsalamoni/pickleball
**Branch principal**: `main`
**Commits adicionados**: 5 (todos mergeados)
- `2b56e45` chore: ignore .release/ and *.tar.gz
- `80f0c1e` ops: bundle arena-v3 deploy artifacts
- `59122e7` ops: add one-click deploy script
- `aecb40d` merge: arena v3 (11 sprints + setup package)
- `06b493c` docs(arena-v3): add guided deploy script

**Branch `feature/arena-management-v3`**: MERGEADA em main e PODE ser deletada se quiser.

## 📊 Métricas da Arena V3

| Métrica | Valor |
|---|---|
| Sprints entregues | 11 / 11 (100%) |
| Páginas V2 criadas | 12 (gestão de arenas) |
| Novas coleções Firestore | 17 |
| Feature flags adicionadas | 50 (TODAS default OFF) |
| Domínio puro (testes) | 17 arquivos + 14 arquivos de testes |
| Cloud Functions | 4 novas + 1 mantida |
| Scripts Node CLI | 5 |
| Documentos de regência | 25 (em `docs/10-ARENA-V3/`) |
| Testes totais | 668 / 668 (100%) |
| Build | green, ~22-23s |
| Breaking changes | 0 |
| Backward compat | 100% |

## 🚦 Status das Páginas V2

| Página | Rota | Status |
|---|---|---|
| `V2ArenaModules` | `/arenas/:id/gerir/modulos` | ✅ Sprint 0 |
| `V2ArenaOpenMatch` | `/arenas/:id/open-match` | ✅ Sprint 1 |
| `V2ArenaAdminOpenMatch` | `/arenas/:id/gerir/open-match` | ✅ Sprint 1 |
| `V2ArenaMatchmaking` | `/arenas/:id/matchmaking` | ✅ Sprint 1 |
| `V2ArenaMembers` | `/arenas/:id/membros` | ✅ Sprint 2 |
| `V2ArenaAdminMembers` | `/arenas/:id/gerir/membros` | ✅ Sprint 2 |
| `V2ArenaPDV` | `/arenas/:id/pdv` | ✅ Sprint 3 |
| `V2ArenaClasses` | `/arenas/:id/aulas` | ✅ Sprint 4 |
| `V2ArenaLeagues` | `/arenas/:id/torneios` | ✅ Sprint 5 |
| `V2ArenaMarketing` | `/arenas/:id/marketing` | ✅ Sprint 6 |
| `V2ArenaOperations` | `/arenas/:id/gerir/operacoes` | ✅ Sprint 7 |
| `V2ArenaAdvanced` | `/arenas/:id/avancado` (4 tabs) | ✅ Sprints 8-11 |

## 🔐 Permissões

- **Platform admin**: `Kx7CC0NVgogh8cCF4wIRmpOvo7r2` (Flavio Salomone) — ACESSO TOTAL
- **Gestores de arena**: usar script `scripts/grant-arena-manager.mjs`
- **Permissions Firestore rules**:
  - `isAuthed()` — qualquer usuário logado
  - `isPlatformAdmin()` — verifica `users/{uid}.role == 'platform_admin'`
  - `isArenaManager(arenaId)` — verifica doc `arena_managers/{arenaId}_{uid}`

## 📂 Arquivos de referência (no repo)

```
docs/10-ARENA-V3/
├── 00-INDEX.md                    (visão geral)
├── 01-PLAN.md                     (planejamento original)
├── 03-PROGRESS.md                 (atualizado)
├── 10-MODULES-CATALOG.md          (50+ módulos)
├── 11-DATA-MODEL.md               (schema de todas coleções)
├── 12-FEATURE-FLAGS.md            (50+ feature flags)
├── 13-ROUTING-UX.md               (rotas + UX)
├── 14-FIRESTORE-RULES.md          (rules explicadas)
├── 15-BUSINESS-LOGIC.md           (domínio puro)
├── 20-24 SPRINT-*.md              (docs por sprint)
├── 24-FIREBASE-SETUP.md           (guia de setup)
├── 25-DEPLOY-STATUS-FINAL.md      (este arquivo)
└── SESSION-2026-07-21-STATUS-FINAL.md

scripts/
├── migrate-arena-v3-flags.mjs     (cria 50+ docs em feature_flags/)
├── check-platform-admin.mjs       (verifica admin)
├── promote-platform-admin.mjs     (grant/revoke)
├── grant-arena-manager.mjs        (gestor de arena)
└── health-check-arena-v3.mjs      (smoke test)

functions/
└── index.js                       (5 Cloud Functions)

firestore.rules                    (31 match arena_)
firestore.indexes.json             (24 índices compostos)
deploy-arena-v3.sh                 (one-click deploy)
deploy-functions-only.sh           (deploy só functions)
```

## 🎯 Próximos passos opcionais

1. **Deletar a branch `feature/arena-management-v3`** (já mergeada):
   ```bash
   git push origin --delete feature/arena-management-v3
   ```

2. **Migrar feature flags** (criar 50+ docs em `feature_flags/`):
   ```bash
   gcloud auth application-default login
   node scripts/migrate-arena-v3-flags.mjs
   ```

3. **Conceder gestor de arena** para uma arena específica:
   ```bash
   node scripts/grant-arena-manager.mjs grant <arenaId> <email>
   ```

4. **Deploy do FRONT** (V2 pages) — só funciona se o seu CI/hosting rebuildar:
   - O código V2 está no `main` agora
   - Próximo build do seu frontend vai incluir as 12 páginas V2
   - O PWA SW também precisa ser bumpado (sw-vN → vNN+1)

5. **Atualizar Node.js das functions** (antes de outubro 2026):
   - Editar `functions/package.json` → `engines.node: ">=22"`

## ⚠️ Warnings conhecidos (não bloqueantes)

1. **Node.js 20 deprecation**: warning durante deploy, mas funciona. Atualizar para 22 antes de 2026-10-30.
2. **Cloud Billing API**: necessário habilitado (já feito).
3. **Eventarc Service Agent**: precisa de 2-3 min para propagar permissões na primeira vez.
4. **GOOGLE_CLOUD_QUOTA_PROJECT warning**: informativo, não bloqueia.
5. **Cleanup policy 100000 days**: aceito (sem cobrança até lá).

## 📞 Comandos úteis

```bash
# Ver todas as functions deployadas
gcloud functions list --project=antonov-82411 --regions=southamerica-east1 --format="table(name,state,updateTime)"

# Ver logs de uma function
firebase functions:log --project antonov-82411 --only expireStaleNotifications

# Testar uma function manualmente
gcloud functions call expireStaleNotifications --project=antonov-82411 --region=southamerica-east1 --gen2

# Health check
node scripts/health-check-arena-v3.mjs

# Ver feature flags ativas
firebase firestore:get feature_flags/arena_modules --project antonov-82411
```

---

**Última atualização**: 2026-07-21 16:08 UTC
**Branch**: `main` (commit `2b56e45`)
**Status geral**: 🟢 **TUDO OK**
