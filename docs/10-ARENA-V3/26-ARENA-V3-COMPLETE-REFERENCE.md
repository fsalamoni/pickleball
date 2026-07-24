# Arena V3 — Guia Rápido de Referência (2026-07-24, sync com Sprints 6-10)

> **TL;DR**: A Arena V3 está **100% deployada em produção**. Regras, índices, Cloud Functions, repositório GitHub — tudo no ar.

## 🎯 Onde estamos

```
┌──────────────────────────────────────────────────────────────┐
│  PickleRush Arena V3 + Sprints 6-10 — STATUS (2026-07-24)  │
│                                                              │
│  ✅ Código: 11 sprints Arena V3 + Sprints 6-10 (Sprints      │
│     6 bugs + 7 calendar + 8 coach+shared + 8a admin +         │
│     9 court grid + 10 backlog 10 ondas)                      │
│  ✅ Testes: 1334+ (100% verdes)                              │
│  ✅ Build: green, ~22s                                       │
│  ✅ Lint: 0 errors                                           │
│  ✅ Firestore: 92 collections (era 39 no Sprint 0)           │
│  ✅ Feature flags: 124 (era 30 no Sprint 0)                  │
│  ✅ Cloud Functions: 5/5 deployadas (SP region)              │
│  ✅ GitHub: main em 56dba26, deploy via GitHub Actions       │
│  ✅ Bundle deployed: index-CJmY5B8O.js (PR #67, sw-v73.6)   │
└──────────────────────────────────────────────────────────────┘
```

## 👤 Você (Platform Admin)

- **UID**: `Kx7CC0NVgogh8cCF4wIRmpOvo7r2`
- **Nome**: Flavio Salomone
- **Role**: `platform_admin` (acesso total)
- **Estado**: RS

Você tem acesso a:
- Todas as arenas
- Painel de admin (`/admin/painel`)
- Moderação via `/admin/pets`
- Cloud Functions console

## 🏗️ Arquitetura da Arena V3

### Frontend (12 páginas V2)

Localização: `src/v2/pages/`

| Sprint | Página | Rota |
|---|---|---|
| 0 | V2ArenaModules | `/arenas/:id/gerir/modulos` |
| 1 | V2ArenaOpenMatch | `/arenas/:id/open-match` |
| 1 | V2ArenaMatchmaking | `/arenas/:id/matchmaking` |
| 1 | V2ArenaAdminOpenMatch | `/arenas/:id/gerir/open-match` |
| 2 | V2ArenaMembers | `/arenas/:id/membros` |
| 2 | V2ArenaAdminMembers | `/arenas/:id/gerir/membros` |
| 3 | V2ArenaPDV | `/arenas/:id/pdv` |
| 4 | V2ArenaClasses | `/arenas/:id/aulas` |
| 5 | V2ArenaLeagues | `/arenas/:id/torneios` |
| 6 | V2ArenaMarketing | `/arenas/:id/marketing` |
| 7 | V2ArenaOperations | `/arenas/:id/gerir/operacoes` |
| 8-11 | V2ArenaAdvanced | `/arenas/:id/avancado` (4 tabs) |

### Backend (35+ coleções Firestore V3 + 5 Cloud Functions)

```
Firestore (antonov-82411 / pickleball DB)
├── arena_settings          (config geral da arena)
├── arena_module_states     (per-arena opt-in)
├── arena_open_slots        (sprint 1)
├── arena_waitlist          (sprint 1)
├── arena_matches           (sprint 1)
├── arena_members           (sprint 2)
├── arena_packages          (sprint 2)
├── arena_wallets           (sprint 2)
├── arena_subscriptions     (sprint 2)
├── arena_tier_configs      (sprint 2)
├── arena_products          (sprint 3)
├── arena_sales             (sprint 3)
├── arena_payments          (sprint 3)
├── arena_coaches           (sprint 4)
├── arena_classes           (sprint 4)
├── arena_class_bookings    (sprint 4)
├── arena_internal_tournaments (sprint 5)
├── arena_ladders           (sprint 5)
├── arena_coupons           (sprint 6)
├── arena_campaigns         (sprint 6)
├── arena_nps_responses     (sprint 6)
├── arena_nps_daily         (agregação cloud)
├── arena_referrals         (sprint 6)
├── arena_checklists        (sprint 7)
├── arena_maintenance_orders (sprint 7)
├── arena_devices           (sprint 8)
├── arena_networks          (sprint 9)
└── arena_network_memberships (sprint 9)

Cloud Functions (southamerica-east1, Node 20 Gen 2)
├── recomputeRankingOnTournamentChange  (trigger, ranking)
├── expireStaleNotifications           (3h SP daily)
├── refreshLadderWeekly                (dom 23h SP)
├── aggregateNpsDaily                  (4h SP daily)
└── autoCloseChecklists                (1h SP daily)
```

