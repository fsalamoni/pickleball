import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  WAITLIST_STATUS,
  DEFAULT_PROMOTION_WINDOW_MINUTES,
  getNextInLine,
  isPromotionExpired,
  getNextPosition,
  compactPositions,
  canJoinWaitlist,
  buildAcceptPromotionAction,
  buildDeclinePromotionAction,
  computePromotionExpiresAt,
} from './waitlist.js';

const now = new Date('2026-07-15T10:00:00Z').getTime();

describe('WAITLIST_STATUS', () => {
  it('tem todos os estados esperados', () => {
    expect(WAITLIST_STATUS.WAITING).toBe('waiting');
    expect(WAITLIST_STATUS.NOTIFIED).toBe('notified');
    expect(WAITLIST_STATUS.ACCEPTED).toBe('accepted');
    expect(WAITLIST_STATUS.DECLINED).toBe('declined');
    expect(WAITLIST_STATUS.EXPIRED).toBe('expired');
    expect(WAITLIST_STATUS.CANCELLED).toBe('cancelled');
  });
});

describe('getNextInLine', () => {
  it('retorna primeiro waiting com menor position', () => {
    const list = [
      { position: 2, status: 'waiting' },
      { position: 1, status: 'waiting' },
      { position: 3, status: 'notified' },
    ];
    expect(getNextInLine(list).position).toBe(1);
  });
  it('ignora quem não está waiting', () => {
    const list = [
      { position: 1, status: 'declined' },
      { position: 2, status: 'waiting' },
    ];
    expect(getNextInLine(list).position).toBe(2);
  });
  it('retorna null para lista vazia', () => {
    expect(getNextInLine([])).toBeNull();
    expect(getNextInLine(null)).toBeNull();
  });
});

describe('isPromotionExpired', () => {
  it('false se status não é notified', () => {
    const item = { status: 'waiting', notification_expires_at: now - 1000 };
    expect(isPromotionExpired(item, now)).toBe(false);
  });
  it('true se expirou', () => {
    const item = { status: 'notified', notification_expires_at: now - 1000 };
    expect(isPromotionExpired(item, now)).toBe(true);
  });
  it('false se ainda dentro do prazo', () => {
    const item = { status: 'notified', notification_expires_at: now + 60_000 };
    expect(isPromotionExpired(item, now)).toBe(false);
  });
  it('usa notified_at + window se não tem expires direto', () => {
    const item = {
      status: 'notified',
      notified_at: now - 6 * 60_000,
      window_minutes: 5,
    };
    expect(isPromotionExpired(item, now)).toBe(true);
  });
});

describe('getNextPosition', () => {
  it('retorna 1 para lista vazia', () => {
    expect(getNextPosition([])).toBe(1);
  });
  it('retorna max + 1', () => {
    const list = [{ position: 3 }, { position: 1 }, { position: 2 }];
    expect(getNextPosition(list)).toBe(4);
  });
});

describe('compactPositions', () => {
  it('renumera 1, 2, 3 após remoções', () => {
    const list = [
      { position: 5, status: 'waiting' },
      { position: 1, status: 'waiting' },
      { position: 8, status: 'waiting' },
    ];
    const out = compactPositions(list);
    expect(out.map((w) => w.position)).toEqual([1, 2, 3]);
  });
  it('só conta quem está waiting', () => {
    const list = [
      { position: 1, status: 'declined' },
      { position: 5, status: 'waiting' },
    ];
    const out = compactPositions(list);
    expect(out.length).toBe(1);
    expect(out[0].position).toBe(1);
  });
});

