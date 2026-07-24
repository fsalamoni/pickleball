# Feature Flags — Arena V3

> Mapeamento de cada feature flag para o módulo/sprint correspondente. **Todas as flags nascem desligadas (false)**.

## Flag master

```js
arena_modules: false  // master switch — desliga TODOS os módulos
```

## Sub-flags (29 ao total)

### 1. Matchmaking (sprint 1)
```js
arena_module_matchmaking: false,
arena_module_matchmaking_open_match: false,
arena_module_matchmaking_partner_finder: false,
arena_module_matchmaking_waitlist: false,
```

### 2. Membros (sprint 2)
```js
arena_module_members: false,
arena_module_members_tiers: false,
arena_module_members_packages: false,
arena_module_members_subscription: false,
arena_module_members_wallet: false,
```

### 3. PDV (sprint 3)
```js
arena_module_pdv: false,
arena_module_pdv_catalog: false,
arena_module_pdv_pix_native: false,
arena_module_pdv_split: false,
```

### 4. Aulas (sprint 4)
```js
arena_module_classes: false,
arena_module_classes_catalog: false,
arena_module_classes_packages: false,
arena_module_classes_marketplace: false,
```

### 5. Torneios internos (sprint 5)
```js
arena_module_leagues: false,
arena_module_leagues_internal: false,
arena_module_leagues_ladder: false,
arena_module_leagues_open_play: false,
arena_module_leagues_prizing: false,
```

### 6. Marketing (sprint 6)
```js
arena_module_marketing: false,
arena_module_marketing_campaigns: false,
arena_module_marketing_loyalty: false,
arena_module_marketing_coupons: false,
arena_module_marketing_referral: false,
arena_module_marketing_nps: false,
```

### 7. Operações (sprint 7)
```js
arena_module_operations: false,
arena_module_operations_checklist: false,
arena_module_operations_maintenance: false,
arena_module_operations_inventory: false,
arena_module_operations_staff: false,
```

### 8. IoT (sprint 8)
```js
arena_module_iot: false,
arena_module_iot_qr_kiosk: false,
arena_module_iot_lighting: false,
arena_module_iot_sensors: false,
arena_module_iot_video_replay: false,
```

### 9. Multi-unidade (sprint 9)
```js
arena_module_multi_unit: false,
arena_module_multi_unit_network: false,
arena_module_multi_unit_consolidated_bi: false,
arena_module_multi_unit_cross_booking: false,
```

### 10. White label (sprint 10)
```js
arena_module_white_label: false,
arena_module_white_label_branding: false,
arena_module_white_label_domain: false,
arena_module_white_label_app: false,
```

### 11. AI (sprint 11)
```js
arena_module_ai: false,
arena_module_ai_pricing: false,
arena_module_ai_matchmaking: false,
arena_module_ai_forecast: false,
```

## Hierarquia de flags

```
arena_modules (master)
├── arena_module_matchmaking
│   ├── arena_module_matchmaking_open_match
│   ├── arena_module_matchmaking_partner_finder
│   └── arena_module_matchmaking_waitlist
├── arena_module_members
│   ├── arena_module_members_tiers
│   ├── arena_module_members_packages
│   ├── arena_module_members_subscription
│   └── arena_module_members_wallet
... (etc)
```

**Regra**: a sub-filha só funciona se a flag pai está ON.
- Se `arena_modules = false` → TUDO off
- Se `arena_module_matchmaking = false` → todas as filhas off (mesmo se filhas on)
- Se `arena_module_matchmaking = true` + `arena_module_matchmaking_open_match = false` → só partner_finder e waitlist funcionam
- Etc.

## Aplicação na UI

```jsx
// Componente só renderiza se a flag global E a sub-flag E a arena habilitaram
function OpenMatchButton({ arena }) {
  const { flags } = useFeatureFlags();
  const { canUse } = useArenaModuleState(arena.id, 'matchmaking_open_match');
  
  if (!flags.arena_module_matchmaking) return null;
  if (!flags.arena_module_matchmaking_open_match) return null;
  if (!canUse) return null;  // arena não habilitou
  
  return <button>Open Match</button>;
}
```

## Painel admin

- **Platform admin** (no `/admin/painel`): pode ligar/desligar flags globais
- **Arena manager** (no `/arenas/:id/gerir/modulos`): pode ligar/desligar módulos da sua arena (se a flag pai global estiver on)

## Migration

A flag `arena_modules` precisa ser adicionada ao `DEFAULT_FEATURE_FLAGS` em `src/core/featureFlags.js`. As 29 sub-flags também. O `normalizeFeatureFlags` ignora chaves desconhecidas, então se uma arena tiver dados legados no Firestore, o default é aplicado (tudo off).

## Auditoria

Toda mudança de flag (global ou por arena) gera `audit_log`:
- `arena_module_enabled` (arena + module + actor)
- `arena_module_disabled` (arena + module + actor)
- `arena_module_config_updated` (arena + module + actor + fields)
- `feature_flag_changed` (flag + old_value + new_value + actor)
