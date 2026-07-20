import { describe, expect, it } from 'vitest';
import {
  PARTNER_INVITE_STATUS,
  buildPartnerInviteFields,
  canRespondToPartnerInvite,
  filterPartnerCandidates,
  findPendingPartnerInvites,
  partnerInviteBadge,
  publicProfileToPartnerFields,
  registrationHasPartnerInvite,
} from './partnerInvite.js';
import { COMPETITION_GENDER, REGISTRATION_STATUS } from './constants.js';

describe('buildPartnerInviteFields', () => {
  it('gera os campos do convite pendente', () => {
    expect(buildPartnerInviteFields('uid-b')).toEqual({
      partner_invite_uid: 'uid-b',
      partner_invite_status: PARTNER_INVITE_STATUS.PENDING,
      partner_invite_responded_at: null,
    });
  });

  it('retorna objeto vazio sem uid', () => {
    expect(buildPartnerInviteFields('')).toEqual({});
    expect(buildPartnerInviteFields(null)).toEqual({});
  });
});

describe('canRespondToPartnerInvite / findPendingPartnerInvites', () => {
  const invite = {
    status: REGISTRATION_STATUS.CONFIRMED,
    partner_invite_uid: 'uid-b',
    partner_invite_status: PARTNER_INVITE_STATUS.PENDING,
  };

  it('só o convidado responde, e apenas enquanto pendente', () => {
    expect(canRespondToPartnerInvite(invite, 'uid-b')).toBe(true);
    expect(canRespondToPartnerInvite(invite, 'uid-x')).toBe(false);
    expect(canRespondToPartnerInvite({ ...invite, partner_invite_status: PARTNER_INVITE_STATUS.ACCEPTED }, 'uid-b')).toBe(false);
  });

  it('inscrição cancelada não aceita resposta', () => {
    expect(canRespondToPartnerInvite({ ...invite, status: REGISTRATION_STATUS.CANCELLED }, 'uid-b')).toBe(false);
  });

  it('encontra os convites pendentes do usuário', () => {
    const list = [invite, { ...invite, partner_invite_uid: 'uid-x' }, {}];
    expect(findPendingPartnerInvites(list, 'uid-b')).toHaveLength(1);
    expect(findPendingPartnerInvites(list, null)).toHaveLength(0);
  });
});

describe('partnerInviteBadge / registrationHasPartnerInvite', () => {
  it('sem convite → null', () => {
    expect(partnerInviteBadge({})).toBeNull();
    expect(registrationHasPartnerInvite({})).toBe(false);
  });

  it('mapeia status para tom e rótulo', () => {
    const base = { partner_invite_uid: 'b' };
    expect(partnerInviteBadge({ ...base, partner_invite_status: 'pending' }).tone).toBe('amber');
    expect(partnerInviteBadge({ ...base, partner_invite_status: 'accepted' }).tone).toBe('green');
    expect(partnerInviteBadge({ ...base, partner_invite_status: 'declined' }).tone).toBe('red');
  });
});

describe('publicProfileToPartnerFields', () => {
  it('mapeia o perfil público para os campos do jogador B', () => {
    const fields = publicProfileToPartnerFields({
      uid: 'uid-b',
      platform_name: ' Maria Silva ',
      email: 'maria@x.com',
      leveling_level: '3.0',
      gender: COMPETITION_GENDER.FEMALE,
      photo_url: 'http://x/p.jpg',
    });
    expect(fields).toEqual({
      name: 'Maria Silva',
      email: 'maria@x.com',
      level: '3.0',
      competition_gender: COMPETITION_GENDER.FEMALE,
      user_id: 'uid-b',
      photo_url: 'http://x/p.jpg',
    });
  });

  it('ignora gênero fora das categorias competitivas e cai para level', () => {
    const fields = publicProfileToPartnerFields({ id: 'u2', level: '2.5', gender: 'other' });
    expect(fields.competition_gender).toBe('');
    expect(fields.level).toBe('2.5');
    expect(fields.user_id).toBe('u2');
    expect(fields.email).toBe('');
  });
});

describe('filterPartnerCandidates', () => {
  const profiles = [
    { uid: 'a', platform_name: 'João Souza', city: 'São Paulo' },
    { uid: 'b', platform_name: 'Maria Silva', city: 'Campinas' },
    { uid: 'c', platform_name: 'Pedro', city: 'Rio' },
  ];

  it('busca por nome sem acentos', () => {
    const out = filterPartnerCandidates(profiles, { term: 'joao' });
    expect(out.map((p) => p.uid)).toEqual(['a']);
  });

  it('busca por cidade', () => {
    const out = filterPartnerCandidates(profiles, { term: 'sao paulo' });
    expect(out.map((p) => p.uid)).toEqual(['a']);
  });

  it('exclui o próprio usuário e inscritos', () => {
    const out = filterPartnerCandidates(profiles, { selfUid: 'a', excludedUids: ['b'] });
    expect(out.map((p) => p.uid)).toEqual(['c']);
  });

  it('sem termo retorna todos os elegíveis', () => {
    expect(filterPartnerCandidates(profiles, {})).toHaveLength(3);
  });
});
