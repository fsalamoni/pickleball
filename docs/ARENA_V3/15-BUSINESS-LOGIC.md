# Lógica de Negócio — Arena V3

> Toda lógica que **não depende de I/O** mora em `modules/arenas/domain/`. Pura, testável, sem Firestore.

## `ARENA_MODULE_ID` (enum)

```js
// modules/arenas/domain/modules.js
export const ARENA_MODULE_ID = Object.freeze({
  MATCHMAKING: 'matchmaking',
  MATCHMAKING_OPEN_MATCH: 'matchmaking_open_match',
  MATCHMAKING_PARTNER_FINDER: 'matchmaking_partner_finder',
  MATCHMAKING_WAITLIST: 'matchmaking_waitlist',
  
  MEMBERS: 'members',
  MEMBERS_TIERS: 'members_tiers',
  MEMBERS_PACKAGES: 'members_packages',
  MEMBERS_SUBSCRIPTION: 'members_subscription',
  MEMBERS_WALLET: 'members_wallet',
  
  PDV: 'pdv',
  PDV_CATALOG: 'pdv_catalog',
  PDV_PIX_NATIVE: 'pdv_pix_native',
  PDV_SPLIT: 'pdv_split',
  
  CLASSES: 'classes',
  CLASSES_CATALOG: 'classes_catalog',
  CLASSES_PACKAGES: 'classes_packages',
  CLASSES_MARKETPLACE: 'classes_marketplace',
  
  LEAGUES: 'leagues',
  LEAGUES_INTERNAL: 'leagues_internal',
  LEAGUES_LADDER: 'leagues_ladder',
  LEAGUES_OPEN_PLAY: 'leagues_open_play',
  LEAGUES_PRIZING: 'leagues_prizing',
  
  MARKETING: 'marketing',
  MARKETING_CAMPAIGNS: 'marketing_campaigns',
  MARKETING_LOYALTY: 'marketing_loyalty',
  MARKETING_COUPONS: 'marketing_coupons',
  MARKETING_REFERRAL: 'marketing_referral',
  MARKETING_NPS: 'marketing_nps',
  
  OPERATIONS: 'operations',
  OPERATIONS_CHECKLIST: 'operations_checklist',
  OPERATIONS_MAINTENANCE: 'operations_maintenance',
  OPERATIONS_INVENTORY: 'operations_inventory',
  OPERATIONS_STAFF: 'operations_staff',
  
  IOT: 'iot',
  IOT_QR_KIOSK: 'iot_qr_kiosk',
  IOT_LIGHTING: 'iot_lighting',
  IOT_SENSORS: 'iot_sensors',
  IOT_VIDEO_REPLAY: 'iot_video_replay',
  
  MULTI_UNIT: 'multi_unit',
  MULTI_UNIT_NETWORK: 'multi_unit_network',
  MULTI_UNIT_CONSOLIDATED_BI: 'multi_unit_consolidated_bi',
  MULTI_UNIT_CROSS_BOOKING: 'multi_unit_cross_booking',
  
  WHITE_LABEL: 'white_label',
  WHITE_LABEL_BRANDING: 'white_label_branding',
  WHITE_LABEL_DOMAIN: 'white_label_domain',
  WHITE_LABEL_APP: 'white_label_app',
  
  AI: 'ai',
  AI_PRICING: 'ai_pricing',
  AI_MATCHMAKING: 'ai_matchmaking',
  AI_FORECAST: 'ai_forecast',
});
```

## Hierarquia de módulos

```js
export const MODULE_HIERARCHY = Object.freeze({
  [ARENA_MODULE_ID.MATCHMAKING]: {
    label: 'Matchmaking',
    description: '...',
    icon: 'Users',
    color: 'blue',
    children: [
      ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH,
      ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER,
      ARENA_MODULE_ID.MATCHMAKING_WAITLIST,
    ],
  },
  // ... etc
});
```

## Gate logic (coração do sistema)