describe('canJoinWaitlist', () => {
  it('rejeita sem user', () => {
    expect(canJoinWaitlist({}, null, null).ok).toBe(false);
  });
  it('permite se não tem entrada prévia', () => {
    const r = canJoinWaitlist({}, { uid: 'u1' }, null);
    expect(r.ok).toBe(true);
  });
  it('rejeita se já está na fila waiting', () => {
    const existing = { status: 'waiting' };
    expect(canJoinWaitlist({}, { uid: 'u1' }, existing).ok).toBe(false);
  });
  it('permite se entrada anterior foi declined/expired/cancelled', () => {
    expect(canJoinWaitlist({}, { uid: 'u1' }, { status: 'declined' }).ok).toBe(true);
    expect(canJoinWaitlist({}, { uid: 'u1' }, { status: 'expired' }).ok).toBe(true);
    expect(canJoinWaitlist({}, { uid: 'u1' }, { status: 'cancelled' }).ok).toBe(true);
  });
});

describe('buildAcceptPromotionAction', () => {
  it('retorna action para user correto', () => {
    const item = { status: 'notified', athlete_id: 'u1' };
    const out = buildAcceptPromotionAction(item, { uid: 'u1' });
    expect(out.type).toBe('accept');
    expect(out.item.status).toBe('accepted');
  });
  it('retorna null para user errado', () => {
    const item = { status: 'notified', athlete_id: 'u1' };
    expect(buildAcceptPromotionAction(item, { uid: 'u2' })).toBeNull();
  });
  it('retorna null se não está notified', () => {
    const item = { status: 'waiting', athlete_id: 'u1' };
    expect(buildAcceptPromotionAction(item, { uid: 'u1' })).toBeNull();
  });
});

describe('buildDeclinePromotionAction', () => {
  it('retorna action para user correto', () => {
    const item = { status: 'notified', athlete_id: 'u1' };
    const out = buildDeclinePromotionAction(item, { uid: 'u1' });
    expect(out.type).toBe('decline');
    expect(out.item.status).toBe('declined');
  });
});

describe('computePromotionExpiresAt', () => {
  it('calcula notified + window', () => {
    const notified = new Date('2026-07-15T10:00:00Z').getTime();
    const expires = computePromotionExpiresAt(notified, 5);
    expect(expires).toBe(notified + 5 * 60_000);
  });
  it('a janela padrão é a MESMA do servidor (60 min) — antes o cliente dizia 5', () => {
    expect(DEFAULT_PROMOTION_WINDOW_MINUTES).toBe(60);
  });
  it('retorna null para input inválido', () => {
    expect(computePromotionExpiresAt(null)).toBeNull();
    expect(computePromotionExpiresAt('xxx')).toBeNull();
  });
});

/**
 * ⭐ 🐞 A chamada como o SERVIDOR a grava.
 *
 * `promoverProximo` (functions/openSlotWaitlist.js) grava
 * `notification_expires_at: Timestamp.fromMillis(...)`. O cliente lia com
 * `Number(x)`, que num Timestamp dá segundos desde o ano 1: toda chamada
 * "vencia" ao chegar, e "Aceitar" respondia "Promoção expirou" para todo mundo.
 * Os testes acima montam o prazo com número — o que ninguém grava.
 */
describe('⭐ a chamada da fila como o banco devolve', () => {
  const agora = Date.now();
  const chamada = (prazoMs) => ({
    athlete_id: 'u1', status: WAITLIST_STATUS.NOTIFIED,
    notified_at: Timestamp.fromMillis(agora),
    notification_expires_at: Timestamp.fromMillis(prazoMs),
  });

  it('⭐ dentro do prazo NÃO está vencida', () => {
    expect(isPromotionExpired(chamada(agora + 60 * 60_000), agora)).toBe(false);
  });

  it('⭐ e dá para aceitar', () => {
    expect(buildAcceptPromotionAction(chamada(agora + 60 * 60_000), { uid: 'u1' })).not.toBeNull();
  });

  it('passado o prazo, vence', () => {
    expect(isPromotionExpired(chamada(agora - 1000), agora)).toBe(true);
  });

  it('sem prazo gravado, vale o avisado + a janela', () => {
    const item = { status: WAITLIST_STATUS.NOTIFIED, notified_at: Timestamp.fromMillis(agora), window_minutes: 30 };
    expect(isPromotionExpired(item, agora + 29 * 60_000)).toBe(false);
    expect(isPromotionExpired(item, agora + 31 * 60_000)).toBe(true);
  });
});
