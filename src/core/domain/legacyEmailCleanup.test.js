import { describe, it, expect } from 'vitest';
import {
  deletionPreconditions,
  effectiveRegistrationContact,
  hasLegacyRegistrationPublicEmail,
  privateContactBackfillPatch,
  provisionalClaimsForLegacyRegistration,
  publicEmailDeletePatch,
  userEmailDeletePatch,
} from './legacyEmailCleanup.js';

describe('legacyEmailCleanup', () => {
  it('detecta e-mail público legado em qualquer um dos quatro campos', () => {
    expect(hasLegacyRegistrationPublicEmail({ player_a_email: 'a@x.com' })).toBe(true);
    expect(hasLegacyRegistrationPublicEmail({ player_b_email_lc: 'b@x.com' })).toBe(true);
    expect(hasLegacyRegistrationPublicEmail({ player_a_email: '' })).toBe(true);
    expect(hasLegacyRegistrationPublicEmail({ player_a_name: 'Ana' })).toBe(false);
  });

  it('monta contato efetivo com subcoleção privada vencendo o legado', () => {
    expect(effectiveRegistrationContact(
      { player_a_email: 'velho@x.com', player_b_email_lc: 'B@X.com' },
      { player_a_email: 'novo@x.com' },
    )).toMatchObject({
      player_a_email: 'novo@x.com',
      player_a_email_lc: 'novo@x.com',
      player_b_email: 'b@x.com',
      player_b_email_lc: 'b@x.com',
    });
  });

  it('backfill só preenche buracos do contato privado', () => {
    expect(privateContactBackfillPatch(
      { player_a_email: 'Legado@X.com', player_a_email_lc: 'legado@x.com' },
      { player_a_email: 'privado@x.com' },
    )).toEqual({ player_a_email_lc: 'privado@x.com' });
  });

  it('cria claims só para slots sem user_id', () => {
    const claims = provisionalClaimsForLegacyRegistration({
      id: 'r1', tournament_id: 't1', modality_id: 'm1',
      player_a_email_lc: 'a@x.com', player_a_user_id: 'uid-a',
      player_b_email_lc: 'b@x.com', player_b_user_id: '',
    });
    expect(claims).toEqual([{
      id: 'r1_b',
      data: {
        email_lc: 'b@x.com', registration_id: 'r1', tournament_id: 't1',
        modality_id: 'm1', slot: 'b', claimed: false, claimed_by: null,
      },
    }]);
  });

  it('bloqueia deleção se contato ou claim ainda faltam', () => {
    const reg = { id: 'r1', player_a_email_lc: 'a@x.com', player_a_user_id: '' };
    expect(deletionPreconditions(reg, {}, new Set())).toEqual({
      ok: false,
      missingContact: ['player_a_email', 'player_a_email_lc'],
      missingClaims: ['r1_a'],
    });
    expect(deletionPreconditions(
      reg,
      { player_a_email: 'a@x.com', player_a_email_lc: 'a@x.com' },
      new Set(['r1_a']),
    ).ok).toBe(true);
  });

  it('gera payloads de deleção somente para os campos permitidos', () => {
    const marker = Symbol('delete');
    expect(Object.keys(publicEmailDeletePatch(marker))).toEqual([
      'player_a_email', 'player_a_email_lc', 'player_b_email', 'player_b_email_lc',
    ]);
    expect(userEmailDeletePatch({ user_email: 'a@x.com', role: 'admin' }, marker)).toEqual({ user_email: marker });
    expect(userEmailDeletePatch({ user_name: 'Ana' }, marker)).toEqual({});
  });
});
