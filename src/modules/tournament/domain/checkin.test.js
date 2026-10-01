import { describe, expect, it } from 'vitest';
import {
  ACTIVE_REGISTRATION_STATUSES,
  canSelfCheckIn,
  hasCheckedIn,
  isActiveRegistration,
  selfCheckInState,
} from './checkin.js';
import { REGISTRATION_STATUS, TOURNAMENT_STATUS } from './constants.js';

const tournament = { status: TOURNAMENT_STATUS.IN_PROGRESS };
const registration = {
  status: REGISTRATION_STATUS.CONFIRMED,
  created_by: 'uid-a',
  player_a_user_id: 'uid-a',
};

describe('isActiveRegistration — o check-in nunca tira ninguém de nada', () => {
  it('⭐ confirmada e com check-in feito jogam igual', () => {
    expect(isActiveRegistration({ status: REGISTRATION_STATUS.CONFIRMED })).toBe(true);
    expect(isActiveRegistration({ status: REGISTRATION_STATUS.CHECKED_IN })).toBe(true);
  });

  it('pendente, espera, cancelada e desistência não jogam', () => {
    [
      REGISTRATION_STATUS.PENDING_PAYMENT,
      REGISTRATION_STATUS.WAITLIST,
      REGISTRATION_STATUS.CANCELLED,
      REGISTRATION_STATUS.WITHDRAWN,
      undefined,
    ].forEach((status) => expect(isActiveRegistration({ status })).toBe(false));
    expect(isActiveRegistration(null)).toBe(false);
  });

  it('a lista é a dos dois status, congelada', () => {
    expect(ACTIVE_REGISTRATION_STATUSES).toEqual(['confirmed', 'checked_in']);
    expect(Object.isFrozen(ACTIVE_REGISTRATION_STATUSES)).toBe(true);
  });
});

describe('canSelfCheckIn', () => {
  it('permite a quem criou a inscrição, com torneio em andamento e inscrição confirmada', () => {
    expect(canSelfCheckIn({ tournament, registration, uid: 'uid-a' })).toBe(true);
  });

  it('⭐ inscrito por OUTRA pessoa: não oferece (a regra do banco recusaria)', () => {
    const pelaOrganizacao = { ...registration, created_by: 'organizadora', player_a_user_id: 'uid-a' };
    expect(canSelfCheckIn({ tournament, registration: pelaOrganizacao, uid: 'uid-a' })).toBe(false);
    expect(selfCheckInState({ tournament, registration: pelaOrganizacao, uid: 'uid-a' }))
      .toEqual({ pode: false, motivo: 'outra_pessoa' });
    const pelaDupla = { ...registration, player_b_user_id: 'uid-b' };
    expect(selfCheckInState({ tournament, registration: pelaDupla, uid: 'uid-b' }))
      .toEqual({ pode: false, motivo: 'outra_pessoa' });
  });

  it('bloqueia quem não é da inscrição', () => {
    expect(canSelfCheckIn({ tournament, registration, uid: 'uid-z' })).toBe(false);
    expect(selfCheckInState({ tournament, registration, uid: 'uid-z' }).motivo).toBe('nao_e_minha');
  });

  it('exige torneio em andamento', () => {
    const aberto = { status: TOURNAMENT_STATUS.REGISTRATIONS_OPEN };
    expect(canSelfCheckIn({ tournament: aberto, registration, uid: 'uid-a' })).toBe(false);
    expect(selfCheckInState({ tournament: aberto, registration, uid: 'uid-a' }).motivo).toBe('fora_do_dia');
  });

  it('exige inscrição confirmada (sem check-in prévio, sem pendência)', () => {
    const feito = { ...registration, status: REGISTRATION_STATUS.CHECKED_IN };
    expect(canSelfCheckIn({ tournament, registration: feito, uid: 'uid-a' })).toBe(false);
    expect(selfCheckInState({ tournament, registration: feito, uid: 'uid-a' }).motivo).toBe('feito');
    const pendente = { ...registration, status: REGISTRATION_STATUS.PENDING_PAYMENT };
    expect(canSelfCheckIn({ tournament, registration: pendente, uid: 'uid-a' })).toBe(false);
    expect(selfCheckInState({ tournament, registration: pendente, uid: 'uid-a' }).motivo).toBe('nao_confirmada');
  });

  it('entradas ausentes → false', () => {
    expect(canSelfCheckIn({})).toBe(false);
    expect(canSelfCheckIn()).toBe(false);
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