### Domínio puro (testável, sem I/O)

Localização: `src/modules/arenas/domain/`

| Arquivo | Funções principais |
|---|---|
| `modules.js` | ARENA_MODULE_ID enum (50+ módulos) |
| `settings.js` | normalizeArenaSettings, isVisibleToPublic |
| `openMatch.js` | Cálculo de slots abertos |
| `waitlist.js` | Lógica de fila de espera |
| `matchmaking.js` | Score de compatibilidade |
| `members.js` | MEMBER_TIER, calculateTier, packages |
| `pdv.js` | Cálculo de carrinho, split, estoque |
| `classes.js` | Cálculo de comissão, validação |
| `leagues.js` | normalizeInternalTournament, ladder |
| `marketing.js` | NPS, cupons, referrals |
| `operations.js` | Checklists, manutenção |
| `arenaV3Advanced.js` | IoT, multi-unit, white-label, AI |

## 🚦 Como usar agora (3 cenários)

### Cenário A: Eu quero ver as páginas V2 funcionando

1. Acesse `https://picklerush.web.app` (ou seu domínio de hosting)
2. Faça login com sua conta Google (`fsalamoni@gmail.com`)
3. Vá em `/arenas` e clique em uma arena
4. Acesse `/arenas/{id}/gerir/modulos` para ver os 50+ módulos
5. Ative módulos que quiser (mestre switch + per-arena)

### Cenário B: Eu quero criar dados de teste

```bash
# Criar uma arena
firebase firestore:set arenas/arena-teste-1 --project antonov-82411 <<EOF
{
  "name": "Arena Teste",
  "owner_id": "Kx7CC0NVgogh8cCF4wIRmpOvo7r2",
  "city": "Porto Alegre",
  "state": "RS",
  "status": "active",
  "created_at": { "_seconds": 1721568000 }
}
EOF

# Conceder gestor para você mesmo (já é platform_admin, mas...)
node scripts/grant-arena-manager.mjs grant arena-teste-1 fsalamoni@gmail.com

# Criar módulo state (liga módulo)
firebase firestore:set arena_module_states/arena-teste-1_open_match --project antonov-82411 <<EOF
{
  "arena_id": "arena-teste-1",
  "module_id": "matchmaking_open_match",
  "enabled": true
}
EOF
```

### Cenário C: Eu quero deployar o front (V2 pages) para o hosting

```bash
# No seu ambiente local (Windows ou Mac)
cd /caminho/para/pickleball
git pull origin main
npm run build
firebase deploy --only hosting --project antonov-82411
```

(Esse passo ainda não foi feito — o código está no main mas o bundle de produção não foi rebuildado para incluir as 12 páginas V2.)

## 📊 Resumo executivo

| Item | Antes | Depois |
|---|---|---|
| Coleções V3 com rules | 11 | **28** (17 novas) |
| Funções automáticas | 1 | **5** (4 novas) |
| Índices compostos | 13 | **24** (11 novos) |
| Páginas V2 de gestão | 0 | **12** |
| Feature flags V3 | 0 | **50** |
| Scripts CLI | 0 | **5** |
| Testes arena-v3 | 0 | **+181 novos** (de 487 → 668) |

## 🎓 Lições aprendidas (resumo)

1. **Gate 4-níveis** (master → parent → sub-flag → arena state) é o padrão da V3
2. **Domínio puro** (testável, sem I/O) em `src/modules/arenas/domain/` com `*.test.js` ao lado
3. **Service** com `createAuditLog` + `serverTimestamp` em TODO write
4. **Hooks** com React Query `staleTime: 30_000` (60_000 para settings)
5. **Backward compat 100%** — nada do que existia foi alterado
6. **Eventarc Service Agent** demora 2-3 min para propagar permissões na primeira vez
7. **firebase deploy** exige OAuth (não funciona com GitHub PAT)

## 📞 Onde pedir ajuda

- **Firestore Rules**: `firestore.rules` na raiz + 25 docs em `docs/10-ARENA-V3/`
- **Deploy**: `deploy-arena-v3.sh` (one-click) + `24-FIREBASE-SETUP.md`
- **Troubleshooting**: `24-FIREBASE-SETUP.md` seção "Troubleshooting"
- **Status completo**: `25-DEPLOY-STATUS-FINAL.md`

---

**Última atualização**: 2026-07-21 16:08 UTC
**Mantenedor**: Flavio Salomone (platform_admin)
**Status**: 🟢 **100% DEPLOYADO**
