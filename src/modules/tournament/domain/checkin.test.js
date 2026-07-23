import { describe, expect, it } from 'vitest';
import { canSelfCheckIn, hasCheckedIn } from './checkin.js';
import { REGISTRATION_STATUS, TOURNAMENT_STATUS } from './constants.js';

const tournament = { status: TOURNAMENT_STATUS.IN_PROGRESS };
const registration = {
  status: REGISTRATION_STATUS.CONFIRMED,
  created_by: 'uid-a',
  player_a_user_id: 'uid-a',
};

describe('canSelfCheckIn', () => {
  it('permite ao criador/jogador A com torneio em andamento e inscrição confirmada', () => {
    expect(canSelfCheckIn({ tournament, registration, uid: 'uid-a' })).toBe(true);
    expect(canSelfCheckIn({ tournament, registration: { ...registration, created_by: 'x', player_a_user_id: 'uid-a' }, uid: 'uid-a' })).toBe(true);
  });

  it('bloqueia quem não é o dono da inscrição', () => {
    expect(canSelfCheckIn({ tournament, registration, uid: 'uid-b' })).toBe(false);
  });

  it('exige torneio em andamento', () => {
    expect(canSelfCheckIn({ tournament: { status: TOURNAMENT_STATUS.REGISTRATIONS_OPEN }, registration, uid: 'uid-a' })).toBe(false);
  });

  it('exige inscrição confirmada (sem check-in prévio, sem pendência)', () => {
    expect(canSelfCheckIn({ tournament, registration: { ...registration, status: REGISTRATION_STATUS.CHECKED_IN }, uid: 'uid-a' })).toBe(false);
    expect(canSelfCheckIn({ tournament, registration: { ...registration, status: REGISTRATION_STATUS.PENDING_PAYMENT }, uid: 'uid-a' })).toBe(false);
  });

  it('entradas ausentes → false', () => {
    expect(canSelfCheckIn({})).toBe(false);
    expect(canSelfCheckIn({ tournament, registration })).toBe(false);
  });
});

describe('hasCheckedIn', () => {
  it('reconhece o status de check-in', () => {
    expect(hasCheckedIn({ status: REGISTRATION_STATUS.CHECKED_IN })).toBe(true);
    expect(hasCheckedIn(registration)).toBe(false);
    expect(hasCheckedIn(null)).toBe(false);
  });
});
