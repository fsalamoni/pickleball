# Data Model — Arena V3

> Schema Firestore para as novas coleções. **Nenhuma coleção existente é alterada.** Apenas campos opcionais adicionados ao doc `arenas/{id}`.

## Coleção `arenas` (extendida — sem breaking)

### Campos atuais (mantidos)
```
id, name, description, city, state, address, neighborhood,
contact_phone, contact_whatsapp, contact_email, instagram, website,
hours, court_count, base_price, active,
photos, cover_url, price_rules, price_overrides,
rating_avg, rating_count, owner_id, owner_name,
created_at, updated_at
```

### Campos novos (todos opcionais)
```js
{
  // ...campos atuais...
  
  /** V3 — Arena V3 settings (sprint 0) */
  arena_v3_enabled: boolean,            // arena migrou para V3 (opt-in da arena)
  arena_v3_migrated_at: Timestamp,      // quando migrou
  arena_v3_migrated_by: 'uid_xxx',     // quem fez a migração
  
  /** V3 — Módulos (sprint 0, via arena_module_states) */
  // ver arena_module_states (não fica no doc da arena)
  
  /** V3 — Multi-unidade (sprint 9) */
  network_id: 'network_xxx',            // se pertence a uma rede
  network_role: 'owner' | 'franchisee',
  
  /** V3 — White label (sprint 10) */
  branding: {
    primary_color: '#10b981',
    logo_url: 'https://...',
    cover_image_url: 'https://...',
    font: 'Inter',
  },
  
  /** V3 — Custom domain (sprint 10) */
  custom_domain: 'app.minhaarena.com.br',
  
  /** V3 — Settings operacionais */
  operational_settings: {
    timezone: 'America/Sao_Paulo',
    booking_window_days: 15,           // quantos dias pra frente pode reservar
    cancellation_window_hours: 24,
    cancellation_refund_pct: 100,      // 100% = total; 50% = parcial
    no_show_fee_pct: 50,
    auto_confirm_bookings: false,      // se true, arena não precisa confirmar
  },
}
```

## Novas coleções (sprint 0+)

### `arena_settings/{arenaId}`

Doc id = arenaId (1:1 com arena).

```js
{
  id: 'arena_123',
  
  /** Configurações operacionais */
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
  
  /** Configurações de notificação */
  notifications: {
    send_booking_confirmation: true,
    send_booking_reminder_hours_before: 2,
    send_booking_reminder_channels: ['push', 'email', 'whatsapp'],
    send_cancellation_notice: true,
    send_review_request_hours_after: 3,
  },
  
  /** Configurações de pagamento */
  payments: {
    accepted_methods: ['pix', 'credit_card', 'cash', 'wallet'],
    require_prepayment: true,
    pix_key: '11999998888',
    allow_split_payment: true,
    max_split_players: 4,
  },
  
  /** Configurações de visibilidade pública */
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
  
  /** Configurações visuais (white label) */
  branding: {
    primary_color: '#10b981',
    accent_color: '#fbbf24',
    logo_url: '',
    cover_image_url: '',
    font_family: 'Inter',
    theme: 'auto',  // 'light' | 'dark' | 'auto'
  },
  
  /** Auditoria */
  created_at: Timestamp,
  updated_at: Timestamp,
  updated_by: 'uid_xxx',
}
```

### `arena_module_states/{arenaId_moduleId}`

Doc id = `{arenaId}_{moduleId}` (determinístico).

```js
{
  id: 'arena_123_matchmaking',
  arena_id: 'arena_123',
  module_id: 'matchmaking',  // ver ARENA_MODULE_ID
  enabled: true,
  enabled_at: Timestamp,
  enabled_by: 'uid_xxx',
  
  /** Config específica do módulo */
  config: {
    // matchmaking
    min_level_diff: 0.0,
    max_level_diff: 2.0,
    prefer_same_city: true,
    auto_match: false,
    
    // open_match
    auto_publish_empty_slots: false,
    min_vacancy_hours_before: 6,
    
    // pdv_catalog
    categories: ['bebidas', 'equipamentos', 'vestuario'],
    show_in_public: true,
    
    // classes
    auto_approve_instructors: false,
    
    // ... outros módulos têm config específica
  },
  
  created_at: Timestamp,
  updated_at: Timestamp,
}
```

---

## Coleções dos próximos sprints (preview)

| Sprint | Coleções |
|---|---|
| 1 (Matchmaking) | `arena_open_slots`, `arena_waitlist` |
| 2 (Membros) | `arena_members`, `arena_packages`, `arena_wallets`, `arena_subscriptions` |
| 3 (PDV) | `arena_products`, `arena_sales`, `arena_payments` |
| 4 (Aulas) | `arena_coaches`, `arena_classes`, `arena_class_bookings`, `arena_class_packages` |
| 5 (Torneios internos) | `arena_internal_tournaments`, `arena_ladders`, `arena_open_play_sessions` |
| 6 (Marketing) | `arena_campaigns`, `arena_loyalty_programs`, `arena_coupons`, `arena_referrals`, `arena_nps_responses` |
| 7 (Operações) | `arena_checklists`, `arena_maintenance_orders`, `arena_inventory`, `arena_staff`, `arena_staff_shifts` |
| 8 (IoT) | `arena_devices`, `arena_sensor_data`, `arena_video_replays` |
| 9 (Multi-unidade) | `arena_networks`, `arena_network_memberships` |
| 10 (White label) | (campos em `arena_settings` + `arenas.branding`) |
| 11 (AI) | (modelo treinado externamente + cache em `arena_settings.ai_cache`) |

## Regras de ouro

1. **Nenhuma coleção existente é renomeada ou removida**
2. **Todos campos novos são opcionais** (default Firestore)
3. **Doc id determinístico onde possível** (evita duplicação)
4. **Auditoria em toda escrita** (audit_logs)
5. **Soft delete** (campo `archived`, `archived_at`, `archived_by`) em vez de `deleteDoc()`
6. **LGPD**: dados sensíveis (telefone, email) são mascarados em listagens públicas