```js
// modules/arenas/domain/modules.js

/**
 * Determina se uma arena pode usar um módulo.
 * @param {Object} args
 * @param {Object} args.platformFlags - flags globais (de platform_settings)
 * @param {Object} args.moduleStates - mapa de { moduleId: { enabled, config } } por arena
 * @param {string} args.moduleId - id do módulo (ARENA_MODULE_ID.*)
 * @returns {boolean}
 */
export function canArenaUseModule({ platformFlags, moduleStates, moduleId }) {
  // 1. Master switch off → nada funciona
  if (!platformFlags?.arena_modules) return false;
  
  // 2. Sub-flag pai off → módulo off
  const parent = findParentModule(moduleId);
  if (parent && !platformFlags[`arena_module_${parent}`]) return false;
  
  // 3. Sub-flag específica off
  if (!platformFlags[`arena_module_${moduleId}`]) return false;
  
  // 4. Arena não habilitou
  if (!moduleStates?.[moduleId]?.enabled) return false;
  
  return true;
}

function findParentModule(moduleId) {
  for (const [parentId, info] of Object.entries(MODULE_HIERARCHY)) {
    if (info.children?.includes(moduleId)) return parentId;
  }
  return null;
}
```

## Settings de arena

```js
// modules/arenas/domain/settings.js

const DEFAULT_SETTINGS = {
  operational: {
    timezone: 'America/Sao_Paulo',
    booking_window_days: 15,
    min_booking_lead_minutes: 60,
    cancellation_window_hours: 24,
    cancellation_refund_pct: 100,
    no_show_fee_pct: 50,
    auto_confirm_bookings: false,
    default_slot_duration_minutes: 60,
    buffer_between_bookings_minutes: 15,
  },
  notifications: {
    send_booking_confirmation: true,
    send_booking_reminder_hours_before: 2,
    send_booking_reminder_channels: ['push', 'email'],
    send_cancellation_notice: true,
    send_review_request_hours_after: 3,
  },
  payments: {
    accepted_methods: ['pix', 'credit_card', 'cash'],
    require_prepayment: true,
    pix_key: '',
    allow_split_payment: true,
    max_split_players: 4,
  },
  visibility: {
    show_pricing: true,
    show_reviews: true,
    show_capacity: true,
    show_amenities: true,
    show_contact: true,
    show_photos: true,
    show_about: true,
    show_location_map: true,
  },
  branding: {
    primary_color: '#10b981',
    accent_color: '#fbbf24',
    logo_url: '',
    cover_image_url: '',
    font_family: 'Inter',
    theme: 'auto',
  },
};

export function normalizeArenaSettings(input = {}) {
  return deepMerge(DEFAULT_SETTINGS, input);
}

export function isVisibleToPublic(settings, section) {
  return settings?.visibility?.[`show_${section}`] !== false;
}
```

## Validação de booking (extensão do existente)

```js
// modules/arenas/domain/booking.js (estende o existente)

/**
 * Verifica se um atleta pode fazer um booking na arena,
 * considerando settings da arena, módulos habilitados, e capacidade.
 */
export function canAthleteBook({
  arena,
  settings,
  platformFlags,
  moduleStates,
  user,
  slot,
  existingBookings,
}) {
  // 1. Arena aceita booking?
  if (!settings.operational.auto_confirm_bookings && !moduleStates.bookings?.enabled) {
    return { ok: false, reason: 'Reservas não habilitadas' };
  }
  
  // 2. Janela de antecedência
  const minutesAhead = (slot.start - Date.now()) / 60000;
  if (minutesAhead < settings.operational.min_booking_lead_minutes) {
    return { ok: false, reason: 'Antecedência mínima não respeitada' };
  }
  
  const daysAhead = (slot.start - Date.now()) / 86400000;
  if (daysAhead > settings.operational.booking_window_days) {
    return { ok: false, reason: 'Janela de reserva excedida' };
  }
  
  // 3. Capacidade
  const sameSlot = existingBookings.filter((b) => b.slot_id === slot.id);
  if (sameSlot.length >= arena.capacity_per_slot) {
    return { ok: false, reason: 'Slot lotado' };
  }
  
  // 4. Usuário bloqueado?
  if (moduleStates.members?.config?.blocked_user_ids?.includes(user.uid)) {
    return { ok: false, reason: 'Usuário bloqueado pela arena' };
  }
  
  return { ok: true };
}
```

