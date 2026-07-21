/**
 * Domínio: Settings por arena (Arena V3).
 *
 * Configurações operacionais, de pagamento, branding, visibilidade.
 * PURO — sem I/O. Funções testáveis.
 */

export const DEFAULT_ARENA_SETTINGS = Object.freeze({
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
    require_prepayment: false,
  },
  notifications: {
    send_booking_confirmation: true,
    send_booking_reminder_hours_before: 2,
    send_booking_reminder_channels: ['push', 'email'],
    send_cancellation_notice: true,
    send_review_request_hours_after: 3,
    send_nps_request_days_after: 7,
  },
  payments: {
    accepted_methods: ['pix', 'credit_card', 'cash'],
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
    show_open_match: true,
    show_classes: true,
    show_leagues: true,
    show_pdv: true,
  },
  branding: {
    primary_color: '#10b981',
    accent_color: '#fbbf24',
    logo_url: '',
    cover_image_url: '',
    font_family: 'Inter',
    theme: 'auto',
  },
});

/**
 * Deep merge simples (apenas 2 níveis).
 * Substitui objetos inteiros (não é recursivo profundo).
 * @param {Object} defaults
 * @param {Object} input
 * @returns {Object}
 */
function shallowDeepMerge(defaults, input) {
  if (!input) return { ...defaults };
  const out = { ...defaults };
  Object.keys(input).forEach((key) => {
    const dv = defaults[key];
    const iv = input[key];
    if (
      dv && typeof dv === 'object' && !Array.isArray(dv) &&
      iv && typeof iv === 'object' && !Array.isArray(iv)
    ) {
      out[key] = { ...dv, ...iv };
    } else if (iv !== undefined) {
      out[key] = iv;
    }
  });
  return out;
}

/**
 * Normaliza e valida settings de arena.
 * Aceita input parcial; preenche com defaults onde faltar.
 * Remove campos inválidos ou perigosos.
 *
 * @param {Object} input
 * @returns {{
 *   valid: boolean,
 *   errors: Object<string,string>,
 *   value: Object
 * }}
 */
export function normalizeArenaSettings(input = {}) {
  const errors = {};
  const value = shallowDeepMerge(DEFAULT_ARENA_SETTINGS, input);

  // Validações específicas
  const op = value.operational;
  if (op.booking_window_days < 0 || op.booking_window_days > 365) {
    errors['operational.booking_window_days'] = 'Deve ser entre 0 e 365.';
  }
  if (op.min_booking_lead_minutes < 0 || op.min_booking_lead_minutes > 1440) {
    errors['operational.min_booking_lead_minutes'] = 'Deve ser entre 0 e 1440 (24h).';
  }
  if (op.cancellation_window_hours < 0 || op.cancellation_window_hours > 168) {
    errors['operational.cancellation_window_hours'] = 'Deve ser entre 0 e 168 (1 semana).';
  }
  if (op.cancellation_refund_pct < 0 || op.cancellation_refund_pct > 100) {
    errors['operational.cancellation_refund_pct'] = 'Deve ser entre 0 e 100.';
  }
  if (op.no_show_fee_pct < 0 || op.no_show_fee_pct > 100) {
    errors['operational.no_show_fee_pct'] = 'Deve ser entre 0 e 100.';
  }
  if (op.default_slot_duration_minutes < 15 || op.default_slot_duration_minutes > 480) {
    errors['operational.default_slot_duration_minutes'] = 'Deve ser entre 15 e 480 min (8h).';
  }
  if (op.buffer_between_bookings_minutes < 0 || op.buffer_between_bookings_minutes > 120) {
    errors['operational.buffer_between_bookings_minutes'] = 'Deve ser entre 0 e 120.';
  }

  // Validação de branding colors (hex simples)
  const br = value.branding;
  if (br.primary_color && !/^#[0-9a-fA-F]{6}$/.test(br.primary_color)) {
    errors['branding.primary_color'] = 'Cor inválida (use #RRGGBB).';
  }
  if (br.accent_color && !/^#[0-9a-fA-F]{6}$/.test(br.accent_color)) {
    errors['branding.accent_color'] = 'Cor inválida (use #RRGGBB).';
  }

  // Validação de payments
  const pay = value.payments;
  const validMethods = ['pix', 'credit_card', 'debit_card', 'cash', 'wallet', 'bank_transfer'];
  pay.accepted_methods = (pay.accepted_methods || []).filter((m) => validMethods.includes(m));
  if (pay.max_split_players < 1 || pay.max_split_players > 10) {
    errors['payments.max_split_players'] = 'Deve ser entre 1 e 10.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value,
  };
}

