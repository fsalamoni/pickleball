import { describe, it, expect } from 'vitest';
import {
  resolveRegistrationContact, hasLegacyPublicEmail, buildContactPayload,
  buildProvisionalClaims, provisionalClaimId, emptyContact, normalizeEmail,
} from './registrationContact.js';

describe('resolveRegistrationContact', () => {
  it('usa a subcoleção privada quando ela existe', () => {
    const r = resolveRegistrationContact(
      { player_a_email: 'antigo@x.com' },
      { player_a_email: 'novo@x.com', player_a_email_lc: 'novo@x.com' },
    );
    expect(r.player_a_email).toBe('novo@x.com');
  });

  it('⭐ cai no campo público quando não há subcoleção (inscrição LEGADA)', () => {
    const r = resolveRegistrationContact(
      { player_a_email: 'legado@x.com', player_a_email_lc: 'legado@x.com' },
      null,
    );
    expect(r.player_a_email).toBe('legado@x.com');
    expect(r.player_a_email_lc).toBe('legado@x.com');
  });

  it('deriva o _lc quando só o e-mail veio', () => {
    const r = resolveRegistrationContact({}, { player_b_email: 'Maria@X.com' });
    expect(r.player_b_email_lc).toBe('maria@x.com');
  });

  it('nada em lugar nenhum devolve vazio, sem quebrar', () => {
    expect(resolveRegistrationContact(null, null)).toEqual(emptyContact());
    expect(resolveRegistrationContact(undefined, undefined)).toEqual(emptyContact());
  });

  it('privado vazio não apaga o legado', () => {
    const r = resolveRegistrationContact(
      { player_a_email: 'legado@x.com' },
      { player_a_email: '   ' },
    );
    expect(r.player_a_email).toBe('legado@x.com');
  });
});

describe('hasLegacyPublicEmail', () => {
  it('reconhece documento legado por qualquer um dos quatro campos', () => {
    expect(hasLegacyPublicEmail({ player_a_email: 'a@x.com' })).toBe(true);
    expect(hasLegacyPublicEmail({ player_b_email_lc: 'b@x.com' })).toBe(true);
  });
  it('documento já corrigido não é legado', () => {
    expect(hasLegacyPublicEmail({ player_a_name: 'Ana' })).toBe(false);
    expect(hasLegacyPublicEmail({ player_a_email: '', player_b_email: '' })).toBe(false);
    expect(hasLegacyPublicEmail(null)).toBe(false);
  });
});

describe('buildContactPayload', () => {
  it('normaliza e devolve SÓ os campos de contato', () => {
    const p = buildContactPayload({ playerAEmail: ' Ana@X.com ', playerBEmail: 'BB@x.com' });
    expect(p).toEqual({
      player_a_email: 'ana@x.com', player_a_email_lc: 'ana@x.com',
      player_b_email: 'bb@x.com', player_b_email_lc: 'bb@x.com',
    });
    // Nada de nome, nível, foto — o contato é só contato.
    expect(Object.keys(p)).toHaveLength(4);
  });
});

describe('buildProvisionalClaims', () => {
  const base = { registrationId: 'r1', tournamentId: 't1', modalityId: 'm1' };

  it('⭐ só cria entrada para slot PROVISÓRIO (com e-mail e sem conta)', () => {
    const c = buildProvisionalClaims({
      ...base,
      playerAEmail: 'a@x.com', playerAUserId: 'uid_a', // já tem conta → não precisa
      playerBEmail: 'b@x.com', playerBUserId: null,    // provisório → precisa
    });
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe('r1_b');
    expect(c[0].data).toMatchObject({
      email_lc: 'b@x.com', registration_id: 'r1', tournament_id: 't1',
      slot: 'b', claimed: false, claimed_by: null,
    });
  });

  it('os dois provisórios geram as duas entradas', () => {
    const c = buildProvisionalClaims({
      ...base, playerAEmail: 'A@x.com', playerBEmail: 'b@x.com',
    });
    expect(c.map((x) => x.id)).toEqual(['r1_a', 'r1_b']);
    expect(c[0].data.email_lc).toBe('a@x.com'); // normalizado
  });

  it('sem e-mail nenhum, nenhuma entrada', () => {
    expect(buildProvisionalClaims({ ...base })).toEqual([]);
    expect(buildProvisionalClaims({ ...base, playerAEmail: '  ' })).toEqual([]);
  });

  it('o id é o mesmo que a regra do Firestore calcula', () => {
    expect(provisionalClaimId('r1', 'a')).toBe('r1_a');
    expect(provisionalClaimId('r1', 'b')).toBe('r1_b');
  });
});

describe('normalizeEmail', () => {
  it('trim + minúsculas, tolerante a nulo', () => {
    expect(normalizeEmail('  Ana@X.com ')).toBe('ana@x.com');
    expect(normalizeEmail(null)).toBe('');
  });
});