## Cálculo de preço (extensão do existente)

```js
// modules/arenas/domain/pricing.js (estende o existente)

/**
 * Calcula o preço final de um booking considerando:
 * - Base price
 * - Regras por dia/horário
 * - Overrides específicos
 * - Desconto de membro (se atleta for membro e arena tiver tiers)
 * - Desconto de pacote (se atleta tiver pacote ativo)
 */
export function calculateBookingPrice({
  arena,
  settings,
  memberTier,
  activePackage,
  coupon,
  date,
  durationMinutes,
}) {
  let price = 0;
  
  // 1. Base + regras
  for (const rule of arena.price_rules || []) {
    if (matchesRule(rule, date, durationMinutes)) {
      price = rule.price;
      break;
    }
  }
  
  if (price === 0) price = arena.base_price * (durationMinutes / 60);
  
  // 2. Overrides
  for (const ov of arena.price_overrides || []) {
    if (matchesOverride(ov, date)) {
      price = ov.price;
      break;
    }
  }
  
  // 3. Desconto de membro
  if (memberTier?.discount_pct) {
    price = price * (1 - memberTier.discount_pct / 100);
  }
  
  // 4. Pacote (substitui o preço)
  if (activePackage && activePackage.remaining_hours > 0) {
    price = 0;  // usar pacote
  }
  
  // 5. Cupom
  if (coupon?.discount_pct) {
    price = price * (1 - coupon.discount_pct / 100);
  }
  
  return Math.max(0, price);
}
```

## Testes (vitest)

```js
// modules/arenas/domain/modules.test.js

import { describe, it, expect } from 'vitest';
import { canArenaUseModule, ARENA_MODULE_ID } from './modules';

describe('canArenaUseModule', () => {
  it('returns false when master switch is off', () => {
    const result = canArenaUseModule({
      platformFlags: { arena_modules: false },
      moduleStates: { matchmaking: { enabled: true } },
      moduleId: 'matchmaking',
    });
    expect(result).toBe(false);
  });
  
  it('returns false when sub-flag is off', () => {
    const result = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: false },
      moduleStates: { matchmaking: { enabled: true } },
      moduleId: 'matchmaking',
    });
    expect(result).toBe(false);
  });
  
  it('returns false when arena did not enable', () => {
    const result = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true },
      moduleStates: {},
      moduleId: 'matchmaking',
    });
    expect(result).toBe(false);
  });
  
  it('returns true when all conditions met', () => {
    const result = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true },
      moduleStates: { matchmaking: { enabled: true } },
      moduleId: 'matchmaking',
    });
    expect(result).toBe(true);
  });
  
  it('child module requires parent flag', () => {
    const result = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: true, arena_module_matchmaking_open_match: true },
      moduleStates: { matchmaking_open_match: { enabled: true } },
      moduleId: 'matchmaking_open_match',
    });
    expect(result).toBe(true);
  });
  
  it('child module blocked when parent off', () => {
    const result = canArenaUseModule({
      platformFlags: { arena_modules: true, arena_module_matchmaking: false, arena_module_matchmaking_open_match: true },
      moduleStates: { matchmaking_open_match: { enabled: true } },
      moduleId: 'matchmaking_open_match',
    });
    expect(result).toBe(false);
  });
});
```

## Convenções

1. **Toda função pura** deve ter teste em `*.test.js` ao lado
2. **Nomes claros**: `canX`, `isY`, `normalizeZ`, `calculateW`
3. **Sem `try/catch`** em funções puras — deixa o erro explodir
4. **Sem `Date.now()`** em funções puras — recebe `now` como parâmetro (testabilidade)
5. **Sem dependência de Firebase** em `domain/`