/**
 * Verifica se uma seção é visível publicamente (no `/arenas/:id`).
 * @param {Object} settings
 * @param {string} section - ex: 'pricing', 'reviews', 'contact'
 * @returns {boolean}
 */
export function isVisibleToPublic(settings, section) {
  if (!settings?.visibility) return true;
  const key = `show_${section}`;
  if (settings.visibility[key] === false) return false;
  return true;
}

/**
 * Verifica se um slot de booking pode ser reservado respeitando settings.
 * @param {Object} args
 * @param {Object} args.settings - settings da arena (já normalizado)
 * @param {Date|number} args.slotStart - início do slot
 * @param {Date|number} args.now - agora (para testabilidade)
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canBookSlot({ settings, slotStart, now = Date.now() }) {
  const op = settings?.operational;
  if (!op) return { ok: true };

  const startMs = slotStart instanceof Date ? slotStart.getTime() : Number(slotStart);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (!Number.isFinite(startMs) || startMs < nowMs) {
    return { ok: false, reason: 'Horário passado.' };
  }

  const minutesAhead = (startMs - nowMs) / 60_000;
  if (minutesAhead < op.min_booking_lead_minutes) {
    return { ok: false, reason: `Antecedência mínima de ${op.min_booking_lead_minutes} min não respeitada.` };
  }

  const daysAhead = (startMs - nowMs) / 86_400_000;
  if (daysAhead > op.booking_window_days) {
    return { ok: false, reason: `Janela de reserva de ${op.booking_window_days} dias excedida.` };
  }

  return { ok: true };
}

/**
 * Calcula o reembolso por cancelamento.
 * @param {Object} args
 * @param {Object} args.settings
 * @param {Date|number} args.slotStart
 * @param {Date|number} args.cancelAt
 * @param {number} args.paidAmount
 * @param {Date|number} [args.now] - para testabilidade
 * @returns {{ refundAmount: number, feeAmount: number, refundPct: number }}
 */
export function calculateCancellationRefund({ settings, slotStart, cancelAt, paidAmount, now = Date.now() }) {
  const op = settings?.operational || {};
  const startMs = slotStart instanceof Date ? slotStart.getTime() : Number(slotStart);
  const cancelMs = cancelAt instanceof Date ? cancelAt.getTime() : Number(cancelAt);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  const useCancelTime = Number.isFinite(cancelMs) ? cancelMs : nowMs;
  const hoursAhead = (startMs - useCancelTime) / 3_600_000;

  let refundPct;
  if (hoursAhead >= op.cancellation_window_hours) {
    refundPct = op.cancellation_refund_pct;
  } else {
    refundPct = 0;
  }

  const refundAmount = Math.round((paidAmount * refundPct / 100) * 100) / 100;
  const feeAmount = paidAmount - refundAmount;
  return { refundAmount, feeAmount, refundPct };
}

/**
 * Lista os canais de notificação ativos.
 */
export function getActiveNotificationChannels(settings) {
  const channels = settings?.notifications?.send_booking_reminder_channels || [];
  return Array.isArray(channels) ? channels : [];
}

/**
 * Mescla settings novos com antigos, preservando campos não tocados.
 * @param {Object} oldSettings
 * @param {Object} newInput
 * @returns {Object}
 */
export function mergeSettings(oldSettings = {}, newInput = {}) {
  return shallowDeepMerge(oldSettings, newInput);
}
